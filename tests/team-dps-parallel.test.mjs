import test from 'node:test';
import assert from 'node:assert/strict';
import {runTeamDpsWorkers} from '../src/wasm/team-dps-task.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {sample,builds,gear} from '../beta-tools/team-dps-full-audit.mjs';
import {compareTeamResults} from './helpers/team-dps-result-comparison.mjs';
import {weapon} from '../beta-tools/interface-audit-7108.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {createTeamDpsScorePool} from '../src/workers/team-dps-score-pool.mjs';
import {FakeTeamWorker as Worker,simpleTeamModel} from './helpers/team-dps-fake-worker.mjs';

test('parallel: real scoring workers keep full serial output and candidate order',async()=>{
 const input=sample();input.team_dps.max_evaluations=24;
 const artifacts=builds(input).flat(),saved=structuredClone({input,artifacts});
 const serial=await nodeTeamDps(input,artifacts,{threads:1}),updates=[];
 const parallel=await nodeTeamDps(input,artifacts,{threads:4,onProgress:p=>updates.push(p)});
 compareTeamResults(parallel,serial);assert.deepEqual({input,artifacts},saved);
 assert.equal(updates.at(-1).evaluated_teams,24);assert.equal(updates.at(-1).phase,'complete');
 for(let i=1;i<updates.length;i++)assert.ok(updates[i].evaluated_teams>=updates[i-1].evaluated_teams);
});

test('parallel: exact 576 assignments, set/converted ER limits and critical top K',async()=>{
 const x=sample(),mains=[['ATKPercentage','HPPercentage','Recharge','ElementalMastery'],['CryoBonus','HydroBonus','ATKPercentage','HPPercentage'],['CriticalRate','CriticalDamage','HealingBonus','HPPercentage']];
 for(let r=0;r<4;r++){
  const p=x.single_interfaces[r];p.artifacts=gear(r,['GladiatorsFinale','EmblemOfSeveredFate','OceanHuedClam','SongOfDaysPast'][r]);
  p.weapon=weapon(['ToukabouShigure','XiphosMoonlight','CrescentPike','FlowingPurity'][r]);
  for(let k=2;k<5;k++)p.artifacts[k].main_stat=[mains[k-2][r],.2];
  p.artifacts[0].sub_stats.push(['ElementalMastery',r*100]);
  p.filter=Object.fromEntries(['sand_main_stat','goblet_main_stat','head_main_stat'].map((key,k)=>[key,[mains[k][r]]]));
 }
 x.single_interfaces[2].character.constellation=1;
 x.single_interfaces[2].constraint.set_mode={Set4:'OceanHuedClam'};
 const initial=createTeamDpsEvaluator(api,x).evaluate(builds(x));
 x.single_interfaces[2].constraint.recharge_min=sum(initial.panels[2].recharge)+.005;
 Object.assign(x.team_dps,{initial_ids:builds(x).map(b=>b.map(a=>a.id)),max_evaluations:65536,result_count:5,metric:'critical',enemy_count:3,damage_scope:'all'});
 const inventory=builds(x).flat(),saved=structuredClone({x,inventory});
 const serial=await nodeTeamDps(x,inventory,{threads:1}),parallel=await nodeTeamDps(x,inventory,{threads:4});
 compareTeamResults(parallel,serial);
 assert.equal(parallel.search_complete,true);assert.equal(parallel.evaluated_teams,13);assert.equal(parallel.legal_teams,12);assert.equal(parallel.results.length,5);
 const oracle=[],evaluator=createTeamDpsEvaluator(api,x);
 function* perm(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*perm(a.filter((_,j)=>j!==i),[...p,a[i]]);}
 for(const f of perm(inventory.filter(a=>a.slot==='Flower')))for(const g of perm(inventory.filter(a=>a.slot==='Feather'))){
  const team=builds(x).map((b,r)=>[f[r],g[r],...b.slice(2)]);
  if(team[2].filter(a=>a.set_name==='OceanHuedClam').length<4||sum(evaluator.constraints(2,team).recharge)<x.single_interfaces[2].constraint.recharge_min)continue;
  oracle.push(evaluator.evaluate(team).critical);
 }
 assert.equal(oracle.length,12);oracle.sort((a,b)=>b-a);
 for(let i=0;i<5;i++){
  assert.ok(Math.abs(parallel.results[i].critical-oracle[i])<1e-6);
  assert.equal(new Set(parallel.results[i].artifacts.flatMap(Object.values)).size,20);
 }
 assert.deepEqual({x,inventory},saved);
});

test('parallel: C2 health and Widsith branches preserve non-critical ranking',async()=>{
 const x=sample();x.single_interfaces[1].character.constellation=2;
 x.single_interfaces[3].weapon=weapon('TheWidsith');
 Object.assign(x.team_dps,{max_evaluations:24,metric:'non_critical',result_count:7});
 const inventory=builds(x).flat();
 const serial=await nodeTeamDps(x,inventory,{threads:1}),parallel=await nodeTeamDps(x,inventory,{threads:4});
 compareTeamResults(parallel,serial);
 assert.equal(parallel.results.length,7);const health=parallel.results[0].eventTrace.events.filter(e=>e.channel==='health');assert.equal(new Set(health.map(e=>e.branch)).size,3);assert.ok(health.length>0);assert.ok(health.every(e=>Math.abs(e.probability-1/3)<1e-12));
});

function setup(options={}){
 const coordinator=new Worker(),scorers=Array.from({length:4},()=>new Worker());
 const result=runTeamDpsWorkers(coordinator,scorers,{team_dps:{}},[],{mode:'optimize',...options});
 return {coordinator,scorers,result,all:[coordinator,...scorers]};
}
test('parallel lifecycle: ordered merge, startup cancellation, scorer error and late responses',async()=>{
 const updates=[],a=setup({onProgress:p=>updates.push(p)});
 a.coordinator.emit({type:'ready'});assert.equal(a.coordinator.sent.length,0);for(const w of a.scorers)w.emit({type:'ready'});
 const start=a.coordinator.sent[0];assert.equal(start.parallelism,4);assert.equal(start.ports.length,4);
 const ports=a.scorers.map(w=>w.sent[0].port),requests=ports.map(port=>new Promise(resolve=>{port.onmessage=({data})=>{if(data.type==='initialize')port.postMessage({type:'initialized'});else if(data.type==='score')resolve(data);};port.start();})),pool=createTeamDpsScorePool(start.ports,simpleTeamModel,[]);
 const scores=pool.score([[1],[2],[3],[4]]);await Promise.all(requests);
 for(const i of [3,1,0,2])ports[i].postMessage({type:'scored',results:[{value:i}]});
 assert.deepEqual(await scores,[{value:0},{value:1},{value:2},{value:3}]);assert.equal(a.coordinator.sent.length,1);pool.dispose();
 a.coordinator.emit({type:'compiled',compile_ms:12});a.coordinator.emit({type:'progress',data:{evaluated_teams:4,elapsed_ms:8}});
 const late=a.coordinator.onmessage;a.coordinator.emit({type:'result',data:{results:[7],elapsed_ms:10}});
 assert.deepEqual(await a.result,{results:[7],elapsed_ms:22,compile_ms:12,compute_backend:'cpu'});late({data:{type:'progress',data:{evaluated_teams:99}}});
 assert.equal(updates.length,1);for(const w of a.all){assert.ok(w.terminated);assert.equal(w.onmessage,null);}
 for(const phase of ['startup','scoring']){
  const controller=new AbortController(),b=setup({signal:controller.signal});
  if(phase==='scoring'){
   for(const w of b.scorers)w.emit({type:'ready'});b.coordinator.emit({type:'ready'});b.coordinator.emit({type:'compiled',compile_ms:1});
  }
  controller.abort();await assert.rejects(b.result,{name:'AbortError'});assert.ok(b.all.every(w=>w.terminated));
 }
 const controller=new AbortController();controller.abort();const pre=setup({signal:controller.signal});
 await assert.rejects(pre.result,{name:'AbortError'});assert.ok(pre.all.every(w=>w.terminated));
 const c=setup();c.scorers[2].emit({type:'error',message:'scorer failed',stack:'actual scoring stack'});
 await assert.rejects(c.result,e=>e.message==='scorer failed'&&e.stack==='actual scoring stack');assert.ok(c.all.every(w=>w.terminated));
 const d=setup();d.scorers[0].onerror({message:'runtime failed'});await assert.rejects(d.result,/runtime failed/);assert.ok(d.all.every(w=>w.terminated));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {createTeamDpsEvaluator,prepareTeamDpsPlan} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression,createTeamDpsScoreModel} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {withTeamDpsEventTrace} from '../beta-data/team-dps-event-trace.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {packTeamDpsResult} from '../beta-data/team-dps-result-view.mjs';
import {runTeamDpsWorkers} from '../src/wasm/team-dps-task.mjs';
import {FakeTeamWorker} from './helpers/team-dps-fake-worker.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {compareEventValues,compareTeamResults} from './helpers/team-dps-result-comparison.mjs';
import {effectInput} from './helpers/team-effect-refactor.mjs';
import {escoffierSkillTeams} from './helpers/team-escoffier-skill.mjs';
import {qiqiInput,qiqiTeams,qiqiAction,qiqiEnd} from './helpers/team-qiqi-fixture.mjs';
import {vodyInput,vodyTeams} from './helpers/team-vodyanitsa-fixture.mjs';

// Fixture imports load the legacy bindings; bind the instrumented runtime last.
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url)));
const resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
function compareScore(a,b){
 for(const key of ['expectation','critical','non_critical','fanfare','furina_overflow','duration','dps'])close(a[key],b[key]);
 for(let r=0;r<4;r++){
  for(const key of ['expectation','critical','non_critical'])close(a.character_damage[r][key],b.character_damage[r][key]);
  for(const key of Object.keys(a.panels[r]))close(Object.values(a.panels[r][key]).reduce((a,b)=>a+b,0),Object.values(b.panels[r][key]).reduce((a,b)=>a+b,0));
 }
}
function freeze(value,seen=new Set()){
 if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
 for(const child of Object.values(value))freeze(child,seen);Object.freeze(value);
}

test('single evaluation uses exact compiled details without a scoring pool and preserves cancellation and errors',async()=>{
 const messages=[],self={postMessage:m=>messages.push(m)},result={results:[{expectation:42}],elapsed_ms:0};
 const source=fs.readFileSync(new URL('../src/workers/team_dps.js',import.meta.url),'utf8').replace(/^import .*$/mg,'').replace("import('../wasm/team-dps-native-api.mjs')",'Promise.resolve(api)');
 const unused=()=>{throw Error('single evaluation must not create a scoring pool');};
 let fail=false,disposed=0;
 vm.runInNewContext(source,{self,api:{},performance,Promise,prepareTeamDpsPlan:()=>({}),createTeamDpsEvaluator:unused,compileTeamDpsModel:()=>({}),createTeamDpsComputation:()=>({score:async(_teams,options)=>{assert.equal(options.detail,true);if(fail)throw Error('compiled detail failed');return result;},dispose:()=>disposed++}),createTeamDpsScorePool:unused});
 const request={mode:'evaluate',input:{team_dps:{initial_ids:[[1,2,3,4,5]]}},artifacts:[],ports:[]};
 await Promise.resolve();await self.onmessage({data:request});
 assert.equal(messages.at(-1).type,'result');assert.equal(messages.at(-1).data.results[0].expectation,42);assert.ok(messages.some(m=>m.type==='compiled'));assert.equal(disposed,1);
 fail=true;await self.onmessage({data:request});assert.match(messages.at(-1).message,/compiled detail failed/);assert.ok(messages.at(-1).stack);assert.equal(disposed,2);

 const workers=[];class Worker extends FakeTeamWorker{constructor(){super();workers.push(this);}}
 const bridge=fs.readFileSync(new URL('../src/wasm/team_dps.js',import.meta.url),'utf8').replace(/^import .*$/mg,'').replace('export function teamDps','function teamDps').replaceAll(/new URL\([^\n]+?import.meta.url\)/g,"'worker'");
 const run=vm.runInNewContext(bridge+'\nteamDps',{Worker,runTeamDpsWorkers,navigator:{hardwareConcurrency:8}});
 const input={team_dps:{}},done=run(input,[],{mode:'evaluate'});assert.equal(workers.length,1);workers[0].emit({type:'ready'});
 assert.equal(workers[0].sent[0].ports.length,0);workers[0].emit({type:'result',data:result});assert.equal((await done).compile_ms,0);assert.ok(workers[0].terminated);
 for(const started of [false,true]){const controller=new AbortController(),pending=run(input,[],{mode:'evaluate',signal:controller.signal}),worker=workers.at(-1);if(started)worker.emit({type:'ready'});controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.ok(worker.terminated);}
 const failed=run(input,[],{mode:'evaluate'});workers.at(-1).emit({type:'error',message:'real failure',stack:'real stack'});await assert.rejects(failed,e=>e.message==='real failure'&&e.stack==='real stack');
});

test('shared immutable plans preserve candidate states and score-only compilation matches full observations',async()=>{
 const random=qiqiInput(4,[qiqiAction('qf',2,'burst',0),qiqiAction('n1',0,'normal.1',1),qiqiAction('n2',0,'normal.1',2),qiqiAction('yn',1,'normal.1',3),qiqiEnd(4)]);random.team_dps.enemy_count=1;
 const cases=[['effects',effectInput(),escoffierSkillTeams],['random-health',random,qiqiTeams],['water-health',vodyInput(),vodyTeams]],gpuCases=[];
 for(const [name,input,makeTeams]of cases){
  const [a,b]=makeTeams(input),builds=[a,b,a],artifacts=[...a.flat(),...b.flat()],ids=builds.map(t=>t.map(b=>b.map(a=>a.id)));input.team_dps.initial_ids=ids[0];
  let prepared=0;const plan=prepareTeamDpsPlan(input,{compileRotation:(...args)=>{prepared++;return compileActionAxis(...args);}});freeze(plan);
  const factory=(api,input,execution={})=>createTeamDpsEvaluator(api,input,{...execution,plan});
  const evaluator=factory(api,input),scalarStart=performance.now(),native=builds.map(team=>withTeamDpsEventTrace(evaluator.evaluate(team,true))),scalarMs=performance.now()-scalarStart;
  const fullStart=performance.now(),full=compileTeamDpsExpression(api,input,artifacts,resources,factory,{trace:true}),fullMs=performance.now()-fullStart;
  const scoreStart=performance.now(),model=createTeamDpsScoreModel(compileTeamDpsExpression(api,input,artifacts,resources,factory)),scoreMs=performance.now()-scoreStart;
  assert.equal(prepared,1);assert.equal(model.eventTrace,undefined);assert.ok(model.program.nodes.length<=full.program.nodes.length);
  const detail=createTeamDpsComputation(full,artifacts),scoring=createTeamDpsComputation(model,artifacts);
  try{
   const oldStart=performance.now(),old=(await detail.score(ids,{detail:true})).results,fullEvaluateMs=performance.now()-oldStart;
   const scoringStart=performance.now(),scores=(await scoring.score(ids)).results,batchMs=performance.now()-scoringStart;
   for(let i=0;i<3;i++){compareScore(scores[i],native[i]);compareScore(old[i],native[i]);compareEventValues(native[i].eventTrace,old[i].eventTrace);}
   compareTeamResults(native[0],native[2]);assert.deepEqual(scores[0],scores[2]);
   const fresh=createTeamDpsEvaluator(api,input).evaluate(b,true);compareScore(fresh,native[1]);
   assert.ok(native[0].eventTrace.events.some(e=>e.channel==='hits'));
   if(name==='random-health')assert.ok(native[0].eventTrace.events.some(e=>e.probability>0&&e.probability<1));
   if(name==='water-health')assert.notEqual(native[0].fanfare,native[1].fanfare);
   console.log(JSON.stringify({case:name,fullNodes:full.program.nodes.length,scoreNodes:model.program.nodes.length,fullCompileMs:fullMs,scoreCompileMs:scoreMs,fullDetailBatchMs:fullEvaluateMs,scalarDetailBatchMs:scalarMs,scoreBatchMs:batchMs}));
   gpuCases.push({name,model,artifacts,teams:ids,expected:scores});
  }finally{detail.dispose();scoring.dispose();}
 }
 if(process.env.TEAM_DPS_SCOPE_CASES)fs.writeFileSync(process.env.TEAM_DPS_SCOPE_CASES,JSON.stringify(packTeamDpsResult(gpuCases)));
});

test('real workers keep single results and optimized ranking/details across one and two scorers',async()=>{
 const input=effectInput();Object.assign(input.team_dps,{max_evaluations:4,result_count:3});const artifacts=input.single_interfaces.flatMap(p=>p.artifacts),before=structuredClone({input,artifacts});
 const single=await nodeTeamDps(input,artifacts,{mode:'evaluate'});assert.ok(single.compile_ms>0);assert.ok(single.results[0].eventTrace.events.length);
 const serial=await nodeTeamDps(input,artifacts,{threads:1}),parallel=await nodeTeamDps(input,artifacts,{threads:2});compareTeamResults(parallel,serial);
 compareScore(single.results[0],serial.baseline);compareEventValues(single.results[0].eventTrace,serial.baseline.eventTrace);
 const catalog=new Map(artifacts.map(a=>[a.id,a])),evaluator=createTeamDpsEvaluator(api,input);
 for(const row of parallel.results){const builds=row.artifacts.map(r=>['flower','feather','sand','goblet','head'].map(k=>catalog.get(r[k])));compareScore(row,evaluator.evaluate(builds));}
 assert.ok(parallel.results[0].eventTrace);assert.ok(parallel.results.slice(1).every(r=>!r.eventTrace&&!r.hits));assert.deepEqual({input,artifacts},before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {teamDetailFixture} from './helpers/team-detail-fixture.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {teamDpsProgressText,teamDpsProgressIndeterminate} from '../beta-data/team-dps-progress.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=n=>JSON.parse(fs.readFileSync(new URL(`../beta-data/team-dps-native/${n}.json`,import.meta.url)));
const resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('random-healing compiled details preserve native joint observations, sources and A/B/A candidate independence',async()=>{
 const input=teamDetailFixture(8500),a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);
 b.forEach(build=>build.forEach(item=>item.id+=100000));b[2][0].sub_stats=[['CriticalRate',.4],['ATKFixed',500]];
 const builds=[a,b,a],artifacts=[...a.flat(),...b.flat()],native=createTeamDpsEvaluator(api,input);
 const reference=[native.evaluate(a,true),native.evaluate(b,true)];
 const model=compileTeamDpsExpression(api,input,artifacts,resources,undefined,{trace:true}),computation=createTeamDpsComputation(model,artifacts);
 try{
  const result=await computation.score(builds.map(team=>team.map(build=>build.map(a=>a.id))),{detail:true});
  for(let i=0;i<2;i++){
   const row=result.results[i];for(const key of ['expectation','critical','non_critical','fanfare','furina_overflow','duration','dps'])near(row[key],reference[i][key]);
   compareEventValues(row.eventTrace,nativeEventTrace(reference[i]));
   const analysis=row.eventTrace.events.find(e=>e.channel==='hits').states[0].value.analysis;
   assert.ok(Object.keys(analysis.atk).some(key=>key!=='compiled'),'named stat sources retained');
  }
  assert.deepEqual(result.results[0],result.results[2]);
 }finally{computation.dispose();}
});

test('C6 20.5s actual Workers finish current/baseline/final/on-demand details, report phases and cancel',async()=>{
 const input=teamDetailFixture(),artifacts=input.single_interfaces.flatMap(p=>p.artifacts),original=structuredClone({input,artifacts});
 const invoke=async(mode,extra={})=>{
  const updates=[],controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000),started=performance.now();
  try{const result=await nodeTeamDps(input,artifacts,{threads:1,mode,signal:controller.signal,onProgress:p=>updates.push(p),...extra});return {result,updates,ms:performance.now()-started};}
  finally{clearTimeout(timer);}
 };
 const current=await invoke('evaluate');assert.ok(current.result.compile_ms>0);assert.ok(current.result.results[0].eventTrace.events.length>200);
 near(current.result.results[0].expectation,4464750.673206209);
 assert.ok(current.updates.some(p=>p.phase==='detail'));
 const optimized=await invoke('optimize');
 for(const phase of ['compile','baseline','search','finalize','complete'])assert.ok(optimized.updates.some(p=>p.phase===phase),phase);
 for(let i=1;i<optimized.updates.length;i++)assert.ok(optimized.updates[i].elapsed_ms>=optimized.updates[i-1].elapsed_ms,'one elapsed-time origin across phases');
 assert.equal(optimized.updates.at(-1).phase,'complete');assert.equal(optimized.result.evaluated_teams,8);
 near(optimized.result.baseline.expectation,current.result.results[0].expectation);compareEventValues(optimized.result.baseline.eventTrace,current.result.results[0].eventTrace);
 assert.ok(optimized.result.results[0].eventTrace.events.length);assert.equal(optimized.result.results.length,2);
 const next=optimized.result.results[1];input.team_dps.initial_ids=next.artifacts.map(row=>['flower','feather','sand','goblet','head'].map(k=>row[k]));
 const detail=await invoke('evaluate');near(detail.result.results[0].expectation,next.expectation);assert.ok(detail.result.results[0].eventTrace.events.length);
 input.team_dps.initial_ids=original.input.team_dps.initial_ids;
 const controller=new AbortController();let reached=false;
 const cancelled=nodeTeamDps(input,artifacts,{threads:1,signal:controller.signal,onProgress:p=>{if(p.phase==='baseline'){reached=true;controller.abort();}}});
 await assert.rejects(cancelled,{name:'AbortError'});assert.ok(reached);
 assert.deepEqual({input,artifacts},original);
 assert.equal(teamDpsProgressText({phase:'baseline'}),'正在计算当前配装明细');assert.ok(teamDpsProgressIndeterminate({phase:'finalize'}));assert.equal(teamDpsProgressIndeterminate({phase:'search'}),false);
 fs.mkdirSync('.build-target/team-detail-7203',{recursive:true});
 fs.writeFileSync('.build-target/team-detail-7203/cpu-worker.json',JSON.stringify({currentMs:current.ms,optimizeMs:optimized.ms,onDemandMs:detail.ms,compileMs:optimized.result.compile_ms,evaluated:optimized.result.evaluated_teams,baseline:optimized.result.baseline.expectation,best:optimized.result.results[0].expectation,phases:[...new Set(optimized.updates.map(p=>p.phase))],cancelled:true},null,2));
});

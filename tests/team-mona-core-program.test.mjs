import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {monaCoreInput,monaCoreTeams,monaCoreEvaluator,monaAction} from './helpers/team-mona-core.mjs';
import {monaRuntimeInput,runtimeTeams} from './helpers/team-runtime-mona.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression,createTeamDpsScoreModel} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {packTeamDpsResult} from '../beta-data/team-dps-result-view.mjs';
import {compareEventValues,nativeEventTrace} from './helpers/team-dps-result-comparison.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('Mona target-local freeze and real EC impulse preserve native/compiled A/B/A scores and complete traces',async()=>{
 const ec=monaCoreInput([monaAction('q',0,'burst',0),monaAction('electro',2,'normal.1',.1)]);ec.team_dps.enemy_count=1;
 const cases=[['frozen-targets',monaCoreInput(),monaCoreEvaluator,monaCoreTeams],['electrocharged-impulse',ec,createTeamDpsEvaluator,monaCoreTeams],['candidate-pop-time',monaRuntimeInput('clam-auto'),createTeamDpsEvaluator,x=>{const [a,b]=runtimeTeams(x);return [a,b,a];}]],gpu=[];
 for(const [name,input,factory,makeTeams]of cases){
  const builds=makeTeams(input),artifacts=[...builds[0].flat(),...builds[1].flat()],evaluator=factory(api,input),native=builds.map(b=>evaluator.evaluate(b,true));
  if(name==='candidate-pop-time'){near(native[0].duration,3+1/60);near(native[1].duration,1+107/60+8+1/60);}
  if(name==='electrocharged-impulse'){
   const ticks=native[0].hits.filter(h=>h.damageModel==='reaction.electroCharged'),pops=native[0].hits.filter(h=>h.monaBubble);assert.ok(ticks.length>=2);assert.equal(ticks[0].noImpulse,true);assert.equal(ticks[1].noImpulse,false);assert.equal(pops.length,1);near(pops[0].time,ticks[1].time+1/60);assert.ok(pops[0].time>ticks[0].time+1);
  }
  const model=compileTeamDpsExpression(api,input,artifacts,resources,factory,{trace:true}),scoreModel=createTeamDpsScoreModel(compileTeamDpsExpression(api,input,artifacts,resources,factory));
  const computation=createTeamDpsComputation(model,artifacts),scores=createTeamDpsComputation(scoreModel,artifacts),teams=builds.map(t=>t.map(b=>b.map(a=>a.id)));
  try{
   const output=(await computation.score(teams,{detail:true})).results,ranked=(await scores.score(teams)).results;
   for(let i=0;i<3;i++){for(const key of ['expectation','critical','non_critical','duration','dps','fanfare']){near(output[i][key],native[i][key]);near(ranked[i][key],native[i][key]);}compareEventValues(output[i].eventTrace,nativeEventTrace(native[i]));}
   assert.deepEqual(output[0],output[2]);assert.deepEqual(ranked[0],ranked[2]);
   gpu.push({name,model,scoreModel,artifacts,teams,expected:output,expectedScores:ranked});console.log(JSON.stringify({name,completeNodes:model.program.nodes.length,scoreNodes:scoreModel.program.nodes.length,damage:output.map(r=>r.expectation)}));
  }finally{computation.dispose();scores.dispose();}
 }
 if(process.env.TEAM_MONA_GPU_CASES)fs.writeFileSync(process.env.TEAM_MONA_GPU_CASES,JSON.stringify(packTeamDpsResult(gpu)));
});

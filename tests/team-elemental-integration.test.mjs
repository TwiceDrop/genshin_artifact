import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {modelInput} from './helpers/team-stellar-model-definition.mjs';
import {installElementalFixture,elementalEvaluator} from './helpers/team-elemental-definition.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('automatic reaction facts and damage use the same preview/candidate queue and compiled candidate gates',async()=>{
 for(const stellar of [false,true]){
  const restore=installElementalFixture(stellar);
  try{
   const input=modelInput('all');input.single_interfaces[0].buffs=[];input.team_dps.testGate=1;
   input.team_dps.axis.timeline=[['seed',0],['trigger',1000],['record',2000],['stellar-before',2100],['physical',3000],['stellar-after',5500]].map(([id,timeMs])=>({id,timeMs,actor:'member1',kind:'action',action:'charged'}));
   input.team_dps.axis.timeline.push({id:'end',kind:'switch',actor:'member1',timeMs:7000});
   const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);a[0].forEach(item=>{item.set_name='GladiatorsFinale';});b.forEach(build=>build.forEach(item=>{item.id+=10000;}));
   const preview=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps);
   const previewDamage=preview.events.filter(e=>e.damageModel==='reaction.superconduct');assert.equal(previewDamage.length,stellar?0:2);
   const native=[a,b,a].map((team,i)=>elementalEvaluator(api,{...input,team_dps:{...input.team_dps,testGate:i===1?0:1}}).evaluate(team,true));
   for(const [i,result]of native.entries()){
    const superconduct=result.hits.filter(e=>e.damageModel==='reaction.superconduct');
    assert.equal(superconduct.length,!stellar&&i!==1?2:0);
    if(superconduct.length)near(superconduct.reduce((n,e)=>n+e.expectation,0),1446.8535*1.5*.9*6);
    const direct=result.hits.filter(e=>e.damageModel==='reaction.stellarConduct');
    assert.deepEqual(direct.map(e=>e.stellarCoefficient),stellar&&i!==1?[1,1.45]:[1,1]);
    const physical=result.hits.filter(e=>e.eventId.startsWith('physical/'));assert.equal(physical.length,3);
    physical.forEach(h=>near(h.res,i===1?.9:1.15));
   }
   const artifacts=[...a.flat(),...b.flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,elementalEvaluator,{trace:true}),computation=createTeamDpsComputation(model,artifacts);
   try{
    const output=(await computation.score([a,b,a].map(t=>t.map(build=>build.map(a=>a.id))),{detail:true})).results;
    output.forEach((result,i)=>{
     near(result.expectation,native[i].expectation);
     const hits=result.eventTrace.events.filter(e=>e.channel==='hits').flatMap(e=>e.states.map(s=>s.value)).filter(e=>e.damageModel==='reaction.stellarConduct');
     assert.deepEqual(hits.map(e=>e.stellarCoefficient),stellar&&i!==1?[1,1.45]:[1,1]);
    });assert.deepEqual(output[0],output[2]);
   }finally{computation.dispose();}
  }finally{restore();}
 }
});

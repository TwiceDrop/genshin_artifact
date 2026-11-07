import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {modelInput,superconductEvaluator,installEffects} from './helpers/team-stellar-model-definition.mjs';
import {effect} from '../beta-data/team-engine/rule-utils.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),a+' != '+b);
test('ordinary superconduct uses current level/EM/bonus/resistance for legacy and extension owners, without crit, defense or inherited snapshot',async()=>{
 const restore=installEffects();
 try{
  for(const role of [0,3]){
   const input=modelInput('all');input.testReactionRole=role;
   input.single_interfaces[role].buffs=[effect('超导增益测试',{EnhanceSuperconduct:.5,ATKFixed:10000,CriticalBase:1,CriticalDamageBase:5,BonusCryo:3,DefMinus:.9})];
   const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);b.forEach(build=>build.forEach(item=>{item.id+=10000;}));b[role][0].sub_stats=[['ElementalMastery',500],['ATKFixed',5000]];
   const ev=superconductEvaluator(api,input),teams=[a,b,a],native=teams.map(t=>ev.evaluate(t,true));
   native.forEach((result,i)=>{
    const hits=result.hits.filter(h=>h.damageModel==='reaction.superconduct');assert.equal(hits.length,2);
    hits.forEach((h,j)=>{
     const em=(i===1?500:0)+j*500,n=1446.8535*1.5*(1+16*em/(2000+em)+.5)*(j?1.325:1.225)*3;
     near(h.em,em);near(h.expectation,n);near(h.critical,n);near(h.non_critical,n);near(h.bonus,.5);assert.equal(h.crit,0);assert.equal(h.contacts,undefined);
    });
   });
   const artifacts=[...a.flat(),...b.flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,superconductEvaluator,{trace:true}),computation=createTeamDpsComputation(model,artifacts);
   try{
    const outputs=(await computation.score(teams.map(t=>t.map(build=>build.map(a=>a.id))),{detail:true})).results;
    outputs.forEach((r,i)=>{
     near(r.expectation,native[i].expectation);
     const hits=r.eventTrace.events.filter(e=>e.channel==='hits').flatMap(e=>e.states.map(s=>s.value)).filter(e=>e.damageModel==='reaction.superconduct');
     const scalar=native[i].hits.filter(e=>e.damageModel==='reaction.superconduct');assert.equal(hits.length,scalar.length);
     hits.forEach((h,j)=>{for(const k of ['expectation','critical','non_critical','em','bonus','res'])near(h[k],scalar[j][k]);near(Object.values(h.analysis.superconduct_bonus).reduce((n,v)=>n+v,0),.5);});
    });
    assert.deepEqual(outputs[0],outputs[2]);
   }finally{computation.dispose();}
  }
 }finally{restore();}
});

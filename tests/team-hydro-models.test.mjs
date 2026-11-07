import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {hydroModelInput,hydroModelEvaluator,installHydroModelEffects} from './helpers/team-hydro-model-fixture.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {originalCryoInput,action as a,end} from './helpers/team-original-cryo-fixture.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Electro-Charged and Shatter use current coefficients, source snapshots and live resistance in both native backends and compiled candidates',async()=>{
 const restore=installHydroModelEffects();
 try{for(const [kind,coefficient,resBefore,resAfter,field]of [['electroCharged',2,.65,.95,'electro_charged_bonus'],['shatter',3,.8,1.05,'shatter_bonus']])for(const role of [0,3]){
  const input=hydroModelInput(kind,role),a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);b.forEach(build=>build.forEach(a=>{a.id+=10000;}));b[role][0].sub_stats=[['ElementalMastery',500],['ATKFixed',5000]];
  const teams=[a,b,a],ev=hydroModelEvaluator(api,input),native=teams.map(t=>ev.evaluate(t,true));
  native.forEach((result,i)=>{
   const hits=result.hits.filter(h=>h.damageModel==='reaction.'+kind);assert.equal(hits.length,kind==='shatter'?9:3);
   hits.forEach(h=>{
    const j=Number(h.eventId.match(/^star-(\d)/)[1])-1,em=(i===1?500:0)+(j===2?500:0),bonus=j===2?.75:.5,res=j?resAfter:resBefore,n=1446.8535*coefficient*(1+16*em/(2000+em)+bonus)*res*h.analysis.target_count;
    near(h.em,em);near(h.bonus,bonus);near(h.res,res);near(h.expectation,n);near(h.critical,n);near(h.non_critical,n);assert.equal(h.crit,0);assert.equal(h.def,1);
    near(Object.values(h.analysis[field]).reduce((a,b)=>a+b,0),bonus);
   });
  });
  const artifacts=[...a.flat(),...b.flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,hydroModelEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
  try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
 }}finally{restore();}
});
test('automatic superconduct captures source before its reaction event and reads resistance after the one-frame delay',async()=>{
 const source=characterPackages.Mona,previous=source.effects;
 source.effects=()=>[{id:'test.delayed.reaction',label:'反应生成后的增益',stage:'damage',target:'team',trigger:{kind:'cast',action:'skill'},duration:10,reads:{},value:()=>({ElementalMastery:500,EnhanceSuperconduct:.5,ResMinusBase:.3})}];
 try{
  const input=originalCryoInput(false,[a('cryo',1,'burst',0),a('electro',2,'normal.1',.1),a('later',3,'skill',.51),end(1)]);input.single_interfaces[1].character.level=1;
  const team=input.single_interfaces.map(p=>p.artifacts),native=createTeamDpsEvaluator(api,input).evaluate(team,true),hits=native.hits.filter(h=>h.damageModel==='reaction.superconduct');assert.ok(hits.length>0);
  hits.forEach(h=>{near(h.em,0);near(h.bonus,0);near(h.res,1.1);near(h.expectation,1446.8535*1.5*1.1*h.analysis.target_count);});
  const artifacts=team.flat(),model=compileTeamDpsExpression(api,input,artifacts,resources,undefined,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
  try{const [r]=(await cpu.score([team.map(b=>b.map(a=>a.id))],{detail:true})).results;near(r.expectation,native.expectation);compareEventValues(r.eventTrace,nativeEventTrace(native));}finally{cpu.dispose();}
 }finally{if(previous)source.effects=previous;else delete source.effects;}
});

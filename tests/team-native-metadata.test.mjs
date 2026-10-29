import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {createNativeDamageProjector} from '../beta-data/team-engine/native-projection.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {createNativeGraphCompiler} from '../beta-data/team-dps-native-compiler.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {nativeMetadataCases,nativeMetadataInput,nativeMetadataTeams} from './helpers/team-native-metadata.mjs';
const near=(a,b)=>assert.ok(Object.is(a,b)||Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('all 83 independently calibrated projections survive shape, element and backend cache alternation',()=>{
 const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url)));
 const entries=read('projections'),project=createNativeDamageProjector(read('extension-slots'));
 assert.equal(entries.length,83);
 const resolve=entry=>project(characterPackages[entry.character],{skill:{config:{Furina:{c6_after_e:!!entry.furinaC6}}}},entry);
 const first=entries.map(resolve);
 for(const entry of entries.toReversed())assert.deepEqual(resolve(entry),entry.fields,JSON.stringify([entry.character,entry.index,entry.nativeElement,entry.furinaC6]));
 entries.forEach((entry,i)=>{assert.strictEqual(resolve(entry),first[i]);assert.deepEqual(first[i],entry.fields);});
 assert.throws(()=>project(characterPackages.Mona,{}, {index:999}),/Mona\/999/);
});

test('Furina numeric adapter keeps count and HP thresholds live in the candidate program',()=>{
 const builder=createNumericProgram(),m=createNativeGraphCompiler(builder,{funcs:{},table:[]}).math;
 const input={skill:{config:{Furina:{hp_above50_count:builder.input(0)}}}},fixed={skill:{config:{Furina:{hp_above50_count:1}}}};
 const native={hp_ratio:{'技能倍率':2},bonus:{'天赋「无人听的自白」':.28}},result={hp:{compiled:builder.input(1)},hp_ratio:{compiled:4},bonus:{compiled:.48}};
 characterPackages.Furina.adjustNativeDamage({input,fixed,native,result,event:{index:10},math:m});
 const program=builder.finish([result.hp_ratio.compiled,result.bonus.compiled]);
 for(const [values,expected]of [[[0,999],[3.8,.2]],[[3,29999],[4.4,.403]],[[4,40000],[4.6,.48]],[[1,41000],[4,.48]],[[0,999],[3.8,.2]]])executeNumericProgram(program,values).forEach((v,i)=>near(v,expected[i]));
});

test('character-owned native metadata preserves actual Worker scoring, dynamic HP and snapshots for both candidates',async()=>{
 for(const name of nativeMetadataCases){
  const input=nativeMetadataInput(name),teams=nativeMetadataTeams(input),evaluator=createTeamDpsEvaluator(api,input);
  const native=teams.map(team=>evaluator.evaluate(team,true));assert.notEqual(native[0].expectation,native[1].expectation);
  const repeated=evaluator.evaluate(teams[0],true);
  for(const key of ['expectation','critical','non_critical','fanfare','furina_overflow','duration','dps'])near(repeated[key],native[0][key]);
  compareEventValues(nativeEventTrace(repeated),nativeEventTrace(native[0]));
  for(const [i,team]of teams.entries()){
   const candidate=structuredClone(input);candidate.team_dps.initial_ids=team.map(build=>build.map(a=>a.id));
   const compiled=(await nodeTeamDps(candidate,teams.flat(2),{mode:'evaluate'})).results[0];
   for(const key of ['expectation','critical','non_critical','fanfare','furina_overflow','duration','dps'])near(compiled[key],native[i][key]);
   compareEventValues(compiled.eventTrace,nativeEventTrace(native[i]));
  }
  if(name==='furina-infusion'){
   const hits=native[0].hits.filter(h=>h.role===1);
   assert.ok(hits.some(h=>h.furinaC6&&h.element==='Hydro'));assert.ok(hits.some(h=>!h.furinaC6&&h.element==='Physical'));
   assert.ok(hits.some(h=>h.arkheStrike&&h.element==='Hydro'));
  }
  if(name==='furina-salon')assert.ok(native[1].furina_overflow>0);
  if(name==='skirk-forms')for(const index of [0,5,9,10,11,12,13,14,15,16,17])assert.ok(native[0].hits.some(h=>h.role===0&&h.index===index),'Skirk/'+index);
  if(name==='mona-snapshot')assert.ok(native[0].hits.some(h=>h.role===3&&h.statSnapshot));
 }
});

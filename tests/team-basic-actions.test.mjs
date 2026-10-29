import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {validateActionAxis,TEAM_ACTION_CATALOG} from '../beta-data/team-engine/action-config.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {basicActions,basicActionInput,basicActionTeams} from './helpers/team-basic-actions.mjs';
import {effectInput,action} from './helpers/team-effect-refactor.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
const near=(a,b)=>assert.ok(Object.is(a,b)||Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function* permutations(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*permutations(a.filter((_,j)=>j!==i),[...p,a[i]]);}

test('all five four-person compositions round-trip every basic action with native indices, contact counts and elements',()=>{
 for(const omitted of Object.keys(basicActions)){
  const x=basicActionInput(omitted),axis=validateActionAxis(JSON.parse(JSON.stringify(x.team_dps.axis))),rotation=compileActionAxis(axis,x.single_interfaces,x.team_dps);
  for(const {character:name}of axis.members)for(const [id,index,parts]of basicActions[name]){
   assert.ok(TEAM_ACTION_CATALOG[name].some(a=>a.id===id),name+'/'+id);
   const hits=rotation.events.filter(e=>e.eventId===name+'/'+id+'/'+(name==='Mona'&&id==='charged'?'charged':id));
   assert.equal(hits.length,parts,name+'/'+id);assert.deepEqual(hits.map(h=>h.part),Array.from({length:parts},(_,i)=>i));
   for(const hit of hits){assert.equal(hit.index,index);assert.equal(hit.parts,parts);assert.equal(hit.element,['Mona','Vodyanitsa'].includes(name)?'Hydro':'Physical');}
  }
  if(omitted!=='Skirk'){
   for(const [id,index]of [['plunge.collision',6],['plunge.low',7],['plunge',8]]){
    const hit=rotation.events.find(e=>e.eventId==='phase/'+id+'/'+id);assert.equal(hit.index,index);assert.equal(hit.category,'plunge');assert.equal(hit.element,'Cryo');assert.equal(hit.nativeElement,'Cryo');assert.equal(hit.qBonus,undefined);
   }
   assert.equal(rotation.events.find(e=>e.eventId==='after/plunge/plunge').element,'Physical');
  }
  const identity=r=>r.events.map(({role,...e})=>({...e,actor:r.slots[role]}));
  for(const order of permutations([0,1,2,3])){
   const changed=structuredClone(axis);changed.members=order.map(i=>axis.members[i]);
   const reordered=compileActionAxis(changed,order.map(i=>x.single_interfaces[i]),x.team_dps);
   assert.deepEqual(identity(reordered),identity(rotation));
  }
 }
});

test('new basic actions preserve native talent totals, phase talent levels, A/B/A and actual Worker results',async()=>{
 for(const omit of Object.keys(basicActions)){
  const x=basicActionInput(omit),teams=basicActionTeams(x),ev=createTeamDpsEvaluator(api,x),native=teams.map(team=>ev.evaluate(team,true));
  assert.notEqual(native[0].expectation,native[1].expectation);near(ev.evaluate(teams[0]).expectation,native[0].expectation);
  const preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));
  for(const hit of native[0].hits){
   if(hit.arkheStrike)continue;
   const profile=structuredClone(ev.profiles[hit.role]);
   if(profile.character.name==='Skirk'&&hit.category==='plunge'&&hit.sevenPhase)profile.character.skill1=profile.character.skill2;
   profile.skill={index:hit.index,config:{Skirk:{cunning_stacks:50,seven_phase_mode:false,death_crossing_stacks:0,void_rift_count:0}}};
   // This oracle reads the native talent directly, independently of the
   // timeline split and the compiled graph's projection/cache.
   const d=api.CalculatorInterface.get_damage_analysis(profile,hit.nativeElement??null);
   const share=profile.character.name==='Escoffier'&&hit.index===2?[.45,.55][hit.part]:1/hit.parts;
   near(hit.analysis.atk_ratio['技能倍率'],d.atk_ratio['技能倍率']*share);
   const shown=preview.roles[hit.role].hits.find(row=>row.eventId===hit.eventId&&row.part===hit.part);
   near(shown.base.atk,hit.analysis.atk_ratio['技能倍率']);
  }
  for(const [i,team]of teams.entries()){
   const input=structuredClone(x);input.team_dps.initial_ids=team.map(build=>build.map(a=>a.id));
   const compiled=(await nodeTeamDps(input,teams.flat(2),{mode:'evaluate'})).results[0];
   for(const key of ['expectation','critical','non_critical','fanfare','furina_overflow','duration','dps'])near(compiled[key],native[i][key]);
   compareEventValues(compiled.eventTrace,nativeEventTrace(native[i]));
  }
  // Numerical permutation proof as well as the structural permutations above.
  for(const order of permutations([0,1,2,3])){
   const y=structuredClone(x);y.single_interfaces=order.map(i=>x.single_interfaces[i]);y.team_dps.axis.members=order.map(i=>x.team_dps.axis.members[i]);y.team_dps.initial_ids=order.map(i=>x.team_dps.initial_ids[i]);y.team_dps.initial_hp=order.map(i=>x.team_dps.initial_hp[i]);
   near(createTeamDpsEvaluator(api,y).evaluate(order.map(i=>teams[0][i])).expectation,native[0].expectation);
  }
 }
});

test('split ordinary Skirk contacts spend a hit-count weapon effect twice without doubling the talent',()=>{
 const x=effectInput();x.single_interfaces.forEach(p=>{p.character.constellation=0;p.weapon.name=['Skirk','Furina'].includes(p.character.name)?'DullBlade':p.weapon.name;});
 x.single_interfaces[0].weapon={name:'RoyalLongsword',level:90,ascend:false,refine:1,params:'NoConfig'};
 x.team_dps.axis.timeline=[action('n','Skirk','normal.3',100),action('c','Skirk','charged',200),action('last','Skirk','normal.1',300)];
 const ev=createTeamDpsEvaluator(api,x),result=ev.evaluate(x.single_interfaces.map(p=>p.artifacts),true),hits=result.hits;
 assert.equal(hits.length,5);assert.deepEqual(hits.map(h=>h.parts),[2,2,2,2,1]);
 assert.ok(hits[1].crit>hits[0].crit);assert.ok(hits[3].crit>hits[2].crit);
 near(hits[0].analysis.atk_ratio['技能倍率'],hits[1].analysis.atk_ratio['技能倍率']);
});

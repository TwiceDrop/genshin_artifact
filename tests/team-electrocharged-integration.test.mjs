import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {electrochargedInput,electrochargedTeams,gatedElectrochargedEvaluator,installElectrochargedEffects} from './helpers/team-electrocharged-fixture.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {compileTeamDpsExpression,createTeamDpsScoreModel} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {resolveCombatTimeline} from '../beta-data/team-engine/combat-runtime.mjs';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {createRuntimeEquipmentEvents} from '../beta-data/equipment-damage-events.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {packTeamDpsResult} from '../beta-data/team-dps-result-view.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('EC damage skips contact hooks, generic hit effects, finite pools and equipment procs while remaining scored',()=>{
 const ec={kind:'hit',time:1,rootOrder:1,role:0,eventId:'ec',hitTriggers:false,damageModel:'reaction.electroCharged'},contact={kind:'hit',time:2,rootOrder:2,role:0,eventId:'normal'};
 const hits=[],published=[],healthHits=[],before=[],health={events:[],rotation:{duration:3,endHit:'include'},resolve:()=>null,afterHit:e=>healthHits.push(e.eventId)};
 resolveCombatTimeline([ec,contact],health,{publish:e=>published.push(e.eventId)},{beforeHit:e=>before.push(e.eventId),hit:e=>{hits.push(e.eventId);return {expectation:10};}});
 assert.deepEqual(hits,['ec','normal']);for(const rows of [published,healthHits,before])assert.deepEqual(rows,['normal']);
 const source={key:'test',role:0,actorId:'a',definition:{id:'test',label:'pool',target:'team',stage:'damage',duration:10,uses:2,reads:{},trigger:{kind:'cast'}}};
 const plan={sources:[source],rotation:{activeRole:()=>0},settings:{},schedule:[{kind:'cast',time:0,rootOrder:0,role:0,eventId:'cast'},ec,contact]};
 const state=createEffectState(plan,{math:scalarMath,enabled:()=>1,trace:true});assert.equal(state.changes.filter(e=>e.kind==='consume').length,1);assert.equal(state.changes.find(e=>e.kind==='consume').before,2);
 const runtime=createRuntimeEquipmentEvents([{}],{slots:['a'],activeRole:()=>0},scalarMath,{}, {rules:[{name:'probe',chance:1,cooldown:0,accept:()=>{throw Error('reaction damage entered equipment hit predicate');}}]});runtime.afterEvent(ec,()=>{});
});
test('real Furina/Yae EC preserves source capture, independent formula, multi-target clock, party permutation and scalar/compiled A/B/A',async t=>{
 const undo=installElectrochargedEffects();
 try{
  const input=electrochargedInput(),preview=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),teams=electrochargedTeams(input);
  const native=teams.map((build,i)=>gatedElectrochargedEvaluator(api,{...input,testElectroEnabled:i===1?0:1}).evaluate(build,true));
  const rows=native[0].hits.filter(h=>h.damageModel==='reaction.electroCharged'&&h.expectation>0);
  assert.equal(rows.length,4);assert.deepEqual(rows.map(e=>e.role),[1,1,0,0]);
  near(rows[0].time,2.5+10/60);near(rows[2].time,3.5+10/60);near(rows[0].bonus,0);near(rows[2].bonus,.5);near(rows[2].em,500);
  for(const row of rows){const expected=2*row.analysis.reaction_level_base*(1+16*row.em/(2000+row.em)+row.bonus)*row.res;near(row.expectation,expected);near(row.critical,expected);}
  assert.equal(native[1].hits.filter(h=>h.damageModel==='reaction.electroCharged'&&h.expectation>0).length,0);
  assert.deepEqual(preview.events.filter(e=>e.damageModel==='reaction.electroCharged'&&e.enabled).map(e=>[e.time,e.role,e.targetIds]),rows.map(e=>[e.time,e.role,e.targetIds]));
  const one={...input,team_dps:{...input.team_dps,damage_scope:'single'}},single=createTeamDpsEvaluator(api,one).evaluate(teams[0],true);near(single.expectation,native[0].expectation/2);
  const order=[2,0,3,1],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);near(createTeamDpsEvaluator(api,permuted).evaluate(permuted.single_interfaces.map(p=>p.artifacts),true).expectation,native[0].expectation);
  const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedElectrochargedEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);t.diagnostic('EC integration graph: '+model.program.nodes.length+' nodes');
  try{const results=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;results.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(results[0],results[2]);}finally{cpu.dispose();}
 }finally{undo();}
});
test('only the initial finite EC tick extends the axis, with candidate-owned include/exclude boundaries',async()=>{
 for(const endHit of ['include','exclude']){
  const input=electrochargedInput();input.team_dps.axis.timeline=input.team_dps.axis.timeline.slice(0,2);input.team_dps.axis.endHit=endHit;input.team_dps.enemy_count=1;
  const teams=electrochargedTeams(input),native=teams.map((build,i)=>gatedElectrochargedEvaluator(api,{...input,testElectroEnabled:i===1?0:1}).evaluate(build,true));
  near(native[0].duration,2.5+10/60);near(native[1].duration,2.5);assert.equal(native[0].hits.filter(e=>e.damageModel==='reaction.electroCharged'&&e.expectation>0).length,endHit==='include'?1:0);
  near(compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps).duration,native[0].duration);
  const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedElectrochargedEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);
  try{const out=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;out.forEach((r,i)=>{near(r.duration,native[i].duration);near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});}finally{cpu.dispose();}
 }
});

test('real Hydro/Electro/Cryo contacts publish conduct before Freeze and preserve candidate effect snapshots',async()=>{
 const owner=characterPackages.Qiqi,previous=owner.effects,gpu=[];
 // Observe delivery through the existing effect lifecycle, not a second
 // reaction implementation. These two effects are test-only instruments.
 owner.effects=(...args)=>[...(previous?.(...args)??[]),
  {id:'test.order.conduct',label:'超导顺序探针',stage:'base',target:'self',trigger:{kind:'reaction',reactionType:['Superconduct','StellarConduct']},duration:4,reads:{},value:()=>({ElementalMastery:200})},
  {id:'test.order.freeze',label:'冻结顺序快照',stage:'damage',target:'self',trigger:{kind:'reaction',reactionType:'Frozen'},duration:4,
   reads:{em:{stat:'elemental_mastery',stage:'attack',timing:'activation'}},value:({m,read})=>({BonusBase:m.mul(.001,read('em'))})},
 ];
 try{
  for(const stellar of [false,true]){
   const input=electrochargedInput();
   if(stellar){const p=fixture('Odette');p.artifacts=input.single_interfaces[0].artifacts;p.weapon=input.single_interfaces[0].weapon;input.single_interfaces[0]=p;input.team_dps.axis.members[0].character='Odette';}
   input.team_dps.axis.initialActiveSlot='member4';
   input.team_dps.axis.timeline=[['water',3,'charged',0],['yn',1,'normal.1',100],['ice',2,'burst',100],['heavy',2,'plunge',2000]].map(([id,r,action,timeMs])=>({id,actor:'member'+(r+1),kind:'action',action,timeMs}));
   input.team_dps.axis.timeline.push({id:'end',actor:'member4',kind:'switch',timeMs:2400});
   const teams=electrochargedTeams(input),rotations=[],native=teams.map((build,i)=>gatedElectrochargedEvaluator(api,{...input,testElectroEnabled:i===1?0:1},{captureRotation:r=>rotations.push(r)}).evaluate(build,true));
   const conduct=stellar?'StellarConduct':'Superconduct';
   for(const [i,result]of native.entries()){
    const changes=result.effects.filter(e=>e.kind==='activate'&&e.effectId==='test.order.freeze');
    assert.equal(changes.length,2);changes.forEach(e=>near(e.captures.em,i===1?0:200));
    const events=rotations[i].reactionFacts.filter(e=>e.enabled&&e.parentEventId.startsWith('ice/')).sort((a,b)=>a.step-b.step);
    assert.deepEqual(events.map(e=>e.reactionType),i===1?['Frozen','Frozen']:[conduct,conduct,'Frozen','Frozen']);
    assert.ok(events.every(e=>e.ownerActorId==='member3'));
    const firstFreeze=events.find(e=>e.reactionType==='Frozen');near(firstFreeze.time,.1+82/60);
    const ticks=result.hits.filter(e=>e.damageModel==='reaction.electroCharged'&&e.expectation>0);
    assert.equal(ticks.length,i===1?0:2);assert.ok(ticks.every(e=>e.time<firstFreeze.time));
    assert.equal(result.hits.filter(e=>e.damageModel==='reaction.shatter'&&e.expectation>0).length,2);
   }
   const order=[2,3,0,1],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);permuted.team_dps.initial_hp=order.map(i=>input.team_dps.initial_hp[i]);
   near(gatedElectrochargedEvaluator(api,permuted).evaluate(order.map(i=>teams[0][i])).expectation,native[0].expectation);
   const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedElectrochargedEvaluator,{trace:true}),scoreModel=createTeamDpsScoreModel(compileTeamDpsExpression(api,input,artifacts,resources,gatedElectrochargedEvaluator));
   const cpu=createTeamDpsComputation(model,artifacts),scores=createTeamDpsComputation(scoreModel,artifacts),ids=teams.map(team=>team.map(build=>build.map(a=>a.id)));
   try{
    const output=(await cpu.score(ids,{detail:true})).results,ranked=(await scores.score(ids)).results;
    output.forEach((r,i)=>{near(r.expectation,native[i].expectation);near(ranked[i].expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});
    assert.deepEqual(output[0],output[2]);assert.deepEqual(ranked[0],ranked[2]);
    gpu.push({name:stellar?'hydro-stellar-freeze':'hydro-conduct-freeze',model,scoreModel,artifacts,teams:ids,expected:output,expectedScores:ranked});
   }finally{cpu.dispose();scores.dispose();}
  }
 }finally{owner.effects=previous;}
 if(process.env.TEAM_HYDRO_ORDER_GPU_CASES)fs.writeFileSync(process.env.TEAM_HYDRO_ORDER_GPU_CASES,JSON.stringify(packTeamDpsResult(gpu)));
});

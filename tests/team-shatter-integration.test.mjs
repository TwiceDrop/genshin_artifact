import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {shatterInput,shatterTeams,gatedShatterEvaluator} from './helpers/team-shatter-fixture.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileTeamDpsExpression} from '../beta-data/team-dps-program.mjs';
import {createTeamDpsComputation} from '../beta-data/team-dps-computation.mjs';
import {capturedTeamGraph} from '../beta-data/team-dps-graph-reader.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
const {api}=await import('../beta-tools/runtime-team-dps-graph.mjs');
const read=name=>JSON.parse(fs.readFileSync(new URL('../beta-data/team-dps-native/'+name+'.json',import.meta.url))),resources={capture:capturedTeamGraph,libraries:[read('native-functions'),read('extension-functions')],extensionSlots:read('extension-slots')};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('role-owned blunt properties distinguish plunge impact, catalyst plunges and individual burst parts',()=>{
 for(const [name,indices]of [['Skirk',[6,7,8]],['Furina',[5,6,7]],['Escoffier',[4,5,6]],['Qiqi',[9,10,11]],['Alyosha',[6,7,8]],['Odette',[7,8,9]],['Sandrone',[7,8,9]]])assert.deepEqual(indices.map(index=>characterPackages[name].isBlunt({index})),[false,true,true]);
 for(const name of ['Mona','Vodyanitsa','YaeMiko'])assert.equal(characterPackages[name].isBlunt,undefined);
 assert.deepEqual([0,1,2].map(part=>characterPackages.Odette.isBlunt({index:20,part})),[true,false,false]);
 assert.equal(characterPackages.Sandrone.isBlunt({index:4}),true);assert.equal(characterPackages.Sandrone.isBlunt({index:3}),false);assert.equal(characterPackages.Sandrone.isBlunt({index:12}),false);
});
test('actual water/ice team generates per-target physical Shatter only on impact and compiles once for A/B/A',async t=>{
 const input=shatterInput(),teams=shatterTeams(input),native=teams.map((build,i)=>gatedShatterEvaluator(api,{...input,testFirstBubble:i===1?0:1}).evaluate(build,true));
 const rows=native[0].hits.filter(h=>h.damageModel==='reaction.shatter');assert.equal(rows.length,2);assert.ok(rows.every(h=>h.time===1&&h.role===3));
 for(const row of rows){const expected=3*1446.8535*(1+16*row.em/(2000+row.em)+row.bonus)*row.res;near(row.expectation,expected);near(row.critical,expected);assert.equal(row.hitTriggers,false);}
 assert.equal(native[1].hits.filter(h=>h.damageModel==='reaction.shatter').length,0);
 const preview=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps);assert.equal(preview.reactionAt({time:.95,rootOrder:Infinity}).targets[0].frozen,true);assert.equal(preview.reactionAt({time:1.1,rootOrder:Infinity}).targets[0].frozen,false);
 assert.deepEqual(preview.events.filter(h=>h.damageModel==='reaction.shatter').map(h=>[h.time,h.targetIds]),rows.map(h=>[h.time,h.targetIds]));
 const one={...input,team_dps:{...input.team_dps,damage_scope:'single'}},single=createTeamDpsEvaluator(api,one).evaluate(teams[0],true);near(single.expectation,native[0].expectation/2);
 const order=[2,0,3,1],permuted=structuredClone(input);permuted.single_interfaces=order.map(i=>input.single_interfaces[i]);permuted.team_dps.axis.members=order.map(i=>input.team_dps.axis.members[i]);near(createTeamDpsEvaluator(api,permuted).evaluate(permuted.single_interfaces.map(p=>p.artifacts),true).expectation,native[0].expectation);
 const artifacts=[...teams[0].flat(),...teams[1].flat()],model=compileTeamDpsExpression(api,input,artifacts,resources,gatedShatterEvaluator,{trace:true}),cpu=createTeamDpsComputation(model,artifacts);t.diagnostic('Shatter graph: '+model.program.nodes.length+' nodes');
 try{const out=(await cpu.score(teams.map(t=>t.map(b=>b.map(a=>a.id))),{detail:true})).results;out.forEach((r,i)=>{near(r.expectation,native[i].expectation);compareEventValues(r.eventTrace,nativeEventTrace(native[i]));});assert.deepEqual(out[0],out[2]);}finally{cpu.dispose();}
});
test('Sandrone rays and only Odette first burst slash Shatter real Frozen targets in preview and scoring',()=>{
 for(const [name,action,time,end,at,index]of [['Sandrone','charged',800,2500,2.3,4],['Odette','burst',0,2600,112/60,20]]){
  const input=shatterInput(),p=fixture(name);p.character.constellation=0;p.weapon=weapon(characterPackages[name].previewWeapon);p.artifacts=input.single_interfaces[3].artifacts;input.single_interfaces[3]=p;input.team_dps.axis.members[3].character=name;
  input.team_dps.axis.timeline=[...input.team_dps.axis.timeline.slice(0,2),{id:'heavy',actor:'member4',kind:'action',action,timeMs:time},{id:'end',actor:'member1',kind:'switch',timeMs:end}];
  const plan=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),native=createTeamDpsEvaluator(api,input).evaluate(input.single_interfaces.map(p=>p.artifacts),true),hits=native.hits.filter(h=>h.damageModel==='reaction.shatter');
  assert.equal(hits.length,2);hits.forEach(h=>near(h.time,at));assert.ok(native.hits.some(h=>h.role===3&&h.index===index&&h.blunt));
  assert.deepEqual(plan.events.filter(h=>h.damageModel==='reaction.shatter').map(h=>[h.time,h.targetIds]),hits.map(h=>[h.time,h.targetIds]));
 }
});
test('equipment history ignores non-contact reaction damage when counting Jade Spear stacks',()=>{
 const input=shatterInput(),p=fixture('Alyosha');p.weapon=weapon('PrimordialJadeWingedSpear');input.single_interfaces[3]=p;input.team_dps.axis.members[3].character='Alyosha';input.team_dps.axis.timeline=[];
 const base=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),hits=[{kind:'hit',eventId:'contact',time:0,rootOrder:0,role:3,onField:true,category:'skill',element:'Electro'},...[1,2].map(time=>({kind:'hit',eventId:'reaction/'+time,time,rootOrder:0,role:3,onField:true,category:'reaction',element:'Electro',hitTriggers:false,reactionDamage:true}))];
 const rules=createEquipmentAxisRules(input.single_interfaces,{...base,events:hits,hpEvents:[]},input.team_dps),value=structuredClone(p);rules.prepare(value,3,{time:3,rootOrder:0,role:3,onField:true,index:0});assert.equal(value.weapon.params.PrimordialJadeWingedSpear.stack,1);
});

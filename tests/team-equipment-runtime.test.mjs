import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {createEquipmentHealingDamage,equipmentHealingDamage} from '../beta-data/equipment-healing-damage-rules.mjs';
import {compileEquipmentDamageEvents} from '../beta-data/equipment-damage-events.mjs';
import {resolveCombatTimeline} from '../beta-data/team-engine/combat-runtime.mjs';
import {createPortableHealth} from '../beta-data/team-dps-portable-health.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {vodyanitsa} from '../beta-data/team-engine/characters/vodyanitsa.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {eventKey} from '../beta-data/team-engine/event-order.mjs';
import {effectInput} from './helpers/team-effect-refactor.mjs';
import {equipmentRuntimeInput} from './helpers/team-equipment-runtime.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const evaluate=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);
const permutations=xs=>xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>i!==j)).map(p=>[x,...p])):[[]];

test('resolved damage can enqueue healing, which emits a later clam hit in the same runtime',()=>{
 const x=effectInput();x.team_dps.axis.timeline=[{id:'end',kind:'switch',actor:'Skirk',timeMs:5000}];x.team_dps.initial_hp=[.9,.9,.9,.9];
 const base=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),panelAt=()=>({hp:{base:1000},atk:{base:100},critical:{base:0}}),builds=x.single_interfaces.map(p=>p.artifacts);
 const health=createPortableHealth(x.single_interfaces,builds,base,{panelAt,healAt:h=>h.recipients.map(()=>h.raw),criticalAt:()=>0,refresh:()=>{}});
 const equipment=createEquipmentHealingDamage(x.single_interfaces,base,h=>h.rawAmounts.reduce((a,b)=>a+b,0),(r,set)=>r===2&&set==='OceanHuedClam',{},scalarMath),facts=[];
 const resolved=resolveCombatTimeline([{kind:'hit',category:'normal',role:0,time:0,rootOrder:0,order:0,eventId:'seed'}],health,null,{
  beforeHit:equipment.beforeHit,hit:e=>({expectation:e.fixed??200}),
  afterEvent(e,enqueue){facts.push(e);equipment.afterEvent(e,enqueue);if(e.eventId==='seed')enqueue({kind:'heal',healing:'test',role:2,time:1,rootOrder:0,order:0,eventId:'damage/heal',recipients:[2],raw:e.damage.expectation});},
 });
 assert.equal(resolved.heals.length,1);near(resolved.heals[0].amount,100);assert.equal(resolved.heals[0].rawAmounts[0],200);
 const explosion=facts.find(e=>e.category==='equipment');assert.equal(explosion.time,4);assert.equal(explosion.damage.expectation,180);assert.equal(explosion.parentEventId,'bubble_end/4');assert.equal(explosion.onField,false);
 assert.deepEqual(facts.map(e=>e.kind),['hit','heal','hp_change','bubble_end','hit']);
 const change=facts[2];assert.equal(change.parentEventId,'damage/heal/1/0/0');assert.equal(change.role,2);assert.equal(change.change,'increase');near(change.amount,100);near(change.ratio,.1);
});

test('Song expiry precedes the same-time hit and spends real targets even outside the score',()=>{
 const profiles=Array(4).fill({}),rotation={slots:['a','b','c','d'],heals:[{kind:'heal',role:2,time:0,rootOrder:0,order:0,amount:15000},{kind:'heal',role:2,time:6,rootOrder:10,order:0,amount:1000}],events:[0,1,2].map((order)=>({kind:'hit',role:0,time:6+order,rootOrder:20,onField:true,category:'normal',order,targetIds:order===1?[2,1,0]:[0,1,2]}))};
 const run=damage_scope=>equipmentHealingDamage(profiles,rotation,h=>h.amount,(r,s)=>r===2&&s==='SongOfDaysPast',{damage_scope,enemy_count:3});
 const all=run('all'),single=run('single');assert.deepEqual([...all.usage.values()].map(x=>x.used),[3,2,0]);assert.deepEqual([...single.usage.values()],[...all.usage.values()]);
 assert.deepEqual(rotation.events.map(e=>all.flat.get(eventKey(e))??0),[1200,800,0]);assert.deepEqual(rotation.events.map(e=>single.flat.get(eventKey(e))??0),[1200,0,0]);
 assert.equal(all.waves[0].amount,15000);assert.equal(all.waves[1].amount,1000);
});

test('Eye of Perception keeps all actual bounces when the selected score changes',()=>{
 const x=equipmentRuntimeInput(),rotation=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),all=compileEquipmentDamageEvents(x.single_interfaces,rotation,x.team_dps),single=compileEquipmentDamageEvents(x.single_interfaces,rotation,{...x.team_dps,damage_scope:'single'});
 assert.deepEqual(single.procs,all.procs);const eye=all.procs.filter(e=>e.role===3);assert.equal(eye.length,3);assert.deepEqual(eye.map(e=>e.targetIds),[[0],[1],[2]]);assert.equal(new Set(all.procs.map(e=>e.eventId)).size,all.procs.length);
 x.team_dps.axis.timeline.push({id:'switch-out',kind:'switch',actor:'Furina',timeMs:4001});const changed=compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),delayed=compileEquipmentDamageEvents(x.single_interfaces,changed,x.team_dps).procs.find(e=>e.role===0);assert.equal(delayed.onField,false);assert.equal(delayed.snapshot.onField,true);
});

test('Vodyanitsa C4 cannot read a later same-time heal from a completed history',()=>{
 const profiles=effectInput().single_interfaces;profiles[3].character.constellation=4;
 const rotation={model:'actions',heals:[{role:3,time:1,rootOrder:10,order:0}],lastCast:()=>0};
 const rule=vodyanitsa.create({role:3,profiles,rotation:()=>rotation,math:scalarMath});
 for(const [rootOrder,expected]of [[9,0],[11,1]]){const p=structuredClone(profiles[3]);vodyanitsa.normalize(p);rule.prepare(p,{time:1,rootOrder,order:0,onField:true});assert.equal(p.character.params.Vodyanitsa.c4_stacks,expected);}
});

test('equipment events and live scores preserve party order, candidate reset, and trace parity',()=>{
 const x=equipmentRuntimeInput(),baseline=evaluate(x),saved=JSON.stringify(x);
 for(const p of permutations([0,1,2,3])){
  const y=structuredClone(x);y.single_interfaces=p.map(i=>x.single_interfaces[i]);y.team_dps.axis.members=p.map(i=>x.team_dps.axis.members[i]);
  for(const key of ['initial_hp','weapon_conditions'])if(x.team_dps[key])y.team_dps[key]=p.map(i=>x.team_dps[key][i]);
  const out=evaluate(y);near(out.expectation,baseline.expectation);assert.equal(out.hits.length,baseline.hits.length);
  out.hits.forEach((h,i)=>{const b=baseline.hits[i];assert.equal(h.eventId,b.eventId);near(h.expectation,b.expectation);});
 }
 const builds=x.single_interfaces.map(p=>p.artifacts),b=structuredClone(builds);b[2].forEach(a=>{a.id+=900000;a.set_name='SongOfDaysPast';});
 const evaluator=createTeamDpsEvaluator(api,x),changed=evaluator.evaluate(b,true);assert.ok(!changed.hits.some(h=>h.label.includes('海染泡沫')));assert.ok(changed.hits.some(h=>h.analysis.extra_damage['昔时之歌·昔时的回响']>0));
 assert.equal(evaluator.evaluate(builds).expectation,baseline.expectation);assert.equal(evaluator.evaluate(builds,true).expectation,baseline.expectation);assert.equal(JSON.stringify(x),saved);
});

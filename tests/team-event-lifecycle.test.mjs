import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {effectInput,action} from './helpers/team-effect-refactor.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {compileEffectPlan} from '../beta-data/team-engine/effect-plan.mjs';
import {createEffectState} from '../beta-data/team-engine/effect-state.mjs';
import {createPortableHealth} from '../beta-data/team-dps-portable-health.mjs';
import {resolveCombatTimeline} from '../beta-data/team-engine/combat-runtime.mjs';
import {eventKey} from '../beta-data/team-engine/event-order.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';

const evaluate=input=>createTeamDpsEvaluator(api,input).evaluate(input.single_interfaces.map(p=>p.artifacts),true);

test('later same-tick casts do not affect earlier hits or spend their pools',()=>{
 const input=effectInput(),mona=fixture('Mona');mona.artifacts=input.single_interfaces[3].artifacts;
 input.single_interfaces[3]=mona;input.team_dps.axis.members[3]={slot:'Mona',character:'Mona'};input.team_dps.axis.initialActiveSlot='Skirk';
 input.team_dps.axis.timeline=[action('s-e','Skirk','skill',0),action('before','Skirk','normal.1',1000),action('q','Mona','burst',1000),action('after','Skirk','normal.1',1000)];
 const result=evaluate(input),before=result.hits.find(h=>h.eventId==='before/normal.1'),after=result.hits.find(h=>h.eventId==='after/normal.1');
 assert.equal(before.analysis.bonus['莫娜·星异'],undefined);assert.ok(after.analysis.bonus['莫娜·星异']>0);
 const vody=effectInput();vody.team_dps.axis.timeline=[action('before','Vodyanitsa','normal.1',1000),action('e','Vodyanitsa','skill',1000),action('after','Vodyanitsa','normal.1',1000)];
 const scored=evaluate(vody),spent=scored.effects.filter(e=>e.effectId==='vodyanitsa.a4.front'&&e.kind==='consume');
 assert.equal(spent.length,2);assert.ok(!spent.some(e=>e.eventId.startsWith('before/')));assert.deepEqual(spent.map(e=>e.used),[3,3]);
});

test('actual healing activates a finite pool before later hits in scalar and numeric execution',()=>{
 const input=effectInput();input.team_dps.axis.timeline=[action('heal','Vodyanitsa','skill',0),action('s-e','Skirk','skill',500),action('one','Skirk','normal.1',1000),action('two','Skirk','normal.2',1200),action('three','Skirk','normal.1',1400),action('refilled','Skirk','normal.1',1600)];
 const base=compileActionAxis(input.team_dps.axis,input.single_interfaces,input.team_dps),plan=compileEffectPlan(input.single_interfaces,base,input.team_dps),hits=base.events.filter(e=>e.role===0);
 const definition={id:'synthetic.heal.pool',trigger:{kind:'heal',healing:null},duration:5,uses:5,target:'otherOnField',filter:{element:'Cryo'},reads:{}};
 const source={definition,role:3,key:definition.id,actorId:'Vodyanitsa'};plan.sources=[source];
 const run=(math,enabled)=>{
  const state=createEffectState(plan,{math,enabled:()=>enabled,events:[]});
  const health=createPortableHealth(input.single_interfaces,input.single_interfaces.map(p=>p.artifacts),base,{math,panelAt:()=>({hp:{base:1000}}),healAt:h=>h.recipients.map(()=>100),criticalAt:()=>0,refresh:()=>{}});
  const result=resolveCombatTimeline(plan.schedule,health,state);
  assert.deepEqual(result.heals.filter(h=>h.role===3).map(h=>h.time),[0,1.5]);
  return hits.map(e=>state.at(source,e).usage.used);
 };
 assert.deepEqual(run(scalarMath,1),[3,2,0,3]);
 const builder=createNumericProgram(),program=builder.finish(run(builder.math,builder.input(0)));
 assert.deepEqual(executeNumericProgram(program,[1]),[3,2,0,3]);assert.deepEqual(executeNumericProgram(program,[0]),[0,0,0,0]);
});

test('a hit consumes the previous instance before its own on-hit refresh',()=>{
 const definition={id:'synthetic.hit.pool',trigger:{kind:'hit'},duration:5,uses:2,target:'self',reads:{}};
 const source={definition,role:0,key:definition.id,actorId:'self'},hits=[1,2,3].map(time=>({eventId:'hit'+time,kind:'hit',role:0,time,rootOrder:0}));
 const plan={sources:[source],schedule:hits,settings:{enemy_count:1},rotation:{model:'actions',activeRole:()=>0}},state=createEffectState(plan,{math:scalarMath,enabled:()=>1,trace:true});
 assert.deepEqual(hits.map(h=>state.at(source,h).usage.used),[0,1,1]);
 assert.deepEqual(state.changes.filter(e=>e.time===2).map(e=>e.kind),['consume','activate']);
 assert.equal(state.changes.find(e=>e.time===2&&e.kind==='consume').instanceId,'synthetic.hit.pool/1');
});

test('front and back Vodyanitsa pools spend actual targets independently of scoring scope',()=>{
 const input=effectInput();input.team_dps.axis.timeline=[action('v-e','Vodyanitsa','skill',0),action('hold','Skirk','skill.hold',500),action('q','Skirk','burst',1000),{id:'leave',actor:'Vodyanitsa',kind:'switch',timeMs:2830}];
 const outputs=['all','single'].map(damage_scope=>{input.team_dps.damage_scope=damage_scope;return evaluate(input);});
 const consume=out=>out.effects.filter(e=>e.effectId.startsWith('vodyanitsa.a4.')&&e.kind==='consume');
 assert.deepEqual(consume(outputs[0]),consume(outputs[1]));
 const burst=outputs[0].hits.filter(h=>h.skirkBurst),uses=burst.map(h=>consume(outputs[0]).find(e=>e.eventId===eventKey(h))?.used??0);
 assert.deepEqual(uses,[3,3,3,3,1,0]);
 for(const out of outputs)assert.equal(out.hits.filter(h=>h.skirkBurst).at(-1).analysis.extra_damage['沃雅妮莎·十二弦的泪歌'],undefined);
});

test('limited effects consume only actual targets, including targets outside the score',()=>{
 const definition={id:'synthetic.targets',trigger:{kind:'cast',action:'skill'},duration:5,uses:3,target:'team',reads:{}};
 const source={definition,role:0,key:definition.id,actorId:'self'},cast={eventId:'cast',kind:'cast',action:'skill',role:0,time:0,rootOrder:0};
 const hits=[[2],[0,2],[0,1,2]].map((targetIds,i)=>({eventId:'hit'+i,kind:'hit',role:0,time:i+1,rootOrder:0,targetIds}));
 const state=createEffectState({sources:[source],schedule:[cast,...hits],settings:{enemy_count:3,damage_scope:'single'},rotation:{model:'actions',activeRole:()=>0}},{math:scalarMath,enabled:()=>1});
 assert.deepEqual(hits.map(h=>state.at(source,h).usage.used),[1,2,0]);
});

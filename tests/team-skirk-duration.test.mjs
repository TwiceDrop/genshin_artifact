import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';import {sample,builds} from '../beta-tools/team-dps-full-audit.mjs';
import {createActionAxis,actionAxisDurationMs} from '../beta-data/team-engine/action-config.mjs';import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {nativeEventTrace,compareEventValues} from './helpers/team-dps-result-comparison.mjs';
const a=(id,action,timeMs,rifts)=>({id,kind:'action',actor:'member1',action,timeMs,...(rifts===undefined?{}:{params:{absorbedRifts:rifts}})}),sw=(id,actor,timeMs)=>({id,kind:'switch',actor:'member'+actor,timeMs}),near=(x,y)=>assert.ok(Math.abs(x-y)<1e-9*Math.max(1,Math.abs(y)),`${x} != ${y}`);
function input(timeline,c=0){const x=sample();x.single_interfaces.forEach(p=>p.character.constellation=0);x.single_interfaces[0].character.constellation=c;x.team_dps.axis={...createActionAxis('synthetic-skirk-duration',['Skirk','Furina','Escoffier','Vodyanitsa']),timeline};return x;}
const compile=x=>compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),evaluate=x=>createTeamDpsEvaluator(api,x).evaluate(builds(x),true);
// Independent 60-frame reference with integer tenths of resource. It steps
// every frame instead of the production event queue and never imports timers.
function oracle(cons,absorptions){let resource=cons>=2?550:450,pause=0,nextPause=-1;const trace=[];
 for(let frame=1;frame<=750;frame++){
  if(frame===750)return {end:12.5,trace};
  if(frame===nextPause){pause--;nextPause=pause?frame+9:-1;}
  if(frame%12===0){if(!pause)resource=Math.max(0,resource-14);trace.push({time:frame/60,resource:resource/10,paused:pause>0});if(!resource)return {end:frame/60,trace};}
  for(const rifts of absorptions.filter(([f])=>f===frame).map(([,n])=>n)){resource=Math.min(1000,resource+rifts*80);if(rifts){if(!pause)nextPause=frame+9;pause=Math.min(6,pause+2*rifts);}}
 }
}
test('Skirk depletion and absorption use resource + pause, independently of the 12.5s cap',()=>{
 for(const cons of [0,2])for(const count of [0,1,2,3]){
  const x=input([a('e','skill',0),a('q','burst',1000,count),sw('tail',1,14000)],cons),r=compile(x),expected=oracle(cons,[[60,count]]);near(r.windows.skirkPhase[0].end,expected.end);near(r.windows.skirkC2[0].end,expected.end);
  const drains=r.resources.filter(h=>['七相自然消耗','吸收暂停消耗'].includes(h.label));assert.deepEqual(drains.map(h=>({time:h.time,resource:h.value,paused:h.label==='吸收暂停消耗'})),expected.trace);assert.equal(r.covered('skirkPhase',expected.end),false);assert.equal(r.covered('skirkC2',expected.end),false);
 }
 assert.equal(oracle(0,[]).end,6.6);assert.equal(oracle(0,[[60,3]]).end,10.8);assert.equal(oracle(2,[]).end,8);assert.equal(oracle(2,[[60,3]]).end,12.2);
 for(const timeline of [[a('e','skill',0),a('q','burst',1000,3),a('ca','charged',1100,3),sw('tail',1,14000)],[a('e','skill',0),a('q','burst',1000,3),a('ca','charged',5000,3),sw('tail',1,14000)]]){const r=compile(input(timeline));assert.equal(r.windows.skirkPhase[0].end,12.5);assert.ok(r.resources.every(h=>h.pauseStacks<=6));assert.equal(r.resources.findLast(h=>h.label==='七相一闪到期').value,0);}
 const overlap=compile(input([a('e','skill',0),a('q','burst',1000,1),a('ca','charged',1100,1),sw('tail',1,14000)])),expected=oracle(0,[[60,1],[66,1]]);assert.equal(overlap.windows.skirkPhase[0].end,expected.end);assert.deepEqual(overlap.resources.filter(h=>h.label==='吸收暂停消耗').map(h=>h.time),expected.trace.filter(h=>h.paused).map(h=>h.time));
});
test('Skirk exact depletion/cap boundaries choose Q form and all six terminal hits',()=>{
 for(const [qTime,count,expectedBurst]of [[6599,3,false],[6600,3,true],[7000,0,true]]){
  const x=input([a('e','skill',0),a('q','burst',qTime,count)]),r=compile(x);assert.equal(r.events.filter(e=>e.skirkBurst).length,expectedBurst?6:0);near(r.duration,qTime/1000+(expectedBurst?158/60:0));near(actionAxisDurationMs(x.team_dps.axis,x.single_interfaces)/1000,r.duration);
  const preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character)),out=evaluate(x);near(preview.duration,r.duration);near(out.duration,r.duration);assert.ok(r.resources.every(h=>h.time<=r.duration));
  x.team_dps.axis.endHit='exclude';assert.equal(compile(x).events.filter(e=>e.skirkBurst).length,expectedBurst?5:0);
 }
 const x=input([a('e','skill',0),a('q','burst',1000,3),a('ca','charged',5000,3),a('last','normal.1',12499),a('cap','normal.1',12500),a('q2','burst',12500)]),r=compile(x);assert.equal(r.events.find(h=>h.eventId==='last/normal.1').sevenPhase,true);assert.equal(r.events.find(h=>h.eventId==='cap/normal.1').sevenPhase,false);assert.equal(r.events.filter(h=>h.skirkBurst).length,6);
});
test('Skirk switch, repeat E, hold, constellations and no future resource traces',()=>{
 const x=input([a('e','skill',0),a('q','burst',1000,3),a('before','normal.1',2000),{...a('other','normal.1',2000),actor:'member2'},a('after','normal.1',2000),a('q2','burst',2100)],6),r=compile(x);assert.equal(r.events.find(e=>e.eventId==='before/normal.1').sevenPhase,true);assert.equal(r.events.find(e=>e.eventId==='after/normal.1').sevenPhase,false);assert.ok(r.events.filter(e=>e.skirkBurst&&!e.label.includes('六命')).every(e=>e.cunning===0));assert.equal(r.events.filter(e=>e.label==='一命·晶刃').length,3);assert.equal(r.events.filter(e=>e.label==='虚境裂隙·六命爆发追加').length,3);
 const repeated=compile(input([a('e','skill',0),a('q','burst',1000,0),a('e2','skill',2000),sw('tail',1,15000)]));assert.deepEqual(repeated.windows.skirkPhase.map(w=>w.end),[2,13]);assert.equal(repeated.windows.skirkC2[0].end,2);assert.equal(repeated.resources.find(h=>h.eventId==='e2').value,76);
 const held=compile(input([a('h','skill.hold',0,3),a('q','burst',12000)],6));assert.equal(held.windows.skirkPhase,undefined);assert.ok(held.events.filter(e=>e.skirkBurst&&!e.label.includes('六命')).every(e=>e.cunning===79));assert.ok(!held.resources.some(e=>e.label==='七相自然消耗'));
 const onlyE=compile(input([a('e','skill',0)]));assert.equal(onlyE.duration,0);assert.equal(onlyE.windows.skirkPhase[0].end,6.6);assert.equal(onlyE.resources.length,1);
 const low=input([a('e','skill',0),a('q','burst',1000,3),sw('tail',1,14000)],1);low.single_interfaces[0].character.level=20;low.single_interfaces[0].character.ascend=false;assert.equal(compile(low).windows.skirkPhase[0].end,6.6);assert.equal(compile(low).events.filter(e=>e.label==='一命·晶刃').length,0);
});
test('Repeated Q resets ten-hit counter and all Q windows close on resource exit',()=>{
 const timeline=[a('e','skill',0),a('q','burst',100,0),...Array.from({length:10},(_,i)=>a('n'+i,'normal.1',1000)),a('empty','normal.1',1000),a('q2','burst',1000,0),a('fresh','normal.1',1000),a('expired','normal.1',6600)];const r=compile(input(timeline));assert.equal(r.events.filter(h=>h.eventId.startsWith('n')&&h.qBonus).length,10);assert.equal(r.events.find(h=>h.eventId==='empty/normal.1').qBonus,false);assert.equal(r.events.find(h=>h.eventId==='fresh/normal.1').qBonus,true);assert.equal(r.events.find(h=>h.eventId==='expired/normal.1').qBonus,false);assert.deepEqual(r.windows.skirkC2.map(w=>w.end),[1,6.6]);
});
test('Native WASM and preview use physical attacks / ordinary Q after depletion, with stable inputs',()=>{
 const x=input([a('e','skill',0),a('q','burst',1000,0),a('ice','normal.1',6599),a('physical','normal.1',6600),a('q2','burst',7000)]),saved=JSON.stringify(x),out=evaluate(x),preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));
 assert.equal(out.hits.find(h=>h.eventId==='ice/normal.1').analysis.element,'Cryo');assert.equal(out.hits.find(h=>h.eventId==='physical/normal.1').analysis.element,'Physical');assert.equal(preview.roles[0].hits.find(h=>h.eventId==='physical/normal.1').element,'Physical');
 const burst=out.hits.filter(h=>h.skirkBurst);assert.equal(burst.length,6);for(const h of burst){const native=api.CalculatorInterface.get_damage_analysis({...out.profiles[0],artifacts:builds(x)[0],skill:{index:h.index,config:{Skirk:{cunning_stacks:0,seven_phase_mode:false,death_crossing_stacks:0,void_rift_count:0}}}},null);near(h.analysis.atk_ratio['技能倍率'],sum(native.atk_ratio));}
 const permutation=[2,0,3,1],moved=structuredClone(x);moved.single_interfaces=permutation.map(i=>x.single_interfaces[i]);moved.team_dps.axis.members=permutation.map(i=>x.team_dps.axis.members[i]);moved.team_dps.weapon_conditions=permutation.map(i=>x.team_dps.weapon_conditions[i]);near(evaluate(moved).expectation,out.expectation);assert.equal(JSON.stringify(x),saved);
});

test('Skirk resource details report actual deltas, including caps, paused drains and exit, through the Worker trace',async()=>{
 const x=input([a('e','skill',0),a('q','burst',1000,3),a('ca','charged',1100,3),sw('away',2,2000),a('hold','skill.hold',3000,3),a('q2','burst',4000)]);
 const rows=compile(x).resources;
 let previous=0;
 for(const row of rows){near(row.before,previous);near(row.after,row.value);near(row.amount,row.after-row.before);previous=row.after;}
 assert.equal(previous,0);
 const gained=rows.find(r=>r.eventId==='q'&&r.label==='吸收裂隙');assert.deepEqual([gained.before,gained.after,gained.amount],[38,62,24]);
 const paused=rows.find(r=>r.label==='吸收暂停消耗');assert.equal(paused.amount,0);assert.equal(paused.before,paused.after);
 const exit=rows.find(r=>r.label==='离开七相一闪');assert.ok(exit.before>0);assert.equal(exit.after,0);assert.equal(exit.amount,-exit.before);
 const capped=compile(input([a('h1','skill.hold',0,3),a('h2','skill.hold',1000,3),a('q','burst',2000)],6)).resources;
 const skill=capped.find(r=>r.eventId==='h2'&&r.label==='施放元素战技'),absorb=capped.find(r=>r.eventId==='h2'&&r.label==='吸收裂隙');
 assert.deepEqual([skill.before,skill.after,skill.amount],[79,100,21]);assert.deepEqual([absorb.before,absorb.after,absorb.amount],[100,100,0]);
 const native=evaluate(x),compiled=(await nodeTeamDps(x,builds(x).flat(),{mode:'evaluate'})).results[0];
 near(compiled.expectation,native.expectation);compareEventValues(compiled.eventTrace,nativeEventTrace(native));
 const resource=compiled.eventTrace.events.filter(e=>e.channel==='resources').flatMap(e=>e.states.map(s=>s.value));
 assert.equal(resource.length,rows.length);resource.forEach((row,i)=>{near(row.before,rows[i].before);near(row.after,rows[i].after);near(row.amount,rows[i].amount);});
});

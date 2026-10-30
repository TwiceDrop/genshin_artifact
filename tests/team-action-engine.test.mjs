import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {builds} from '../beta-tools/team-dps-full-audit.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../beta-data/team-engine/index.mjs';
import {actionAxisDurationMs} from '../beta-data/team-engine/action-config.mjs';
import {parseTeamDpsConfiguration} from '../beta-data/team-dps-config.mjs';
import {actionInput} from './helpers/team-action-configuration.mjs';
import {eventKey} from '../beta-data/team-engine/event-order.mjs';
const near=(a,b,label='')=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
const row=(id,actor,action,timeMs,params)=>({id,actor,kind:'action',action,timeMs,...(params?{params}:{})});
const fixture=(timeline,cons=0)=>{const x=actionInput();x.team_dps.axis.timeline=timeline;x.single_interfaces.forEach(p=>p.character.constellation=cons);return x;};
const evaluate=x=>createTeamDpsEvaluator(api,x).evaluate(builds(x),true);
const compile=x=>compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps);
const spent=(out,hit)=>out.effects.find(e=>e.kind==='consume'&&e.effectId.startsWith('vodyanitsa.a4.')&&e.eventId===eventKey(hit));

test('V1: independent Salon clocks, recast replacement and automatic terminal hit',()=>{
 const x=fixture([row('e','hydro','skill',0),row('end','carry','normal.1',10000)]),base=compile(x);
 near(base.duration,10);assert.ok(!base.events.some(h=>h.role===1&&h.time===0));
 for(const [index,time]of [[9,.3],[11,110/60],[10,133/60],[12,131/60]])near(base.events.find(h=>h.role===1&&h.index===index).time,time,'first/'+index);
 const repeated=structuredClone(x);repeated.team_dps.axis.timeline.push(row('e2','hydro','skill',4000));const again=compile(repeated);
 assert.ok(!again.events.some(h=>h.eventId.startsWith('e/salon')&&h.time>=4));
 near(again.events.find(h=>h.eventId.startsWith('e2/salon-11')).time,4+110/60);
 assert.ok(again.events.filter(h=>h.hpDrain).every(h=>h.hpDrainTime<h.time));
 const q=fixture([row('q','hydro','burst',5000)]);near(actionAxisDurationMs(q.team_dps.axis),7000);near(compile(q).events.at(-1).time,7);
 q.team_dps.axis.durationMs=1;near(compile(q).duration,7);parseTeamDpsConfiguration(JSON.stringify(q.team_dps.axis));
 q.team_dps.axis.endHit='exclude';assert.equal(compile(q).events.length,0);
 const onlyE=fixture([row('e','hydro','skill',0)]);near(compile(onlyE).duration,.3);assert.equal(compile(onlyE).events.length,1);
});
test('V1: Skirk hold charges resource without Seven-Phase; both burst forms and constellations derive from role',()=>{
 for(const cons of [0,6]){
  const x=fixture([row('hold','carry','skill.hold',0,{absorbedRifts:3}),row('q','carry','burst',1000)],cons),out=evaluate(x),q=out.hits.filter(h=>h.label.startsWith('极恶技·灭'));
  assert.equal(q.length,6);assert.deepEqual(q.map(h=>h.index),[15,15,15,15,15,16]);near(out.duration,1+158/60);
  const resource=out.resources.find(h=>h.label==='吸收裂隙');assert.equal(resource.value,69+(cons>=2?10:0));assert.equal(out.resources.filter(h=>h.resource==='蛇之狡谋').at(-1).value,0);
  const native=api.CalculatorInterface.get_damage_analysis({...out.profiles[0],artifacts:builds(x)[0],skill:{index:15,config:{Skirk:{cunning_stacks:resource.value,seven_phase_mode:false,death_crossing_stacks:0,void_rift_count:0}}}},null);
  near(q[0].analysis.atk_ratio['技能倍率'],sum(native.atk_ratio),'native burst ratio');
  assert.equal(out.hits.filter(h=>h.label==='一命·晶刃').length,cons?3:0);assert.equal(out.hits.filter(h=>h.label==='虚境裂隙·六命爆发追加').length,cons?3:0);
 }
 const normal=fixture([row('hold','carry','skill.hold',0,{absorbedRifts:1}),row('n','carry','normal.1',1000)]),physical=compile(normal).events.find(h=>h.eventId==='n/normal.1');assert.equal(physical.index,0);assert.equal(physical.element,'Physical');
 const phase=fixture([row('tap','carry','skill',0),row('q','carry','burst',500,{absorbedRifts:2}),row('n','carry','normal.1',1000)],2),seven=compile(phase);assert.ok(!seven.events.some(h=>h.skirkBurst));assert.ok(seven.events.find(h=>h.eventId==='n/normal.1').qBonus);assert.ok(seven.covered('skirkC2',1));
 const leave=fixture([row('tap','carry','skill',0),{id:'leave',kind:'switch',actor:'hydro',timeMs:500},row('q','carry','burst',1000)]);leave.team_dps.axis.initialActiveSlot='carry';assert.equal(compile(leave).events.filter(h=>h.skirkBurst).length,6);near(actionAxisDurationMs(leave.team_dps.axis),1000+158/60*1000);
 const implicit=fixture([row('tap','carry','skill',0),row('other-q','hydro','burst',500),row('q','carry','burst',1000)]),left=compile(implicit);assert.equal(left.events.filter(h=>h.skirkBurst).length,6);assert.equal(left.covered('skirkPhase',.5),false);near(actionAxisDurationMs(implicit.team_dps.axis),1000+158/60*1000);
});
test('V1: Vodyanitsa burst reads live Song coverage and candidate HP; C2 duration comes from the role',()=>{
 const no=fixture([row('q','support','burst',1000)]),yes=fixture([row('e','support','skill',0),row('q','support','burst',1000)]);
 const plain=evaluate(no).hits.find(h=>h.index===11&&h.role===3),ev=createTeamDpsEvaluator(api,yes),team=builds(yes),out=ev.evaluate(team,true),boosted=out.hits.find(h=>h.index===11&&h.role===3);
 assert.equal(plain.analysis.hp_ratio['遥久之歌·独立倍率'],undefined);near(boosted.analysis.hp_ratio['遥久之歌·独立倍率'],plain.analysis.hp_ratio['技能倍率']*.864);
 const stronger=structuredClone(team);stronger[3].forEach(a=>{a.id+=900000;a.sub_stats.push(['HPPercentage',.5]);});assert.ok(ev.evaluate(stronger).character_damage[3].expectation>out.character_damage[3].expectation);near(ev.evaluate(team).expectation,out.expectation,'candidate reset');
 for(const cons of [0,2]){const x=fixture([row('e','support','skill',0),row('q','support','burst',20000)],cons),r=evaluate(x),h=r.hits.find(h=>h.index===11&&h.role===3);assert.equal(!!h.analysis.hp_ratio['遥久之歌·独立倍率'],cons>=2);}
 const lasting=fixture([row('e','support','skill',0),row('q','carry','burst',20000)]);lasting.team_dps.axis.initialActiveSlot='carry';
 const later=compile(lasting),laterResult=evaluate(lasting);assert.equal(later.covered('vodySong',20),false);assert.ok(laterResult.hits.filter(h=>h.skirkBurst).every(h=>spent(laterResult,h)?.used>0));
 lasting.team_dps.axis.timeline=[row('e','support','skill',0),row('q','carry','burst',30000)];const expired=evaluate(lasting);assert.ok(expired.hits.filter(h=>h.skirkBurst).every(h=>!spent(expired,h)));
 // Commands implicitly enter their owner; existing axes do not need switch
 // rows between skills. Derived summons never change the active character.
 const switchTo=(id,actor,timeMs)=>({id,actor,timeMs,kind:'switch'}),axis=fixture([
  row('f-e','hydro','skill',0),row('f-q','hydro','burst',500),switchTo('switch-f','hydro',2500),row('e-e','healer','skill',2500),row('e-q','healer','burst',3000),switchTo('switch-e','healer',4500),row('v-e','support','skill',4500),switchTo('switch-v','support',5500),row('s-e','carry','skill.hold',6000,{absorbedRifts:3}),row('s-q','carry','burst',6500)
 ]);axis.team_dps.axis.initialActiveSlot='carry';axis.team_dps.damage_scope='single';axis.team_dps.enemy_count=1;
 const commands=compile(axis),frontResult=evaluate(axis),front=frontResult.hits.filter(h=>h.skirkBurst);
 assert.equal(commands.activeRole(8.32),0);assert.ok(front.every(h=>h.onField&&spent(frontResult,h)?.effectId==='vodyanitsa.a4.front'&&spent(frontResult,h).used===1));assert.deepEqual(front.slice(0,5).map(h=>h.part),[0,1,2,3,4]);
 const summon=commands.events.find(h=>h.role===1&&h.time===8.35);assert.equal(summon.onField,false);assert.equal(commands.activeRole(summon.time,summon.rootOrder),0);
 const noSwitch=structuredClone(axis);noSwitch.team_dps.axis.timeline=noSwitch.team_dps.axis.timeline.filter(a=>a.kind!=='switch');const automatic=compile(noSwitch),automaticResult=evaluate(noSwitch);assert.ok(automaticResult.hits.filter(h=>h.skirkBurst).every(h=>h.onField&&spent(automaticResult,h)?.used>0));assert.ok(automatic.roots.some(h=>h.kind==='switch'&&h.implicit&&h.from===3&&h.role===0&&h.time===6));
 // The earlier Parfait at 4.5s precedes Vodyanitsa's E and cannot spend its
 // future pool. Only E itself has spent six uses when this burst begins.
 const multiple=structuredClone(noSwitch);multiple.team_dps.damage_scope='all';multiple.team_dps.enemy_count=6;const all=evaluate(multiple);assert.deepEqual(all.hits.filter(h=>h.skirkBurst).map(h=>spent(all,h)?.used??0),[6,6,6,1,0,0]);
 // An explicit switch during an already-cast burst does put its later hits
 // off field. Rechant remains a shared ten-target pool and refreshes on E.
 const delayed=fixture([row('e','support','skill',0),row('hold','carry','skill.hold',500),row('q','carry','burst',1000),switchTo('leave','support',2830)]);delayed.team_dps.damage_scope='all';delayed.team_dps.enemy_count=3;
 const backResult=evaluate(delayed),back=backResult.hits.filter(h=>h.skirkBurst);assert.deepEqual(back.map(h=>spent(backResult,h)?.used??0),[3,3,3,3,1,0]);assert.deepEqual(back.map(h=>h.onField),[true,false,false,false,false,false]);
 delayed.team_dps.axis.timeline.push(row('refresh','support','skill',3100));const refreshed=evaluate(delayed);assert.equal(spent(refreshed,refreshed.hits.find(h=>h.eventId==='q/burst/4')).used,3);
 const perm=[3,0,2,1],changed=structuredClone(yes);changed.single_interfaces=perm.map(r=>yes.single_interfaces[r]);changed.team_dps.axis.members=perm.map(r=>yes.team_dps.axis.members[r]);changed.team_dps.weapon_conditions=perm.map(r=>yes.team_dps.weapon_conditions[r]);near(evaluate(changed).expectation,out.expectation,'role order');
 const dir='.build-target/team-event-refactor-20261029';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+'/character-mechanics.json',JSON.stringify({plainBurst:plain.expectation,songBurst:boosted.expectation,axisSeconds:out.duration,reordered:true,automaticSwitches:automatic.switches,frontBurstUses:front.map(h=>spent(frontResult,h).used),delayedBurstBackground:back.map(h=>({time:h.time,onField:h.onField,...spent(backResult,h)}))},null,2));
});

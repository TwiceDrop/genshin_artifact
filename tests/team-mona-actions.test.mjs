import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {api} from '../beta-tools/runtime-7106.mjs';import {fixture} from '../beta-tools/interface-audit-7108.mjs';import {sample,builds} from '../beta-tools/team-dps-full-audit.mjs';
import {createActionAxis,actionAxisDurationMs,validateActionAxis} from '../beta-data/team-engine/action-config.mjs';import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';import {changeTeamConstellation} from '../beta-data/team-dps-character-rules.mjs';
const names=['Skirk','Furina','Escoffier','Mona'],a=(id,r,action,timeMs,params)=>({id,kind:'action',actor:'member'+r,action,timeMs,...(params?{params}:{})});
function input(timeline){const x=sample(),p=fixture('Mona');p.artifacts=x.single_interfaces[3].artifacts;x.single_interfaces[3]=p;x.single_interfaces.forEach(p=>p.character.constellation=0);x.team_dps.axis={...createActionAxis('synthetic-mona',names),timeline};return x;}
const compile=x=>compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),evaluate=x=>createTeamDpsEvaluator(api,x).evaluate(builds(x),true),sum=x=>Object.values(x).reduce((a,b)=>a+b,0),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Mona bubble: fixed/auto/expiry/replacement share exact duration and terminal boundary',()=>{
 const x=input([a('q',4,'burst',8000,{bubbleDelayMs:2000})]),r=compile(x);near(r.duration,10+1/60);near(actionAxisDurationMs(x.team_dps.axis,x.single_interfaces)/1000,r.duration);assert.equal(r.events.length,1);near(r.events[0].time,10+1/60);assert.equal(r.windows.monaOmen[0].start,8);assert.equal(r.windows.monaOmen[0].end,15);
 x.team_dps.axis.endHit='exclude';assert.equal(compile(x).events.length,0);
 const auto=input([a('early',1,'normal.1',1000),a('q',4,'burst',1000),a('hit',1,'normal.1',2000)]),ar=compile(auto);near(ar.events.find(h=>h.monaBubble).time,2+1/60);near(ar.duration,2+1/60);
 auto.team_dps.axis.timeline.pop();near(compile(auto).duration,9+1/60);assert.equal(compile(auto).events.filter(h=>h.monaBubble).length,1);
 auto.team_dps.axis.timeline.push(a('second',4,'burst',1500,{bubbleDelayMs:2000}));const repeat=compile(auto);assert.equal(repeat.events.filter(h=>h.monaBubble).length,1);assert.equal(repeat.events.find(h=>h.monaBubble).eventId,'second/bubble');near(repeat.duration,3.5+1/60);
 const same=input([a('q',4,'burst',1000),a('hit',1,'normal.1',1000)]);near(compile(same).events.find(h=>h.monaBubble).time,1+1/60);
});
test('Mona native Q coefficient, Omen and C4 match independent actual-WASM controls',()=>{
 const x=input([a('q',4,'burst',0,{bubbleDelayMs:2000}),a('hit',1,'normal.1',3000),a('end',1,'normal.1',7000)]),p=x.single_interfaces[3];p.weapon={name:'ApprenticesNotes',level:1,ascend:false,refine:1,params:'NoConfig'};
 for(const [cons,level]of [[0,0],[0,9],[4,12]]){p.character.constellation=cons;p.character.skill3=level;const out=evaluate(x),h=out.hits.find(h=>h.monaBubble),native=api.CalculatorInterface.get_damage_analysis({...structuredClone(p),skill:{index:10,config:{Mona:{c6_charged_stack:0,c6_omen:false}}},buffs:[]},null);near(sum(h.analysis.atk_ratio),sum(native.atk_ratio));
  const neutral={...structuredClone(p),buffs:[]},buffed={...neutral,buffs:[{name:'MonaQ',config:{MonaQ:{skill3:level+1,c4:cons>=4,c4_magus:false}}}]},before=api.CalculatorInterface.get_damage_analysis(neutral,null),after=api.CalculatorInterface.get_damage_analysis(buffed,null);
  const inside=out.hits.find(h=>h.eventId==='hit/normal.1'),outside=out.hits.find(h=>h.eventId==='end/normal.1');near(inside.bonus-outside.bonus,sum(after.bonus)-sum(before.bonus));near(inside.crit-outside.crit,sum(after.critical)-sum(before.critical));
  const selfBuff=api.CalculatorInterface.get_damage_analysis({...neutral,buffs:[{name:'MonaQ',config:{MonaQ:{skill3:level+1,c4:cons>=4,c4_magus:cons>=4}}}]},null);near(h.crit_damage-sum(native.critical_damage),sum(selfBuff.critical_damage)-sum(before.critical_damage));
 }
});
test('Mona Omen duration follows talent levels 1/4/7, with an exclusive end boundary',()=>{
 const x=input([a('q',4,'burst',0,{bubbleDelayMs:2000})]);
 for(const [level,duration]of [[1,4],[3,4],[4,4.5],[6,4.5],[7,5],[10,5],[15,5]]){x.single_interfaces[3].character.skill3=level-1;const r=compile(x),end=2+duration;assert.equal(r.windows.monaOmen[0].end,end);assert.equal(r.covered('monaOmen',end-.001),true);assert.equal(r.covered('monaOmen',end),false);}
});
test('Mona shared Q hooks: TTDS, Prototype Amber and native recharge conversion',()=>{
 const x=input([a('q',4,'burst',0,{bubbleDelayMs:2000}),a('first',1,'normal.1',1000),a('last',1,'normal.1',11000)]),m=x.single_interfaces[3];m.weapon={name:'ThrillingTalesOfDragonSlayers',level:90,ascend:false,refine:5,params:'NoConfig'};const boosted=evaluate(x),first=boosted.hits.find(h=>h.eventId==='first/normal.1');assert.ok(first.analysis.atk['讨龙英杰谭']>0);
 m.weapon={name:'PrototypeAmber',level:90,ascend:false,refine:5,params:'NoConfig'};x.team_dps.initial_hp=[.5,.5,.5,.5];const healed=evaluate(x);assert.deepEqual(healed.heals.filter(h=>h.healing==='prototype_amber').map(h=>h.time),[2,4,6]);
 const baseline=api.CommonInterface.get_attribute(m);m.artifacts[2].main_stat=['Recharge',.518];const more=api.CommonInterface.get_attribute(m);near(sum(more.bonus_hydro)-sum(baseline.bonus_hydro),.518*.2);
});
test('Mona sample, preview, constellation levels and repeated reads preserve inputs',()=>{
 const x=input([]);x.team_dps.axis=JSON.parse(fs.readFileSync('examples/team-dps/skirk-mona-actions-22s.json','utf8'));const saved=JSON.stringify(x),r=compile(x),preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));near(r.duration,22);assert.equal(r.events.find(h=>h.monaBubble).onField,false);assert.equal(r.windows.monaOmen[0].end,15);assert.equal(preview.roles[3].hits.length,1);near(preview.roles[3].base.atk,7.9632);assert.equal(JSON.stringify(x),saved);
 const c=structuredClone(x.single_interfaces[3].character);changeTeamConstellation(c,6);assert.equal(c.skill3,12);assert.equal(c.skill2,12);changeTeamConstellation(c,0);assert.equal(c.skill3,9);assert.equal(c.skill2,9);
 const invalid=structuredClone(x.team_dps.axis);invalid.timeline.find(a=>a.id==='mona-q').params.bubbleDelayMs=8001;assert.throws(()=>validateActionAxis(invalid),/0～8秒/);
});

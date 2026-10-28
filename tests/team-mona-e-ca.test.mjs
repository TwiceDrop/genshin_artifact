import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';import {fixture} from '../beta-tools/interface-audit-7108.mjs';import {sample,builds} from '../beta-tools/team-dps-full-audit.mjs';
import {createActionAxis,actionAxisDurationMs} from '../beta-data/team-engine/action-config.mjs';import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
const names=['Vodyanitsa','Furina','Escoffier','Mona'],a=(id,action,timeMs,params)=>({id,kind:'action',actor:'member4',action,timeMs,...(params?{params}:{})}),sw=(id,actor,timeMs)=>({id,kind:'switch',actor:'member'+actor,timeMs});
const sum=x=>Object.values(x).reduce((a,b)=>a+b,0),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function input(timeline){const x=sample();x.single_interfaces=names.map((n,i)=>{const p=fixture(n);p.artifacts=x.single_interfaces[i].artifacts;p.character.constellation=0;p.buffs=[];return p;});x.single_interfaces[3].weapon={name:'ApprenticesNotes',level:1,ascend:false,refine:1,params:'NoConfig'};x.team_dps.axis={...createActionAxis('synthetic-mona-e-ca',names),timeline};return x;}
const compile=x=>compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),evaluate=x=>createTeamDpsEvaluator(api,x).evaluate(builds(x),true);
test('Mona E: four ticks and explosion, tap/hold clocks, replacement, tail and actual-WASM ratios',()=>{
 for(const [action,frames]of [['skill',[86,145,204,263,329]],['skill.hold',[101,160,219,278,344]]]){
  const x=input([a('e',action,0),sw('out',1,500)]),r=compile(x);assert.equal(r.events.length,5);r.events.forEach((e,i)=>near(e.time,frames[i]/60));assert.deepEqual(r.events.map(e=>e.index),[8,8,8,8,9]);assert.ok(r.events.every(e=>!e.onField));near(r.duration,frames[4]/60);near(actionAxisDurationMs(x.team_dps.axis,x.single_interfaces)/1000,r.duration);
  const result=evaluate(x),preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));result.hits.forEach((h,i)=>near(sum(h.analysis.atk_ratio),i===4?2.3904:.576));near(preview.roles[3].base.atk,4*.576+2.3904);near(result.duration,preview.duration);
  x.team_dps.axis.endHit='exclude';assert.equal(compile(x).events.length,4);
 }
 const x=input([a('e1','skill',0),a('e2','skill.hold',2000)]),r=compile(x);assert.equal(r.events.filter(e=>e.eventId.startsWith('e1/')).length,1);assert.equal(r.events.filter(e=>e.eventId.startsWith('e2/')).length,5);near(r.duration,2+344/60);
 const same=input([a('e1','skill',0),a('e2','skill',0)]);assert.ok(compile(same).events.every(e=>e.eventId.startsWith('e2/')));
});
test('Mona E snapshots caster attack, but Omen and target resistance use impact time',()=>{
 const x=input([sw('in',4,0),a('e','skill',9000),a('q','burst',11000,{bubbleDelayMs:2000})]);x.single_interfaces[3].weapon={name:'TheWidsith',level:90,ascend:false,refine:5,params:'NoConfig'};x.team_dps.widsith_mode={3:'t1_rate'};
 const result=evaluate(x),phantom=result.hits.filter(h=>h.eventId.startsWith('e/')),atk=phantom.map(h=>sum(h.analysis.atk));assert.ok(phantom.every(h=>h.analysis.atk['流浪乐章被动等效（宣叙调）']>0));atk.forEach(v=>near(v,atk[0]));assert.ok(phantom[1].bonus>phantom[0].bonus+.59);
 const p=x.single_interfaces[3],native=api.CalculatorInterface.get_damage_analysis({...structuredClone(p),skill:{index:8,config:{Mona:{c6_charged_stack:0,c6_omen:false}}},weapon:{...p.weapon,params:{TheWidsith:{t1_rate:0,t2_rate:0,t3_rate:0}}}},null);assert.ok(atk[0]>sum(native.atk));
 const es={id:'esco',kind:'action',actor:'member3',action:'skill',timeMs:11000};x.team_dps.axis.timeline.push(es);const debuffed=evaluate(x).hits.filter(h=>h.eventId.startsWith('e/'));assert.ok(sum(debuffed[1].analysis.res_minus)>sum(debuffed[0].analysis.res_minus));
});
test('Mona charged: native Hydro coefficient, bubble trigger, C2 and C6 gain/consume/off-field/expiry',()=>{
 const x=input([a('q','burst',0),a('ca','charged',3100),a('again','charged',3200),a('next','charged',4100),sw('out',1,4200),a('back','charged',5100),a('expired','charged',17000)]);let r=compile(x);near(r.events.find(e=>e.monaBubble).time,3.1+1/60);let result=evaluate(x);near(sum(result.hits.find(h=>h.eventId==='ca/charged').analysis.atk_ratio),2.695);
 x.single_interfaces[3].character.constellation=6;r=compile(x);const charged=r.events.filter(e=>e.category==='charged');assert.deepEqual(charged.map(e=>e.monaC6Stacks),[3,0,1,0,0]);assert.deepEqual(charged.map(e=>e.monaC6Omen),[true,true,true,true,false]);result=evaluate(x);const rows=result.hits.filter(e=>e.category==='charged');near(sum(rows[0].analysis.atk_ratio),5.39);near(sum(rows.at(-1).analysis.atk_ratio),2.695);near(rows[0].bonus-rows[1].bonus,1.8);assert.equal(r.covered('monaC2',29),false);assert.equal(r.covered('monaC2',28.999),true);assert.equal(rows[0].analysis.em['莫娜·星月的连珠'],80);
 const saved=JSON.stringify(x);createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));evaluate(x);assert.equal(JSON.stringify(x),saved);
});

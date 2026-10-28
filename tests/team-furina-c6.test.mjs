import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';import {fixture} from '../beta-tools/interface-audit-7108.mjs';import {sample,builds} from '../beta-tools/team-dps-full-audit.mjs';
import {createActionAxis,actionAxisDurationMs,validateActionAxis,TEAM_ACTION_CATALOG} from '../beta-data/team-engine/action-config.mjs';import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
const a=(id,action,timeMs=0)=>({id,actor:'member2',kind:'action',action,timeMs}),tail=t=>({id:'tail',kind:'switch',actor:'member2',timeMs:t}),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`),sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
function input(timeline,c=6){const x=sample();x.single_interfaces.forEach(p=>p.character.constellation=0);x.single_interfaces[1].character.constellation=c;x.team_dps.axis={...createActionAxis('synthetic-furina',['Skirk','Furina','Escoffier','Vodyanitsa']),initialActiveSlot:'member2',timeline};return x;}
const compile=x=>compileActionAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),evaluate=x=>createTeamDpsEvaluator(api,x).evaluate(builds(x),true),preview=x=>createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character));
test('Furina N1–N4 and all plunge coefficients come from the running native kernel',()=>{
 assert.deepEqual(TEAM_ACTION_CATALOG.Furina.filter(x=>x.id.startsWith('normal')).map(x=>x.id),['normal.1','normal.2','normal.3','normal.4']);
 const x=input([a('e','skill'),...Array.from({length:4},(_,i)=>a('n'+(i+1),'normal.'+(i+1),1000+i*500)),a('low','plunge.low',3500),a('high','plunge',4000),a('collision','plunge.collision',4500)]),saved=JSON.stringify(x);validateActionAxis(x.team_dps.axis);
 const out=evaluate(x),p=fixture('Furina');p.character.constellation=6;const view=preview(x);
 for(const [id,index]of [['n1',0],['n2',1],['n3',2],['n4',3],['low',6],['high',7],['collision',5]]){const hit=out.hits.find(h=>h.eventId.startsWith(id+'/')&&!h.arkheStrike);p.skill={index,config:{Furina:{hp_above50_count:0,c6_after_e:hit.furinaC6,c6_pneuma:false}}};const native=api.CalculatorInterface.get_damage_analysis(p,null);near(sum(hit.analysis.atk_ratio),sum(native.atk_ratio));near(sum(hit.analysis.hp_ratio),sum(native.hp_ratio));assert.equal(hit.element,hit.furinaC6?'Hydro':'Physical');near(view.roles[1].hits.find(h=>h.eventId===hit.eventId).base.atk,sum(native.atk_ratio));}
 const arkhe=out.hits.find(h=>h.arkheStrike);assert.equal(arkhe.element,'Hydro');near(sum(arkhe.analysis.hp_ratio),.18);near(view.roles[1].hits.find(h=>h.eventId===arkhe.eventId).effective.hp,.18);assert.equal(JSON.stringify(x),saved);
});
test('charged attack uses the old alignment then switches damage, summons and healing',()=>{
 const x=input([a('e','skill'),a('p1','plunge',500),a('c1','charged',1000),a('p2','plunge',1500),a('c2','charged',4000),a('p3','plunge',4500),tail(6000)]),out=evaluate(x),r=compile(x);
 const primary=id=>out.hits.find(h=>h.eventId===id+'/'+({c1:'charged',c2:'charged'}[id]||'plunge'));
 for(const [id,ratio]of [['p1',.18],['c1',.18],['p2',.43],['c2',.43],['p3',.18]])near(sum(primary(id).analysis.hp_ratio),ratio);
 assert.ok(primary('p2').expectation>primary('p1').expectation);assert.ok(!out.hits.some(h=>h.hpDrain&&h.time>=1&&h.time<=4));assert.ok(out.hits.some(h=>h.hpDrain&&h.time>4));
 const drains=out.health.filter(h=>h.kind==='current_hp_drain');assert.deepEqual(drains.map(h=>h.time),[1.5,4]);
 const before=out.health.filter(h=>h.time<1.5||h.time===1.5&&h.rootOrder<drains[0].rootOrder).at(-1);drains[0].ratios.forEach((v,i)=>near(v,before.ratios[i]*.99));
 assert.ok(out.heals.some(h=>h.healing==='furina_singer'&&h.time>1&&h.time<4));assert.ok(out.heals.some(h=>h.healing==='furina_c6'&&h.time>1));
 assert.equal(r.roots.find(h=>h.id==='c1').arkhe,'ousia');assert.equal(r.roots.find(h=>h.id==='c2').arkhe,'pneuma');
 const delayed=input([a('e','skill'),a('c','charged',1600),tail(2200)],0),d=evaluate(delayed);assert.equal(d.hits.filter(h=>h.hpDrain).length,0);assert.equal(d.health.filter(h=>h.kind==='salon_drain').length,3);
});
test('C6 shared six procs, 0.1s trigger interval, ten-second expiry and E refresh',()=>{
 const x=input([a('e','skill'),...Array.from({length:7},(_,i)=>a('p'+i,'plunge',500+i*200)),tail(2200)]),r=compile(x);assert.deepEqual(r.events.filter(h=>h.category==='plunge').map(h=>h.furinaC6),[true,true,true,true,true,true,false]);
 x.team_dps.axis.timeline=[a('e','skill'),a('p1','plunge',500),a('p2','plunge',550),...Array.from({length:5},(_,i)=>a('p'+(i+3),'plunge',600+i*100)),a('last','plunge',1100)];assert.deepEqual(compile(x).events.filter(h=>h.category==='plunge').map(h=>h.furinaC6),[true,true,true,true,true,true,true,false]);
 x.team_dps.axis.timeline=[a('e','skill'),a('c','charged',9999),a('expired','plunge',10000),a('e2','skill',11000),a('renewed','plunge',11000)];const b=compile(x);assert.equal(b.events.find(h=>h.eventId==='expired/plunge').furinaC6,false);assert.equal(b.events.find(h=>h.eventId==='renewed/plunge').furinaC6,true);assert.equal(b.events.some(h=>h.eventId==='e2/bubble'),false);
 const same=input([a('e','skill'),a('c','charged',1000),a('p','plunge',1000)]);assert.equal(compile(same).events.find(h=>h.eventId==='p/plunge').arkhe,'pneuma');
 const reverse=input([a('e','skill'),a('p','plunge',1000),a('c','charged',1000)]);assert.equal(compile(reverse).events.find(h=>h.eventId==='p/plunge').arkhe,'ousia');
});
test('Singer ticks use current candidate HP, native healing and stop on replacement/expiry',()=>{
 const x=input([a('c','charged'),a('e','skill',100),tail(7000)],0);x.team_dps.initial_hp=[.1,.1,.1,.1];const out=evaluate(x),heals=out.heals.filter(h=>h.healing==='furina_singer');assert.ok(heals.length>=3);near(heals[0].time,.1+73/60);
 const hp=sum(out.panels[1].hp),frames=Math.floor(120*(1-Math.min(.16,hp*.000004))+.5);near(heals[1].time-heals[0].time,frames/60);assert.ok(heals.every(h=>h.recipients.length===1&&h.recipients[0]===1));
 const p=structuredClone(out.profiles[1]);p.artifacts=builds(x)[1];p.buffs.push({name:'ExtensionEffect',config:{ExtensionEffect:{label:'双水共鸣',values:{HPPercentage:.25}}}});p.skill={index:13,config:{Furina:{hp_above50_count:0,c6_after_e:false,c6_pneuma:false}}};const native=api.CalculatorInterface.get_damage_analysis(p,null);near(heals[0].rawAmounts[0],(sum(native.hp)*sum(native.hp_ratio)+sum(native.extra_damage))*(1+sum(native.healing_bonus)));
 x.team_dps.axis.timeline=[a('e','skill'),a('c','charged',1000),a('e2','skill',2000),tail(4000)];const rep=evaluate(x).heals.filter(h=>h.healing==='furina_singer');assert.ok(rep.every(h=>h.eventId.startsWith('e2/')));
 x.team_dps.axis.timeline=[a('e','skill'),a('c','charged',29000),tail(32000)];assert.equal(evaluate(x).heals.filter(h=>h.healing==='furina_singer').length,0);
});
test('terminal Arkhe, form-dependent E completion and exclude policy share editor/preview/scoring duration',()=>{
 for(const [rows,expected]of [[ [a('n','normal.1',1000)],1.5],[[a('n1','normal.1',1000),a('n2','normal.2',2000)],2],[[a('c','charged'),a('e','skill',1000)],1]]){
  const x=input(rows,0),out=evaluate(x),v=preview(x);near(out.duration,expected);near(v.duration,expected);near(actionAxisDurationMs(x.team_dps.axis,x.single_interfaces)/1000,expected);
  x.team_dps.axis.endHit='exclude';assert.ok(evaluate(x).hits.every(h=>h.time<expected));
 }
});

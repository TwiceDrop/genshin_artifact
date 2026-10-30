import test from 'node:test';import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {createActionAxis,actionAxisDurationMs} from '../beta-data/team-engine/action-config.mjs';
import {compileActionAxis} from '../beta-data/team-engine/timeline.mjs';
import {normalizeTeamProfiles,createCharacterRules} from '../beta-data/team-engine/registry.mjs';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {createSkillMultiplierPreview} from '../beta-data/team-engine/multiplier-preview.mjs';
import {normalizeEnemy} from '../beta-data/enemy-interface.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const a=(r,action,t)=>({kind:'action',actor:'member'+(r+1),action,timeMs:t*1000}),end=t=>({kind:'switch',actor:'member4',timeMs:t*1000});
function input(rows,cons=0,names=['YaeMiko','Qiqi','Odette','Sandrone']){const axis=createActionAxis('synthetic-yae',names);axis.timeline=rows.map((e,i)=>({...e,id:'a'+i}));return {single_interfaces:names.map((n,i)=>{const p=fixture(n);p.artifacts=[];p.character.constellation=i?0:cons;return p;}),team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:1,damage_scope:'single'}};}
const rot=x=>compileActionAxis(x.team_dps.axis,normalizeTeamProfiles(x.single_interfaces),x.team_dps);
const run=x=>createTeamDpsEvaluator(api,x).evaluate(x.single_interfaces.map(p=>p.artifacts),true);
const own=r=>r.events.filter(e=>e.role===0),sakura=r=>own(r).filter(e=>e.yaeSakura);
const values=buffs=>Object.assign({},...buffs.map(b=>b.config.ExtensionEffect.values));

test('three independent Sakura clocks, dynamic rank, replacement, expiry, background and shared ICD',()=>{
 const x=input([a(0,'skill',0),a(0,'skill',.95),a(0,'skill',1.9),end(27)]),r=rot(x),hits=sakura(r);
 assert.deepEqual(hits.slice(0,3).map(h=>h.index),[8,9,9]);
 hits.slice(0,3).forEach((h,i)=>near(h.time,[121/60,.95+121/60,1.9+121/60][i]));
 assert.equal(hits.length,24);assert.ok(hits.some(e=>e.time>24));
 assert.ok(hits.every(e=>e.application.group==='yae.sakura'));assert.equal(hits.slice(0,3).filter(e=>e.applicationTargets.length).length,1);
 assert.ok(hits.filter(e=>e.time>=27).length===0);assert.equal(own(r).filter(e=>e.index===13).length,0);
 const back=rot(input([a(0,'skill',0),a(0,'skill',.95),a(0,'skill',1.9),{...end(2),timeMs:2000},end(10)]));
 assert.ok(sakura(back).every(e=>!e.onField));assert.equal(back.activeRole(5),3);
 const replace=rot(input([a(0,'skill',0),a(0,'skill',.95),a(0,'skill',1.9),a(0,'skill',4),end(10)]));
 assert.ok(!sakura(replace).some(e=>e.yaeSakura==='a0'&&e.time>4.6));assert.ok(sakura(replace).some(e=>e.yaeSakura==='a1'&&e.time>4.6));
 assert.equal(own(replace).filter(e=>e.index===13).length,1);near(own(replace).find(e=>e.index===13).time,4+98/60);
 const c2=rot(input([a(0,'skill',0),a(0,'skill',.95),a(0,'skill',1.9),end(4)],2));assert.deepEqual(sakura(c2).slice(0,3).map(e=>e.index),[9,10,10]);
});

test('Q counts Sakura at cast, retains them, and ends after actual thunderbolts; terminal E does not run summons forever',()=>{
 for(let n=0;n<=3;n++){
  const x=input([...Array.from({length:n},(_,i)=>a(0,'skill',i)),a(0,'burst',4)]),r=rot(x),q=own(r).filter(e=>e.category==='burst');
  assert.equal(q.length,n+1);near(r.duration,4+(n?154/60+(n-1)*.4:100/60));near(actionAxisDurationMs(x.team_dps.axis,x.single_interfaces)/1000,r.duration);
  assert.ok(sakura(r).length>=n);x.team_dps.axis.endHit='exclude';assert.equal(own(rot(x)).filter(e=>e.category==='burst').length,n);
 }
 const r=rot(input([a(0,'skill',0),a(0,'skill',1),a(0,'skill',2),a(0,'burst',4),end(12)]));assert.equal(sakura(r).length,11);
 const single=rot(input([a(0,'skill',0)]));assert.equal(single.events.length,0);near(single.duration,34/60);
 const fourth=rot(input([a(0,'skill',0),a(0,'skill',1),a(0,'skill',2),a(0,'skill',4)]));near(fourth.duration,4+98/60);assert.equal(own(fourth).at(-1).index,13);
 const late=rot(input([a(0,'skill',0),a(0,'burst',25)]));assert.equal(own(late).filter(e=>e.category==='burst').length,1);
});

test('enhancement consumes reaction trigger after a hit, keeps cooldown and emits one single-target star without application',()=>{
 const x=input([a(0,'skill',0),a(0,'skill',.95),a(0,'skill',1.9),a(1,'skill',2.1),a(2,'skill',3),a(2,'skill',3.7),end(14)]),r=rot(x),enh=sakura(r).filter(e=>e.yaeEnhanced),stars=own(r).filter(e=>e.index===16);
 assert.ok(enh.length>=2);assert.equal(stars.length,enh.filter(e=>e.yaeStellar).length);
 assert.ok(stars.every(e=>e.applicationTargets.length===0&&e.targetIds.length===1));
 for(let i=1;i<enh.length;i++)assert.ok(enh[i].time-enh[i-1].time>=2.5-1e-10);
 assert.ok(stars.every((e,i)=>Math.abs(e.time-enh[i].time-.2)<1e-9));
 const noCryo=rot(input([a(0,'skill',0),a(0,'skill',1),a(0,'skill',2),end(12)]));assert.equal(sakura(noCryo).filter(e=>e.yaeEnhanced).length,0);
 const ordinary=rot(input([a(0,'skill',0),a(0,'skill',1),a(0,'skill',2),a(1,'skill',2.1),end(10)],0,['YaeMiko','Qiqi','Furina','Mona']));assert.ok(sakura(ordinary).some(e=>e.yaeEnhanced));assert.equal(own(ordinary).filter(e=>e.index===16).length,0);
});

test('C1 is owned, timed, refreshed; C2 only buffs Yae and current active once and expires with Sakura',()=>{
 const x=input([a(0,'skill',0),a(0,'skill',1),a(0,'skill',2),a(1,'skill',2.1),a(2,'skill',3),a(0,'skill',6),end(40)],6),r=rot(x),p=normalizeTeamProfiles(x.single_interfaces),rules=createCharacterRules(p,()=>r,scalarMath,x.team_dps);
 const at=(role,time,rootOrder=Infinity)=>values(rules.instances[0].attackBuffs(role,{time,rootOrder},[]));
 assert.equal(at(0,.2).ElementalMastery,undefined);assert.equal(at(0,.7).ElementalMastery,90);assert.equal(at(0,1.7).ElementalMastery,120);assert.equal(at(0,2.7).ElementalMastery,200);
 assert.equal(at(1,2.7).ElementalMastery,200);assert.equal(at(2,2.7).ElementalMastery,undefined);assert.equal(at(0,31).ElementalMastery,undefined);
 assert.equal(at(0,0).EnhanceStellarSuperconduct,undefined);assert.equal(at(0,40).EnhanceStellarSuperconduct,undefined);
 assert.equal(at(0,0).BonusElementalBurst,1);assert.equal(at(0,0).StellarConductCritDamage,2);
 assert.ok(r.combatHistory.some(h=>h.states[0].c1Until>h.time));
 // Qiqi's first reaction primes Yae's enhancement but cannot grant Yae C1.
 const reaction=r.reactionTimeline.reactions.find(f=>f.role===1);assert.ok(reaction);
 assert.equal(at(0,reaction.time).EnhanceStellarSuperconduct,undefined);
 const first=own(r).find(e=>e.index===16);assert.ok(first);
 assert.equal(at(0,first.time,first.rootOrder+.1).EnhanceStellarSuperconduct,.5);
});

test('actual native coefficients and independent normal / empowered / C6 star equations; preview records 80% once',()=>{
 const x=input([a(0,'skill',0),a(0,'skill',.95),a(0,'skill',1.9),a(1,'skill',2.1),end(10)],6),out=run(x),normal=out.hits.find(e=>e.role===0&&e.yaeSakura&&!e.yaeEnhanced),enh=out.hits.find(e=>e.role===0&&e.yaeEnhanced),star=out.hits.find(e=>e.role===0&&e.index===16);
 // ATK 340+185; first hit has two Sakura (C2 -> rank3); C2 grants 120 EM.
 near(normal.atk,525);near(normal.em,120);near(normal.bonus,.18);near(normal.def,190/(190+200*.4));near(normal.non_critical,525*1.7064*1.18*190/(190+200*.4)*.9);
 near(enh.flat,enh.atk*.8);near(enh.analysis.atk_ratio['杀生樱伤害·肆阶'],2.133);
 near(star.atk,525);near(star.em,200);near(star.crit_damage,2.5);
 // No E / Electro bonus or DEF in star damage; Sandrone and Odette blessings.
 near(star.non_critical,525*2*(1+(342.03+185+334.85+185)*.00007)*(1+.5+6*200/2200)*.9);
 const preview=createSkillMultiplierPreview(api,x.team_dps.axis,x.single_interfaces.map(p=>p.character)),ph=preview.roles[0].hits.find(h=>h.modifiers.some(m=>m.label==='八重神子·祓所之讬宣'));
 near(ph.base.atk,2.133);near(ph.effective.atk,2.933);assert.equal(preview.roles[0].hits.length,out.hits.filter(h=>h.role===0).length);
 const other=input([a(0,'skill',0),a(0,'skill',1),a(0,'skill',2),a(0,'skill',4)],6),extra=run(other).hits.find(h=>h.index===13);near(extra.bonus,0.2);near(extra.def,190/390);near(extra.non_critical,525*.4*1.2*190/390*.9);
 const q=run(input([a(0,'burst',0)],4)).hits[0];near(q.non_critical,525*4.68*2*190/390*.9);
});

test('Kagura has three shared refreshed 24-second stacks and native-missing star bonus exactly once',()=>{
 const x=input([a(0,'skill',0),a(0,'skill',1),a(0,'skill',2),end(27)]);x.single_interfaces[0].weapon=weapon('KagurasVerity');
 const p=normalizeTeamProfiles(x.single_interfaces),r=rot(x),rules=createEquipmentAxisRules(p,r,x.team_dps),builds=p.map(p=>p.artifacts);
 for(const [time,stacks]of [[.1,1],[1.1,2],[2.1,3],[18,3],[25.999,3],[26,0]]){
  const e={time,rootOrder:Infinity,order:999},copy=structuredClone(p[0]);rules.prepare(copy,0,e);assert.equal(copy.weapon.params.KagurasVerity.stack,stacks);
  const buffs=values(rules.baseBuffs(builds,0,e));near(buffs.EnhanceStellarSuperconduct??0,stacks*.12);
 }
});

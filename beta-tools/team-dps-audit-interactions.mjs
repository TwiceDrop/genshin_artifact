import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sample,gear,builds,run,sum,close} from './team-dps-full-audit.mjs';
import {weapon,fixture,weapons} from './interface-audit-7108.mjs';
import {api} from './runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
import {compileTeamDpsAxis} from '../beta-data/team-dps-rotation.mjs';
import {MANUAL_WEAPON_OPTIONS} from '../beta-data/team-dps-weapon-options.mjs';
const results=[],details={};
const eq=(a,b)=>assert.ok(close(a,b),`actual ${a}; expected ${b}`);
function check(name,fn){try{results.push({name,pass:true,evidence:fn()});}catch(e){results.push({name,pass:false,error:e.stack});}}
const hit=(o,r,t)=>o.hits.find(h=>h.role===r&&h.time===t&&h.category!=='equipment');
check('Escoffier C1 is refreshed by Q at 5.5 and expires at 20.5',()=>{
 const x=sample(),a=run(x);x.single_interfaces[2].character.constellation=1;const b=run(x),rows=[17.5,18.5,19,19.5,20,20.5].map(t=>({time:t,actual:hit(b,0,t).crit_damage-hit(a,0,t).crit_damage,expected:t<20.5?.6:0}));
 const missing=b.hits.filter(h=>[0,2].includes(h.role)&&h.time>=18&&h.time<20.5).reduce((n,h)=>n+h.non_critical*h.crit*.6,0);details.escoC1={rows,missingExpectation:missing,totalActual:b.expectation,totalExpected:b.expectation+missing};for(const r of rows)eq(r.actual,r.expected);return details.escoC1;
});
check('Xiphos converted ER does not enter Emblem conversion',()=>{
 const x=sample();x.single_interfaces[1].weapon=weapon('XiphosMoonlight');x.single_interfaces[1].artifacts=gear(1,'EmblemOfSeveredFate',50);const b=builds(x),ev=createTeamDpsEvaluator(api,x),a=ev.evaluate(b,true),changed=structuredClone(b);changed[1][0].id+=1000000;changed[1][0].sub_stats.push(['ElementalMastery',500]);const o=ev.evaluate(changed,true),q=z=>z.hits.find(h=>h.role===1&&h.category==='burst');
 const raw=structuredClone(x.single_interfaces[1]);raw.skill.index=14;raw.weapon.params.XiphosMoonlight.rate=1;raw.enemy=x.team_dps.enemy;
 const nativeA=api.CalculatorInterface.get_damage_analysis(raw,null);raw.artifacts=changed[1];const nativeB=api.CalculatorInterface.get_damage_analysis(raw,null);
 details.xiphosEmblem={before:q(a).expectation,after:q(o).expectation,bonusDelta:q(o).bonus-q(a).bonus,erDelta:sum(o.panels[1].recharge)-sum(a.panels[1].recharge),nativeBonusDelta:sum(nativeB.bonus)-sum(nativeA.bonus)};eq(q(o).expectation,q(a).expectation);return details.xiphosEmblem;
});
check('Toukabou Shigure buffs one enemy in all-target totals',()=>{
 const x=sample();x.single_interfaces[0].weapon=weapon('ToukabouShigure');x.team_dps.weapon_conditions[0].ToukabouShigure.rate=0;const off=run(x);x.team_dps.weapon_conditions[0].ToukabouShigure.rate=1;const on=run(x);
 const one=on.character_damage[0].expectation-off.character_damage[0].expectation;x.team_dps.enemy_count=3;x.team_dps.damage_scope='all';const on3=run(x);x.team_dps.weapon_conditions[0].ToukabouShigure.rate=0;const off3=run(x),actual=on3.character_damage[0].expectation-off3.character_damage[0].expectation;
 const expected=off3.hits.filter(h=>h.role===0).reduce((n,h)=>n+h.expectation/(1+h.bonus)*.16/3,0);
 details.parasol={singleEnemyGain:one,threeEnemyGain:actual,expected};eq(actual,expected);return details.parasol;
});
check('Crescent Pike raw public interface and TeamDPS input',()=>{
 const x=sample();x.single_interfaces[2].weapon=weapon('CrescentPike');const raw=api.CommonInterface.get_attribute(x.single_interfaces[2]);details.crescentPike={rawAttack:sum(raw.atk),rawParams:x.single_interfaces[2].weapon.params};
 const r=compileTeamDpsAxis(x.team_dps.axis,x.single_interfaces,x.team_dps),rules=createEquipmentAxisRules(x.single_interfaces,r,x.team_dps),p=structuredClone(x.single_interfaces[2]);rules.prepare(p,2,{time:0,rootOrder:-1,order:-1});details.crescentPike.preparedParams=p.weapon.params;
 return run(x).expectation;
});
check('Explicit reaction facts merge into the automatic model (regression triage)',()=>{
 const x=sample();x.team_dps.axis.timeline=x.team_dps.axis.timeline.filter(e=>e.kind!=='reaction');x.single_interfaces[1].weapon=weapon('FreedomSworn');const a=run(x);
 for(const timeMs of [1000,2000])x.team_dps.axis.timeline.push({id:'explicit-'+timeMs,kind:'reaction',timeMs,actor:'hydro',reaction:'Frozen'});
 const b=run(x);assert.notEqual(a.expectation,b.expectation);return {automatic:a.expectation,additionalFacts:b.expectation};
});
check('Manual weapon ranges: low/mid/full coverage, all legal current holders',()=>{
 const rows=[];
 for(const [name,fields]of Object.entries(MANUAL_WEAPON_OPTIONS))for(let r=0;r<4;r++){
  if(weapons[name].type!==['Sword','Sword','Polearm','Catalyst'][r])continue;
  const values=[];for(const strength of [0,.5,1]){const x=sample();x.single_interfaces[r].weapon=weapon(name);for(const f of fields)x.team_dps.weapon_conditions[r][name][f.key]=f.max/f.scale*strength;const out=run(x);assert.ok(Number.isFinite(out.expectation));values.push(out.expectation);}
  rows.push({role:r,weapon:name,values});
 }return rows;
});
fs.writeFileSync('.build-target/team-dps-full-audit/interactions.json',JSON.stringify({results,details},null,2));console.log(JSON.stringify({results,details},null,2));if(results.some(r=>!r.pass))process.exitCode=1;

import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-config.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {cinderElements} from '../beta-data/equipment-axis-rules.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function sample(){const p=TEAM_DPS_ROLES.map((name,r)=>{const x=fixture(name);x.artifacts=x.artifacts.map(a=>({...a,id:100*r+a.id}));return x;}),axis=importedAxis();axis.timeline=axis.timeline.filter(e=>e.kind!=='reaction');return {single_interfaces:p,team_dps:{axis,enemy:{level:100,hydro_res:.1,cryo_res:.1,physical_res:.1},fanfare:300,result_count:2,max_evaluations:40,initial_ids:p.map(p=>p.artifacts.map(a=>a.id))}};}
const builds=x=>x.single_interfaces.map(p=>p.artifacts),run=x=>createTeamDpsEvaluator(api,x).evaluate(builds(x),true),hit=(o,r,t)=>o.hits.find(h=>h.role===r&&h.time===t&&h.category!=='equipment');
const equip=(x,r,name)=>x.single_interfaces[r].artifacts.forEach(a=>a.set_name=name);
const fact=(x,e)=>x.team_dps.axis.timeline.push({id:'test-'+x.team_dps.axis.timeline.length,...e});

test('V1 public WASM: candidate conversions and same-source replacement',()=>{
 const x=sample();x.single_interfaces[1].weapon=weapon('XiphosMoonlight');x.single_interfaces[3].weapon=weapon('WanderingEvenstar');
 const ev=createTeamDpsEvaluator(api,x),a=ev.evaluate(builds(x),true),b=structuredClone(builds(x));
 for(const r of [1,3]){b[r][0].id+=1000;b[r][0].sub_stats.push(['ElementalMastery',500]);}
 const changed=ev.evaluate(b,true),fresh=createTeamDpsEvaluator(api,x).evaluate(b,true);
 near(changed.expectation,fresh.expectation);near(sum(changed.panels[0].recharge)-sum(a.panels[0].recharge),.054);
 near(hit(changed,0,7.75).atk-hit(a,0,7.75).atk,36);near(sum(changed.panels[1].recharge)-sum(a.panels[1].recharge),.18);
 const double=sample();double.single_interfaces[0].weapon=weapon('XiphosMoonlight');double.single_interfaces[1].weapon=weapon('XiphosMoonlight');const stacked=run(double);
 near(sum(stacked.panels[2].recharge),2+2*265*.00036*.3);
 const y=sample();y.single_interfaces[2].weapon=weapon('SymphonistOfScents');const automatic=run(y);
 y.single_interfaces[0].buffs=[{name:'SymphonistOfScents',config:{SymphonistOfScents:{refine:1,rate:1}}}];const saved=JSON.stringify(y),manual=run(y);
 near(automatic.expectation,manual.expectation);assert.equal(JSON.stringify(y),saved);
 const k=sample();k.single_interfaces[1].weapon=weapon('KeyOfKhajNisut');
 for(const timeMs of [300,600])fact(k,{kind:'hit',timeMs,actor:'hydro',action:'furina.skill'});
 const ko=run(k);assert.ok(hit(ko,0,7.75).em>100);
 const f=sample();f.single_interfaces[1].weapon=weapon('FreedomSworn');
 const automaticFreedom=run(f);for(const timeMs of [1000,2000])fact(f,{kind:'reaction',timeMs,actor:'hydro',reaction:'Frozen'});
 near(run(f).expectation,automaticFreedom.expectation);
});

test('V2 event rules: cinder eligibility, cooldowns, conditional defaults and healing sets',()=>{
 const x=sample();equip(x,2,'ScrollOfTheHeroOfCinderCity');x.single_interfaces[2].artifact_config={config_scroll_of_the_hero_of_cinder_city:{elements:['Pyro'],rate1:1,rate2:1}};
 const automaticCinder=run(x);fact(x,{kind:'reaction',timeMs:3000,actor:'healer',reaction:'Frozen'});fact(x,{kind:'state',timeMs:0,actor:'healer',state:'nightsoul',durationMs:20500});
 near(run(x).expectation,automaticCinder.expectation);assert.equal(cinderElements('Frozen','Pyro',true),null);assert.equal(cinderElements('Frozen','Cryo',true).second,.28);
 const book=sample();book.single_interfaces[3].weapon=weapon('ThrillingTalesOfDragonSlayers');const once=run(book);
 fact(book,{kind:'switch',timeMs:12000,actor:'support'});fact(book,{kind:'switch',timeMs:12500,actor:'carry'});near(hit(run(book),0,18.5).atk,hit(once,0,18.5).atk);
 const defaults=sample();equip(defaults,0,'DesertPavilionChronicle');const zero=run(defaults);defaults.single_interfaces[0].artifact_config={config_desert_pavilion_chronicle:{rate:0}};near(run(defaults).expectation,zero.expectation);
 const conditions=sample();equip(conditions,0,'MarechausseeHunter');equip(conditions,1,'RealmMirrorNight');conditions.single_interfaces[2].weapon=weapon('CalamityQueller');conditions.single_interfaces[3].weapon=weapon('StarcallersWatch');const modeled=run(conditions);
 near(hit(modeled,0,7.75).crit,.56);near(hit(modeled,2,8).atk-hit(modeled,2,3).atk,1088*.32);
 conditions.single_interfaces[1].artifact_config={config_realm_mirror_night:{moon_state:2,moon_reaction_bonus:4}};conditions.single_interfaces[3].weapon.params.StarcallersWatch.use_buff=false;near(run(conditions).expectation,modeled.expectation);
 const song=sample();equip(song,2,'SongOfDaysPast');const so=run(song),affected=so.hits.filter(h=>h.flat>0);
 assert.equal(affected.length,10);assert.ok(affected.every(h=>h.onField&&h.time>=11.5));assert.ok(affected.every(h=>h.flat<=1200));
 const clam=sample();equip(clam,2,'OceanHuedClam');const co=run(clam),foam=co.hits.filter(h=>h.category==='equipment');assert.ok(foam.length>0);assert.equal(foam[0].time,8.5);
 for(const h of foam){assert.equal(h.analysis.element,'Physical');near(h.expectation,h.flat*.9);near(h.critical,h.non_critical);assert.equal(h.analysis.ignore_defense,true);}
 const horn=sample();horn.single_interfaces[3].weapon=weapon('AshGravenDrinkingHorn');const ho=run(horn).hits.filter(h=>h.category==='equipment');assert.equal(ho.length,1);near(ho[0].analysis.hp_ratio['苍纹角杯·范围伤害'],.4);
});

test('V3 joint search: support equipment affects ranking and constant team ER constraints',()=>{
 const x=sample();x.single_interfaces[1].weapon=weapon('XiphosMoonlight');x.single_interfaces[0].constraint={set_mode:'Any',recharge_min:2.02};x.team_dps.max_evaluations=1;
 const result=optimizeTeamDps(api,x,builds(x).flat());assert.equal(result.results.length,1);assert.ok(sum(result.results[0].panels[0].recharge)>2.02);
 assert.equal(new Set(result.results[0].artifacts.flatMap(Object.values)).size,20);
 const y=sample();equip(y,2,'TenacityOfTheMillelith');
 const ev=createTeamDpsEvaluator(api,y),active=ev.evaluate(builds(y)),without=structuredClone(builds(y));without[2].slice(3).forEach(a=>{a.id+=1000;a.set_name='Adventurer';});const inactive=ev.evaluate(without);
 assert.ok(active.character_damage[0].expectation>inactive.character_damage[0].expectation);near(ev.evaluate(builds(y)).expectation,active.expectation);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-config.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps,evaluateTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {procProbabilities} from '../beta-data/equipment-damage-events.mjs';
import {compileTeamDpsAxis} from '../beta-data/team-dps-rotation.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
import {teamDpsWeaponAvailable,teamDpsArtifactAvailable} from '../beta-data/team-dps-equipment-support.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function sample(){const p=TEAM_DPS_ROLES.map((name,r)=>{const x=fixture(name);x.artifacts.forEach(a=>a.id+=r*100);return x;});return {single_interfaces:p,team_dps:{axis:importedAxis(),enemy:{level:100,hydro_res:.1,cryo_res:.1,physical_res:.3},fanfare:300,max_evaluations:1,result_count:1,initial_ids:p.map(x=>x.artifacts.map(a=>a.id))}};}
const builds=x=>x.single_interfaces.map(p=>p.artifacts),run=x=>createTeamDpsEvaluator(api,x).evaluate(builds(x),true);
const fact=(x,e)=>x.team_dps.axis.timeline.push({id:'followup-'+x.team_dps.axis.timeline.length,...e});

test('V1 equipment catalog follows the selected theory model',()=>{
 assert.equal(teamDpsWeaponAvailable('HymnOfTheMaelstrom'),true);
 assert.equal(teamDpsWeaponAvailable('RoyalLongsword'),true);
 assert.equal(teamDpsArtifactAvailable('ScrollOfTheHeroOfCinderCity'),true);
 assert.equal(teamDpsArtifactAvailable('EchoesOfAnOffering'),true);
 const x=sample();x.single_interfaces[3].weapon=weapon('HymnOfTheMaelstrom');
 const before=JSON.stringify(x);assert.ok(run(x).expectation>0);assert.equal(JSON.stringify(x),before);
});

test('V2 actual WASM + weapon events: physical procs, probabilities, cooldowns and snapshots',()=>{
 const x=sample();x.single_interfaces[0].weapon=weapon('SkywardBlade');
 const native={...x.single_interfaces[0],skill:{index:9,config:'NoConfig'}},d=api.CalculatorInterface.get_damage_analysis(native,null);
 assert.deepEqual(Object.keys(d.atk_ratio),['技能倍率']);assert.equal(sum(d.extra_damage),0);
 const out=run(x),procs=out.hits.filter(h=>h.category==='equipment');
 assert.equal(procs.length,29);near(procs[0].time,8+1/60);assert.ok(procs.every(h=>h.time<20));
 const h=procs[0],n=h.atk*.2*(1+h.bonus)*190/390*.7;
 near(h.non_critical,n);near(h.critical,n*(1+h.crit_damage));near(h.expectation,n*(1+h.crit*h.crit_damage));
 assert.equal(h.analysis.element,'Physical');assert.equal(sum(h.analysis.atk_ratio),.2);
 x.single_interfaces[0].weapon.refine=5;near(sum(run(x).hits.find(h=>h.category==='equipment').analysis.atk_ratio),.4);
 // Same frame multi-hit and exact CD boundary: independent enumeration of 16 Bernoulli paths.
 const times=[0,0,14,15],distribution=procProbabilities(times.map(time=>({time})),.5,15),brute=[0,0,0,0];
 for(let bits=0;bits<16;bits++){let ready=0;for(let i=0;i<times.length;i++)if(times[i]>=ready&&(bits&(1<<i))){brute[i]+=1/16;ready=times[i]+15;}}
 distribution.forEach((p,i)=>near(p.probability,brute[i]));
 x.single_interfaces[0].weapon=weapon('FilletBlade');const fillet=run(x).hits.filter(h=>h.category==='equipment');
 near(fillet[0].probability,.5);near(fillet[1].probability,.25);assert.ok(fillet.every(h=>sum(h.analysis.atk_ratio)===2.4));
 near(fillet.reduce((n,h)=>n+h.probability,0),1-Math.pow(.5,33));
 x.single_interfaces[0].weapon=weapon('CursedBlade');const isshin=run(x),gales=isshin.hits.filter(h=>h.category==='equipment');
 assert.equal(gales.length,2);near(gales[0].time,7.75+1/60);near(gales[1].time,16+1/60);
 near(gales[0].atk-isshin.hits.find(h=>h.role===0&&h.category==='normal').atk,(359+510)*.15);
 // Incoming-enemy-damage procs are excluded by the selected theory model.
 x.single_interfaces[0].weapon=weapon('AquilaFavonia');assert.equal(run(x).hits.filter(h=>h.category==='equipment').length,0);
 fact(x,{kind:'hp_change',timeMs:9000,actor:'carry',change:'damage'});
 assert.equal(run(x).hits.filter(h=>h.label.includes('风鹰剑·')).length,0);
});

test('V3 conditions: no UI parameters, refreshed stacks, cast windows and candidate isolation',()=>{
 const x=sample();x.single_interfaces[2].weapon=weapon('StaffOfTheScarletSands');x.single_interfaces[2].weapon.params='NoConfig';
 const out=run(x),first=out.hits.find(h=>h.role===2&&h.time===3),next=out.hits.find(h=>h.role===2&&h.time===4);
 near(next.atk-first.atk,100*.28); // One real on-field E hit, not default three stacks.
 const bad=structuredClone(x);bad.single_interfaces[2].weapon.params={StaffOfTheScarletSands:{stack:3}};near(run(bad).expectation,out.expectation);
 const ev=createTeamDpsEvaluator(api,x),b=structuredClone(builds(x));b[2][0].id+=900;b[2][0].sub_stats.push(['ElementalMastery',200]);
 const changed=ev.evaluate(b,true);assert.ok(changed.character_damage[2].expectation>out.character_damage[2].expectation);near(ev.evaluate(builds(x)).expectation,out.expectation);near(changed.expectation,createTeamDpsEvaluator(api,x).evaluate(b).expectation);
 const p=sample().single_interfaces;const rotation=compileTeamDpsAxis(importedAxis(),p),rules=createEquipmentAxisRules(p,rotation);
 const prepare=(r,n,t)=>{const profile=structuredClone(p[r]);profile.weapon=weapon(n);profile.weapon.params='NoConfig';return createEquipmentAxisRules(p.map((v,i)=>i===r?profile:v),rotation).prepare(profile,r,{time:t,rootOrder:Infinity,order:Infinity}).weapon.params[n];};
 assert.equal(prepare(3,'LostPrayerToTheSacredWinds',7).stack,0);assert.equal(prepare(3,'LostPrayerToTheSacredWinds',10).stack,0);
 assert.equal(prepare(0,'SkyriderSword',10).rate,1);assert.equal(prepare(0,'SkyriderSword',23).rate,0);
 assert.equal(prepare(0,'BeyondTheChrysalis',9).loyal_rate,100);assert.equal(prepare(0,'BeyondTheChrysalis',9).rebel_rate,100);
 assert.equal(prepare(2,'Deathmatch',4).ge2,false);assert.equal(prepare(3,'BlackcliffAgate',8).stack,0);
 const trigger={...rotation.events.find(h=>h.role===0),time:0,onField:true,rootOrder:0};
 const synthetic={...rotation,events:[0,1,6.5].map((time,order)=>({...trigger,time,order,category:'skill'}))};
 const spear=structuredClone(p[0]);spear.weapon=weapon('PrimordialJadeWingedSpear');const team=p.map((v,i)=>i===0?spear:v);
 const stack=createEquipmentAxisRules(team,synthetic).prepare(spear,0,{time:7.1,rootOrder:99,order:99}).weapon.params.PrimordialJadeWingedSpear;
 assert.equal(stack.stack,3); // The hit at 6.5 refreshes the whole stack, not just one stack.
 const cfg=rules.prepare(structuredClone(p[0]),0,{time:8,rootOrder:Infinity,order:Infinity}).artifact_config;
 assert.ok(Object.hasOwn(cfg,'config_crimson_witch_of_flames'));
 const c=sample();c.single_interfaces[3].weapon=weapon('ClashOfKings');c.single_interfaces[3].weapon.params='NoConfig';
 const co=run(c);near(co.hits.find(h=>h.role===3&&h.time===6.5).em,200);assert.ok(co.hits.filter(h=>h.role===3&&h.time>=12.5).every(h=>h.em===100));
 const long=importedAxis();long.timeline.find(e=>e.kind==='switch'&&e.actor==='carry').timeMs=17000;
 const pp=structuredClone(p);pp[3].weapon=weapon('TulaytullahsRemembrance');pp[3].weapon.params='NoConfig';
 const rr=compileTeamDpsAxis(long,pp),at={time:10.5,rootOrder:Infinity,order:Infinity},prepared=createEquipmentAxisRules(pp,rr).prepare(structuredClone(pp[3]),3,at);
 assert.equal(prepared.weapon.params.TulaytullahsRemembrance.stack,4);
 prepared.skill.index=0;const timed=api.CalculatorInterface.get_damage_analysis(prepared,null);prepared.weapon.params.TulaytullahsRemembrance.stack=0;
 near(sum(timed.bonus)-sum(api.CalculatorInterface.get_damage_analysis(prepared,null).bonus),.192);
 // The expanded facade prefers canonical fields to the legacy UI aliases.
 // Both must be authored by the rule; old canonical values cannot override it.
 for(const [name,params]of Object.entries({AmberBead:{stacks:2},NocturnesCurtainCall:{lunar_active:true,rate:1},DawningFrost:{charged_active:true,charged_rate:1,skill_active:false,skill_rate:0},ReliquaryOfTruth:{skill_active:false,lunar_bloom_hit:true},EtherlightSpindlelute:{skill_active:false}})){
  const alias=sample();alias.single_interfaces[3].weapon=weapon(name);const automatic=run(alias);
  Object.assign(alias.single_interfaces[3].weapon.params[name],params);const imported=run(alias);
  near(imported.expectation,automatic.expectation);assert.deepEqual(imported.hits.map(h=>h.em),automatic.hits.map(h=>h.em));
 }
});

test('V4 production Worker: reaction equipment completes with the common theory rules',async()=>{
 const messages=[],self={postMessage:m=>messages.push(m)},source=fs.readFileSync(new URL('../src/workers/team_dps.js',import.meta.url),'utf8').replace(/^import .*$/mg,'').replace("import('mona')",'Promise.resolve(api)');
 vm.runInNewContext(source,{self,api,optimizeTeamDps,evaluateTeamDps,Promise});await Promise.resolve();
 assert.equal(messages[0].type,'ready');const x=sample();x.single_interfaces[3].weapon=weapon('HymnOfTheMaelstrom');
 const before=JSON.stringify(x);self.onmessage({data:{input:x,artifacts:builds(x).flat(),mode:'optimize'}});
 assert.equal(messages.at(-1).type,'result');assert.ok(messages.at(-1).data.results[0].expectation>0);
 assert.equal(messages.some(m=>m.type==='error'),false);assert.equal(JSON.stringify(x),before);
});

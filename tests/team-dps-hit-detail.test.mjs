import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-config.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {teamDpsArtifactAvailable} from '../beta-data/team-dps-equipment-support.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
import * as stellar from '../src/algorithms/stellar-detail.mjs';
import {damageReactionOptions,defaultDamageReaction} from '../src/algorithms/reaction-labels.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const code=fs.readFileSync(new URL('../src/components/display/DamageAnalysis/DamageAnalysis.vue',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'').replace('export default','globalThis.component =');
const env={...stellar,damageReactionOptions,defaultDamageReaction,DamageAnalysisUtil:{},StellarDamageDetail:{},LEVEL_MULTIPLIER:[],console};
vm.createContext(env);vm.runInContext(code,env);
function dialog(analysis,enemy,character){
 const state={...env.component.data(),enemyConfig:enemy,characterLevel:character.level,characterName:character.name};
 for(const [k,fn]of Object.entries(env.component.methods))state[k]=fn.bind(state);
 for(const [k,fn]of Object.entries(env.component.computed))Object.defineProperty(state,k,{get:()=>fn.call(state)});
 state.setValue(analysis);return state;
}
function sample(){
 const profiles=TEAM_DPS_ROLES.map((role,r)=>{const p=fixture(role);p.artifacts.forEach(a=>a.id+=r*100);return p;});
 return {profiles,builds:profiles.map(p=>p.artifacts),input:{single_interfaces:profiles,team_dps:{axis:importedAxis(),enemy:{level:100,hydro_res:.1,cryo_res:.1}}}};
}

test('equipment events recompose in the shared dialog with physical resistance and ignored defense',()=>{
 const {profiles,builds,input}=sample();builds[2].forEach(a=>a.set_name='OceanHuedClam');profiles[3].weapon=weapon('AshGravenDrinkingHorn');
 profiles[0].weapon=weapon('FilletBlade');
 const out=createTeamDpsEvaluator(api,input).evaluate(builds,true),procs=out.hits.filter(h=>h.category==='equipment');
 assert.ok(procs.some(h=>h.analysis.ignore_defense));assert.ok(procs.some(h=>!h.analysis.ignore_defense));
 assert.ok(procs.some(h=>h.analysis.event_probability===.5));
 for(const h of procs){const s=dialog(h.analysis,out.enemy,out.profiles[h.role].character);near(s.damageNormal,h.expectation);for(const metric of ['expectation','critical','non_critical'])near(s.selectedActualResult[metric],h[metric]);}
});

test('per-hit analysis recomposes actual WASM damage for split hits, additions, C6 and support equipment',()=>{
 const {profiles,builds,input}=sample();
 profiles[0].weapon=weapon('LightOfFoliarIncision');profiles[0].weapon.params.LightOfFoliarIncision.rate=1;
 assert.equal(teamDpsArtifactAvailable('EchoesOfAnOffering'),true);
 profiles[2].character.constellation=2;builds[3].forEach(a=>{a.set_name='TenacityOfTheMillelith';a.sub_stats.push(['HPPercentage',.5]);});
 for(const c6 of [false,true]){
  if(c6)profiles.forEach(p=>p.character.constellation=6);
  const evaluator=createTeamDpsEvaluator(api,input),plain=evaluator.evaluate(builds),out=evaluator.evaluate(builds,true);
  for(const key of ['expectation','critical','non_critical'])assert.equal(out[key],plain[key]);
  assert.equal('hits' in plain,false);
  const immutable=JSON.stringify(out);
  for(const hit of structuredClone(out).hits){
   const state=dialog(hit.analysis,out.enemy,out.profiles[hit.role].character);
   assert.deepEqual(Array.from(state.reactionOptions,o=>o.key),['normal']);
   for(const key of ['expectation','critical','non_critical'])near(state.selectedActualResult[key],hit[key]);
  }
  const hit=out.hits.find(h=>h.role===0&&h.parts===2),state=dialog(hit.analysis,out.enemy,out.profiles[0].character);
  assert.ok(sum(hit.analysis.extra_damage)>0);const prior=state.selectedActualResult.expectation;
  const flat=sum(hit.analysis.extra_damage);state.extraDamageState.forEach(x=>x.checked=false);
  near(prior-state.selectedActualResult.expectation,flat*(1+hit.bonus)*hit.def*hit.res*(1+hit.crit*hit.crit_damage));
  assert.equal(JSON.stringify(out),immutable);
  const changed=structuredClone(builds);changed[2][2]={...changed[2][2],id:9999,main_stat:['ATKPercentage',.966]};
  const other=evaluator.evaluate(changed,true),oldHit=out.hits.find(h=>h.role===0),newHit=other.hits.find(h=>h.role===0);
  assert.ok(sum(newHit.analysis.extra_damage)>sum(oldHit.analysis.extra_damage));
  near(dialog(newHit.analysis,other.enemy,other.profiles[0].character).selectedActualResult.expectation,newHit.expectation);
 }
});

test('shared detail retains native single-hit behavior and team defense/resistance boundary semantics',()=>{
 const p=fixture('Kaeya'),native=api.CalculatorInterface.get_damage_analysis(p,null),state=dialog(native,{level:100,cryo_res:.1},p.character);
 assert.equal(state.teamHit,false);assert.equal(state.selectedActualResult,native[state.damageType]);assert.equal(state.atkAdditiveRatioState.length,0);
 const analysis={team_hit:true,element:'Cryo',normal:{expectation:0},atk:{base:100},atk_ratio:{talent:2},atk_additive_ratio:{equipment:.7},independent_damage_multiplier:{effect:.4},extra_damage:{flat:30},critical:{base:1.2},critical_damage:{base:1},bonus:{base:.5},def_minus:{effect:1},def_penetration:{effect:1.2},res_minus:{}};
 state.setValue(analysis);state.enemyConfig={level:100,cryo_res:.75};
 const n=(100*2*1.4+100*.7+30)*1.5*.25;
 near(state.selectedActualResult.non_critical,n);near(state.selectedActualResult.expectation,n*2);
 state.setValue(native);assert.equal(state.teamHit,false);assert.equal(state.atkAdditiveRatioState.length,0);assert.equal(state.selectedActualResult,native[state.damageType]);
 assert.equal(state.formatStellarDamage(1234.56789),'1,234.57');assert.equal(state.formatStellarDamage(12),'12');
 const utilSource=fs.readFileSync(new URL('../src/components/display/DamageAnalysis/DamageAnalysisUtil.vue',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 const utilEnv={};vm.runInNewContext(utilSource.slice(utilSource.indexOf('export default')).replace('export default','globalThis.component ='),utilEnv);
 const methods=utilEnv.component.methods,item={value:.221};assert.equal(methods.formatValue(item.value),'0.22');assert.equal(item.value,.221);
 assert.equal(methods.formatValue(.6000000000000001),'0.6');
 const event={target:{value:'1.23456'}};methods.updateValue.call(methods,item,event);assert.equal(item.value,1.23456);assert.equal(event.target.value,'1.23');
});

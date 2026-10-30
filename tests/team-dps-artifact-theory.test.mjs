import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-config.mjs';
import {compileTeamDpsAxis} from '../beta-data/team-dps-rotation.mjs';
import {createEquipmentAxisRules} from '../beta-data/equipment-axis-rules.mjs';
import {echoesProbabilities} from '../beta-data/equipment-damage-events.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps,evaluateTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
import * as stellar from '../src/algorithms/stellar-detail.mjs';
import {damageReactionOptions,defaultDamageReaction} from '../src/algorithms/reaction-labels.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function sample(){const p=TEAM_DPS_ROLES.map((name,r)=>{const x=fixture(name);x.artifacts.forEach(a=>a.id+=r*100);return x;});return {single_interfaces:p,team_dps:{axis:importedAxis(),enemy:{level:100,cryo_res:.1,hydro_res:.1,physical_res:.1},initial_ids:p.map(x=>x.artifacts.map(a=>a.id)),max_evaluations:20,result_count:3}};}
const builds=x=>x.single_interfaces.map(p=>p.artifacts);
const snake=name=>'config_'+name.replace(/([A-Z])/g,'_$1').slice(1).toLowerCase();
function setGear(p,name){p.artifacts.forEach(a=>a.set_name=name);}

test('artifact theory 1: six user decisions reach actual WASM parameters and damage',()=>{
 const x=sample(),p=x.single_interfaces,rotation=compileTeamDpsAxis(x.team_dps.axis,p);
 const prepared=(r,name,t,options={},config={},index=9,team=p)=>{
  const copy=structuredClone(team);setGear(copy[r],name);copy[r].artifact_config={[snake(name)]:config};copy[r].skill={index,config:'NoConfig'};
  return createEquipmentAxisRules(copy,rotation,options).prepare(copy[r],r,{time:t,rootOrder:Infinity,order:Infinity});
 };
 for(const [name,field,source,value,index]of [['Berserker','critical','战狂4',.24,9],['BraveHeart','bonus','勇士之心4',.3,9],['BloodstainedChivalry','bonus','染血的骑士道4',.5,14]]){
  for(const rate of [0,.37,1]){
   const q=prepared(0,name,8,{}, {rate},index),saved=JSON.stringify(q),d=api.CalculatorInterface.get_damage_analysis(q,null);
   near(d[field][source],value*rate);assert.equal(JSON.stringify(q),saved);
  }
 }
 // Full Shimenawa includes Skirk's zero-energy profile and axis tail.
 for(const t of [0,8,20.5])for(const index of [9,14]){
  const q=prepared(0,'ShimenawasReminiscence',t,{}, {rate:0},index),d=api.CalculatorInterface.get_damage_analysis(q,null);
  near(d.bonus['追忆之注连4'],.5);
 }
 for(const [t,bonus]of [[0,.5],[5.999,.5],[6,.4],[7,.3],[8,.2],[9,.1],[10,0],[20.5,0]]){
  const d=api.CalculatorInterface.get_damage_analysis(prepared(0,'UnfinishedReverie',t),null);near(d.bonus['未竟的遐思4'],bonus);
 }
 const burning=structuredClone(p);burning[1]=fixture('Nahida');burning[2]=fixture('Diluc');
 near(api.CalculatorInterface.get_damage_analysis(prepared(0,'UnfinishedReverie',20,{}, {},9,burning),null).bonus['未竟的遐思4'],.5);
 const dendroOnly=structuredClone(p);dendroOnly[1]=fixture('Nahida');
 near(api.CalculatorInterface.get_damage_analysis(prepared(0,'UnfinishedReverie',20,{}, {},9,dendroOnly),null).bonus['未竟的遐思4'],0);
 for(const [frozen,bonus]of [[true,.4],[false,.2]])for(const t of [0,20.5])near(api.CalculatorInterface.get_damage_analysis(prepared(0,'BlizzardStrayer',t,{frozen}),null).critical['冰风迷途的勇士4'],bonus);
 const hydro=p.map(()=>fixture('Furina'));assert.equal(prepared(0,'BlizzardStrayer',8,{}, {},9,hydro).artifact_config.config_blizzard_strayer.critical_bonus,0);
 for(const r of [0,1,2,3])assert.equal(prepared(r,'HuskOfOpulentDreams',0).artifact_config.config_husk_of_opulent_dreams.level,0);
 assert.equal(prepared(0,'HuskOfOpulentDreams',6).artifact_config.config_husk_of_opulent_dreams.level,2);
 const v=prepared(2,'VourukashasGlow',8,{}, {stack:5},8);near(api.CalculatorInterface.get_damage_analysis(v,null).bonus['花海甘露之光4'],.1);
 setGear(p[0],'ShimenawasReminiscence');const out=createTeamDpsEvaluator(api,x).evaluate(builds(x),true);
 assert.ok(out.hits.filter(h=>h.role===0&&h.category==='normal').every(h=>h.analysis.bonus['追忆之注连4']===.5));
});

test('artifact theory 2: Echoes path enumeration, trial cooldown, shared window and actual hit detail',()=>{
 const hits=[0,0,.049,.05,.15,.2,.4,.6,.8,1].map((time,order)=>({time,order,onField:order<6||order>=8}));
 const brute=Array(hits.length).fill(0);
 function walk(i,mass,fail,ready,expiry){
  if(i===hits.length)return;
  const h=hits[i];
  if(h.time<expiry-1e-9){brute[i]+=mass;walk(i+1,mass,fail,ready,expiry);return;}
  if(h.time<ready-1e-9){walk(i+1,mass,fail,ready,expiry);return;}
  const chance=[.36,.56,.76,.96,1][fail];
  brute[i]+=mass*chance;walk(i+1,mass*chance,0,h.time+.2,h.time+.05);
  if(chance<1)walk(i+1,mass*(1-chance),h.onField?fail+1:fail,h.time+.2,-Infinity);
 }
 walk(0,1,0,-Infinity,-Infinity);
 const probabilities=echoesProbabilities(hits);hits.forEach(h=>near(probabilities.get(h.order),brute[h.order]));
 near(probabilities.get(0),.36);near(probabilities.get(1),.36);near(probabilities.get(2),.36);near(probabilities.get(3),0);near(probabilities.get(4),0);near(probabilities.get(5),.488);
 for(const probability of echoesProbabilities([0,.2,.4,.6,.8].map((time,order)=>({time,order,onField:false}))).values())near(probability,.36);

 const x=sample();setGear(x.single_interfaces[0],'EchoesOfAnOffering');x.single_interfaces[0].character.constellation=6;
 // Native single-hit retains its selected average; TeamDPS replaces it only in its own context.
 const native=structuredClone(x.single_interfaces[0]);native.skill={index:9,config:'NoConfig'};native.artifact_config={config_echoes_of_an_offering:{rate:.5}};
 near(api.CalculatorInterface.get_damage_analysis(native,null).atk_ratio['来歆余响4'],.35);
 const saved=JSON.stringify(x),ev=createTeamDpsEvaluator(api,x),out=ev.evaluate(builds(x),true),two=structuredClone(builds(x));
 two[0][2]={...two[0][2],id:5002,set_name:'GladiatorsFinale'};two[0][3]={...two[0][3],id:5003,set_name:'ShimenawasReminiscence'};two[0][4]={...two[0][4],id:5004,set_name:'UnfinishedReverie'};
 const base=ev.evaluate(two,true),code=fs.readFileSync(new URL('../src/components/display/DamageAnalysis/DamageAnalysis.vue',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'').replace('export default','globalThis.component =');
 const env={...stellar,damageReactionOptions,defaultDamageReaction,DamageAnalysisUtil:{},StellarDamageDetail:{},LEVEL_MULTIPLIER:[],console};vm.runInNewContext(code,env);
 let delta=0;
 for(let i=0;i<out.hits.length;i++){
  const h=out.hits[i],b=base.hits[i];near(h.atk,b.atk);
  const added=h.atk*.7*(h.echoes_probability??0)*(1+h.bonus)*h.def*h.res;
  near(h.non_critical-b.non_critical,added);near(h.critical-b.critical,added*(1+h.crit_damage));near(h.expectation-b.expectation,added*(1+h.crit*h.crit_damage));delta+=added*(1+h.crit*h.crit_damage);
  const s={...env.component.data(),enemyConfig:out.enemy,characterLevel:out.profiles[h.role].character.level,characterName:out.profiles[h.role].character.name};
  for(const [k,fn]of Object.entries(env.component.methods))s[k]=fn.bind(s);
  for(const [k,fn]of Object.entries(env.component.computed))Object.defineProperty(s,k,{get:()=>fn.call(s)});
  s.setValue(h.analysis);for(const k of ['expectation','critical','non_critical'])near(s.selectedActualResult[k],h[k]);
 }
 near(out.expectation-base.expectation,delta);assert.ok(delta>0);
 assert.ok(out.hits.some(h=>h.parts===2&&h.echoes_probability>0));assert.ok(out.hits.some(h=>h.c6&&h.echoes_probability>0));
 assert.ok(out.hits.filter(h=>h.category!=='normal').every(h=>h.echoes_probability===undefined));
 assert.equal(JSON.stringify(x),saved);near(ev.evaluate(builds(x)).expectation,out.expectation);
 near(api.CalculatorInterface.get_damage_analysis(native,null).atk_ratio['来歆余响4'],.35);
});

test('artifact theory 3: current-candidate Echoes ATK, joint search, constraints and production Worker',async()=>{
 const x=sample();x.team_dps.max_evaluations=80;setGear(x.single_interfaces[0],'EchoesOfAnOffering');x.single_interfaces[0].constraint={set_mode:{Set4:'EchoesOfAnOffering'},recharge_min:1.5};x.single_interfaces[3].character.constellation=1;
 const ev=createTeamDpsEvaluator(api,x),original=ev.evaluate(builds(x),true),changed=structuredClone(builds(x));
 changed[3][0]={...changed[3][0],id:5500,sub_stats:[...changed[3][0].sub_stats,['HPPercentage',.5]]};
 const next=ev.evaluate(changed,true),a=original.hits.find(h=>h.echoes_probability>0),b=next.hits.find(h=>h.order===a.order);
 assert.ok(b.atk>a.atk);near(next.expectation,createTeamDpsEvaluator(api,x).evaluate(changed).expectation);near(ev.evaluate(builds(x)).expectation,original.expectation);
 near(sum(b.analysis.atk_additive_ratio),sum(a.analysis.atk_additive_ratio));
 const messages=[],self={postMessage:m=>messages.push(m)},code=fs.readFileSync(new URL('../src/workers/team_dps.js',import.meta.url),'utf8').replace(/^import .*$/mg,'').replace("import('mona')",'Promise.resolve(api)');
 vm.runInNewContext(code,{self,api,optimizeTeamDps,evaluateTeamDps,Promise});await Promise.resolve();
 const inventory=[...builds(x).flat(),changed[3][0]],saved=JSON.stringify(x);self.onmessage({data:{input:x,artifacts:inventory,mode:'optimize'}});
 assert.equal(messages.at(-1).type,'result');const result=messages.at(-1).data;assert.equal(result.evaluated_teams,80);assert.equal(result.results.length,3);assert.equal(result.search_complete,false);
 const byId=new Map(inventory.map(a=>[a.id,a]));
 for(const row of result.results){
  const team=row.artifacts.map(b=>Object.values(b).map(id=>byId.get(id)));assert.equal(new Set(team.flat().map(a=>a.id)).size,20);
  assert.ok(team[0].filter(a=>a.set_name==='EchoesOfAnOffering').length>=4);assert.ok(sum(row.panels[0].recharge)>=1.5);
  near(row.expectation,createTeamDpsEvaluator(api,x).evaluate(team).expectation);
 }
 assert.equal(JSON.stringify(x),saved);
});

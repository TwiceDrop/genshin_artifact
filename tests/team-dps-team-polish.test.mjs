import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-config.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {changeTeamConstellation} from '../beta-data/team-dps-character-rules.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function sample(){
 const profiles=TEAM_DPS_ROLES.map((role,r)=>{const p=fixture(role);p.artifacts.forEach(a=>a.id+=r*100);return p;});
 profiles[3].artifacts.forEach(a=>a.sub_stats.push(['HPPercentage',1]));
 return {profiles,builds:profiles.map(p=>p.artifacts),input:{single_interfaces:profiles,team_dps:{axis:importedAxis(),enemy:{level:100,hydro_res:.1,cryo_res:.1}}}};
}

test('team polish: ascension boundaries gate shared passives, constellation prerequisites and heals',()=>{
 const observations=[];
 for(const role of [0,1,2,3])for(const [level,ascend]of [[20,false],[20,true],[60,false],[60,true]]){
  const {profiles,builds,input}=sample();profiles.forEach(p=>p.character.constellation=6);
  Object.assign(profiles[role].character,{level,ascend});
  const out=createTeamDpsEvaluator(api,input).evaluate(builds,true),h=out.hits.find(h=>h.role===0&&h.time===8.5);
  const a1=level>20||ascend,a4=level===60&&ascend;
  if(role===0){
   const native=api.CalculatorInterface.get_damage_analysis({...profiles[0],character:{...out.profiles[0].character},skill:{index:h.index,config:{Skirk:{cunning_stacks:50,seven_phase_mode:false,death_crossing_stacks:0,void_rift_count:0}}}},null);
   near(sum(h.analysis.atk_ratio)/sum(native.atk_ratio),a4?1.7:1);
   assert.equal(Object.hasOwn(h.analysis.atk,'丝柯克·四命'),a4);
   assert.equal(out.hits.some(h=>h.c6),a1);
   const q=out.hits.find(h=>h.role===0&&h.qBonus);near(q.analysis.bonus['丝柯克·凋尽'],a1?.2:.08);
  }
  if(role===1)assert.equal(out.heals.some(h=>h.healing==='furina_a1'),a1);
  if(role===2){
   assert.equal(Object.hasOwn(h.analysis.res_minus,'爱可菲·灵感浸入调味'),a4);
   assert.equal(Object.hasOwn(h.analysis.critical_damage,'爱可菲·一命'),a4);
   assert.equal(out.heals.some(h=>h.role===2&&!h.healing&&h.recipients.length===1),a1);
   assert.ok(out.heals.some(h=>h.role===2&&!h.healing&&h.recipients.length===4));
  }
  if(role===3)assert.equal(Object.hasOwn(h.analysis.extra_damage,'沃雅妮莎·十二弦的泪歌'),a4);
  observations.push({role,level,ascend,expectation:out.expectation});
 }
 fs.writeFileSync('.build-target/team-dps-team-polish-20261027/V1-ascension.json',JSON.stringify(observations,null,2));
});

test('team polish: constellation edits preserve effective talent levels without changing input presets',()=>{
 for(const name of TEAM_DPS_ROLES){
  const c={name,constellation:0,skill1:9,skill2:9,skill3:9};
  changeTeamConstellation(c,3);assert.equal(c[name==='Skirk'||name==='Furina'?'skill3':'skill2'],12);
  changeTeamConstellation(c,6);assert.equal(c.skill2,12);assert.equal(c.skill3,12);
  changeTeamConstellation(c,6);assert.equal(c.skill2,12);assert.equal(c.skill3,12);
  changeTeamConstellation(c,0);assert.deepEqual(c,{name,constellation:0,skill1:9,skill2:9,skill3:9});
  c.constellation=5;c.skill2=12;c.skill3=12;changeTeamConstellation(c,3);
  assert.equal(c[name==='Skirk'||name==='Furina'?'skill2':'skill3'],9);
 }
});

test('team polish: coincident character buffs apply and detailed sources sum to scored values',()=>{
 const {profiles,builds,input}=sample();profiles.forEach(p=>p.character.constellation=6);
 profiles[3].weapon=weapon('ThrillingTalesOfDragonSlayers');builds[3].forEach(a=>a.set_name='TenacityOfTheMillelith');
 const out=createTeamDpsEvaluator(api,input).evaluate(builds,true),h=out.hits.find(h=>h.role===0&&h.time===8.5);
 for(const [field,keys]of Object.entries({atk:['丝柯克·四命','沃雅妮莎·一命','千岩牢固4','讨龙英杰谭'],hp:['双水共鸣'],bonus:['芙宁娜·万众狂欢','沃雅妮莎·六命'],res_minus:['爱可菲·灵感浸入调味','沃雅妮莎·宣叙·晨声纷流'],critical_damage:['爱可菲·一命','沃雅妮莎·二命']}))for(const key of keys)assert.ok(h.analysis[field][key]>0,field+'/'+key);
 for(const h of out.hits){near(sum(h.analysis.atk),h.atk);if(h.hp!==undefined)near(sum(h.analysis.hp),h.hp);assert.equal(JSON.stringify(h.analysis).includes('固定轴队伍'),false);}
 const roles=input.team_dps.axis.members.map(m=>m.slot);
 input.team_dps.axis.timeline.push({id:'same-hit',timeMs:3000,kind:'hit',actor:roles[0],action:'skirk.normal.1'});
 // Put the attack before Escoffier's cast in the input at the same instant.
 const event=input.team_dps.axis.timeline.pop();input.team_dps.axis.timeline.unshift(event);
 const same=createTeamDpsEvaluator(api,input).evaluate(builds,true).hits.find(h=>h.eventId==='same-hit');
 near(same.analysis.res_minus['爱可菲·灵感浸入调味'],.55);near(same.analysis.critical_damage['爱可菲·一命'],.6);
});

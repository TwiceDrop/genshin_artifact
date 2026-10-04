import test from 'node:test';
import assert from 'node:assert/strict';
import {original,rawOriginal,vody,sum,named} from '../beta-tools/runtime-7106.mjs';
import {calculateSingleHit} from '../beta-data/single-hit-damage.mjs';
import {normalizeBuffParameters} from '../beta-data/buff-rule-registry.mjs';
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const buff=(name,p={})=>{const normalized=normalizeBuffParameters(name,p);return Object.keys(normalized).length?named(name,normalized):{name,config:'NoConfig'};};
const x={...structuredClone(vody),character:{name:'Kaeya',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:'NoConfig'},weapon:{name:'DullBlade',level:90,ascend:false,refine:1,params:'NoConfig'},skill:{index:0,config:'NoConfig'},artifacts:[],buffs:[]};
test('Classic composite: native parity for panel, elemental damage, flat bonus and capped conversions',()=>{
 const buffs=[buff('BennettQ'),buff('GanyuTalent2'),buff('KaedeharaKazuhaTalent2',{element:'Cryo'}),buff('YunjinQ'),buff('FaruzanQ',{enable_c6:true,rate_talent2:.5}),buff('CitlaliC6',{stack:3}),buff('FurinaQ'),buff('BaizhuTalent2'),buff('XianyunTalent1'),buff('KamisatoAyatoQ')];
 const input={...x,buffs};
 const a=original.CommonInterface.get_attribute(input),b=rawOriginal.CommonInterface.get_attribute(input);
 for(const key of Object.keys(b))if(b[key]&&typeof b[key]==='object')near(sum(a[key]),sum(b[key]));
 for(const element of ['Cryo','Anemo']){const c=original.CalculatorInterface.get_damage_analysis(input,element),d=rawOriginal.CalculatorInterface.get_damage_analysis(input,element);near(c.normal.expectation,d.normal.expectation);}
});
test('Lunar rules: owner crit, final elevation, inactive states and no ordinary bonus leakage',()=>{
 const input={kind:'lunar-bloom',character:{name:'Nefer'},panelMode:'before-buffs',element:'Dendro',panel:{ATK:100,em:0,critRate:.1,critDamage:1,damageBonus:9},skillMultiplier:1,resistanceBeforeBuffs:0,buffs:[buff('LaumaTalent2'),buff('ColumbinaQ'),buff('LaumaC6')]};
 const out=calculateSingleHit(input);near(out.non_critical,175);near(out.critical,385);near(out.expectation,217);
 const off=calculateSingleHit({...input,buffs:[buff('LaumaTalent2',{mode:0}),buff('ColumbinaQ',{domain_active:false}),buff('LaumaC6',{full_moon:false})]});near(off.non_critical,100);near(off.expectation,110);
});


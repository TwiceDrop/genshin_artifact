import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDirectLunarDamage} from '../beta-data/lunar-damage.mjs';
import {api,vody,vesna,read,named,sum} from '../beta-tools/runtime-7106.mjs';
import {createDamageEvaluator} from '../src/algorithms/stat-gain/curve.mjs';
const clone=structuredClone;
const near=(a,b,message='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<Math.max(1e-7,Math.abs(b)*1e-9),`${message}: ${a} != ${b}`);
const damage=x=>api.CalculatorInterface.get_damage_analysis(x,null);
const team=()=>({baseBonus:0,resistanceMultiplier:1,participants:[
 {id:'geo',element:'Geo',levelBase:50,em:0,critRate:.5,critDamage:1,flatBonus:20},
 {id:'hydro',element:'Hydro',levelBase:75,em:0,critRate:0,critDamage:0},
]});


test('2 直伤月结晶与月绽放各用本人面板，擢升最终放大本体及定额',()=>{
 const input={kind:'lunar-crystallize',owner:{id:'owner',em:500,critRate:.6,critDamage:1.2},scalingStat:2000,skillMultiplier:2,
  baseBonus:.14,lunarBonus:.4,skillIndependentMultiplier:1.5,skillIndependentTags:['direct-lunar-crystallize'],
  lunarIndependentMultiplier:1.2,lunarIndependentTags:['direct-lunar-crystallize'],flatBonus:700,elevation:.25,resistanceMultiplier:.9};
 const main=2000*2*1.6*1.14*1.5*(1+6*500/2500+.4)*1.2;
 const crystal=calculateDirectLunarDamage(input);
 near(crystal.non_critical,(main+700)*.9*1.25);
 near(crystal.expectation,(main+700)*.9*(1+.6*1.2)*1.25);
 const bloom=calculateDirectLunarDamage({...input,kind:'lunar-bloom',skillIndependentTags:['direct-lunar-bloom'],lunarIndependentTags:['direct-lunar-bloom']});
 near(bloom.expectation,(main/1.6+700)*.9*(1+.6*1.2)*1.25);
 const withoutFlat=calculateDirectLunarDamage({...input,flatBonus:0});
 near(crystal.expectation-withoutFlat.expectation,700*.9*(1+.6*1.2)*1.25,'elevation also multiplies flat');
 assert.throws(()=>calculateDirectLunarDamage({...input,skillIndependentTags:[]}),/未明确适用/);
 assert.throws(()=>calculateDirectLunarDamage({...input,participants:team().participants}),/未知参数/);
 assert.throws(()=>calculateDirectLunarDamage({...input,skillIndependentMultiplier:null}),/有效数值/);
});

test('3 普通独立倍率仅放大技能本体，定额不乘且默认100%',()=>{
 const sources=[named('IansanTalent2',{nightsoul:42,atk:3000,skill_level:10}),named('NicoleE',{nicole_atk:4000,e_level:10,ascended:true,c2:true}),
  named('MonaMagusGlow',{stack:3}),named('PruneTalent2',{prune_atk:3500,rate:1}),named('IllugaP2',{full_moon:true,is_c6:true})];
 const naked={...clone(vody),skill:{index:0,config:'NoConfig'},buffs:[]};
 const input={...naked,buffs:[...sources,named('LaylaC4',{hp:30000,rate:.5})]};
 const base=damage(input),bare=damage({...input,buffs:sources}),before=damage(naked);
 near(sum(bare.atk)-sum(before.atk),690+600+300+300,'source ATK caps and post-cap additions');
 near(sum(bare.em)-sum(before.em),80,'Illuga grants ordinary EM');
 near(sum(bare.bonus)-sum(before.bonus),.375,'Prune grants ordinary additive bonus');
 const reactions=api.CalculatorInterface.get_transformative_damage(input);
 for(const [key,coefficient]of Object.entries({overload:2.75,superconduct:1.5,electro_charged:2,shatter:3}))near(reactions[key]/reactions.bloom,coefficient/2,'7.1 reaction coefficient '+key);
 reactions.free();
 const changed=damage({...input,buffs:[...input.buffs,named('IndependentDamageMultiplier',{p:150,scope:'ordinary'})]});
 near(changed.normal.non_critical,bare.normal.non_critical*1.5+(base.normal.non_critical-bare.normal.non_critical));
 near(sum(changed.extra_damage),750);
 near(sum(changed.atk_ratio),sum(base.atk_ratio)*1.5,'details show same multiplier');
 near(damage({...input,buffs:[...input.buffs,named('IndependentDamageMultiplier')]}).normal.expectation,base.normal.expectation);
});

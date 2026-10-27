import test from 'node:test';
import assert from 'node:assert/strict';
import {LUNAR_EQUIPMENT_NAMES,prepareLunarEquipmentBuffs} from '../beta-data/lunar-equipment-rules.mjs';
import {EXTENSION_BUFF_REGISTRY,prepareExtensionBuffs} from '../beta-data/extension-buffs.mjs';
import {collectReactionParameters,lunarParameters} from '../beta-data/reaction-parameter-rules.mjs';
import {calculateDirectLunarDamage} from '../beta-data/lunar-damage.mjs';
import {calculateBloomFamilyDamage} from '../beta-data/bloom-damage.mjs';
import {withLunarDamageContexts} from '../beta-data/lunar-context-facade.mjs';
const named=(name,p={})=>({name,config:{[name]:p}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9, String(a)+' != '+b);
const values=(name,p={})=>EXTENSION_BUFF_REGISTRY.compile(named(name,p),{character:{name:'Vesna'}})?.[0]?.config.ExtensionEffect.values||{};
const direct=(kind,buffs=[])=>({kind,owner:{id:'Vesna',em:0,critRate:0,critDamage:0},scalingStat:100,skillMultiplier:1,resistanceMultiplier:1,buffs});
const total=buffs=>buffs.reduce((out,b)=>{for(const[k,v]of Object.entries(b.config?.ExtensionEffect?.values||{}))out[k]=(out[k]||0)+v;return out;},{});
test('1 纺夜天镜：双状态交集、精炼、四类反应消费和同名去重',()=>{
 for(let r=1;r<=5;r++)for(const a of [false,true])for(const b of [false,true]){
  const p={refine:r,northernmost_runo_active:a,crescent_verse_active:b,overlap_rate:.5};const v=values('NightweaversLookingGlass',p),factor=a&&b?(.3+.1*r)*.5:0;
  near(v.EnhanceBloom||0,factor*3);near(v.EnhanceHyperbloom||0,factor*2);near(v.EnhanceBurgeon||0,factor*2);near(v.EnhanceMoonbloom||0,factor);assert.equal(v.ElementalMastery,undefined);
 }
 const buffs=[named('NightweaversLookingGlass')];
 near(calculateDirectLunarDamage(direct('lunar-bloom',buffs)).expectation,140);
 for(const kind of ['bloom','hyperbloom','burgeon'])near(calculateBloomFamilyDamage({kind,owner:{id:'trigger',em:0},levelBase:100,resistanceMultiplier:1,buffs}).expectation,kind==='bloom'?440:540);
 near(collectReactionParameters([...buffs,...buffs]).EnhanceMoonbloom,.4);
 assert.throws(()=>values('NightweaversLookingGlass',{overlap_rate:1.1}),/无效/);
});
test('2 霜结的誓金枝：岩伤与月结晶分别消费，装备者排除及月笼状态',()=>{
 for(let r=1;r<=5;r++){const p={refine:r,rate:.5};const v=values('GoldenFrostboundOath',p);near(v.BonusGeo,(.15+.05*r)*.5);near(v.EnhanceMoonCrystallize,(.15+.05*r)*.5);}
 for(const p of [{favor_active:false},{moondrift_present:false},{recipient_is_wielder:true}])assert.deepEqual(values('GoldenFrostboundOath',p),{});
 near(calculateDirectLunarDamage(direct('lunar-crystallize',[named('GoldenFrostboundOath')])).expectation,192);
 near(calculateDirectLunarDamage(direct('lunar-bloom',[named('GoldenFrostboundOath')])).expectation,100);
 assert.equal(values('GoldenFrostboundOath').DEFPercentage,undefined);
});
test('3 支离轮光：月感电范围、状态、部分覆盖和后台受益',()=>{
 for(let r=1;r<=5;r++)near(values('FracturedHalo',{refine:r,rate:.25}).EnhanceMoonelectro,(.3+.1*r)*.25);
 assert.deepEqual(values('FracturedHalo',{edict_active:false}),{});
 const buffs=[named('FracturedHalo')];near(lunarParameters('lunar-electro',buffs,{recipientOnField:false}).reactionBonus,.4);
 near(calculateDirectLunarDamage(direct('lunar-electro',buffs)).expectation,420);
 near(lunarParameters('lunar-crystallize',buffs).reactionBonus,0);near(lunarParameters('lunar-bloom',buffs).reactionBonus,0);
 assert.equal(values('FracturedHalo').ATKPercentage,undefined);assert.throws(()=>values('FracturedHalo',{refine:6}),/无效/);
});
test('4 两套月辉：类型并集、相同类型不叠加、共享总数和初辉满辉精通',()=>{
 for(const [mode,em]of [[0,0],[1,60],[2,120]])near(values('SpinMoonSerenade',{mode}).ElementalMastery,em);
 assert.equal(values('RealmMirrorNight').CriticalBase,undefined);
 const spin=named('SpinMoonSerenade',{mode:2}),realm=named('RealmMirrorNight');
 const both=prepareLunarEquipmentBuffs([spin,realm,spin]);near(total(both).EnhanceMoonReaction,.2);near(total(both).ElementalMastery,120);
 near(total(prepareLunarEquipmentBuffs([spin,spin])).EnhanceMoonReaction,.1);
 const declared=[named('SpinMoonSerenade',{mode:2,rate:.2}),named('RealmMirrorNight',{rate:.2})];near(total(prepareLunarEquipmentBuffs(declared)).EnhanceMoonReaction,.2);
 near(total(prepareLunarEquipmentBuffs([...both,...declared])).EnhanceMoonReaction,.2);
 assert.deepEqual(prepareLunarEquipmentBuffs(both),both);
 near(total(prepareLunarEquipmentBuffs([named('SpinMoonSerenade',{effect_active:false,mode:2}),realm])).EnhanceMoonReaction,.1);
 for(const rate of [.15,.3,.4])assert.throws(()=>values('SpinMoonSerenade',{rate}),/无效|不同类型/);
 assert.throws(()=>prepareExtensionBuffs({character:{name:'Vesna'},artifact_config:{config_spin_moon_serenade:{moon_state:2}},buffs:[spin]}),/只在一处/);
 assert.doesNotThrow(()=>prepareExtensionBuffs({character:{name:'Vesna'},artifact_config:{config_spin_moon_serenade:{moon_state:2,moon_reaction_bonus:1}},buffs:[named('SpinMoonSerenade',{effect_active:false})]}));
 const input={character:{name:'Vesna'},buffs:[spin,realm]};const prepared=prepareExtensionBuffs(input);near(total(prepared.buffs).EnhanceMoonReaction,.2);near(total(prepared.buffs).ElementalMastery,120);
 assert.deepEqual(collectReactionParameters(input.buffs),collectReactionParameters(prepared.buffs));
});
test('5 五项完整API绑定、具名与编译混用、角色组合及固定面板优化隔离',()=>{
 assert.equal(LUNAR_EQUIPMENT_NAMES.length,5);for(const n of LUNAR_EQUIPMENT_NAMES)assert.ok(EXTENSION_BUFF_REGISTRY.has(n));
 const buffs=LUNAR_EQUIPMENT_NAMES.map(n=>named(n));const input={character:{name:'Vesna'},buffs};
 assert.deepEqual(collectReactionParameters(buffs),collectReactionParameters(prepareExtensionBuffs(input).buffs));
 assert.deepEqual(collectReactionParameters([...buffs,...prepareExtensionBuffs(input).buffs]),collectReactionParameters(buffs));
 const api=withLunarDamageContexts({CalculatorInterface:{get_damage_analysis:()=>({})},OptimizeSingleWasm:{optimize:()=>[]}});
 const config={...input,direct_lunar_context:direct('lunar-bloom')};near(api.CalculatorInterface.get_damage_analysis(config).direct_moonbloom.expectation,160);
 const combination=[...buffs,named('LaumaBurst',{em:100,skill_level:10}),named('LaumaC6')];near(calculateDirectLunarDamage(direct('lunar-bloom',combination)).expectation,(160+400)*1.25);
 const ordinary={...input,ordinary_bloom_context:{kind:'bloom',owner:{id:'Vesna',em:0},levelBase:100,resistanceMultiplier:1}};near(api.CalculatorInterface.get_damage_analysis(ordinary).bloom.expectation,440);
 assert.throws(()=>api.OptimizeSingleWasm.optimize(config,[]),/仅支持单次/);
 assert.equal(prepareExtensionBuffs({character:{name:'Lauma'},buffs}).buffs,buffs);
});

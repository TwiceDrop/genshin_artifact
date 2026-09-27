import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {calculateDirectLunarDamage,calculateLunarCrystallizeTeam,calculateLunarElectroTeam} from '../beta-data/lunar-damage.mjs';
import {calculateDirectStellarConduct} from '../beta-data/direct-stellar-conduct.mjs';
import {calculateStellarSwirlTeam} from '../beta-data/stellar-swirl-reaction.mjs';
import {REACTION_PARAMETER_NAMES,collectReactionParameters,bindReactionBuffs,moonOmenBonus,polestarField} from '../beta-data/reaction-parameter-rules.mjs';
import {EXTENSION_BUFF_REGISTRY,prepareExtensionBuffs} from '../beta-data/extension-buffs.mjs';
import {withLunarDamageContexts} from '../beta-data/lunar-context-facade.mjs';
import {createDamageEvaluator} from '../src/algorithms/stat-gain/curve.mjs';
const named=(name,p)=>({name,config:{[name]:p}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),a+' != '+b);
const direct=kind=>({kind,owner:{id:'owner',em:500,critRate:.2,critDamage:1},scalingStat:1000,skillMultiplier:2,flatBonus:100,resistanceMultiplier:1});
test('1 月曜三种擢升、双暴、倍率作用于各自分支，定额不乘倍率',()=>{
 for(const [kind,coefficient,elevate]of [['lunar-electro',3,'ElevateMoonelectro'],['lunar-bloom',1,'ElevateMoonbloom'],['lunar-crystallize',1.6,'ElevateMoonCrystallize']]){
  const buffs=[named(elevate,{p:25}),named('CriticalMoonReaction',{p:30}),named('CriticalDamageMoonReaction',{p:50}),named('MoonReactionDamageMultiplier',{p:150})];
  const r=calculateDirectLunarDamage({...direct(kind),buffs});
  near(r.non_critical,(2000*coefficient*2.2*1.5+100)*1.25);
  near(r.expectation,r.non_critical*1.75);
  const other=kind==='lunar-electro'?'ElevateMoonCrystallize':'ElevateMoonelectro';
  near(calculateDirectLunarDamage({...direct(kind),buffs:[named(other,{p:100})]}).expectation,calculateDirectLunarDamage(direct(kind)).expectation);
 }
 for(const [element,value]of [['Pyro',4000],['Electro',4000],['Cryo',4000],['Hydro',60000],['Geo',3600],['Anemo',1600],['Dendro',1600]]){near(moonOmenBonus({element,value}),.36);near(moonOmenBonus({element,value:value/2}),.18);near(moonOmenBonus({element,value:value*2}),.36);}
 const omen=named('ResonanceMoonOmen',{element:'Hydro',value:30000});
 const moon=calculateDirectLunarDamage({...direct('lunar-bloom'),buffs:[omen,omen]});
 near(moon.non_critical,2000*(2.2+.18)+100);
 assert.throws(()=>moonOmenBonus({element:'Physical',value:1000}),/不能选物理/);
 const base=direct('lunar-bloom');
 near(calculateDirectLunarDamage({...base,buffs:[named('MoonReactionDamageMultiplier',{})]}).expectation,calculateDirectLunarDamage(base).expectation);
 near(calculateDirectLunarDamage({...base,buffs:[named('MoonReactionDamageMultiplier',{p:0})]}).expectation,120);
 assert.throws(()=>calculateDirectLunarDamage({...base,buffs:[named('MoonReactionDamageMultiplier',{p:null})]}),/无效/);
});
test('2 月笼参数只归属指定参与者，判暴后排序；月感电使用3的贡献系数',()=>{
 const context={baseBonus:0,resistanceMultiplier:1,participants:[{id:'geo',element:'Geo',levelBase:62.5,em:0,critRate:0,critDamage:1},{id:'hydro',element:'Hydro',levelBase:75,em:0,critRate:0,critDamage:0}]};
 const input={character:{name:'owner'},buffs:[named('CriticalMoonReaction',{p:50})]};
 const bound=bindReactionBuffs({...context,buffRecipientId:'geo'},input,{team:true});
 assert.equal(bound.participants[1].buffs,undefined);
 near(calculateLunarCrystallizeTeam(bound).expectation,129);
 const electro={...bound,participants:bound.participants.map(p=>({...p,element:p.element==='Geo'?'Electro':p.element,levelBase:p.levelBase*1.6/3}))};
 near(calculateLunarElectroTeam(electro).expectation,129);
 assert.throws(()=>bindReactionBuffs({...context,buffRecipientId:'missing'},input,{team:true}),/不在参与者/);
});
test('3 星超导K为加法，月曜或普通独立倍率不泄漏，F不随K变化',()=>{
 const input={owner:{id:'ssc',em:0,critRate:0,critDamage:0},scalingStat:2000,skillMultiplier:2,baseMultiplier:1.5,flatBonus:10,elevation:.1,resistanceMultiplier:1,element:'Cryo'};
 const r=calculateDirectStellarConduct({...input,buffs:[named('StellarConductBaseMultiplier',{value:.7}),named('MoonReactionDamageMultiplier',{p:300}),named('CriticalMoonReaction',{p:100}),named('IndependentDamageMultiplier',{p:500})]});
 const resonance=named('ResonancePolestarField',{stacks:12});
 const resonanceResult=calculateDirectStellarConduct({...input,baseMultiplier:1,buffs:[resonance,resonance]});
 near(resonanceResult.non_critical,(4000*2+10)*1.1);
 const effects=collectReactionParameters([resonance,resonance]);near(effects.BonusCryo,.4);near(effects.BonusElectro,.4);near(effects.ResMinusPhysical,.4);
 const coefficients=[1,1.45,1.5,1.55,1.6,1.65,1.7,1.75,1.8,1.85,1.9,1.95,2];
 const bonuses=[.2,.29,.3,.31,.32,.33,.34,.35,.36,.37,.38,.39,.4];
 for(let stacks=0;stacks<=12;stacks++){const field=polestarField({stacks});near(field.coefficient,coefficients[stacks]);near(field.bonus,bonuses[stacks]);near(field.physicalShred,.4);}
 assert.throws(()=>polestarField({stacks:1.5}),/整数/);
 near(r.non_critical,9691);near(r.expectation,9691);near(r.coefficient,2.2);
 near(r.non_critical-calculateDirectStellarConduct(input).non_critical,4000*.7*1.1);
 assert.throws(()=>calculateDirectStellarConduct({...input,buffs:[named('StellarConductBaseMultiplier',{value:-2})]}),/无效/);
});
test('4 冰风涡系数只加给受益参与者冰伤，风伤及近似标记不变',()=>{
 const p=(id,element)=>({id,element,levelMultiplier:100,elementalMastery:0,criticalRate:0,criticalDamage:0,anemoResistanceMultiplier:1,cryoResistanceMultiplier:1});
 const x={triggerId:'wind',vortexMultiplier:2,participants:[p('wind','Anemo'),p('ice','Cryo'),p('ice2','Cryo')]};
 const baseline=calculateStellarSwirlTeam(x);
 const actual=calculateStellarSwirlTeam({...x,participants:x.participants.map(p=>p.id==='ice'?{...p,buffs:[named('StellarSwirlReactionCryoBaseMultiplier',{value:1})]}:p)});
 near(actual.stellarswirl_anemo.expectation,baseline.stellarswirl_anemo.expectation);
 near(actual.stellarswirl_cryo.expectation-baseline.stellarswirl_cryo.expectation,60);
 assert.equal(actual.expectation_is_approximate,true);
});
test('5 八项参数及两项共鸣注册到原生属性且通过实际适配接口，固定面板仍拒绝优化',()=>{
 const buffs=REACTION_PARAMETER_NAMES.map(name=>named(name,name==='ResonanceMoonOmen'?{element:'Hydro',value:30000}:name==='ResonancePolestarField'?{stacks:12}:name.endsWith('BaseMultiplier')?{value:.5}:{p:name==='MoonReactionDamageMultiplier'?150:25}));
 const input={character:{name:'owner'},buffs,direct_lunar_context:{...direct('lunar-bloom'),owner:{id:'owner',em:500,critRate:.2,critDamage:1}}};
 const compiled=prepareExtensionBuffs({...input,character:{name:'Vesna'}}).buffs;
 assert.equal(compiled.length,10);assert.ok(compiled.every(b=>b.name==='ExtensionEffect'));
 const raw=collectReactionParameters(buffs),native=collectReactionParameters(compiled);
 assert.deepEqual(raw,native);
 assert.deepEqual(collectReactionParameters([...buffs,...compiled]),raw);
 const locked=buffs.map(b=>({...b,lock:true}));
 assert.deepEqual(collectReactionParameters(locked),{});
 assert.deepEqual(collectReactionParameters(compiled.map(b=>({...b,lock:true}))),{});
 assert.deepEqual(prepareExtensionBuffs({character:{name:'Vesna'},buffs:[...locked,...buffs]}).buffs,compiled);
 for(const name of REACTION_PARAMETER_NAMES)assert.ok(EXTENSION_BUFF_REGISTRY.has(name));
 const api=withLunarDamageContexts({CalculatorInterface:{get_damage_analysis:()=>({normal:{expectation:7}})},OptimizeSingleWasm:{optimize:()=>[]},DSLInterface:{run:()=>null}});
 const r=api.CalculatorInterface.get_damage_analysis(input);
 near(r.direct_moonbloom.expectation,calculateDirectLunarDamage({...input.direct_lunar_context,buffs}).expectation);
 near(r.normal.expectation,7);
 assert.throws(()=>api.OptimizeSingleWasm.optimize(input,[]),/仅支持单次/);
 assert.throws(()=>api.DSLInterface.run('',input,[]),/仅支持单次/);
 const ssc={...input,direct_lunar_context:undefined,direct_stellar_context:{owner:{id:'owner',em:0,critRate:0,critDamage:0},scalingStat:100,skillMultiplier:1,baseMultiplier:1,element:'Electro',resistanceMultiplier:1}};
 near(api.CalculatorInterface.get_damage_analysis(ssc).direct_stellarconduct.expectation,250);
 assert.throws(()=>createDamageEvaluator(api,ssc,'direct_stellarconduct',null,[],0),/不能用于词条收益/);
 // Syntax-only UI verification: no Webpack, Cargo or WASM build.
 const require=createRequire(import.meta.url),compiler=require('@vue/compiler-sfc');
 const source=fs.readFileSync(new URL('../src/pages/NewArtifactPlanPage/LunarDamagePanel.vue',import.meta.url),'utf8');
 const parsed=compiler.parse(source);assert.equal(parsed.errors.length,0);compiler.compileScript(parsed.descriptor,{id:'reaction-parameters'});
 assert.equal(compiler.compileTemplate({source:parsed.descriptor.template.content,filename:'LunarDamagePanel.vue',id:'reaction-parameters'}).errors.length,0);
});

import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
globalThis.module={require:createRequire(import.meta.url)};
import {bindings} from '../mona_wasm/pkg/bindings.js';import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js';
import * as extension from '../mona_wasm/extension/mona_extension.js';import {createFacade} from '../beta-data/facade.mjs';import {createBeta2} from '../beta-data/vesna-facade.mjs';
import {computeCurve,createDamageEvaluator} from '../src/algorithms/stat-gain/curve.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
bindings.lI(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(new URL('../mona_wasm/pkg/mona_wasm_bg.wasm',import.meta.url))),{'./mona_wasm_bg.js':bridge}).exports);
extension.initSync(fs.readFileSync(new URL('../mona_wasm/extension/mona_extension_bg.wasm',import.meta.url)));
const old={CommonInterface:bindings.Ps,CalculatorInterface:bindings.K2,OptimizeSingleWasm:bindings.E2,BonusPerStat:bindings.bd,TeamOptimizationWasm:bindings.B8};
const support=read('../beta-data/extension-support.json');const base=createFacade(old,extension,read('../beta-data/vodyanitsa.json'),support,read('../src/assets/_gen_character.js'));
export const api=createBeta2(base,extension,support);
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),clone=structuredClone;
const named=(name,config)=>({name,config:{[name]:config}});
const fixture=read('../beta-data/mizuki-fixture.json');
export const input=clone(fixture.input);input.character={name:'Vesna',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:{Vesna:{stance:true,radiance:true,disciplinary_stacks:6,anemo_cryo_count:1,other_count:1,flat_inside_discipline:false}}};
input.weapon={name:'BeyondTheChrysalis',level:90,ascend:false,refine:1,params:{BeyondTheChrysalis:{loyal_wind:true,rebel_wind:true,on_field:true}}};input.skill={index:17,config:'NoConfig'};
const p={hp:60000,constellation:0,e_level:10,on_field:true,ordinary_mode:false};input.buffs=['A1','A4'].map(n=>({name:'Vodyanitsa'+n,config:{['Vodyanitsa'+n]:p}}));
const tests=[],test=(name,fn)=>{try{fn();tests.push({name,pass:true})}catch(e){tests.push({name,pass:false,error:String(e)})}};
const near=(a,b)=>{if(typeof a==='number'&&typeof b==='number')return close(a,b);if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const k of Object.keys(a))near(a[k],b[k]);}else assert.equal(a,b)};
test('原发布内核中的瑞希面板与伤害数值不变',()=>{near(api.CommonInterface.get_attribute(fixture.input),old.CommonInterface.get_attribute(fixture.input));near(api.CalculatorInterface.get_damage_analysis(fixture.input,null),old.CalculatorInterface.get_damage_analysis(fixture.input,null));});
test('原生薇斯纳＋真实瑞希装备面板',()=>{const a=api.CommonInterface.get_attribute(input);close(sum(a.atk),1740.492);close(sum(a.elemental_mastery),630);close(sum(a.critical),.88);close(sum(a.critical_damage),2.17);});
// KQM original research (7.0): https://keqingmains.com/misc/stellar-reaction-guide/
// TapTap 2026-09-23 text formula/A4 values: https://www.taptap.cn/moment/851912127529616541
test('原生直接星扩散按基础与精通结算后加入沃雅妮莎定额',()=>{
 const d=api.CalculatorInterface.get_damage_analysis(input,null);
 // Independent fixture anchors: 1740.492 ATK, 7.58016 skill+discipline ratio,
 // 630 EM, 36% weapon Stellar bonus, 40% four-piece bonus, 5200 A4 flat,
 // 35% Anemo shred against 10% enemy RES, 88% CRIT and 217% CRIT DMG.
 const raw=1740.492*7.58016*(1+1740.492*.00007)*(1+6*630/2630+.36+.4)+5200;
 close(d.direct_stellarswirl.non_critical,raw*1.125);
 close(d.direct_stellarswirl.expectation,raw*1.125*(1+.88*2.17));
 close(d.normal.expectation,0);
});
test('旧定额位置开关按同一已核对公式迁移',()=>{const x=clone(input);x.character.params.Vesna.flat_inside_discipline=true;close(api.CalculatorInterface.get_damage_analysis(x,null).direct_stellarswirl.expectation,api.CalculatorInterface.get_damage_analysis(input,null).direct_stellarswirl.expectation);});
test('沃 A4 6500 定额不受精通/星扩增伤但受抗性/暴击/擢升',()=>{
 const plain=clone(input);plain.artifacts=[];plain.character.params.Vesna.other_count=0;
 plain.buffs=[named('VodyanitsaA4',{...p,hp:40000})];
 close(sum(api.CalculatorInterface.get_damage_analysis(plain,null).em),0);
 const variants=[[],[named('ElementalMastery',{value:500}),named('EnhanceStellarGlimmerReaction',{p:50})],
  [named('VodyanitsaA1',{...p}),named('VodyanitsaC6',{...p,constellation:6})]];
 for(const extra of variants){
  const noFlat=clone(plain);noFlat.buffs.push(...extra);
  const withFlat=clone(noFlat);withFlat.buffs[0].config.VodyanitsaA4.hp=65000;
  const off=api.CalculatorInterface.get_damage_analysis(noFlat,null);
  const on=api.CalculatorInterface.get_damage_analysis(withFlat,null);
  const resistance=extra.some(b=>b.name==='VodyanitsaA1')?1.125:.9;
  const elevation=extra.some(b=>b.name==='VodyanitsaC6')?1.25:1;
  close(on.direct_stellarswirl.non_critical-off.direct_stellarswirl.non_critical,6500*resistance*elevation);
  close(on.direct_stellarswirl.critical-off.direct_stellarswirl.critical,6500*resistance*elevation*(1+sum(on.critical_damage)));
  close(on.direct_stellarswirl.expectation-off.direct_stellarswirl.expectation,6500*resistance*elevation*(1+sum(on.critical)*sum(on.critical_damage)));
 }
});
test('关闭辉映后原生普通伤害含整肃而不吃队友星定额',()=>{const x=clone(input);x.character.params.Vesna.radiance=false;const d=api.CalculatorInterface.get_damage_analysis(x,null);assert.equal(d.direct_stellarswirl,undefined);close(d.normal.non_critical,1678.812*4.7376*1.6*.5*1.125);});
test('二命列装自动六层，并增加 40% 基础攻击',()=>{const x=clone(input);x.character.constellation=2;x.character.params.Vesna.disciplinary_stacks=0;close(sum(api.CommonInterface.get_attribute(x).atk),1740.492+1028*.4);assert.ok(api.CalculatorInterface.get_damage_analysis(x,null).direct_stellarswirl.expectation>215948);});
test('血红之证四件暴击按实际配装计数',()=>{const x=clone(input);x.artifacts[0].set_name='GladiatorsFinale';close(sum(api.CommonInterface.get_attribute(x).critical),.72);x.artifacts[0].set_name='ScarletProof';close(sum(api.CommonInterface.get_attribute(x).critical),.88);});
test('炉火两件套提供攻击18%，不错误提供精通80',()=>{const x=clone(input);x.artifacts=x.artifacts.slice(0,2).map(a=>({...a,set_name:'HeartOfTheFurnace'}));const a=api.CommonInterface.get_attribute(x);close(sum(a.elemental_mastery),69);close(sum(a.atk),1028*(1+.18+.06)+311);});
test('队友二命与六命作用于星伤，不污染面板风伤',()=>{const x=clone(input);x.buffs.push(...['C2','C6'].map(n=>({name:'Vodyanitsa'+n,config:{['Vodyanitsa'+n]:{...p,constellation:6}}})));close(sum(api.CommonInterface.get_attribute(x).bonus_anemo),0);assert.ok(api.CalculatorInterface.get_damage_analysis(x,null).direct_stellarswirl.expectation>250000);});
test('原生单人配装可以返回五件装备',()=>{const r=api.OptimizeSingleWasm.optimize({...input,target_function:{name:'VesnaDefault',params:'NoConfig'},algorithm:'AStar',constraint:null,filter:null},input.artifacts);assert.ok(r.length>0);});
test('配装目标与伤害面板相同，不把星伤优化成普通风伤',()=>{const r=api.OptimizeSingleWasm.optimize({...input,target_function:{name:'VesnaDefault',params:'NoConfig'},algorithm:'Naive',constraint:null,filter:null},input.artifacts);assert.ok(r.length>0);close(r[0].value,api.CalculatorInterface.get_damage_analysis(input,null).direct_stellarswirl.expectation);});
test('原生十词条收益入口输出有限数值',()=>{const r=api.BonusPerStat.bonus_per_stat({...input,tf:{name:'VesnaDefault',params:'NoConfig'},artifacts_config:input.artifact_config});assert.equal(r.atk_percentage.length,10);assert.ok(r.atk_percentage.every(x=>Number.isFinite(x)&&x>0));assert.ok(r.elemental_mastery.every(Number.isFinite));});
test('实际0～20条最优收益曲线保持血红四件并输出21个点',()=>{const options={stats:['ATKPercentage','ElementalMastery','CriticalDamage','CriticalRate'],maxRolls:20,tier:'average'};const ev=createDamageEvaluator(api,input,'direct_stellarswirl',null,options.stats,options.tier);const r=computeCurve(ev.evaluate,options);assert.equal(r.points.length,21);close(r.baseline,api.CalculatorInterface.get_damage_analysis(input,null).direct_stellarswirl.expectation);assert.ok(r.points[20].damage>r.baseline);fs.writeFileSync(new URL('../beta-data/vesna-curve.json',import.meta.url),JSON.stringify(r,null,2));});
test('未解锁六命的灵剑不能消耗辅助定额产生伤害',()=>{const x=clone(input);x.skill.index=19;close(api.CalculatorInterface.get_damage_analysis(x,null).direct_stellarswirl.expectation,0);});
test('原角色绑定沃雅妮莎的旧计算仍一致',()=>{const s=read('../beta-data/skirk-fixture.json').input;assert.deepEqual(api.CommonInterface.get_attribute(s),base.CommonInterface.get_attribute(s));});
const results={passed:tests.filter(t=>t.pass).length,total:tests.length,tests};fs.writeFileSync(new URL('../beta-data/beta2-tests.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));if(results.passed!==results.total)process.exitCode=1;

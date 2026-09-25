import fs from 'node:fs';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
globalThis.module={require:createRequire(import.meta.url)};
import {bindings} from '../mona_wasm/pkg/bindings.js';import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js';
import * as extension from '../mona_wasm/extension/mona_extension.js';import {createFacade} from '../beta-data/facade.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
const binary=fs.readFileSync(new URL('../mona_wasm/pkg/mona_wasm_bg.wasm',import.meta.url));
const instance=new WebAssembly.Instance(new WebAssembly.Module(binary),{'./mona_wasm_bg.js':bridge});bindings.lI(instance.exports);
extension.initSync(fs.readFileSync(new URL('../mona_wasm/extension/mona_extension_bg.wasm',import.meta.url)));
const original={CalculatorInterface:bindings.K2,CommonInterface:bindings.Ps,OptimizeSingleWasm:bindings.E2,BonusPerStat:bindings.bd,TeamOptimizationWasm:bindings.B8};
const chars=read('../src/assets/_gen_character.js');
const api=createFacade(original,extension,read('../beta-data/vodyanitsa.json'),read('../beta-data/extension-support.json'),chars);
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const c={name:'Vodyanitsa',level:90,ascend:false,constellation:0,skill1:0,skill2:9,skill3:9,
 params:{Vodyanitsa:{e_active:false,song_active:false,ordinary_mode:true,c1_active:false,c2_active:false,c4_stacks:0,on_field:true}}};
const input={character:c,weapon:{name:'HymnOfTheMaelstrom',level:90,ascend:false,refine:1,params:{HymnOfTheMaelstrom:{stacks:0,boosted:false,on_field:true}}},
 skill:{index:11,config:{Vodyanitsa:{low_hp_heal:false,q_song_bonus:false}}},artifacts:[],artifact_config:null,enemy:null,buffs:[]};
const results=[],test=(name,fn)=>{try{fn();results.push({name,pass:true});console.log('PASS',name)}catch(e){results.push({name,pass:false,error:String(e)});console.log('FAIL',name,String(e))}};
test('新增原生角色与专武可以读取面板',()=>{const p=api.CommonInterface.get_attribute(input);close(sum(p.hp),14818*(1+.288+.6615));close(sum(p.healing_bonus),.04)});
test('十二个技能条目全部输出有效伤害或治疗',()=>{for(let i=0;i<12;i++){const r=api.CalculatorInterface.get_damage_analysis({...input,skill:{...input.skill,index:i}},null);assert.ok(Number.isFinite(r.normal.expectation)&&r.normal.expectation>0)}});
test('E 治疗按生命比例与固定值计算',()=>{const p=api.CommonInterface.get_attribute(input);const r=api.CalculatorInterface.get_damage_analysis({...input,skill:{...input.skill,index:10}},null);close(r.normal.expectation,(sum(p.hp)*.0504+593.2278)*1.04)});
test('E10 与 Q10 独立倍率公式核对',()=>{const hp=sum(api.CommonInterface.get_attribute(input).hp);for(const [i,r]of [[8,.058896],[11,.822182]]){const d=api.CalculatorInterface.get_damage_analysis({...input,skill:{...input.skill,index:i}},null);close(d.normal.non_critical,hp*r*.5*.9)}});
test('C4 生命层数与精炼生命加成进入属性图',()=>{const x=structuredClone(input);x.character.constellation=4;x.character.params.Vodyanitsa.c4_stacks=3;x.weapon.params.HymnOfTheMaelstrom={stacks:3,boosted:true,on_field:true};close(sum(api.CommonInterface.get_attribute(x).hp),14818*(1+.288+.6615+.6+.21))});
const raw=read('../beta-data/skirk-fixture.json').input;
test('丝柯克原面板与伤害完全不变',()=>{assert.deepEqual(api.CommonInterface.get_attribute(raw),original.CommonInterface.get_attribute(raw));assert.deepEqual(api.CalculatorInterface.get_damage_analysis(raw,null),original.CalculatorInterface.get_damage_analysis(raw,null))});
test('丝柯克 + 沃雅妮莎 C0 支援复现实验值',()=>{const x=structuredClone(raw);x.skill.index=9;x.buffs=['E','A4'].map(s=>({name:'Vodyanitsa'+s,config:{['Vodyanitsa'+s]:{hp:60000,constellation:0,e_level:10,on_field:true,ordinary_mode:true}}}));close(api.CalculatorInterface.get_damage_analysis(x,null).normal.expectation,18205.40726360957)});
test('单人优化能返回五件配装',()=>{const artifacts=raw.artifacts.map((a,i)=>({...a,id:i+1}));const r=api.OptimizeSingleWasm.optimize({...input,target_function:{name:'VodyanitsaDefault',params:'NoConfig'},algorithm:'AStar',constraint:null,filter:null},artifacts);assert.ok(r.length>0);});
test('C1 使用最终生命转固定攻击，未解锁时无效',()=>{
 const x=structuredClone(input);x.character.params.Vodyanitsa.c1_active=true;
 close(sum(api.CommonInterface.get_attribute(x).atk),650);
 x.character.constellation=1;const p=api.CommonInterface.get_attribute(x);close(sum(p.atk),650+sum(p.hp)*.008);
});
test('专武攻击转换使用基础攻击、三层与强化倍率，并受上限限制',()=>{
 const x=structuredClone(input);x.character.constellation=4;x.character.params.Vodyanitsa.c4_stacks=3;
 x.weapon.params.HymnOfTheMaelstrom={stacks:3,boosted:true,on_field:true};
 let p=api.CommonInterface.get_attribute(x);close(sum(p.atk),650*(1+(sum(p.hp)-40000)/1000*.004*3*1.75));
 x.buffs=[{name:'HPFixed',config:{HPFixed:{value:40000}}}];p=api.CommonInterface.get_attribute(x);close(sum(p.atk),650*1.42);
 x.weapon.params.HymnOfTheMaelstrom.on_field=false;close(sum(api.CommonInterface.get_attribute(x).atk),650);
});
test('C2 水伤暴伤、C6 水伤加成、C4 低血治疗分别生效',()=>{
 const x=structuredClone(input);x.character.constellation=2;x.character.params.Vodyanitsa.c2_active=true;
 let r=api.CalculatorInterface.get_damage_analysis(x,null);close(r.normal.critical/r.normal.non_critical,2);
 x.character.params.Vodyanitsa.on_field=false;r=api.CalculatorInterface.get_damage_analysis(x,null);close(r.normal.critical/r.normal.non_critical,1.5);
 x.character.constellation=6;x.character.params.Vodyanitsa.song_active=true;r=api.CalculatorInterface.get_damage_analysis(x,null);close(r.normal.critical/r.normal.non_critical,2);
 close(sum(api.CommonInterface.get_attribute(x).bonus_hydro),.6);
 x.skill.index=10;x.skill.config.Vodyanitsa.low_hp_heal=true;r=api.CalculatorInterface.get_damage_analysis(x,null);
 close(r.normal.expectation,(sum(api.CommonInterface.get_attribute(x).hp)*.0504+593.2278)*1.04*1.5);
});
test('A4 超出四万生命的普通加值与 3500 上限',()=>{
 const x=structuredClone(input);x.buffs=[{name:'HPFixed',config:{HPFixed:{value:40000}}}];
 const base=api.CalculatorInterface.get_damage_analysis(x,null);x.character.params.Vodyanitsa.song_active=true;
 const boosted=api.CalculatorInterface.get_damage_analysis(x,null);close(boosted.normal.non_critical-base.normal.non_critical,3500*.9*.5);
 x.character.params.Vodyanitsa.ordinary_mode=false;close(api.CalculatorInterface.get_damage_analysis(x,null).normal.non_critical,base.normal.non_critical);
});
test('风起之日四件套按已配置覆盖率计算攻击，不静默丢弃库存',()=>{
 const x=structuredClone(input);x.artifacts=raw.artifacts.map(a=>({...a,set_name:'Empty'}));
 const base=sum(api.CommonInterface.get_attribute(x).atk);
 x.artifacts=x.artifacts.map(a=>({...a,set_name:'ADayCarvedFromRisingWinds'}));
 const sets=read('../src/assets/_gen_artifact.js');const snake=s=>s.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()).replace(/^_/,'');
 x.artifact_config=Object.fromEntries(Object.values(sets).filter(s=>s.config2.length||s.config4.length).map(s=>['config_'+snake(s.name2),Object.fromEntries([...s.config2,...s.config4].map(c=>[c.name,c.default]))]));
 x.artifact_config.config_a_day_carved_from_rising_winds.rate=0.5;
 close(sum(api.CommonInterface.get_attribute(x).atk)-base,650*(.18+.25*.5));
});
test('界面完整圣遗物配置与十条词条收益入口可使用',()=>{
 const sets=read('../src/assets/_gen_artifact.js');const snake=s=>s.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()).replace(/^_/,'');
 const config=Object.fromEntries(Object.values(sets).filter(s=>s.config2.length||s.config4.length).map(s=>['config_'+snake(s.name2),Object.fromEntries([...s.config2,...s.config4].map(c=>[c.name,c.default]))]));
 const x={...input,artifact_config:config};assert.ok(sum(api.CommonInterface.get_attribute(x).hp)>0);
 const r=api.BonusPerStat.bonus_per_stat({...x,tf:{name:'VodyanitsaDefault',params:'NoConfig'},artifacts_config:config});assert.equal(r.hp_percentage.length,10);assert.ok(r.hp_percentage.every(v=>Number.isFinite(v)&&v>0));
});
const output={results,passed:results.filter(r=>r.pass).length,total:results.length};
fs.writeFileSync(new URL('../beta-data/smoke-results.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
if(output.passed!==output.total)process.exitCode=1;

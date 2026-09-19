import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {bindings} from '../mona_wasm/pkg/bindings.js';
import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js';
import * as extension from '../mona_wasm/extension/mona_extension.js';
import {createFacade} from '../beta-data/facade.mjs';
import {createBeta2} from '../beta-data/vesna-facade.mjs';
import {normalizeSignatureWeapon, chrysalisEffects} from '../beta-data/weapon-effects.mjs';
import {computeCurve, createDamageEvaluator} from '../src/algorithms/stat-gain/curve.mjs';
globalThis.module = {require:createRequire(import.meta.url)};
const read = p => JSON.parse(fs.readFileSync(new URL('../'+p, import.meta.url), 'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
bindings.lI(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(new URL('../mona_wasm/pkg/mona_wasm_bg.wasm',import.meta.url))),{'./mona_wasm_bg.js':bridge}).exports);
extension.initSync(fs.readFileSync(new URL('../mona_wasm/extension/mona_extension_bg.wasm',import.meta.url)));
const original = {CommonInterface:bindings.Ps,CalculatorInterface:bindings.K2,OptimizeSingleWasm:bindings.E2,BonusPerStat:bindings.bd,TeamOptimizationWasm:bindings.B8};
const support = read('beta-data/extension-support.json');
const api = createBeta2(createFacade(original,extension,read('beta-data/vodyanitsa.json'),support,read('src/assets/_gen_character.js')),extension,support);
const clone=structuredClone, sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const attr=x=>api.CommonInterface.get_attribute(x), damage=x=>api.CalculatorInterface.get_damage_analysis(x,null);
const vesna={character:{name:'Vesna',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:{Vesna:{stance:true,radiance:true,disciplinary_stacks:6,anemo_cryo_count:1,other_count:0,flat_inside_discipline:false}}},weapon:{name:'BeyondTheChrysalis',level:90,ascend:false,refine:1,params:{BeyondTheChrysalis:{loyal_rate:0,rebel_rate:0,plenty_rate:0,on_field:true}}},skill:{index:17,config:'NoConfig'},artifacts:[],artifact_config:null,enemy:null,buffs:[]};
const vody={character:{name:'Vodyanitsa',level:90,ascend:false,constellation:0,skill1:0,skill2:9,skill3:9,params:{Vodyanitsa:{e_active:false,song_active:false,ordinary_mode:true,c1_active:false,c2_active:false,c4_stacks:0,on_field:true}}},weapon:{name:'HymnOfTheMaelstrom',level:90,ascend:false,refine:1,params:{HymnOfTheMaelstrom:{hp:0,stacks:0,boosted:false,on_field:true}}},skill:{index:11,config:{Vodyanitsa:{low_hp_heal:false,q_song_bonus:false}}},artifacts:[],artifact_config:null,enemy:null,buffs:[]};
const tests=[];
function test(name, fn) {try {fn();tests.push({name,pass:true});console.log('PASS',name)} catch(error) {tests.push({name,pass:false,error:String(error)});console.error('FAIL',name,error)}}
const checked=read('beta-data/weapons-beta3.json');
test('公开页面精炼参数与当前实现一致',()=>{
 assert.deepEqual(checked.weapons[0].refinements,[[.56,.36,5,10,4],[.72,.45,5.5,10,4],[.88,.54,6,10,4],[1.04,.63,6.5,10,4],[1.2,.72,7,10,4]]);
 assert.deepEqual(checked.weapons[1].refinements.map(r=>r.slice(0,4)),[[.04,40000,.004,.08],[.05,40000,.005,.1],[.06,40000,.006,.12],[.07,40000,.007,.14],[.08,40000,.008,.16]]);
});
for(const [index, fixture, charAtk] of [[0,vesna,354],[1,vody,108]])test(`${fixture.weapon.name}：1～90级及六处突破前后全部核对（96组）`,()=>{
 for(const row of checked.weapons[index].levels){const x=clone(fixture);x.weapon.level=row.level;x.weapon.ascend=row.ascend;const a=attr(x);close(sum(a.atk), (charAtk+row.attack)*(index===0?1.06:1));if(index===0)close(sum(a.critical_damage),.5+row.subStat);else close(sum(a.hp),14818*(1+.288+row.subStat));}
});
for(let refine=1;refine<=5;refine++){
 test(`蝶变R${refine}：三项覆盖率0/25/50/100%，暴伤、星伤与回能分别验证`,()=>{
  const x=clone(vesna);x.weapon.refine=refine;const p=x.weapon.params.BeyondTheChrysalis;
  const initial=damage(x).direct_stellarswirl, baseCD=sum(attr(x).critical_damage);
  for(const rate of [0,25,50,100]){
   p.loyal_rate=rate;p.rebel_rate=0;p.plenty_rate=0;
   close(sum(attr(x).critical_damage),baseCD+(.4+.16*refine)*rate/100);
   close(damage(x).direct_stellarswirl.non_critical,initial.non_critical);
   p.loyal_rate=0;p.rebel_rate=rate;
   close(damage(x).direct_stellarswirl.non_critical,initial.non_critical*(1+(.27+.09*refine)*rate/100));
   close(damage(x).direct_stellarswirl_compose['蝶变'],(.27+.09*refine)*rate/100);
   p.rebel_rate=0;p.plenty_rate=rate;
   close(attr(x).weapon_effects.energyPerFourSeconds,(4.5+.5*refine)*rate/100);
   close(sum(attr(x).recharge),1);close(damage(x).direct_stellarswirl.expectation,initial.expectation);
  }
 });
 test(`漩流颂歌R${refine}：40000阈值、50000中间值、60000上限、三层与强化`,()=>{
  const x=clone(vody);x.weapon.refine=refine;const p=x.weapon.params.HymnOfTheMaelstrom, coef=.03+.01*refine;
  for(const hp of [35000,40000,50000,60000,100000])for(const n of [0,1,2,3])for(const boosted of [false,true]){
   Object.assign(p,{hp,stacks:n,boosted});const a=attr(x),mult=boosted?1.75:1;
   close(sum(a.atk),650*(1+Math.min(Math.max(hp-40000,0)/1000*coef/10,2*coef)*n*mult));
   close(sum(a.healing_bonus),coef);close(sum(a.hp),14818*(1+.288+.6615+coef*n*mult));
  }
 });
}
test('蝶变三项可同时100%，退场同时清除，基础副词条保留',()=>{
 const x=clone(vesna),p=x.weapon.params.BeyondTheChrysalis;Object.assign(p,{loyal_rate:100,rebel_rate:100,plenty_rate:100,on_field:false});
 close(sum(attr(x).critical_damage),.941);close(attr(x).weapon_effects.energyPerFourSeconds,0);close(damage(x).direct_stellarswirl.expectation,damage(vesna).direct_stellarswirl.expectation);
});
test('旧版开关与无配置均可迁移，保存后的独立覆盖率不被覆盖',()=>{
 const w=clone(vesna.weapon);w.params={BeyondTheChrysalis:{loyal_wind:true,rebel_wind:false,on_field:true}};
 assert.deepEqual(normalizeSignatureWeapon(w).params.BeyondTheChrysalis,{on_field:true,loyal_rate:100,rebel_rate:0,plenty_rate:0});
 w.params.BeyondTheChrysalis.loyal_rate=32.5;close(chrysalisEffects(JSON.parse(JSON.stringify(w))).criticalDamage,.56*.325);
 w.params='NoConfig';close(chrysalisEffects(w).criticalDamage,0);
});
test('自定义生命不改变自身生命/治疗，自动模式跟随面板，后台不享受自身加攻',()=>{
 const x=clone(vody);x.weapon.params.HymnOfTheMaelstrom={hp:0,stacks:3,boosted:true,on_field:true};
 x.buffs=[{name:'HPFixed',config:{HPFixed:{value:20000}}}];const a=attr(x),hp=sum(a.hp);
 const expected=650*(1+Math.min(Math.max(hp-40000,0)/1000*.004,.08)*3*1.75);close(sum(a.atk),expected);
 x.skill.index=10;const heal=damage(x).normal.expectation;x.weapon.params.HymnOfTheMaelstrom.hp=60000;
 close(sum(attr(x).atk),650*1.42);close(sum(attr(x).hp),hp);close(damage(x).normal.expectation,heal);
 x.weapon.params.HymnOfTheMaelstrom.on_field=false;close(sum(attr(x).atk),650);close(sum(attr(x).hp),hp);
});
test('沃雅妮莎队友专武BUFF读取自定义生命与精炼，对薇斯纳普通角色均生效',()=>{
 for(const template of [vesna,read('beta-data/skirk-fixture.json').input]){
  const x=clone(template);x.buffs=[];const before=attr(x);
  x.buffs=[{name:'VodyanitsaSignature',config:{VodyanitsaSignature:{hp:50000,constellation:0,e_level:10,on_field:true,ordinary_mode:true,refine:5,stacks:3,boosted:true}}}];
  const after=attr(x);const baseAtk=before.atk['角色基础攻击']+before.atk['武器基础攻击'];close(sum(after.atk)-sum(before.atk),baseAtk*.42);
 }
});
test('精炼/等级/生命/覆盖率越界时拒绝计算',()=>{
 for(const [key,value] of [['loyal_rate',-1],['rebel_rate',101],['plenty_rate',NaN]]){const x=clone(vesna);x.weapon.params.BeyondTheChrysalis[key]=value;assert.throws(()=>attr(x));}
 for(const [key,value] of [['refine',0],['refine',6],['refine',1.5],['level',0],['level',91]]){const x=clone(vesna);x.weapon[key]=value;assert.throws(()=>attr(x));}
 for(const hp of [-1,500001]){const x=clone(vody);x.weapon.params.HymnOfTheMaelstrom.hp=hp;assert.throws(()=>attr(x));}
});
test('蝶变覆盖率进入配装目标、十词条收益和曲线，均与伤害面板一致',()=>{
 const x=clone(vesna);x.artifacts=read('beta-data/mizuki-fixture.json').input.artifacts;Object.assign(x.weapon.params.BeyondTheChrysalis,{loyal_rate:35,rebel_rate:65,plenty_rate:40});
 const target={name:'VesnaDefault',params:'NoConfig'};
 const optimized=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);assert.ok(optimized.length);close(optimized[0].value,damage(x).direct_stellarswirl.expectation);
 const bonus=api.BonusPerStat.bonus_per_stat({...x,tf:target,artifacts_config:x.artifact_config});assert.equal(bonus.atk_percentage.length,10);assert.ok(bonus.atk_percentage.every(Number.isFinite));
 const options={stats:['ATKPercentage','CriticalDamage','CriticalRate'],maxRolls:3,tier:'average'};
 const ev=createDamageEvaluator(api,x,'direct_stellarswirl',null,options.stats,options.tier),curve=computeCurve(ev.evaluate,options);close(curve.baseline,damage(x).direct_stellarswirl.expectation);assert.equal(curve.points.length,4);
});
test('无新武器的旧角色仍返回原发布内核完全相同的结果',()=>{
 const x=read('beta-data/skirk-fixture.json').input;assert.deepEqual(attr(x),original.CommonInterface.get_attribute(x));assert.deepEqual(damage(x),original.CalculatorInterface.get_damage_analysis(x,null));
});
const report={passed:tests.filter(t=>t.pass).length,total:tests.length,tests};
fs.writeFileSync(new URL('../beta-data/beta3-tests.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total} passed`);if(report.passed!==report.total)process.exitCode=1;

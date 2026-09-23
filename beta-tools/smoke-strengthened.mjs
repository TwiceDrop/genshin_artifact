// Focused audit of strengthened Yumemizuki Mizuki against the published 7.0 data.
// Run against the real published WASM, not a restatement of the facade summaries.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {bindings} from '../mona_wasm/pkg/bindings.js';
import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js';
import * as extension from '../mona_wasm/extension/mona_extension.js';
import {createFacade} from '../beta-data/facade.mjs';
import {createBeta2} from '../beta-data/vesna-facade.mjs';
import {createLimitedWeaponFacade} from '../beta-data/limited-weapon-facade.mjs';
import {createStrengthenedFacade,MIZUKI_STELLAR_TARGET} from '../beta-data/strengthened-facade.mjs';
import {computeCurve,createDamageEvaluator} from '../src/algorithms/stat-gain/curve.mjs';
globalThis.module={require:createRequire(import.meta.url)};
const file=p=>new URL('../'+p,import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(file(p),'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''));
bindings.lI(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(file('mona_wasm/pkg/mona_wasm_bg.wasm'))),{'./mona_wasm_bg.js':bridge}).exports);
const original={CommonInterface:bindings.Ps,CalculatorInterface:bindings.K2,OptimizeSingleWasm:bindings.E2,BonusPerStat:bindings.bd,TeamOptimizationWasm:bindings.B8,CalcArtifactBestSet:bindings.uC};
extension.initSync(fs.readFileSync(file('mona_wasm/extension/mona_extension_bg.wasm')));
const support=read('beta-data/extension-support.json');
const previous=createBeta2(createFacade(original,extension,read('beta-data/vodyanitsa.json'),support,read('src/assets/_gen_character.js')),extension,support);
const limited=createLimitedWeaponFacade(previous,original,read('beta-data/weapons-limited-71.json'));
const api=createStrengthenedFacade(limited);
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0),clone=structuredClone;
const close=(actual,expected,label='')=>assert.ok(Number.isFinite(actual)&&Number.isFinite(expected)&&Math.abs(actual-expected)<Math.max(1e-7,Math.abs(expected)*1e-10),label+' '+actual+' != '+expected);
const attr=(x,core=api)=>core.CommonInterface.get_attribute(x);
const damage=(x,fumo=null,core=api)=>core.CalculatorInterface.get_damage_analysis(x,fumo);
const named=(name,config)=>({name,config:config?{[name]:config}:'NoConfig'});
const coefficients=[.018,.021,.024,.027,.03,.033,.036,.039,.042,.045,.048,.051,.054,.057,.06];
const fixture=(constellation=0,enhanced_state=true,em=615)=>({
 character:{name:'YumemizukiMizuki',level:90,ascend:false,constellation,skill1:9,skill2:9,skill3:9,params:{YumemizukiMizuki:{talent2_rate:0,enhanced_state,c1_reaction_active:true}}},
 weapon:{name:'TheWidsith',level:90,ascend:false,refine:1,params:{TheWidsith:{t1_rate:0,t2_rate:0,t3_rate:0}}},
 skill:{index:14,config:'NoConfig'},artifacts:[],artifact_config:null,enemy:null,buffs:[named('ElementalMastery',{value:em-115})],
});
function receiver(){
 const x=fixture();x.character={name:'Kaeya',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:'NoConfig'};
 x.weapon={name:'DullBlade',level:90,ascend:false,refine:1,params:'NoConfig'};x.skill.index=0;x.buffs=[];return x;
}
const tests=[],observations=[];
function test(name,fn){try{fn();tests.push({name,pass:true});console.log('PASS',name);}catch(error){tests.push({name,pass:false,error:String(error),stack:error.stack});console.error('FAIL',name,String(error));}}
test('瑞希技能目录包含14/15直星扩散与16强化持续攻击',()=>{
 const m=read('src/assets/_gen_character.js').YumemizukiMizuki;
 for(const index of [14,15,16])assert.ok(m.skillMap2.some(s=>s.index===index));
 assert.ok(m.config.some(c=>c.name==='enhanced_state'));assert.ok(m.config.some(c=>c.name==='c1_reaction_active'));
});
test('E自身星扩散增伤：技能1～15档每100EM的完整系数',()=>{
 for(let level=1;level<=15;level++)for(const enhanced of [false,true]){
  const x=fixture(0,enhanced);x.character.skill2=level-1;const em=sum(attr(x).elemental_mastery),d=damage(x);
  close(d.direct_stellarswirl_compose['梦见月瑞希E技能：星扩散增伤'],em/100*coefficients[level-1]);
 }
});
test('E队友BUFF：技能1～15档、0/500/1000精通，星扩散增伤正确',()=>{
 for(let level=1;level<=15;level++)for(const em of [0,500,1000]){
  const x=receiver();x.buffs=[named('YumemizukiMizukiE',{em,skill_level:level})];
  close(sum(damage(x,'Anemo').direct_stellarswirl_compose),em/100*coefficients[level-1]);
 }
});
test('idx16普通强化持续攻击：原E倍率不变并额外加1000%EM',()=>{
 for(const co of [0,1,2,6])for(const enhanced of [false,true]){
  const x=fixture(co,enhanced),em=sum(attr(x).elemental_mastery);x.skill.index=8;const base=damage(x);
  x.skill.index=16;const boosted=damage(x),res=co>=2&&enhanced?1.05:.9;
  close(sum(boosted.atk_ratio),sum(base.atk_ratio));close(sum(boosted.em_ratio),10);
  close(boosted.normal.non_critical-base.normal.non_critical,em*10*.5*res);
 }
});
test('idx14星扩散额外伤害：1000%EM、精通/E增伤、抗性与双暴完整乘区',()=>{
 for(const co of [0,1,2,6])for(const emSource of [115,500,750,1000,1500]){
  const x=fixture(co,true,emSource),a=attr(x),em=sum(a.elemental_mastery),d=damage(x);
  const bonus=1+6*em/(2000+em)+em/100*.045,res=co>=2?1.05:.9;
  const nonCritical=10*em*bonus*res,cr=Math.min(1,sum(a.critical)+(co===6?.1:0)),cd=sum(a.critical_damage)+(co===6?.2:0);
  close(sum(d.direct_stellarswirl_ratio),10);
  close(d.direct_stellarswirl.non_critical,nonCritical);
  close(d.direct_stellarswirl.critical,nonCritical*(1+cd));
  close(d.direct_stellarswirl.expectation,nonCritical*(1+cr*cd));
 }
});
test('C1独立直伤：idx15为400%EM，与idx14比例0.4，C0无该直伤',()=>{
 const zero=fixture(0);zero.skill.index=15;assert.ok(!damage(zero).direct_stellarswirl||damage(zero).direct_stellarswirl.expectation===0);
 for(const co of [1,2,6]){
  const x=fixture(co);x.skill.index=14;const ten=damage(x);x.skill.index=15;const four=damage(x);
  close(sum(four.direct_stellarswirl_ratio),4);
  for(const key of ['non_critical','critical','expectation'])close(four.direct_stellarswirl[key],ten.direct_stellarswirl[key]*.4);
 }
});
test('C1反应固定加值：550%总EM、开关关闭清除，独立直伤不重复叠加',()=>{
 for(const enhanced of [false,true]){
  const x=fixture(1,enhanced),em=sum(attr(x).elemental_mastery);x.skill.index=14;const active=damage(x);
  close(sum(active.stellarswirl_reaction_extra_fixed),5.5*em);
  x.character.params.YumemizukiMizuki.c1_reaction_active=false;const inactive=damage(x);
  close(sum(inactive.stellarswirl_reaction_extra_fixed),0);
  close(active.direct_stellarswirl.non_critical,inactive.direct_stellarswirl.non_critical);
  for(const key of ['stellarswirl_anemo','stellarswirl_cryo'])close(active[key].non_critical-inactive[key].non_critical,5.5*em*.9);
 }
});
test('C1队友BUFF只添加550%源EM反应固定值',()=>{
 const x=receiver(),before=damage(x,'Anemo');x.buffs=[named('YumemizukiMizukiC1',{em:1000})];const after=damage(x,'Anemo');
 close(sum(after.stellarswirl_reaction_extra_fixed),5500);close(after.normal.expectation,before.normal.expectation);
});
test('C2自身开启强化状态后风抗降低20%，同时覆盖星扩散风与冰部分',()=>{
 const x=fixture(1,true);x.skill.index=8;const before=damage(x);x.character.constellation=2;const after=damage(x);
 close(sum(after.res_minus)-sum(before.res_minus),.2);
 for(const key of ['normal','stellarswirl_anemo','stellarswirl_cryo'])close(after[key].non_critical,before[key].non_critical*1.05/.9);
});
test('C2队友BUFF五种抗性降低20%，火水雷冰伤每EM0.04%，不影响草岩',()=>{
 for(const element of ['Pyro','Hydro','Electro','Cryo','Anemo','Geo','Dendro']){
  const x=receiver();x.buffs=[named('YumemizukiMizukiC2',{em:1000})];const d=damage(x,element);
  close(sum(d.res_minus),['Geo','Dendro'].includes(element)?0:.2,element+' resistance');
 }
 const x=receiver();x.buffs=[named('YumemizukiMizukiC2',{em:1000})];const a=attr(x);
 for(const name of ['pyro','hydro','electro','cryo'])close(sum(a['bonus_'+name]),.4);
 for(const name of ['anemo','geo','dendro'])close(sum(a['bonus_'+name]),0);
});
test('C6自身精通转换：500阈值、1000封顶，不将额外转换精通重复作为源',()=>{
 for(const em of [115,499,500,750,1000,1500]){
  const off=fixture(5,true,em),on=fixture(6,true,em),before=attr(off),after=attr(on);
  const excess=Math.max(0,em-500);
  close(sum(after.critical)-sum(before.critical),Math.min(.2,excess*.0004));
  close(sum(after.critical_damage)-sum(before.critical_damage),Math.min(.8,excess*.0016));
  close(sum(after.elemental_mastery),em*1.1);
 }
});
test('C6星伤专属10%暴击率和20%暴伤，与普通双暴分开',()=>{
 const x=fixture(6,true),d=damage(x);close(sum(d.critical_stellarswirl),.1);close(sum(d.critical_damage_stellarswirl),.2);
 const ally=receiver(),before=attr(ally);ally.buffs=[named('YumemizukiMizukiC6',null)];
 const after=attr(ally),result=damage(ally,'Anemo');close(sum(after.critical),sum(before.critical));close(sum(after.critical_damage),sum(before.critical_damage));
 close(sum(result.critical_stellarswirl),.1);close(sum(result.critical_damage_stellarswirl),.2);
});
test('廓然梦生10%精通转换与队友BUFF，不产生递归增幅',()=>{
 for(const em of [115,500,1000]){
  close(sum(attr(fixture(0,true,em)).elemental_mastery),em*1.1);
  const x=receiver();x.buffs=[named('YumemizukiMizukiEnhancedEM',{em})];close(sum(attr(x).elemental_mastery),em*.1);
 }
});
test('瑞希idx14/15星伤最优词条曲线与原发布WASM实际伤害相同',()=>{
 for(const index of [14,15]){
  const x=fixture(6,true,750);x.skill.index=index;
  const options={stats:['ElementalMastery','CriticalDamage','CriticalRate'],maxRolls:2,tier:'average'};
  const ev=createDamageEvaluator(api,x,'direct_stellarswirl',null,options.stats,options.tier),curve=computeCurve(ev.evaluate,options);
  close(curve.baseline,damage(x).direct_stellarswirl.expectation);assert.ok(curve.points[2].damage>curve.baseline);
  for(const point of curve.points)close(point.damage,ev.evaluate(point.allocation));
 }
});
test('兼容旧存档：原瑞希纯精通配装目标继续最大化精通',()=>{
 const samples=[];
 for(const co of [0,6])for(const enhanced of [false,true]){
  const x=fixture(co,enhanced);x.artifacts=read('beta-data/mizuki-fixture.json').input.artifacts.map(a=>({...a,set_name:'GladiatorsFinale'}));
  const r=original.OptimizeSingleWasm.optimize({...x,target_function:{name:'YumemizukiMizukiDefault',params:'NoConfig'},algorithm:'Naive',constraint:null,filter:null},x.artifacts);
  assert.ok(r.length);close(r[0].value,sum(attr(x,original).elemental_mastery));
  samples.push({constellation:co,enhanced,target:r[0].value,em:sum(attr(x,original).elemental_mastery),starDamage:damage(x,null,original).direct_stellarswirl.expectation});
 }
 observations.push({id:'mizuki-default-target',status:'info',finding:'The legacy Elemental Mastery target remains available for existing saves; the new Stellar Swirl target is tested separately below.',samples});
});

const modes=[{index:14,reaction:'direct_stellarswirl'},{index:15,reaction:'direct_stellarswirl'},{index:14,reaction:'stellarswirl_anemo'},{index:14,reaction:'stellarswirl_cryo'}];
const stellarTarget=mode=>({name:MIZUKI_STELLAR_TARGET,params:{[MIZUKI_STELLAR_TARGET]:{mode}}});
const legacyTarget={name:'YumemizukiMizukiDefault',params:'NoConfig'};
const equipment=()=>read('beta-data/mizuki-fixture.json').input.artifacts.map(a=>({...a,set_name:'GladiatorsFinale'}));
function targetDamage(input,mode){const x=clone(input);x.skill={index:modes[mode].index,config:'NoConfig'};return damage(x)[modes[mode].reaction].expectation;}
function optimize(input,target,algorithm='Naive',artifacts=input.artifacts){
 return api.OptimizeSingleWasm.optimize({...input,target_function:target,algorithm,constraint:null,filter:null},artifacts);
}
function freezeDeep(value){if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freezeDeep(v);}return value;}
test('新星扩散目标位于瑞希目录首位，四模式和旧精通目标同时存在',()=>{
 const all=read('src/assets/_gen_tf.js'),names=Object.values(all).filter(v=>v.for==='YumemizukiMizuki').map(v=>v.name);
 assert.equal(names[0],MIZUKI_STELLAR_TARGET);assert.ok(names.includes(legacyTarget.name));
 const config=all[MIZUKI_STELLAR_TARGET].config.find(v=>v.name==='mode');assert.equal(config.default,0);assert.equal(config.options.length,4);
});
test('四模式 AStar/Naive 配装值等于对应实际伤害，保留强化状态及C1开关',()=>{
 for(const mode of [0,1,2,3])for(const co of [1,6])for(const enhanced of [false,true])for(const c1active of [false,true]){
  const x=fixture(co,enhanced,750);x.artifacts=equipment();x.character.params.YumemizukiMizuki.c1_reaction_active=c1active;
  // A different selected panel skill must not overwrite the target mode.
  x.skill.index=0;const expected=targetDamage(x,mode);
  for(const algorithm of ['Naive','AStar']){const results=optimize(x,stellarTarget(mode),algorithm);assert.ok(results.length);close(results[0].value,expected,'mode '+mode+' '+algorithm);}
 }
});
test('四模式十词条收益：精通、暴击率、暴伤逐档与实际加词条伤害一致',()=>{
 for(const mode of [0,1,2,3])for(const co of [1,6]){
  const x=fixture(co,true,750);x.artifacts=equipment();const baseline=targetDamage(x,mode);
  const result=api.BonusPerStat.bonus_per_stat({...x,tf:stellarTarget(mode),artifacts_config:x.artifact_config});
  for(const [key,stat,roll]of [['elemental_mastery','ElementalMastery',23],['critical_rate','CriticalRate',.039],['critical_damage','CriticalDamage',.078]]){
   assert.equal(result[key].length,10,key);
   for(let n=1;n<=10;n++){const y=clone(x);y.artifacts[0].sub_stats.push([stat,roll*n]);close(result[key][n-1],targetDamage(y,mode)/baseline-1,'mode '+mode+' '+key+' '+n);}
  }
 }
});
test('变化候选以实际星伤选择精通或双暴，旧精通目标仍选精通',()=>{
 const cases=[{em:115,co:0,crit:0,expected:'em'},{em:1500,co:0,crit:0,expected:'cr'},{em:1500,co:6,crit:60,expected:'cd'}];
 const samples=[];
 for(const c of cases){
  const x=fixture(c.co,true,c.em);x.artifacts=equipment().map(a=>({...a,sub_stats:[]}));if(c.crit)x.buffs.push(named('Critical',{p:c.crit}));
  const alternatives=[['em','ElementalMastery',46],['cr','CriticalRate',.078],['cd','CriticalDamage',.156]].map(([name,key,value],i)=>({name,artifact:{...x.artifacts[4],id:51+i,sub_stats:[[key,value]]}}));
  const candidates=[...x.artifacts.slice(0,4),...alternatives.map(a=>a.artifact)];
  const values=alternatives.map(a=>({name:a.name,id:a.artifact.id,value:targetDamage({...x,artifacts:[...x.artifacts.slice(0,4),a.artifact]},0)})).sort((a,b)=>b.value-a.value);
  assert.equal(values[0].name,c.expected,'independent damage oracle should exercise '+c.expected);
  for(const algorithm of ['AStar','Naive']){const result=optimize(x,stellarTarget(0),algorithm,candidates);assert.ok(result.length);close(result[0].value,values[0].value);assert.equal(result[0].head,values[0].id);}
  const legacy=optimize(x,legacyTarget,'Naive',candidates);assert.equal(legacy[0].head,51);
  samples.push({baseEM:c.em,constellation:c.co,critBuff:c.crit,best:values[0].name,values});
 }
 observations.push({id:'mizuki-stellar-target-candidate-selection',status:'info',samples});
});
test('四模式最优词条曲线每个点与新配装目标一致',()=>{
 for(const mode of [0,1,2,3]){
  const x=fixture(6,true,750);x.artifacts=equipment();x.skill.index=modes[mode].index;
  const options={stats:['ElementalMastery','CriticalRate','CriticalDamage'],maxRolls:3,tier:'max'};
  const ev=createDamageEvaluator(api,x,modes[mode].reaction,null,options.stats,options.tier),curve=computeCurve(ev.evaluate,options);
  close(curve.baseline,targetDamage(x,mode));assert.ok(curve.points[3].damage>curve.baseline);
  const rolls={ElementalMastery:23,CriticalRate:.039,CriticalDamage:.078};
  for(const point of curve.points){const y=clone(x);for(const [key,count]of Object.entries(point.allocation))if(count)y.artifacts[0].sub_stats.push([key,count*rolls[key]]);close(optimize(y,stellarTarget(mode))[0].value,point.damage);}
 }
});
test('新目标不改写角色、目标或圣遗物存档，冻结输入也可计算',()=>{
 const x=fixture(6,true,750);x.artifacts=equipment();const target=stellarTarget(2),saved=clone({x,target});freezeDeep(x);freezeDeep(target);
 assert.ok(optimize(x,target).length);api.BonusPerStat.bonus_per_stat({...x,tf:target,artifacts_config:x.artifact_config});damage(x);
 assert.deepEqual({x,target},saved);
});
test('非法目标模式、错误角色、C0一命模式及静态评分都明确拒绝',()=>{
 const x=fixture(0,true);x.artifacts=equipment();
 for(const mode of [-1,4,1.5,NaN,Infinity,'0']){
  assert.throws(()=>optimize(x,stellarTarget(mode)),/类型无效/);
  assert.throws(()=>api.BonusPerStat.bonus_per_stat({...x,tf:stellarTarget(mode),artifacts_config:x.artifact_config}),/类型无效/);
 }
 assert.throws(()=>optimize(x,stellarTarget(1)),/解锁瑞希一命/);
 const wrong=receiver();wrong.artifacts=equipment();assert.throws(()=>optimize(wrong,stellarTarget(0)),/仅适用于/);
 assert.throws(()=>api.CommonInterface.get_artifacts_rank_by_character(x.character,x.weapon,stellarTarget(0),x.artifacts),/静态评分/);
 // Invalid input must not poison the published WASM for later valid calculations.
 const expected=targetDamage(x,0);close(optimize(x,stellarTarget(0))[0].value,expected);
});
test('省略新目标配置默认廓然直接星扩散，旧角色旧目标结果保持一致',()=>{
 const x=fixture();x.artifacts=equipment();close(optimize(x,{name:MIZUKI_STELLAR_TARGET,params:'NoConfig'})[0].value,targetDamage(x,0));
 const y=receiver();y.artifacts=equipment();const target={name:'MaxATK',params:'NoConfig'};
 const input={...y,target_function:target,algorithm:'Naive',constraint:null,filter:null};
 assert.deepEqual(api.OptimizeSingleWasm.optimize(input,y.artifacts),original.OptimizeSingleWasm.optimize(input,y.artifacts));
 assert.deepEqual(attr(y),attr(y,original));assert.deepEqual(damage(y),damage(y,null,original));
});


test('保留新目标名称时用户自定义DSL优先，配装和收益按自定义常量123',()=>{
 const x=fixture(0,true,750);x.artifacts=equipment();
 // An old C1 selection remains in UI state when switching to a custom expression.
 const target={...stellarTarget(1),use_dsl:true,dsl_source:'result = 123'},before=clone(target);
 for(const algorithm of ['AStar','Naive'])close(optimize(x,target,algorithm)[0].value,123);
 const result=api.BonusPerStat.bonus_per_stat({...x,tf:target,artifacts_config:x.artifact_config});
 for(const key of ['elemental_mastery','critical_rate','critical_damage'])for(const gain of result[key])close(gain,0);
 assert.deepEqual(target,before);
});
test('理论套装排行明确拒绝新星扩散目标，避免旧内核忽略DSL',()=>{
 const x=fixture(1,true);x.artifacts=equipment();
 for(const mode of [0,1,2,3])for(const key of ['target_function','tf'])
  assert.throws(()=>api.CalcArtifactBestSet.calc_artifact_best_set({...x,[key]:stellarTarget(mode)}),/暂不支持理论套装排行/);
 // Rejection occurs outside WASM and leaves valid inventory optimization usable.
 close(optimize(x,stellarTarget(0))[0].value,targetDamage(x,0));
});
test('单人与团队新星伤目标选择暴伤头，旧精通目标选择精通头',()=>{
 const x=read('beta-data/mizuki-fixture.json').input;x.character.params.YumemizukiMizuki.enhanced_state=true;
 x.artifacts=x.artifacts.map(a=>({...a,set_name:'GladiatorsFinale'}));
 const head=x.artifacts.find(a=>a.slot==='Head'),emHead={...head,id:5,sub_stats:[['ElementalMastery',20]]},cdHead={...head,id:6,sub_stats:[['CriticalDamage',.5]]};
 const fixed=x.artifacts.filter(a=>a.slot!=='Head'),candidates=[...fixed,emHead,cdHead];
 const emInput={...x,artifacts:[...fixed,emHead]},cdInput={...x,artifacts:[...fixed,cdHead]};
 assert.ok(targetDamage(cdInput,0)>targetDamage(emInput,0));assert.ok(sum(attr(emInput).elemental_mastery)>sum(attr(cdInput).elemental_mastery));
 const before=clone({x,candidates}),samples=[];
 for(const [target,expectedHead,expectedValue]of [[stellarTarget(0),6,targetDamage(cdInput,0)],[legacyTarget,5,sum(attr(emInput).elemental_mastery)]]){
  for(const algorithm of ['AStar','Naive']){const r=optimize(x,target,algorithm,candidates);assert.equal(r[0].head,expectedHead);close(r[0].value,expectedValue);}
  const teamInput={single_interfaces:[{...x,target_function:target,algorithm:'Naive',constraint:null,filter:null}],weights:[1],hyper_param:{mva_step:1,work_space:16,max_re_optimize:1,max_search:50,count:1}};
  const teamBefore=clone(teamInput),team=api.TeamOptimizationWasm.optimize_team2(teamInput,candidates);
  assert.equal(team.artifacts[0][0].head,expectedHead);assert.deepEqual(teamInput,teamBefore);
  samples.push({target:target.name,head:expectedHead,value:expectedValue,teamHead:team.artifacts[0][0].head});
 }
 assert.deepEqual({x,candidates},before);
 observations.push({id:'mizuki-stellar-team-optimization',status:'info',samples});
});

for(const index of [14,15]){
 const x=fixture(1,false);x.skill.index=index;
 observations.push({id:'explicit-stellar-skill-'+index,status:'review',finding:'Explicitly selecting a stellar-only skill still evaluates its damage with enhanced_state=false. This may be intentional standalone-skill evaluation, so it is not classified as a formula failure.',damage:damage(x).direct_stellarswirl});
}
const report={checkedAt:new Date().toISOString(),scope:'Published WASM formula audit and the full composed API for the new Yumemizuki Mizuki Stellar Swirl optimization target; no product code is patched by this script.',source:{url:'https://gi.gachabase.net/characters/10000109/yumemizuki-mizuki/release?lang=chs',version:'7.0.0',designRevision:47194594},passed:tests.filter(t=>t.pass).length,total:tests.length,tests,observations};
fs.writeFileSync(file('beta-data/strengthened-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log(report.passed+'/'+report.total+' passed; '+observations.filter(o=>o.status==='gap').length+' functional gap(s) recorded');
if(report.passed!==report.total)process.exitCode=1;

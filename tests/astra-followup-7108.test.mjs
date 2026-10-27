import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import webpack from 'webpack';
import {api,vesna,named,sum} from '../beta-tools/runtime-7106.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {EXTENSION_BUFF_REGISTRY} from '../beta-data/extension-buffs.mjs';
import {probeCompiledOptimizer} from '../beta-tools/compiled-worker-probe.mjs';
const near=(a,b,label='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
const damage=(x,index=x.skill.index,fumo=null)=>api.CalculatorInterface.get_damage_analysis({...x,skill:{...x.skill,index}},fumo);
const input=name=>{const x=fixture(name);delete x.target_function;delete x.constraint;delete x.algorithm;return x;};
const c2=(p={})=>named('VodyanitsaC2',{hp:50000,constellation:2,on_field:true,ordinary_mode:true,e_level:10,...p});
const reference=named('ExtensionEffect',{label:'C2 elemental reference',values:{CriticalDamageHydro:.5,CriticalDamageCryo:.5}});
function vesnaInput(gear=false){const x=structuredClone(vesna);x.character.params.Vesna.stance=false;x.weapon={name:'DullBlade',level:90,ascend:false,refine:1,params:'NoConfig'};x.skill={index:0,config:'NoConfig'};if(gear)x.artifacts=input('Vesna').artifacts;return x;}
const rawGeneric=[named('EnhanceStellarGlimmerReaction',{p:40}),named('ElevateStellarGlimmerReaction',{p:25})];
const compiled=(buffs,x)=>buffs.flatMap(b=>EXTENSION_BUFF_REGISTRY.compile(b,x));
const tf=(name,source)=>({name:name+'Default',params:'NoConfig',use_dsl:true,dsl_source:source});
const dsl=(source,x)=>{const r=api.DSLInterface.run(source,x,x.artifacts);assert.equal(r.is_error,false,r.error_msg);return Number(r.output.trim().replace(/^MONA: /,''));};
const opt=(x,t,pool=x.artifacts)=>api.OptimizeSingleWasm.optimize({...x,target_function:t,algorithm:'Naive',constraint:null,filter:null},pool);
const twoHeads=x=>{const head=structuredClone(x.artifacts.find(a=>a.slot==='Head'));head.id=6;head.sub_stats.push(['CriticalDamage',.4]);return [...x.artifacts,head];};
const fitted=(x,pool,id)=>({...structuredClone(x),artifacts:pool.filter(a=>a.slot!=='Head'||a.id===id)});
const vesnaSource='dmg burst = Vesna.Burst\ndmg plain = Vesna.Normal1({fumo: "Cryo"})\nresult = burst.direct_stellarswirl.e + plain.normal.e\nprint(result)';
const vesnaValue=x=>damage(x,17).direct_stellarswirl.expectation+damage(x,0,'Cryo').normal.expectation;
const conductSource='dmg hit = Sandrone.ChargedRayStellar\nresult = hit.direct_stellarconduct.e\nprint(result)';
const conductValue=x=>damage(x).direct_stellarconduct.expectation;
function sandrone(){const x=input('Sandrone');x.skill.index=5;return x;}

test('1 薇斯纳普通 C2：水冰暴伤、命座前后台停用条件和星伤作用域',()=>{
 const x=vesnaInput(),enabled={...x,buffs:[c2()]},rows=[];
 for(const element of ['Hydro','Cryo']){
  const baseline=damage(x,0,element).normal,actual=damage(enabled,0,element).normal;
  const expected=damage({...x,buffs:[reference]},0,element).normal;
  near(actual.non_critical,baseline.non_critical);near(actual.critical,baseline.critical+.5*baseline.non_critical);
  for(const field of ['non_critical','critical','expectation'])near(actual[field],expected[field],element+' '+field);
  rows.push({element,before:baseline.critical,after:actual.critical});
 }
 near(damage(enabled,0,'Cryo').normal.critical,410.850594,'reported reproduction');
 for(const element of [null,'Pyro'])near(damage(enabled,0,element).normal.expectation,damage(x,0,element).normal.expectation,'unrelated damage');
 near(damage(enabled,17).direct_stellarswirl.expectation,damage(x,17).direct_stellarswirl.expectation,'ordinary C2 does not affect star');
 for(const p of [{constellation:1},{on_field:false},{active:false}])near(damage({...x,buffs:[c2(p)]},0,'Cryo').normal.expectation,damage(x,0,'Cryo').normal.expectation,'disabled C2');
 near(damage({...x,buffs:[{...c2(),lock:true}]},0,'Cryo').normal.expectation,damage(x,0,'Cryo').normal.expectation,'locked C2');
 near(damage({...x,buffs:[c2({constellation:6,on_field:false})]},0,'Cryo').normal.critical,damage(enabled,0,'Cryo').normal.critical,'C6 off field');
 console.log({check:'Vesna ordinary C2',rows});
});

test('2 薇斯纳混合 DSL、两套候选及暴伤收益与独立元素属性对照一致',()=>{
 const x=vesnaInput(true),actual={...x,buffs:[c2()]},expected={...x,buffs:[reference]};
 const source='dmg hit = Vesna.Normal1({fumo: "Cryo"})\nresult = hit.normal.e\nprint(result)';
 near(dsl(source,actual),damage(actual,0,'Cryo').normal.expectation,'normal fumo');
 near(dsl(vesnaSource,actual),vesnaValue(expected),'mixed DSL');
 const t=tf('Vesna',vesnaSource),pool=twoHeads(x),values=new Map([5,6].map(id=>[id,vesnaValue(fitted(expected,pool,id))]));
 const results=opt(actual,t,pool);assert.equal(results.length,2);
 for(const r of results)near(r.value,values.get(r.head),'Vesna candidate');
 const gain=api.BonusPerStat.bonus_per_stat({...actual,tf:t,artifacts_config:null}).critical_damage[0];
 const refGain=api.BonusPerStat.bonus_per_stat({...expected,tf:t,artifacts_config:null}).critical_damage[0];
 near(gain,refGain,'independent elemental gain');
 near(gain,vesnaValue({...expected,buffs:[reference,named('CriticalDamage',{p:7.8})]})/vesnaValue(expected)-1,'direct damage gain');
 console.log({check:'Vesna mixed DSL',values:[...values],criticalDamageGain:gain});
});

test('3 旧原生星超导通用 BUFF 编译前后等价，专属槽保持专属，星扩散不重复',()=>{
 const rows=[];
 for(const name of ['Sandrone','Odette']){
  const x=input(name);x.skill.index=name==='Sandrone'?5:12;if(name==='Odette')x.character.params.Odette.radiance_mode=2;
  const baseline=damage(x),raw=damage({...x,buffs:rawGeneric}),a=damage({...x,buffs:compiled(rawGeneric,x)});
  for(const field of ['non_critical','critical','expectation'])near(a.direct_stellarconduct[field],raw.direct_stellarconduct[field],name+' '+field);
  const factor=(1+sum(baseline.direct_stellarconduct_compose)+.4)/(1+sum(baseline.direct_stellarconduct_compose))*(1+sum(baseline.elevate_stellarconduct_compose)+sum(baseline.elevate_stellar_glimmer_reaction_compose)+.25)/(1+sum(baseline.elevate_stellarconduct_compose)+sum(baseline.elevate_stellar_glimmer_reaction_compose));
  near(a.direct_stellarconduct.expectation,baseline.direct_stellarconduct.expectation*factor,'generic formula');
  for(const b of rawGeneric)near(damage({...x,buffs:compiled([b],x)}).direct_stellarconduct.expectation,damage({...x,buffs:[b]}).direct_stellarconduct.expectation,b.name);
  const scoped=named('ExtensionEffect',{label:'Swirl only',values:{StellarSwirlBonus:.4,StellarSwirlElevation:.25}});
  near(damage({...x,buffs:[scoped]}).direct_stellarconduct.expectation,baseline.direct_stellarconduct.expectation,'true swirl-only scope');
  if(name==='Sandrone')near(a.direct_stellarconduct.expectation,7700.515374282121,'reported reproduction');
  if(name==='Odette'){
   const starRaw=damage({...x,buffs:rawGeneric},13),starCompiled=damage({...x,buffs:compiled(rawGeneric,x)},13);
   for(const field of ['non_critical','critical','expectation'])near(starCompiled.direct_stellarswirl[field],starRaw.direct_stellarswirl[field],'no double stellar swirl');
  }
  rows.push({name,before:baseline.direct_stellarconduct.expectation,raw:raw.direct_stellarconduct.expectation,compiled:a.direct_stellarconduct.expectation});
 }
 console.log({check:'legacy generic source scope',rows});
});

test('4 编译后的通用 BUFF：原生/DSL 候选与攻击、暴伤收益等价',()=>{
 const x=sandrone(),raw={...x,buffs:rawGeneric},a={...x,buffs:compiled(rawGeneric,x)},pool=twoHeads(x);
 const sourceTF=tf('Sandrone',conductSource),nativeTF={name:'SandroneDefault',params:'NoConfig',use_dsl:false,dsl_source:''};
 near(dsl(conductSource,a),conductValue(raw),'compiled DSL');
 const expected=new Map([5,6].map(id=>[id,conductValue(fitted(raw,pool,id))]));
 for(const t of [nativeTF,sourceTF]){
  const results=opt(a,t,pool);assert.equal(results.length,2);for(const r of results)near(r.value,expected.get(r.head),'compiled candidate');
  const gains=api.BonusPerStat.bonus_per_stat({...a,tf:t,artifacts_config:null}),rawGains=api.BonusPerStat.bonus_per_stat({...raw,tf:t,artifacts_config:null});
  for(const [key,name,p]of [['atk_percentage','ATKPercentage',5.8],['critical_damage','CriticalDamage',7.8]]){
   near(gains[key][0],rawGains[key][0],key+' raw vs compiled');
   near(gains[key][0],conductValue({...raw,buffs:[...rawGeneric,named(name,{p})]})/conductValue(raw)-1,key+' independent gain');
  }
 }
 console.log({check:'compiled conduct DSL/native objectives',values:[...expected]});
});

test('5 当前源码真实 Worker：薇斯纳普通 C2 与旧原生编译通用 BUFF',async()=>{
 const dist=path.resolve('.build-target/astra-followup-20261004/worker-probe');
 await new Promise((resolve,reject)=>{const compiler=webpack({mode:'none',target:'webworker',entry:path.resolve('src/workers/optimize_artifact.js'),output:{path:dist,filename:'js/optimizer.js',chunkFilename:'js/[id].js',assetModuleFilename:'assets/[name][ext]',publicPath:'http://worker.local/'},resolve:{alias:{mona:path.resolve('mona_wasm/pkg')}},module:{rules:[{resourceQuery:/raw-wasm/,type:'asset/resource'}]},experiments:{topLevelAwait:true,asyncWebAssembly:true},optimization:{minimize:false}});compiler.run((error,stats)=>compiler.close(closeError=>error||closeError?reject(error||closeError):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));});
 const v=vesnaInput(true),s=sandrone(),cases=[
  [{...v,buffs:[c2()]},tf('Vesna',vesnaSource),{...v,buffs:[reference]},vesnaValue],
  [{...s,buffs:compiled(rawGeneric,s)},{name:'SandroneDefault',params:'NoConfig',use_dsl:false,dsl_source:''},{...s,buffs:rawGeneric},conductValue]
 ];
 const rows=[];
 for(const [actual,t,reference,value]of cases){const pool=twoHeads(actual),expected=new Map([5,6].map(id=>[id,value(fitted(reference,pool,id))]));const message=await probeCompiledOptimizer(dist,{...actual,target_function:t,algorithm:'Naive',constraint:null,filter:null},pool);assert.equal(message.type,'results',JSON.stringify(message));assert.equal(message.data.results.length,2);for(const r of message.data.results)near(r.value,expected.get(r.head),'Worker candidate');rows.push({name:actual.character.name,results:message.data.results.map(r=>({head:r.head,value:r.value}))});}
 console.log({check:'real compiled optimizer Worker',rows});
});
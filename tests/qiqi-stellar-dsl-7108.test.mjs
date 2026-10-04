import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import webpack from 'webpack';
import {api,named} from '../beta-tools/runtime-7106.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {probeCompiledOptimizer} from '../beta-tools/compiled-worker-probe.mjs';

const skills={
 Odette:[[13,'CodaStellarSwirl'],[16,'PlumeStellarSwirl'],[19,'WingStellarSwirl'],[23,'C1StellarSwirl'],[25,'C4StellarSwirl']],
 AetherCryo:[[14,'StellarSwirlBurst'],[15,'ChargedIceCondensation1'],[16,'ChargedIceCondensation2']],
};
const primary={Odette:skills.Odette[0],AetherCryo:skills.AetherCryo[1]};
const close=(a,b,label)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),label+': '+a+' != '+b);
function input(name) {
 const x=fixture(name);delete x.target_function;delete x.algorithm;delete x.constraint;
 x.character.constellation=4;x.character.params[name].radiance_mode=2;
 x.skill.index=primary[name][0];
 x.buffs=[named('QiqiC6StellarConduct',{atk:2000}),named('EnhanceStellarGlimmerReaction',{p:30}),named('ElevateStellarGlimmerReaction',{p:25}),named('Critical',{p:37}),named('CriticalDamage',{p:80})];
 x.enemy={level:95,resistance:{pyro:.1,hydro:.1,anemo:.25,electro:.1,dendro:.1,cryo:.4,geo:.1,physical:.1}};
 return x;
}
const damage=(x,index=x.skill.index)=>api.CalculatorInterface.get_damage_analysis({...x,skill:{...x.skill,index}},null);
const source=(name,skill=primary[name][1])=>`dmg hit = ${name}.${skill}\nresult = hit.direct_stellarswirl.e`;
const target=(x,dsl=source(x.character.name))=>({name:x.character.name+'Default',params:'NoConfig',use_dsl:true,dsl_source:dsl});
const optimize=(x,inventory=x.artifacts,dsl=source(x.character.name))=>api.OptimizeSingleWasm.optimize({...x,target_function:target(x,dsl),algorithm:'Naive',constraint:null,filter:null},inventory);
function candidates(x) {
 const fixed=x.artifacts.filter(a=>a.slot!=='Head');
 for(const a of fixed)if(['Sand','Goblet'].includes(a.slot))a.main_stat=['HPPercentage',.466];
 const head={...structuredClone(x.artifacts.find(a=>a.slot==='Head')),main_stat:['HPPercentage',.466]};
 const strong={...structuredClone(head),id:6,sub_stats:[...head.sub_stats,['ATKFixed',2500],['ElementalMastery',200],['CriticalRate',.4],['CriticalDamage',1.3]]};
 return {fixed,heads:[head,strong],all:[...fixed,head,strong]};
}

test('1 奥黛塔五段、冰旅行者三段 DSL 定额与单次一致，普通段不受影响',()=>{
 const rows=[];
 for(const [name,list]of Object.entries(skills)) {
  const x=input(name);
  for(const [index,skill]of list) {
   const dsl=`dmg hit = ${name}.${skill}\ndmg plain = ${name}.Normal1\nresult = hit.direct_stellarswirl.expectation + hit.direct_stellarswirl.critical * 0.1 + hit.direct_stellarswirl.non_critical * 0.01 + plain.normal.e\nprint(result)`;
   const env={...x,skill:{...x.skill,index:0}};
   const result=api.DSLInterface.run(dsl,env,x.artifacts);
   assert.equal(result.is_error,false,result.error_msg);
   const hit=damage(x,index).direct_stellarswirl;
   const expected=hit.expectation+hit.critical*.1+hit.non_critical*.01+damage(x,0).normal.expectation;
   const actual=Number(result.output.trim().replace(/^MONA: /,''));
   assert.ok(Math.abs(actual-expected)<.011,name+'.'+skill+' '+actual+' != '+expected);
   rows.push({name,skill,actual,expected});
  }
 }
 console.log(JSON.stringify({check:'direct DSL and ordinary scope',rows}));
});

test('2 实际配装逐候选重算，奥黛塔天赋随候选攻击变化并达到上限',()=>{
 const rows=[];
 for(const name of Object.keys(skills)) {
  const x=input(name),pool=candidates(x);x.artifacts=[...pool.fixed,pool.heads[0]];
  const expected=new Map(pool.heads.map(head=>[head.id,damage({...x,artifacts:[...pool.fixed,head]}).direct_stellarswirl.expectation]));
  const results=optimize(x,pool.all);assert.equal(results.length,2);
  for(const r of results)close(r.value,expected.get(r.head),name+' head '+r.head);
  close(results[0].value,Math.max(...expected.values()),name+' best');
  rows.push({name,results:results.map(r=>({head:r.head,value:r.value})),expected:[...expected]});
 }
 console.log(JSON.stringify({check:'candidate recomputation',rows}));
});

test('3 定额不随通用本体倍率缩放，词条收益与重新计算一致，停用七七不加定额',()=>{
 const rows=[];
 for(const name of Object.keys(skills)) {
  const x=input(name),bare={...structuredClone(x),buffs:x.buffs.filter(b=>b.name!=='QiqiC6StellarConduct')};
  const body=damage(bare).direct_stellarswirl.expectation,flat=damage(x).direct_stellarswirl.expectation-body;
  for(const p of [0,150]) {
   const scaled={...structuredClone(x),buffs:[...x.buffs,named('StellarSwirlDamageMultiplier',{p})]};
   const value=optimize(scaled)[0].value;
   close(value,body*p/100+flat,name+' multiplier '+p);
   rows.push({name,p,value,flat});
  }
  const gains=api.BonusPerStat.bonus_per_stat({...x,tf:target(x),artifacts_config:null});
  const improved={...structuredClone(x),buffs:[...x.buffs,named('ATKPercentage',{p:5.8})]};
  close(gains.atk_percentage[0],damage(improved).direct_stellarswirl.expectation/damage(x).direct_stellarswirl.expectation-1,name+' attack gain');
  const disabled={...structuredClone(x),buffs:x.buffs.map(b=>b.name==='QiqiC6StellarConduct'?{...b,lock:true}:b)};
  close(optimize(disabled)[0].value,body,name+' disabled');
 }
 console.log(JSON.stringify({check:'multiplier and stat gain',rows}));
});

test('4 本次源码编译的真实 Worker 返回两角色正确配装结果',async()=>{
 const dist=path.resolve('.build-target/qiqi-stellar-dsl-20261004/worker-probe');
 await new Promise((resolve,reject)=>{
  const compiler=webpack({mode:'none',target:'webworker',entry:path.resolve('src/workers/optimize_artifact.js'),
   output:{path:dist,filename:'js/optimizer.js',chunkFilename:'js/[id].js',assetModuleFilename:'assets/[name][ext]',publicPath:'http://worker.local/'},
   resolve:{alias:{mona:path.resolve('mona_wasm/pkg')}},
   module:{rules:[{resourceQuery:/raw-wasm/,type:'asset/resource'}]},
   experiments:{topLevelAwait:true,asyncWebAssembly:true},optimization:{minimize:false}});
  compiler.run((error,stats)=>compiler.close(closeError=>error||closeError?reject(error||closeError):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));
 });
 const rows=[];
 for(const name of Object.keys(skills)) {
  const x=input(name),pool=candidates(x);x.artifacts=[...pool.fixed,pool.heads[0]];
  const expected=optimize(x,pool.all);
  const msg=await probeCompiledOptimizer(dist,{...x,target_function:target(x),algorithm:'Naive',constraint:null,filter:null},pool.all);
  assert.equal(msg.type,'results',JSON.stringify(msg));assert.equal(msg.data.results.length,expected.length);
  for(let i=0;i<expected.length;i++) {
   assert.equal(msg.data.results[i].head,expected[i].head);
   close(msg.data.results[i].value,expected[i].value,name+' Worker');
  }
  rows.push({name,results:msg.data.results.map(r=>({head:r.head,value:r.value}))});
 }
 console.log(JSON.stringify({check:'source compiled Worker',rows}));
});
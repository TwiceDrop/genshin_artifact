import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import webpack from 'webpack';
import {api,named,sum} from '../beta-tools/runtime-7106.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {probeCompiledOptimizer} from '../beta-tools/compiled-worker-probe.mjs';
const skills={
 YumemizukiMizuki:[[14,'TalentStellarSwirl'],[15,'C1StellarSwirl']],
 Odette:[[13,'CodaStellarSwirl'],[16,'PlumeStellarSwirl'],[19,'WingStellarSwirl'],[23,'C1StellarSwirl'],[25,'C4StellarSwirl']],
 Sandrone:[[18,'ChargedRayStellar'],[19,'SkillPrismStellar'],[20,'BurstBeamStellar'],[21,'C4Resonator'],[22,'C6ClusterStellar']],
 AetherCryo:[[14,'StellarSwirlBurst'],[15,'ChargedIceCondensation1'],[16,'ChargedIceCondensation2']],
};
const primary=name=>skills[name][name==='AetherCryo'?1:0];
const close=(a,b,label)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),label+': '+a+' != '+b);
const params={hp:50000,constellation:6,e_level:10,on_field:true,ordinary_mode:false};
const support=(id,p={})=>named('Vodyanitsa'+id,{...params,...p});
function input(name){
 const x=fixture(name);delete x.target_function;delete x.algorithm;delete x.constraint;
 x.character.constellation=6;x.skill.index=primary(name)[0];
 if(['Odette','AetherCryo'].includes(name))x.character.params[name].radiance_mode=2;
 if(name==='AetherCryo')x.skill.config.AetherCryo.e_infusion=false;
 if(name==='YumemizukiMizuki'){x.character.params[name].enhanced_state=true;x.character.params[name].c1_reaction_active=false;x.buffs=[named('ElementalMastery',{value:785})];}
 x.buffs.push(named('Critical',{p:37}),named('CriticalDamage',{p:80}),named('ElevateStellarGlimmerReaction',{p:25}));
 x.enemy={level:95,resistance:{pyro:.1,hydro:.1,anemo:.25,electro:.1,dendro:.1,cryo:.4,geo:.1,physical:.1}};
 return x;
}
const withBuffs=(x,buffs)=>({...structuredClone(x),buffs:[...x.buffs,...buffs]});
const damage=(x,index=x.skill.index)=>api.CalculatorInterface.get_damage_analysis({...x,skill:{...x.skill,index}},null);
const customTarget=(x,source=`dmg hit = ${x.character.name}.${primary(x.character.name)[1]}\nresult = hit.direct_stellarswirl.e`)=>({name:x.character.name+'Default',params:'NoConfig',use_dsl:true,dsl_source:source});
const target=x=>x.character.name==='Sandrone'?{name:'SandroneStellarSwirl',params:{SandroneStellarSwirl:{mode:0,...x.skill.config.Sandrone}}}:x.character.name==='YumemizukiMizuki'?{name:'YumemizukiMizukiStellarSwirl',params:{YumemizukiMizukiStellarSwirl:{mode:0}}}:customTarget(x);
const optimize=(x,inventory=x.artifacts,t=target(x))=>api.OptimizeSingleWasm.optimize({...x,target_function:t,algorithm:'Naive',constraint:null,filter:null},inventory);
function pool(x){
 const fixed=x.artifacts.filter(a=>a.slot!=='Head').map(a=>({...a,main_stat:['Sand','Goblet'].includes(a.slot)?['HPPercentage',.466]:a.main_stat}));
 const head={...structuredClone(x.artifacts.find(a=>a.slot==='Head')),main_stat:['HPPercentage',.466]};
 const strong={...structuredClone(head),id:6,sub_stats:[...head.sub_stats,['ATKFixed',2500],['ElementalMastery',200],['CriticalRate',.4],['CriticalDamage',1.3]]};
 return {fixed,heads:[head,strong],all:[...fixed,head,strong]};
}
test('1 A4 定额位置、生命上限、C2 前后台和 C6 擢升原生消费',()=>{
 const rows=[];
 for(const name of Object.keys(skills)){
  const x=input(name),b=damage(x),raw=sum(name==='YumemizukiMizuki'?b.em:b.atk)*sum(b.direct_stellarswirl_ratio)+sum(b.direct_stellarswirl_extra_damage);
  const post=b.direct_stellarswirl.non_critical/(raw*(1+sum(b.direct_stellarswirl_base_compose))*(1+sum(b.direct_stellarswirl_compose)));
  const cd=sum(b.critical_damage)+sum(b.critical_damage_stellarswirl),cr=Math.min(1,sum(b.critical)+sum(b.critical_stellarswirl)),elev=sum(b.elevate_stellarswirl_compose)+sum(b.elevate_stellar_glimmer_reaction_compose);
  for(const hp of [40000,50000,65000,80000]){
   const a=damage(withBuffs(x,[support('A4',{hp,on_field:false}),support('C2',{on_field:false}),support('C6')]));
   const flat=Math.min(Math.max(hp-40000,0)*.26,6500),n=(b.direct_stellarswirl.non_critical+flat*post)*(1+elev+.25)/(1+elev);
   close(a.direct_stellarswirl.non_critical,n,name+' noncrit hp '+hp);
   close(a.direct_stellarswirl.critical,n*(1+cd+.6),name+' crit');
   close(a.direct_stellarswirl.expectation,n*(1+cr*(cd+.6)),name+' expectation');
   close(sum(a.direct_stellarswirl_extra_fixed),flat,name+' flat detail');
   close(sum(a.elevate_stellarswirl_compose)+sum(a.elevate_stellar_glimmer_reaction_compose),elev+.25,name+' elevation detail');
   rows.push({name,hp,flat,value:a.direct_stellarswirl.expectation});
  }
  for(const c of [1,2,5,6])for(const on_field of [true,false]){
   const a=damage(withBuffs(x,[support('C2',{constellation:c,on_field})]));
   close(sum(a.critical_damage_stellarswirl)-sum(b.critical_damage_stellarswirl),c>=2&&(on_field||c>=6)?.6:0,name+' C2 condition');
  }
  close(damage(withBuffs(x,['A4','C2','C6'].map(id=>({...support(id),lock:true})))).direct_stellarswirl.expectation,b.direct_stellarswirl.expectation,name+' disabled');
  close(damage(withBuffs(x,[support('A4'),support('A4')])).direct_stellarswirl.expectation,damage(withBuffs(x,[support('A4')])).direct_stellarswirl.expectation,name+' duplicate');
  const ordinary=damage(withBuffs(x,[support('A4',{ordinary_mode:true}),support('C2',{ordinary_mode:true})]));
  close(sum(ordinary.direct_stellarswirl_extra_fixed),0,name+' ordinary mode no stellar flat');
  for(const field of ['non_critical','critical','expectation'])close(ordinary.direct_stellarswirl[field],b.direct_stellarswirl[field],name+' ordinary mode no stellar CD '+field);
 }
 console.log(JSON.stringify({check:'independent formula and conditions',rows}));
});
test('2 四角色保留技能 DSL 与单次一致、普通段和七七定额保持正确',()=>{
 const rows=[];
 for(const [name,list]of Object.entries(skills)){
  const bare=input(name),x=withBuffs(bare,[support('A4'),support('C2'),support('C6'),named('QiqiC6StellarConduct',{atk:2000})]);
  for(const [index,skill]of list){
   const dsl=`dmg hit = ${name}.${skill}\ndmg plain = ${name}.Normal1\nresult = hit.direct_stellarswirl.e + hit.direct_stellarswirl.c * 0.1 + hit.direct_stellarswirl.n * 0.01 + plain.normal.e\nprint(result)`;
   const r=api.DSLInterface.run(dsl,{...x,skill:{index:0,config:x.skill.config}},x.artifacts);assert.equal(r.is_error,false,r.error_msg);
   const hit=damage(x,index),normal=damage(x,0).normal.expectation,expected=hit.direct_stellarswirl.expectation+hit.direct_stellarswirl.critical*.1+hit.direct_stellarswirl.non_critical*.01+normal;
   const actual=Number(r.output.trim().replace(/^MONA: /,''));assert.ok(Math.abs(actual-expected)<.011,name+'.'+skill+': '+actual+' != '+expected);
   assert.notEqual(hit.reaction_availability?.direct_stellarswirl?.status,'uncalibrated');
   close(normal,damage(withBuffs(bare,[support('C6')]),0).normal.expectation,name+' ordinary star flat/CD scope');
   close(sum(hit.direct_stellarswirl_extra_fixed),14600,name+' two sources');
   rows.push({name,skill,actual,expected});
  }
  const e=damage(withBuffs(bare,[support('A4'),support('C2'),support('C6')])).direct_stellarswirl.expectation,body=damage(withBuffs(bare,[support('C2'),support('C6')])).direct_stellarswirl.expectation;
  for(const p of [0,150])close(damage(withBuffs(bare,[support('A4'),support('C2'),support('C6'),named('StellarSwirlDamageMultiplier',{p})])).direct_stellarswirl.expectation,body*p/100+e-body,name+' multiplier '+p);
 }
 console.log(JSON.stringify({check:'DSL and scope',rows}));
});
test('3 原生/自定义实际配装及词条收益逐候选重算',()=>{
 const rows=[];
 for(const name of Object.keys(skills)){
  const x=withBuffs(input(name),[support('A4'),support('C2'),support('C6'),named('QiqiC6StellarConduct',{atk:2000})]),p=pool(x);x.artifacts=[...p.fixed,p.heads[0]];
  const expected=new Map(p.heads.map(h=>[h.id,damage({...x,artifacts:[...p.fixed,h]}).direct_stellarswirl.expectation]));
  for(const t of [target(x),customTarget(x)]){
   const r=optimize(x,p.all,t);assert.equal(r.length,2);
   for(const item of r)close(item.value,expected.get(item.head),name+' head '+item.head);
   close(r[0].value,Math.max(...expected.values()),name+' best');
  }
  const gains=api.BonusPerStat.bonus_per_stat({...x,tf:target(x),artifacts_config:null}),buff=name==='YumemizukiMizuki'?named('ElementalMastery',{value:23}):named('ATKPercentage',{p:5.8}),key=name==='YumemizukiMizuki'?'elemental_mastery':'atk_percentage';
  close(gains[key][0],damage(withBuffs(x,[buff])).direct_stellarswirl.expectation/damage(x).direct_stellarswirl.expectation-1,name+' stat gain');
  close(sum(api.CommonInterface.get_attribute(x).atk),sum(api.CommonInterface.get_attribute({...x,buffs:x.buffs.filter(b=>!b.name.startsWith('Vodyanitsa'))}).atk),name+' panel ATK');
  rows.push({name,expected:[...expected],gain:gains[key][0]});
 }
 console.log(JSON.stringify({check:'candidate and stat gain',rows}));
});
test('4 当前源码真实 Worker 的四条旧角色支援配装路径',async()=>{
 const dist=path.resolve('.build-target/vodyanitsa-stellar-support-20261004/worker-probe');
 await new Promise((resolve,reject)=>{
  const compiler=webpack({mode:'none',target:'webworker',entry:path.resolve('src/workers/optimize_artifact.js'),output:{path:dist,filename:'js/optimizer.js',chunkFilename:'js/[id].js',assetModuleFilename:'assets/[name][ext]',publicPath:'http://worker.local/'},resolve:{alias:{mona:path.resolve('mona_wasm/pkg')}},module:{rules:[{resourceQuery:/raw-wasm/,type:'asset/resource'}]},experiments:{topLevelAwait:true,asyncWebAssembly:true},optimization:{minimize:false}});
  compiler.run((error,stats)=>compiler.close(closeError=>error||closeError?reject(error||closeError):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));
 });
 const rows=[];
 for(const name of Object.keys(skills)){
  const x=withBuffs(input(name),[support('A4'),support('C2'),support('C6')]),p=pool(x);x.artifacts=[...p.fixed,p.heads[0]];
  const expected=optimize(x,p.all),msg=await probeCompiledOptimizer(dist,{...x,target_function:target(x),algorithm:'Naive',constraint:null,filter:null},p.all);
  assert.equal(msg.type,'results',JSON.stringify(msg));assert.equal(msg.data.results.length,2);
  for(let i=0;i<2;i++){assert.equal(msg.data.results[i].head,expected[i].head);close(msg.data.results[i].value,expected[i].value,name+' Worker');}
  rows.push({name,results:msg.data.results.map(r=>({head:r.head,value:r.value}))});
 }
 console.log(JSON.stringify({check:'compiled Worker',rows}));
});
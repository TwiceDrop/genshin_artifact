import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import webpack from 'webpack';
import {api,vesna,vody,named,sum} from '../beta-tools/runtime-7106.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {probeCompiledOptimizer} from '../beta-tools/compiled-worker-probe.mjs';
import {calculateDirectStellarConduct} from '../beta-data/direct-stellar-conduct.mjs';
import {calculateSingleHit} from '../beta-data/single-hit-damage.mjs';
const near=(a,b,label='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
const input=name=>{const x=fixture(name);delete x.target_function;delete x.constraint;delete x.algorithm;return x;};
const add=(x,buffs)=>({...structuredClone(x),buffs:[...x.buffs,...buffs]});
const damage=(x,index=x.skill.index)=>api.CalculatorInterface.get_damage_analysis({...x,skill:{...x.skill,index}},null);
const tf=(name,source)=>({name:name+'Default',params:'NoConfig',use_dsl:true,dsl_source:source});
const opt=(x,t,arts=x.artifacts)=>api.OptimizeSingleWasm.optimize({...x,target_function:t,algorithm:'Naive',constraint:null,filter:null},arts);
const dsl=(source,x,arts=x.artifacts)=>{const r=api.DSLInterface.run(source,x,arts);assert.equal(r.is_error,false,r.error_msg);return Number(r.output.trim().replace(/^MONA: /,''));};
const twoHeads=x=>{const head=structuredClone(x.artifacts.find(a=>a.slot==='Head'));head.id=6;head.sub_stats.push(['ATKFixed',200],['HPFixed',10000]);return [...x.artifacts,head];};
const fitted=(x,pool,id)=>({...structuredClone(x),artifacts:pool.filter(a=>a.slot!=='Head'||a.id===id)});
const c2=(p={})=>named('VodyanitsaC2',{hp:50000,constellation:2,on_field:true,ordinary_mode:true,e_level:10,...p});
function star(name){const x=input(name);x.character.constellation=6;x.buffs=[named('Critical',{p:37}),named('CriticalDamage',{p:80})];if(['Odette','AetherCryo'].includes(name))x.character.params[name].radiance_mode=2;if(name==='AetherCryo')x.skill.config.AetherCryo.e_infusion=false;if(name==='YumemizukiMizuki')x.character.params[name].enhanced_state=true;return x;}
function vesnaInput(){const x=structuredClone(vesna);x.artifacts=input('Vesna').artifacts;x.character.constellation=6;const p={hp:50000,constellation:6,on_field:true,ordinary_mode:false,e_level:10};x.buffs=['A4','C2','C6'].map(id=>named('Vodyanitsa'+id,p));return x;}
const vesnaSource='dmg burst = Vesna.Burst\ndmg plain = Vesna.Normal1\nresult = burst.direct_stellarswirl.e + plain.normal.e\nprint(result)';
const vesnaValue=x=>damage(x,17).direct_stellarswirl.expectation+damage(x,0).normal.expectation;
function hymn(hp=50000){const x=input('Mona');x.weapon={name:'HymnOfTheMaelstrom',level:90,ascend:false,refine:1,params:{HymnOfTheMaelstrom:{stacks:3,boosted:true,on_field:true,hp:0}}};const bareHP=sum(api.CommonInterface.get_attribute(x).hp);x.buffs=[named('HPFixed',{value:hp-bareHP})];return x;}
const hymnSource='dmg hit = Mona.Normal1\nresult = hit.normal.e\nprint(result)';
const cryoSource='dmg hit = Odette.CodaStellarSwirl\ndmg plain = Odette.Normal1\nresult = hit.direct_stellarswirl.e + plain.normal.e\nprint(result)';
const cryoValue=x=>damage(x,13).direct_stellarswirl.expectation+damage(x,0).normal.expectation;

test('1 普通 C2 保留冰直伤暴伤，抵消星扩散及同源星超导串入；候选与收益一致',()=>{
 const rows=[];
 for(const [name,index]of [['Odette',13],['AetherCryo',15],['YumemizukiMizuki',14],['Sandrone',18]]){
  const x=star(name),b=damage(x,index),a=damage(add(x,[c2()]),index);
  for(const field of ['non_critical','critical','expectation'])near(a.direct_stellarswirl[field],b.direct_stellarswirl[field],name+' stellar '+field);
  rows.push({name,before:b.direct_stellarswirl.expectation,after:a.direct_stellarswirl.expectation});
 }
 const own=structuredClone(vody);own.skill.index=0;const ownBase=damage(own),ownAfter=damage(add(own,[c2()]));near(ownAfter.normal.non_critical,ownBase.normal.non_critical);near(ownAfter.normal.critical,ownBase.normal.critical+.5*ownBase.normal.non_critical,'extension ordinary C2');
 const x=star('Odette');
 for(const key of ['non_critical','critical','expectation'])near(damage(add(x,[c2()]),12).direct_stellarconduct[key],damage(x,12).direct_stellarconduct[key],'Cryo conduct '+key);
 const b=damage(x,10),a=damage(add(x,[c2()]),10),cr=(b.normal.expectation/b.normal.non_critical-1)/(b.normal.critical/b.normal.non_critical-1);
 near(a.normal.non_critical,b.normal.non_critical);near(a.normal.critical,b.normal.critical+.5*b.normal.non_critical);near(a.normal.expectation,b.normal.expectation+.5*b.normal.non_critical*cr);
 for(const p of [{constellation:1},{on_field:false},{active:false}])near(damage(add(x,[c2(p)]),10).normal.expectation,b.normal.expectation,'inactive C2');
 const y=add(x,[c2()]),t=tf('Odette',cryoSource),pool=twoHeads(y),expected=new Map([5,6].map(id=>[id,cryoValue(fitted(y,pool,id))]));
 near(dsl(cryoSource,y),cryoValue(y));for(const r of opt(y,t,pool))near(r.value,expected.get(r.head),'C2 candidate');
 const gains=api.BonusPerStat.bonus_per_stat({...y,tf:t,artifacts_config:null});near(gains.atk_percentage[0],cryoValue(add(y,[named('ATKPercentage',{p:5.8})]))/cryoValue(y)-1,'C2 gain');
 console.log({check:'C2 scope',rows,ordinaryBefore:b.normal.expectation,ordinaryAfter:a.normal.expectation});
});

test('2 薇斯纳公共 DSL 消费原生星扩散与普通段，并按候选装备及收益重算',()=>{
 const x=vesnaInput();
 for(const [index,skill]of [[15,'ESpirit3Final'],[17,'Burst'],[19,'C6Spirit']]){
  const source=`dmg hit = Vesna.${skill}\nresult = hit.direct_stellarswirl.e\nprint(result)`;
  near(dsl(source,x),damage(x,index).direct_stellarswirl.expectation,skill);
 }
 near(dsl(vesnaSource,x),vesnaValue(x),'mixed DSL');
 const t=tf('Vesna',vesnaSource),pool=twoHeads(x),expected=new Map([5,6].map(id=>[id,vesnaValue(fitted(x,pool,id))]));
 for(const r of opt(x,t,pool))near(r.value,expected.get(r.head),'Vesna candidate');
 const gains=api.BonusPerStat.bonus_per_stat({...x,tf:t,artifacts_config:null});near(gains.atk_percentage[0],vesnaValue(add(x,[named('ATKPercentage',{p:5.8})]))/vesnaValue(x)-1,'Vesna gain');
 console.log({check:'Vesna DSL',expected:[...expected],gain:gains.atk_percentage[0]});
});

test('3 显式星超导正确消费通用增伤与最终擢升；保留冰雷原生路径已有消费',()=>{
 const buffs=[named('EnhanceStellarGlimmerReaction',{p:40}),named('ElevateStellarGlimmerReaction',{p:25})];
 const context={owner:{id:'Sandrone',em:200,critRate:.5,critDamage:1},element:'Electro',scalingStat:2000,skillMultiplier:2,baseMultiplier:1.5,reactionBonus:.3,flatBonus:600,elevation:.1,resistanceMultiplier:.7};
 const n=(2000*2*1.5*(1+6*200/2200+.3+.4)+600)*.7*(1+.1+.25);
 const r=calculateDirectStellarConduct({...context,buffs});near(r.non_critical,n);near(r.critical,n*2);near(r.expectation,n*1.5);
 const x=input('Sandrone');x.buffs=buffs;x.direct_stellar_context=context;near(damage(x).direct_stellarconduct.expectation,r.expectation,'outer context');
 const panel=calculateSingleHit({kind:'stellar-conduct',character:{name:'Sandrone'},panel:{ATK:2000,em:200,critRate:.5,critDamage:1},element:'Electro',skillMultiplier:2,baseMultiplier:1.5,reactionBonus:.3,flatBonus:600,elevation:.1,resistanceBeforeBuffs:.3,buffs});near(panel.expectation,r.expectation,'retained explicit helper');
 const rows=[];
 for(const [name,index,skill]of [['Sandrone',5,'ChargedRayStellar'],['Odette',12,'CodaStellarConduct']]){
  const x=input(name);if(name==='Odette')x.character.params.Odette.radiance_mode=2;x.skill.index=index;
  const b=damage(x),a=damage(add(x,buffs));
  const factor=(1+sum(b.direct_stellarconduct_compose)+.4)/(1+sum(b.direct_stellarconduct_compose))*(1+sum(b.elevate_stellarconduct_compose)+sum(b.elevate_stellar_glimmer_reaction_compose)+.25)/(1+sum(b.elevate_stellarconduct_compose)+sum(b.elevate_stellar_glimmer_reaction_compose));
  near(a.direct_stellarconduct.expectation,b.direct_stellarconduct.expectation*factor,name+' native');
  if(name==='Sandrone'){
   const t={name:'SandroneDefault',params:'NoConfig',use_dsl:false,dsl_source:''},pool=twoHeads(x),y=add(x,buffs);
   const expected=new Map([5,6].map(id=>[id,damage(fitted(y,pool,id)).direct_stellarconduct.expectation]));for(const item of opt(y,t,pool))near(item.value,expected.get(item.head),name+' native candidate');
   const gains=api.BonusPerStat.bonus_per_stat({...y,tf:t,artifacts_config:null});near(gains.atk_percentage[0],damage(add(y,[named('ATKPercentage',{p:5.8})])).direct_stellarconduct.expectation/a.direct_stellarconduct.expectation-1,'native conduct gain');
  }
  const source=`dmg hit = ${name}.${skill}\nresult = hit.direct_stellarconduct.e\nprint(result)`,t=tf(name,source),pool=twoHeads(x),y=add(x,buffs);
  near(dsl(source,y),a.direct_stellarconduct.expectation,name+' DSL');
  const expected=new Map([5,6].map(id=>[id,damage(fitted(y,pool,id)).direct_stellarconduct.expectation]));for(const item of opt(y,t,pool))near(item.value,expected.get(item.head),name+' DSL candidate');
  rows.push({name,before:b.direct_stellarconduct.expectation,after:a.direct_stellarconduct.expectation});
 }
 console.log({check:'generic stellar conduct',explicit:r.expectation,rows});
});

test('4 漩流颂歌生命阈值、上限、前台与固定来源；普通目标/DSL 候选及生命收益动态消费',()=>{
 const rows=[];
 for(const hp of [39999,40000,50000,60000,65000]){
  const x=hymn(hp),a=api.CommonInterface.get_attribute(x),base=a.atk['角色基础攻击']+a.atk['武器基础攻击'];
  near(sum(a.hp),hp);near(a.atk['漩流颂歌·场上加攻']||0,Math.min(Math.max(hp-40000,0),20000)*.04*3*1.75/10000*base,'Hymn formula');
  const fixed=structuredClone(x);fixed.weapon.params.HymnOfTheMaelstrom.hp=hp;near(damage(x).normal.expectation,damage(fixed).normal.expectation,'fixed source equivalent');
  rows.push({hp,attack:a.atk['漩流颂歌·场上加攻']||0});
 }
 const x=hymn(),off=structuredClone(x);off.weapon.params.HymnOfTheMaelstrom.on_field=false;near(api.CommonInterface.get_attribute(off).atk['漩流颂歌·场上加攻']||0,0,'off field');
 const zero=structuredClone(x);zero.weapon.params.HymnOfTheMaelstrom.stacks=0;near(api.CommonInterface.get_attribute(zero).atk['漩流颂歌·场上加攻']||0,0,'zero stacks');
 const t=tf('Mona',hymnSource),pool=twoHeads(x),expected=new Map([5,6].map(id=>[id,damage(fitted(x,pool,id)).normal.expectation]));
 near(dsl(hymnSource,x),damage(x).normal.expectation);for(const r of opt(x,t,pool))near(r.value,expected.get(r.head),'Hymn DSL candidate');
 const native={name:'MonaDefault',params:{MonaDefault:{recharge_demand:1.4}},use_dsl:false,dsl_source:''},nativeExpected=new Map();
 for(const id of [5,6]){const candidate=fitted(x,pool,id);candidate.weapon.params.HymnOfTheMaelstrom.hp=sum(api.CommonInterface.get_attribute(candidate).hp);nativeExpected.set(id,opt(candidate,native)[0].value);}
 for(const r of opt(x,native,pool))near(r.value,nativeExpected.get(r.head),'Hymn native candidate');
 const gains=api.BonusPerStat.bonus_per_stat({...x,tf:t,artifacts_config:null});near(gains.hp_percentage[0],damage(add(x,[named('HPPercentage',{p:5.8})])).normal.expectation/damage(x).normal.expectation-1,'live HP gain');assert.ok(gains.hp_percentage[0]>0);
 const fixed=structuredClone(x);fixed.weapon.params.HymnOfTheMaelstrom.hp=50000;assert.equal(api.BonusPerStat.bonus_per_stat({...fixed,tf:t,artifacts_config:null}).hp_percentage.length,0);
 console.log({check:'Hymn live graph',rows,expected:[...expected],gain:gains.hp_percentage[0]});
});

test('5 当前源码真实 Worker：C2 星伤作用域、薇斯纳 DSL 和漩流颂歌候选重算',async()=>{
 const dist=path.resolve('.build-target/pending-goal-20261004/worker-probe');
 await new Promise((resolve,reject)=>{const compiler=webpack({mode:'none',target:'webworker',entry:path.resolve('src/workers/optimize_artifact.js'),output:{path:dist,filename:'js/optimizer.js',chunkFilename:'js/[id].js',assetModuleFilename:'assets/[name][ext]',publicPath:'http://worker.local/'},resolve:{alias:{mona:path.resolve('mona_wasm/pkg')}},module:{rules:[{resourceQuery:/raw-wasm/,type:'asset/resource'}]},experiments:{topLevelAwait:true,asyncWebAssembly:true},optimization:{minimize:false}});compiler.run((error,stats)=>compiler.close(closeError=>error||closeError?reject(error||closeError):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));});
 const cases=[[add(star('Odette'),[c2()]),cryoSource,cryoValue],[vesnaInput(),vesnaSource,vesnaValue],[hymn(),hymnSource,x=>damage(x).normal.expectation]];
 const rows=[];
 for(const [x,source,value]of cases){const name=x.character.name,t=tf(name,source),pool=twoHeads(x),expected=new Map([5,6].map(id=>[id,value(fitted(x,pool,id))]));const msg=await probeCompiledOptimizer(dist,{...x,target_function:t,algorithm:'Naive',constraint:null,filter:null},pool);assert.equal(msg.type,'results',JSON.stringify(msg));assert.equal(msg.data.results.length,2);for(const r of msg.data.results)near(r.value,expected.get(r.head),name+' Worker');rows.push({name,results:msg.data.results.map(r=>({head:r.head,value:r.value}))});}
 console.log({check:'compiled Worker',rows});
});
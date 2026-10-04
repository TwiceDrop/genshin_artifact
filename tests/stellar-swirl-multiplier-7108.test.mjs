import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import webpack from 'webpack';
import {api,named,sum,vesna} from '../beta-tools/runtime-7106.mjs';
import {fixture} from '../beta-tools/interface-audit-7108.mjs';
import {probeCompiledOptimizer} from '../beta-tools/compiled-worker-probe.mjs';
const work='.build-target/stellar-swirl-multiplier-20261002';
const report={date:'2026-10-02',checks:[]};
const clone=structuredClone;
const close=(a,b,label='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),label+': '+a+' != '+b);
const fields=['non_critical','critical','expectation'];
const selections=[['YumemizukiMizuki',14],['Odette',13],['Sandrone',18],['AetherCryo',15]];
function input(name,index){
 const x=fixture(name);delete x.target_function;delete x.algorithm;delete x.constraint;
 x.skill.index=index;
 if(name==='YumemizukiMizuki'){x.character.params[name].enhanced_state=true;x.character.params[name].c1_reaction_active=false;x.buffs=[named('ElementalMastery',{value:785})];}
 if(['Odette','AetherCryo'].includes(name))x.character.params[name].radiance_mode=2;
 return x;
}
const damage=x=>api.CalculatorInterface.get_damage_analysis(x,null);
const mult=(x,p=150)=>({...clone(x),buffs:[...clone(x.buffs),named('StellarSwirlDamageMultiplier',{p})]});
const target=x=>({
 YumemizukiMizuki:{name:'YumemizukiMizukiStellarSwirl',params:{YumemizukiMizukiStellarSwirl:{mode:0}}},
 Odette:{name:'OdetteDefault',params:'NoConfig',use_dsl:true,dsl_source:'dmg hit = Odette.CodaStellarSwirl\nresult = hit.direct_stellarswirl.e'},
 Sandrone:{name:'SandroneStellarSwirl',params:{SandroneStellarSwirl:{mode:0,...x.skill.config.Sandrone}}},
 AetherCryo:{name:'AetherCryoDefault',params:'NoConfig',use_dsl:true,dsl_source:'dmg hit = AetherCryo.ChargedIceCondensation1\nresult = hit.direct_stellarswirl.e'}
})[x.character.name];
function pool(x){const fixed=x.artifacts.filter(a=>a.slot!=='Head'),h=x.artifacts.find(a=>a.slot==='Head');return {fixed,heads:[h,{...clone(h),id:6,sub_stats:[...h.sub_stats,['ATKFixed',250],['ElementalMastery',100]]}],all:[...fixed,h,{...clone(h),id:6,sub_stats:[...h.sub_stats,['ATKFixed',250],['ElementalMastery',100]]}]};}
function optimize(x,inventory=x.artifacts){return api.OptimizeSingleWasm.optimize({...x,target_function:target(x),algorithm:'Naive',constraint:null,filter:null},inventory);}
function mark(name,data){report.checks.push({name,...data});fs.writeFileSync(work+'/report.json',JSON.stringify(report,null,2));}

test('1 四条旧路径的本体和伤害明细按150%缩放',()=>{
 const before=JSON.parse(fs.readFileSync('.build-target/stellar-swirl-path-audit-20261002/report.json','utf8'));
 const rows=[];
 for(const [name,index]of selections){
  const x=input(name,index),a=damage(x),b=damage(mult(x));
  const old=before.groups.find(g=>g.name===name).rows.find(r=>r.index===index&&r.constellation===0);
  close(a.direct_stellarswirl.expectation,old.direct,'unchanged original body '+name);
  for(const k of fields)close(b.direct_stellarswirl[k],a.direct_stellarswirl[k]*1.5,name+' '+k);
  close(sum(b.direct_stellarswirl_ratio),sum(a.direct_stellarswirl_ratio)*1.5,name+' detail');
  if(a.normal)for(const k of fields)close(b.normal[k],a.normal[k],name+' ordinary');
  rows.push({name,index,before:a.direct_stellarswirl.expectation,after:b.direct_stellarswirl.expectation});
 }
 mark('four direct-body paths',{rows});
});

test('2 定额不乘倍率，0%仍保留定额；禁用、重复和连续调用保持合同',()=>{
 const rows=[];
 for(const name of ['YumemizukiMizuki','Sandrone']){
  const x=input(name,name==='Sandrone'?18:14);
  x.buffs.push(named('EnhanceStellarGlimmerReaction',{p:30}),named('ElevateStellarGlimmerReaction',{p:25}));
  const bare=damage(x),withFlat={...clone(x),buffs:[...clone(x.buffs),named('QiqiC6StellarConduct',{atk:2000})]};
  const a=damage(withFlat),b=damage(mult(withFlat)),zero=damage(mult(withFlat,0));
  for(const k of fields){const flat=a.direct_stellarswirl[k]-bare.direct_stellarswirl[k];close(b.direct_stellarswirl[k],bare.direct_stellarswirl[k]*1.5+flat,name+' flat150 '+k);close(zero.direct_stellarswirl[k],flat,name+' flat0 '+k);}
  rows.push({name,flat:a.direct_stellarswirl.expectation-bare.direct_stellarswirl.expectation,zero:zero.direct_stellarswirl.expectation});
 }
 const x=input('YumemizukiMizuki',14),a=damage(x).direct_stellarswirl.expectation;
 const disabled={...clone(x),buffs:[...clone(x.buffs),{...named('StellarSwirlDamageMultiplier',{p:0}),lock:true},named('StellarSwirlDamageMultiplier',{p:150,active:false})]};
 close(damage(disabled).direct_stellarswirl.expectation,a,'disabled');
 const dup=mult(x);dup.buffs.push(named('StellarSwirlDamageMultiplier',{p:200}));
 close(damage(dup).direct_stellarswirl.expectation,a*1.5,'first active duplicate');
 const defaults={...clone(x),buffs:[...clone(x.buffs),{name:'StellarSwirlDamageMultiplier',config:'NoConfig'}]};
 close(damage(defaults).direct_stellarswirl.expectation,a,'default100');
 close(damage(x).direct_stellarswirl.expectation,a,'transaction reset');
 mark('flat and multiplier contract',{rows});
});

test('3 实际配装候选重算，四条路径与单次伤害一致',()=>{
 const rows=[];
 for(const [name,index]of selections){
  const x=mult(input(name,index));if(['YumemizukiMizuki','Sandrone'].includes(name))x.buffs.push(named('QiqiC6StellarConduct',{atk:2000}));
  const inv=pool(x),expected=new Map(inv.heads.map(h=>[h.id,damage({...x,artifacts:[...inv.fixed,h]}).direct_stellarswirl.expectation]));
  const results=optimize(x,inv.all);assert.ok(results.length,name+' candidates');
  for(const r of results)close(r.value,expected.get(r.head),name+' candidate '+r.head);
  close(results[0].value,Math.max(...expected.values()),name+' optimum');
  rows.push({name,candidates:results.map(r=>({head:r.head,value:r.value})),expected:[...expected]});
 }
 mark('live optimizer candidates',{rows});
});

test('4 词条收益和混合DSL正确消费倍率，普通伤害与原生扩展保持作用域',()=>{
 const rows=[];
 for(const name of ['YumemizukiMizuki','Sandrone']){
  const x=mult(input(name,name==='Sandrone'?18:14));x.buffs.push(named('QiqiC6StellarConduct',{atk:2000}));
  const baseline=damage(x).direct_stellarswirl.expectation;
  const stat=name==='Sandrone'?'ATKPercentage':'ElementalMastery',key=name==='Sandrone'?'atk_percentage':'elemental_mastery';
  const buff=name==='Sandrone'?named(stat,{p:5.8}):named(stat,{value:23});
  const gains=api.BonusPerStat.bonus_per_stat({...x,tf:target(x),artifacts_config:null});
  const improved={...clone(x),buffs:[...clone(x.buffs),buff]};
  close(gains[key][0],damage(improved).direct_stellarswirl.expectation/baseline-1,name+' stat gain');
  rows.push({name,gain:gains[key][0]});
 }
 const x=mult(input('YumemizukiMizuki',14));x.buffs.push(named('QiqiC6StellarConduct',{atk:2000}));
 const source='dmg hit = YumemizukiMizuki.TalentStellarSwirl\ndmg plain = YumemizukiMizuki.Normal1\nresult = hit.direct_stellarswirl.e + plain.normal.e\nprint(result)';
 const printed=api.DSLInterface.run(source,x,x.artifacts);assert.equal(printed.is_error,false,printed.error_msg);
 const normal=damage({...x,skill:{...x.skill,index:0}}).normal.expectation;
 const expected=damage(x).direct_stellarswirl.expectation+normal;
 assert.ok(Math.abs(Number(printed.output.trim().replace(/^MONA: /,''))-expected)<.011,'DSL print');
 const bare=input('YumemizukiMizuki',14);
 assert.deepEqual(api.CommonInterface.get_attribute(mult(bare)),api.CommonInterface.get_attribute(bare),'attribute scope');
 const native=clone(vesna),a=damage(native),b=damage(mult(native));
 for(const k of fields)close(b.direct_stellarswirl[k],a.direct_stellarswirl[k]*1.5,'Vesna native scope');
 const hashes=JSON.parse(fs.readFileSync(work+'/protected-hashes.json','utf8'));
 for(const [file,hash]of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,file);
 mark('DSL, stat gains, native scope and protected files',{rows,dsl:expected});
});

test('5 当前源码独立编译的真实配装Worker接入浏览器公共入口',async()=>{
 const dist=path.resolve(work,'worker-probe');
 await new Promise((resolve,reject)=>{
  const compiler=webpack({mode:'none',target:'webworker',entry:path.resolve('src/workers/optimize_artifact.js'),
   output:{path:dist,filename:'js/optimizer.js',chunkFilename:'js/[id].js',assetModuleFilename:'assets/[name][ext]',publicPath:'http://worker.local/'},
   resolve:{alias:{mona:path.resolve('mona_wasm/pkg')}},
   module:{rules:[{resourceQuery:/raw-wasm/,type:'asset/resource'}]},
   experiments:{topLevelAwait:true,asyncWebAssembly:true},optimization:{minimize:false}});
  compiler.run((error,stats)=>compiler.close(closeError=>error||closeError?reject(error||closeError):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));
 });
 const rows=[];
 for(const name of ['YumemizukiMizuki','Sandrone']){
  const x=mult(input(name,name==='Sandrone'?18:14));x.buffs.push(named('QiqiC6StellarConduct',{atk:2000}));
  const inv=pool(x),expected=optimize(x,inv.all);
  const msg=await probeCompiledOptimizer(dist,{...x,target_function:target(x),algorithm:'Naive',constraint:null,filter:null},inv.all);
  assert.equal(msg.type,'results',JSON.stringify(msg));assert.equal(msg.data.results.length,expected.length);
  for(let i=0;i<expected.length;i++){assert.equal(msg.data.results[i].head,expected[i].head);close(msg.data.results[i].value,expected[i].value,name+' compiled Worker');}
  rows.push({name,results:msg.data.results.map(r=>({head:r.head,value:r.value}))});
 }
 mark('source compiled browser Worker',{rows,artifact:dist});
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {api,sum} from '../beta-tools/runtime-7106.mjs';
import {previewDefaults} from '../beta-data/preview-7201-config.mjs';
import {createDamageEvaluator} from '../src/algorithms/stat-gain/curve.mjs';
import {named,input,gear} from '../beta-tools/preview-7201-fixtures.mjs';
const close=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const damage=x=>api.CalculatorInterface.get_damage_analysis(x,null);

test('V4两角色公式：精通星伤、双缩放爆发、命座与护盾',()=>{
 const m=input(),d=damage(m),em=100,cr=.25,cd=.884;
 close(d.direct_stellarconduct.non_critical,em*4.032*(1+.00028*em)*(1+6*em/(2000+em))*.9);
 close(d.direct_stellarconduct.expectation,d.direct_stellarconduct.non_critical*(1+cr*cd));
 m.skill.index=14;close(damage(m).normal.non_critical,((263+23)*6.0048+100*12.0096)*1.2*.5*.9);
 const steady=input();steady.character.constellation=6;steady.character.params.Mitya={...previewDefaults.Mitya,core_mode:1,field_hits:12};steady.skill.index=12;const se=343;close(damage(steady).direct_stellarconduct.non_critical,se*1.44*1.15*2*(1+se*.00028)*(1+6*se/(2000+se))*1.05*1.2);steady.character.params.Mitya.core_mode=0;steady.skill.index=15;close(damage(steady).direct_stellarconduct.expectation,0);
 const v=input('Valeriy');v.character.constellation=6;v.character.params.Valeriy={...previewDefaults.Valeriy,shield_overflow:20};
 close(damage(v).normal.non_critical,(255+23)*1.24*4.1256*2*.5*.9);
 v.skill.index=9;close(damage(v).normal.expectation,(255+23)*1.24*(3.760128+20*.08)+2881.4229);
});

test('装备与BUFF作用域：专武、金流、星套装、瓦列里定额和停用',()=>{
 const m=input();m.weapon={name:'StarsealedEdict',level:90,ascend:false,refine:1,params:{StarsealedEdict:{skill_active:true,stacks:3,radiance:true}}};
 const p=api.CommonInterface.get_attribute(m);close(sum(p.atk),263+542);close(sum(p.elemental_mastery),220);close(sum(p.critical_damage),.884+.882+.24);
 let d=damage(m);close(d.direct_stellarconduct.critical/d.direct_stellarconduct.non_critical,1+.884+.882+.24+.36);
 const plain=input();const off=damage(plain).direct_stellarconduct.non_critical;
 plain.buffs=[named('ValeriyDirective',{atk:2000,talent_level:10,ascended:true,momentum:40,radiance:true,recipient_on_field:true,active:true})];
 close(damage(plain).direct_stellarconduct.non_critical-off,2000*(1.31328+.009*40)*.9);
 plain.buffs[0].lock=true;close(damage(plain).direct_stellarconduct.non_critical,off);
 plain.buffs=[named('CustomElementalBonus',{element:'Electro',p:100}),named('IndependentDamageMultiplier',{p:200})];close(damage(plain).direct_stellarconduct.non_critical,off);
 const cash=input();cash.weapon={name:'CashflowSupervision',level:90,ascend:false,refine:1,params:{CashflowSupervision:{stack:3}}};
 const before=100*4.032*1.028*.9;close(damage(cash).direct_stellarconduct.non_critical,before*(1+6*100/2100+.42));
 const set=input();set.artifacts=gear.map(a=>({...a,set_name:'DisenchantmentInDeepShadow'}));set.artifact_config={config_disenchantment_in_deep_shadow:{rate:1}};
 d=damage(set);const em=sum(d.em);close(d.direct_stellarconduct.non_critical,em*4.032*(1+Math.min(em*.00028,.14))*(1+6*em/(em+2000)+.4)*.9);close(sum(d.critical),.41);
 const furnace=input();furnace.artifacts=gear.map(a=>({...a,set_name:'HeartOfTheFurnace'}));furnace.artifact_config={config_heart_of_the_furnace:{rate:1}};const f=damage(furnace).direct_stellarconduct.non_critical;furnace.buffs=[named('HeartOfTheFurnace4',{rate:1})];close(damage(furnace).direct_stellarconduct.non_critical,f);furnace.artifact_config.config_heart_of_the_furnace.rate=0;close(damage(furnace).direct_stellarconduct.non_critical,f);
});

test('单次/候选优化/DSL/收益：两角色各两个候选，候选转换重算',()=>{
 for(const name of ['Mitya','Valeriy']){
  const x=input(name);x.artifacts=structuredClone(gear);if(name==='Valeriy'){x.character.params.Valeriy.radiance=false;x.character.params.Valeriy.directive=true;}
  const alt={...structuredClone(gear[2]),id:6,main_stat:name==='Mitya'?['ElementalMastery',287]:['ATKPercentage',.466]};
  const target={name:name+'Default',params:'NoConfig'},a=damage(x),key=name==='Mitya'?'direct_stellarconduct':'normal';
  const b=damage({...x,artifacts:x.artifacts.map(t=>t.slot==='Sand'?alt:t)});
  const rows=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:{set_mode:'Any'},filter:null},[...x.artifacts,alt]);
  close(rows[0].value,Math.max(a[key].expectation,b[key].expectation));assert.notEqual(a[key].expectation,b[key].expectation);
  const source=`dmg hit = ${name}.${name==='Mitya'?'GradientStellar':'Mortar'}\nprint(hit.${key}.e)`;
  const dsl=api.DSLInterface.run(source,x,x.artifacts);assert.equal(dsl.is_error,false,dsl.error_msg);close(Number(dsl.output.trim().replace(/^MONA: /,'')),a[key].expectation);
  const gains=api.BonusPerStat.bonus_per_stat({...x,tf:target,artifacts_config:null});assert.ok(Object.values(gains).flat().every(Number.isFinite));assert.ok((name==='Mitya'?gains.elemental_mastery:gains.atk_percentage).some(v=>v>0));
  const ev=createDamageEvaluator(api,x,key,null,['ElementalMastery'],'average');assert.ok(Number.isFinite(ev.evaluate({ElementalMastery:1})));
 }
});
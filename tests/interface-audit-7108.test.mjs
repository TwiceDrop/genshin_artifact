import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {api,read} from '../beta-tools/runtime-7106.mjs';
import {fixture,gear,optimizer,namedBuff,runInterfaceAudit} from '../beta-tools/interface-audit-7108.mjs';
import {normalizeBonusInput} from '../beta-data/interface-contracts.mjs';
import {defaultDamageReaction,visibleDamageReactionKeys} from '../src/algorithms/reaction-labels.mjs';
import {probeCompiledOptimizer} from '../beta-tools/compiled-worker-probe.mjs';
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function quiet(fn){const log=console.log,error=console.error;console.log=()=>{};console.error=()=>{};try{return fn()}finally{console.log=log;console.error=error}}
const enemy={level:90,electro_res:.1,pyro_res:.1,hydro_res:.1,cryo_res:.1,geo_res:.1,anemo_res:.1,dendro_res:.1,physical_res:.1};

test('Catalog matrix: every role/weapon/set/BUFF entry; unavailable contracts recorded explicitly',()=>quiet(()=>{
 const report=runInterfaceAudit();assert.equal(report.observations.length,0);
 const known=f=>(f.group==='character.rank'&&/静态.*评分|静态.*配装/.test(f.error))||(f.group==='character.dsl'&&f.label==='Vesna'&&/DSL/.test(f.error))||(/StellarSwirlDamageMultiplier/.test(f.label)&&/旧角色/.test(f.error))||(/DurinTalent2|DurinC2/.test(f.label)&&/另一元素/.test(f.error));
 assert.deepEqual(report.failures.filter(f=>!known(f)),[]);
 assert.equal(report.counts['skill.display'],2034);assert.equal(report.counts['buff.damage'],768);assert.equal(report.counts['weapon.damage'],255);assert.equal(report.counts['set.damage'],189);
 process.stdout.write('Matrix calls: '+Object.values(report.counts).reduce((a,b)=>a+b,0)+'; known restrictions: '+report.failures.length+'\n');
}));

test('BUFF parity: native damage, DSL and optimization; extension attribute boundary',()=>quiet(()=>{
 for(const role of ['Kaeya','Vodyanitsa'])for(const buffs of [[],[namedBuff('VodyanitsaE')],[namedBuff('VodyanitsaC1')],[namedBuff('FlinsC6')],[namedBuff('LinneaC6')]]){
  const x=fixture(role);x.buffs=buffs;x.skill.index=role==='Kaeya'?10:8;
  const skill=role==='Kaeya'?'E1':'EInitial';const source=`dmg hit = ${role}.${skill}\nprint(hit.normal.e)`;
  const expected=api.CalculatorInterface.get_damage_analysis(x,null).normal.expectation;
  const dsl=api.DSLInterface.run(source,x,x.artifacts);assert.equal(dsl.is_error,false,dsl.error_msg);near(Number(dsl.output.trim().replace(/^MONA: /,'')),expected);
  x.target_function={...x.target_function,use_dsl:true,dsl_source:source.replace('print(hit.normal.e)','result = hit.normal.e')};
  near(api.OptimizeSingleWasm.optimize(optimizer(x),gear)[0].value,expected);
 }
 for(const role of ['Vodyanitsa','Vesna'])for(const mode of [1,2]){const x=fixture(role);x.buffs=[{name:'AetherCryoTalent1',config:{AetherCryoTalent1:{atk:2000,radiance_mode:mode}}}];assert.ok(Number.isFinite(api.CalculatorInterface.get_damage_analysis(x,null).normal.expectation));assert.ok(api.OptimizeSingleWasm.optimize(optimizer(x),gear).length);}
}));

test('Set config aliases, changing candidates, filters and main/detail/curve branch consistency',()=>quiet(()=>{
 for(const name of ['Sandrone','YumemizukiMizuki']){
  const x=fixture(name,name==='Sandrone'?'SandroneStellarSwirl':'YumemizukiMizukiStellarSwirl');x.skill.index=name==='Sandrone'?18:14;
  x.artifacts=gear.map(a=>({...a,set_name:'HeartOfTheFurnace'}));x.artifact_config={config_heart_of_the_furnace:{rate:1}};
  const {artifact_config,...base}=x;const input=normalizeBonusInput({...base,tf:x.target_function,artifacts_config:artifact_config});
  const gain=api.BonusPerStat.bonus_per_stat(input);const before=api.CalculatorInterface.get_damage_analysis(x,null).direct_stellarswirl.expectation;
  const improved={...x,buffs:[{name:'ElementalMastery',config:{ElementalMastery:{value:23}}}]};const after=api.CalculatorInterface.get_damage_analysis(improved,null).direct_stellarswirl.expectation;
  near(gain.elemental_mastery[0],after/before-1);
 }
 const x=fixture('Kaeya');const high={...gear[2],id:6,main_stat:['ElementalMastery',187]};const saved=JSON.stringify(x);const filtered=api.OptimizeSingleWasm.optimize({...optimizer(x),filter:{sand_main_stat:['ElementalMastery']}},[...gear,high]);assert.equal(filtered[0].sand,6);assert.equal(JSON.stringify(x),saved);
 assert.equal(api.OptimizeSingleWasm.optimize({...optimizer(x),constraint:{set_mode:'Any',recharge_min:9}},gear).length,0);
 for(const [name,index,key]of [['Ineffa',11,'direct_moonelectro'],['Nefer',11,'direct_moonbloom'],['Zibai',13,'direct_mooncrystallize'],['Sandrone',5,'direct_stellarconduct']]){const y=fixture(name);y.skill.index=index;const r=api.CalculatorInterface.get_damage_analysis(y,null);assert.equal(defaultDamageReaction(r),key);assert.deepEqual(visibleDamageReactionKeys(r),[key]);}
 // Evaluate the actual detail component model to ensure it receives the same
 // result and keeps the standard multiplier before flat damage.
 let code=fs.readFileSync('src/components/display/DamageAnalysis/DamageAnalysis.vue','utf8').split('<script>')[1].split('</script>')[0].replace(/^import .*$/gm,'').replace('export default','return');
 const model=new Function('DamageAnalysisUtil','LEVEL_MULTIPLIER','damageReactionOptions','defaultDamageReaction',code)({},[],(r)=>visibleDamageReactionKeys(r).map(key=>({key,label:key})),defaultDamageReaction);
 const vm={...model.data(),enemyConfig:enemy,characterLevel:90};for(const [key,fn]of Object.entries(model.methods))vm[key]=fn.bind(vm);for(const [key,get]of Object.entries(model.computed))Object.defineProperty(vm,key,{get:()=>get.call(vm)});
 x.buffs=[{name:'IndependentDamageMultiplier',config:{IndependentDamageMultiplier:{p:150}}},{name:'BaseDmg',config:{BaseDmg:{value:500}}}];const result=api.CalculatorInterface.get_damage_analysis(x,null);vm.setValue(result);near(vm.selectedActualResult.expectation,result.normal.expectation);near(vm.damageNormal,result.normal.expectation);
}));

test('Remaining public interfaces and production optimization worker',async()=>{
 quiet(()=>{
  const x=fixture('Kaeya','MaxATK');const r=api.CalcArtifactBestSet.calc_artifact_best_set(optimizer(x));assert.ok(r.length);assert.ok(r.every(row=>Number.isFinite(row.value)));
  const t=api.TeamOptimizationWasm.optimize_team2({single_interfaces:[optimizer(x)],weights:[1],hyper_param:{mva_step:1,work_space:5,max_re_optimize:1,max_search:10,count:1}},gear);assert.equal(t.artifacts[0].length,1);
  const y=fixture('Vesna');const h=api.TeamOptimizationWasm.optimize_team2({single_interfaces:[optimizer(y)],weights:[1]},gear);assert.ok(h.artifacts.length);assert.equal(h.search_complete,true);
 });
 const x=fixture('Vesna');x.buffs=[namedBuff('AetherCryoTalent1')];const r=await probeCompiledOptimizer('dist',optimizer(x),gear);assert.equal(r.type,'results',JSON.stringify(r));assert.ok(r.data.results.length);near(r.data.results[0].value,quiet(()=>api.OptimizeSingleWasm.optimize(optimizer(x),gear)[0].value));
});

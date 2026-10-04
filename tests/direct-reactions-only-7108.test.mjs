import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse,compileScript,compileTemplate} from '@vue/compiler-sfc';
import {api,named} from '../beta-tools/runtime-7106.mjs';
import {fixture,optimizer,gear,chars,targets,buffs} from '../beta-tools/interface-audit-7108.mjs';
import {REMOVED_REACTION_KEYS,assertDirectReactionDsl} from '../beta-data/direct-reaction-scope.mjs';
import {calculateDirectLunarDamage} from '../beta-data/lunar-damage.mjs';
import {calculateSingleHit} from '../beta-data/single-hit-damage.mjs';
import {visibleDamageReactionKeys,damageReactionOptions} from '../src/algorithms/reaction-labels.mjs';
import {probeCompiledOptimizer} from '../beta-tools/compiled-worker-probe.mjs';
const near=(a,b,label='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
const quiet=fn=>{const log=console.log;console.log=()=>{};try{return fn()}finally{console.log=log}};
const damage=(x,index=x.skill.index)=>{const {target_function,tf,...input}=x;return api.CalculatorInterface.get_damage_analysis({...input,skill:{...input.skill,index}},null)};
const sourceResult=(source,x)=>{const r=api.DSLInterface.run(source+'\nprint(result)',x,x.artifacts);assert.equal(r.is_error,false,r.error_msg);return Number(r.output.trim().replace(/^MONA: /,''));};
const clean=r=>{for(const key of REMOVED_REACTION_KEYS){assert.equal(key in r,false,key);assert.equal(key in (r.reaction_availability||{}),false,key+' availability');}};

test('1 保留的技能直伤数值不变，所有角色公共接口不返回独立星月反应',()=>quiet(()=>{
 const baseline=JSON.parse(fs.readFileSync('.build-target/direct-only/baseline.json','utf8'));
 assert.equal(baseline.length,42);
 for(const row of baseline){const r=damage(row.input);clean(r);for(const [key,before]of Object.entries(row.direct))for(const field of ['expectation','critical','non_critical'])near(r[key]?.[field],before[field],row.input.character.name+'/'+row.input.skill.index+'/'+key+'/'+field);}
 for(const name of Object.keys(chars)){
  const x=fixture(name);clean(damage(x));const r=api.CalculatorInterface.get_transformative_damage(x);clean(r);
  for(const key of ['bloom','superconduct','swirl_cryo','crystallize'])assert.ok(Number.isFinite(r[key]));r.free();
 }
}));

test('2 移除的上下文、DSL 和配装选项均明确拒绝，保留目标按直伤配装',()=>quiet(()=>{
 const x=fixture('Kaeya');
 for(const key of ['stellar_swirl_context','lunar_crystallize_context','lunar_electro_context']){
  const retired={...x,[key]:{participants:[]}};
  for(const fn of [()=>api.CalculatorInterface.get_damage_analysis(retired,null),()=>api.DSLInterface.run('result = 1',retired,gear),()=>api.OptimizeSingleWasm.optimize(optimizer(retired),gear),()=>api.BonusPerStat.bonus_per_stat({...retired,tf:x.target_function}),()=>api.TeamOptimizationWasm.optimize_team2({single_interfaces:[retired]},gear)])assert.throws(fn,/已移除/);
 }
 for(const key of REMOVED_REACTION_KEYS){
  const source=`dmg hit = Kaeya.Normal1\nresult = hit.${key}.e`;
  assert.throws(()=>api.DSLInterface.run(source,x,gear),/已移除/);
  assert.throws(()=>api.OptimizeSingleWasm.optimize({...optimizer(x),target_function:{...x.target_function,use_dsl:true,dsl_source:source}},gear),/已移除/);
  assert.throws(()=>assertDirectReactionDsl(`dmg hit = Kaeya.Normal1\nresult = hit["${key}"]`),/已移除/);
 }
 assert.throws(()=>assertDirectReactionDsl('dmg hit = Kaeya.Normal1\nk = "moonelectro"\nresult = hit[k]'),/固定字段/);
 assertDirectReactionDsl('// hit.moonelectro\n/* hit.stellarswirl_cryo */\nprint("mooncrystallize")\ndmg hit = Kaeya.Normal1\nresult = hit.normal.e');
 assert.throws(()=>api.CalculatorInterface.get_damage_analysis({...x,buffs:[named('StellarSwirlReactionCryoBaseMultiplier',{value:1})]}),/已移除/);
 const mizuki=fixture('YumemizukiMizuki','YumemizukiMizukiStellarSwirl');mizuki.character.constellation=6;
 for(const mode of [2,3])assert.throws(()=>api.OptimizeSingleWasm.optimize({...optimizer(mizuki),target_function:{...mizuki.target_function,params:{YumemizukiMizukiStellarSwirl:{mode}}}},gear),/已移除/);
 for(const mode of [0,1]){
  mizuki.target_function.params.YumemizukiMizukiStellarSwirl.mode=mode;
  const expected=sourceResult(`dmg hit = YumemizukiMizuki.${mode?'C1StellarSwirl':'TalentStellarSwirl'}\nresult = hit.direct_stellarswirl.e`,mizuki);
  near(api.OptimizeSingleWasm.optimize(optimizer(mizuki),gear)[0].value,expected);
 }
 const ineffa=fixture('Ineffa');ineffa.enemy={level:150,electro_res:.6};
 const score=y=>damage(y,9).normal.expectation+damage(y,11).direct_moonelectro.expectation;
 for(const algorithm of ['Naive','AStar'])near(api.OptimizeSingleWasm.optimize({...optimizer(ineffa),algorithm},gear)[0].value,score(ineffa));
 const improved=structuredClone(ineffa);improved.artifacts[0].sub_stats.push(['ElementalMastery',23]);
 near(api.BonusPerStat.bonus_per_stat({...ineffa,tf:ineffa.target_function,artifacts_config:null}).elemental_mastery[0],score(improved)/score(ineffa)-1);
 const sandrone=fixture('Sandrone','SandroneStellarSwirl');near(api.OptimizeSingleWasm.optimize(optimizer(sandrone),gear)[0].value,damage(sandrone,18).direct_stellarswirl.expectation);
 const vesna=fixture('Vesna');vesna.character.params.Vesna.radiance=true;near(api.OptimizeSingleWasm.optimize(optimizer(vesna),gear)[0].value,damage(vesna,17).direct_stellarswirl.expectation);
}));

test('3 单次手填公式、列表与页面一致，移除的代码和菜单没有残留调用',()=>{
 for(const [kind,coefficient]of [['lunar-electro',3],['lunar-bloom',1],['lunar-crystallize',1.6]]){
  const input={kind,owner:{id:'owner',em:500,critRate:.5,critDamage:1},scalingStat:2000,skillMultiplier:2,flatBonus:700,elevation:.25,resistanceMultiplier:.9};
  near(calculateDirectLunarDamage(input).expectation,(4000*coefficient*2.2+700)*.9*1.25*1.5);
 }
 const hit=calculateSingleHit({kind:'stellar-swirl',element:'Anemo',character:{name:'YumemizukiMizuki'},panel:{ATK:2000,em:500,critRate:.5,critDamage:1},skillMultiplier:2,resistanceBeforeBuffs:.1});assert.ok(hit.expectation>0);
 const stale=Object.fromEntries(REMOVED_REACTION_KEYS.map(k=>[k,{expectation:9000}]));stale.normal={expectation:100};assert.deepEqual(visibleDamageReactionKeys(stale),['normal']);stale.direct_stellarswirl={expectation:200};assert.deepEqual(visibleDamageReactionKeys(stale),['direct_stellarswirl']);assert.deepEqual(damageReactionOptions(null),[]);
 assert.equal(buffs.StellarSwirlReactionCryoBaseMultiplier,undefined);assert.equal(targets.YumemizukiMizukiStellarSwirl.config[0].options.length,2);
 for(const path of ['src/pages/NewArtifactPlanPage/SingleHitPanel.vue','src/pages/ReactionCalculatorPage.vue','src/pages/NewArtifactPlanPage/LunarDamagePanel.vue','src/store/reaction-panel-context.js','beta-data/stellar-swirl-reaction.mjs','beta-data/moon-electro-team.mjs'])assert.equal(fs.existsSync(path),false,path);
 for(const path of ['src/router/router.js','src/pages/MainPage/SideBar.vue'])assert.doesNotMatch(fs.readFileSync(path,'utf8'),/reaction-calculator/);
 for(const path of ['src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue','src/pages/NewArtifactPlanPage/DamagePanel.vue','src/pages/NewArtifactPlanPage/BuffItem.vue','src/components/display/DamageAnalysis/DamageAnalysis.vue','src/pages/MainPage/SideBar.vue']){
  const {descriptor,errors}=parse(fs.readFileSync(path,'utf8'));assert.deepEqual(errors,[],path);const script=compileScript(descriptor,{id:path});assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:path,id:path,compilerOptions:{bindingMetadata:script.bindings}}).errors,[],path);
 }
});

test('4 构建后的真实配装 Worker 保留技能直伤并拒绝独立反应目标',async()=>{
 for(const role of ['YumemizukiMizuki','Sandrone','Vesna','Ineffa']){
  const target={YumemizukiMizuki:'YumemizukiMizukiStellarSwirl',Sandrone:'SandroneStellarSwirl'}[role];const x=fixture(role,target);if(role==='Vesna')x.character.params.Vesna.radiance=true;
  const result=await probeCompiledOptimizer('dist',optimizer(x),gear);assert.equal(result.type,'results',JSON.stringify(result));near(result.data.results[0].value,quiet(()=>api.OptimizeSingleWasm.optimize(optimizer(x),gear)[0].value),role);
 }
 const x=fixture('Kaeya');x.target_function={...x.target_function,use_dsl:true,dsl_source:'dmg hit = Kaeya.Normal1\nresult = hit.moonelectro.e'};
 const removed=await probeCompiledOptimizer('dist',optimizer(x),gear);assert.notEqual(removed.type,'results');assert.match(JSON.stringify(removed),/已移除/);
});

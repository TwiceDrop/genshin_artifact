import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse,compileScript,compileTemplate} from '@vue/compiler-sfc';
import {api,named} from '../../beta-tools/runtime.mjs';
import {fixture,optimizer,gear,chars,targets,buffs} from '../../beta-tools/interface-audit-7108.mjs';
import {REMOVED_REACTION_KEYS,assertDirectReactionDsl} from '../../beta-data/direct-reaction-scope.mjs';
import {calculateDirectLunarDamage} from '../../beta-data/lunar-damage.mjs';
import {calculateSingleHit} from '../../beta-data/single-hit-damage.mjs';
import {visibleDamageReactionKeys,damageReactionOptions} from '../../src/algorithms/reaction-labels.mjs';
import {probeCompiledOptimizer} from '../../beta-tools/compiled-worker-probe.mjs';
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
test('4 构建后的真实配装 Worker 保留技能直伤并拒绝独立反应目标',async()=>{
 for(const role of ['YumemizukiMizuki','Sandrone','Vesna','Ineffa']){
  const target={YumemizukiMizuki:'YumemizukiMizukiStellarSwirl',Sandrone:'SandroneStellarSwirl'}[role];const x=fixture(role,target);if(role==='Vesna')x.character.params.Vesna.radiance=true;
  const result=await probeCompiledOptimizer('dist',optimizer(x),gear);assert.equal(result.type,'results',JSON.stringify(result));near(result.data.results[0].value,quiet(()=>api.OptimizeSingleWasm.optimize(optimizer(x),gear)[0].value),role);
 }
 const x=fixture('Kaeya');x.target_function={...x.target_function,use_dsl:true,dsl_source:'dmg hit = Kaeya.Normal1\nresult = hit.moonelectro.e'};
 const removed=await probeCompiledOptimizer('dist',optimizer(x),gear);assert.notEqual(removed.type,'results');assert.match(JSON.stringify(removed),/已移除/);
});

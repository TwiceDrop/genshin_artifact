import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {api,read} from '../../beta-tools/runtime-7106.mjs';
import {fixture,gear,optimizer,namedBuff,runInterfaceAudit} from '../../beta-tools/interface-audit-7108.mjs';
import {normalizeBonusInput} from '../../beta-data/interface-contracts.mjs';
import {defaultDamageReaction,visibleDamageReactionKeys} from '../../src/algorithms/reaction-labels.mjs';
import {probeCompiledOptimizer} from '../../beta-tools/compiled-worker-probe.mjs';
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function quiet(fn){const log=console.log,error=console.error;console.log=()=>{};console.error=()=>{};try{return fn()}finally{console.log=log;console.error=error}}
const enemy={level:90,electro_res:.1,pyro_res:.1,hydro_res:.1,cryo_res:.1,geo_res:.1,anemo_res:.1,dendro_res:.1,physical_res:.1};

test('Remaining public interfaces and production optimization worker',async()=>{
 quiet(()=>{
  const x=fixture('Kaeya','MaxATK');const r=api.CalcArtifactBestSet.calc_artifact_best_set(optimizer(x));assert.ok(r.length);assert.ok(r.every(row=>Number.isFinite(row.value)));
  const t=api.TeamOptimizationWasm.optimize_team2({single_interfaces:[optimizer(x)],weights:[1],hyper_param:{mva_step:1,work_space:5,max_re_optimize:1,max_search:10,count:1}},gear);assert.equal(t.artifacts[0].length,1);
  const y=fixture('Vesna');const h=api.TeamOptimizationWasm.optimize_team2({single_interfaces:[optimizer(y)],weights:[1]},gear);assert.ok(h.artifacts.length);assert.equal(h.search_complete,true);
 });
 const x=fixture('Vesna');x.buffs=[namedBuff('AetherCryoTalent1')];const r=await probeCompiledOptimizer('dist',optimizer(x),gear);assert.equal(r.type,'results',JSON.stringify(r));assert.ok(r.data.results.length);near(r.data.results[0].value,quiet(()=>api.OptimizeSingleWasm.optimize(optimizer(x),gear)[0].value));
});

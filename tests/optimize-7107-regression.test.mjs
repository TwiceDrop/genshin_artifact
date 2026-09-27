import test from 'node:test';
import assert from 'node:assert/strict';
import {api,vesna,vody,read,sum} from '../beta-tools/runtime-7106.mjs';
import {runSingleOptimizeWorker} from '../src/wasm/single-optimize-task.mjs';
import {initializeSingleOptimizeWorker} from '../src/workers/single-optimize-handler.mjs';
import {probeCompiledOptimizer} from '../beta-tools/compiled-worker-probe.mjs';
const sets=['AubadeOfMorningstarAndMoon','HeavensGift','DisenchantmentInDeepShadow'];
const gear=read('beta-data/skirk-fixture.json').input.artifacts.map((a,i)=>({...a,id:i+1,set_name:'GladiatorsFinale'}));
const named=(name,p)=>({name,config:{[name]:p}});
const screenshotBuffs=[named('OdetteTalent1',{atk:2000,radiance_mode:2}),named('OdetteMarvelousSplendor',{stacks:4}),named('OdetteC2MarvelousSplendor',{stacks:4}),named('OdetteC2SoloDance',{radiance_mode:2}),named('FaruzanQ',{base_atk:650,q_level:6,rate_q1:1,rate_q2:1,rate_talent2:0,enable_c6:true}),...['VodyanitsaE','VodyanitsaA4','VodyanitsaA1'].map(n=>named(n,{hp:60000,constellation:0,e_level:10,on_field:true,ordinary_mode:false}))];
const input={...structuredClone(vesna),buffs:screenshotBuffs,weapon:{...vesna.weapon,params:{BeyondTheChrysalis:{loyal_rate:100,rebel_rate:0,plenty_rate:0,on_field:true}}},target_function:{name:'VesnaDefault',params:'NoConfig'},constraint:{set_mode:'Any',recharge_min:1},algorithm:'AStar'};
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),a+' != '+b);
const artifacts=set=>gear.map((a,i)=>({...a,set_name:i<4?set:'GladiatorsFinale'}));
const fake=()=>({sent:[],terminated:0,postMessage(x){this.sent.push(x)},terminate(){this.terminated++}});
test('1 截图配置：默认算法与候选套装复现',()=>{
 for(const set_name of sets){const candidates=[...gear,...gear.map((a,i)=>({...a,id:10+i,set_name}))];const result=api.OptimizeSingleWasm.optimize(input,candidates);assert.ok(result.length&&Number.isFinite(result[0].value));const ids=['flower','feather','sand','goblet','head'].map(k=>result[0][k]);const equipped=candidates.filter(a=>ids.includes(a.id));near(result[0].value,api.CalculatorInterface.get_damage_analysis({...input,artifacts:equipped}).direct_stellarswirl.expectation);}
 const obsidian=gear.map(a=>({...a,set_name:'ObsidianCodex'}));const warehouse=[...obsidian,...artifacts(sets[0]).map((a,i)=>({...a,id:20+i}))];const constrained=api.OptimizeSingleWasm.optimize({...input,constraint:{...input.constraint,set_mode:{Set4:'ObsidianCodex'}}},warehouse);assert.ok(constrained.length);assert.ok(['flower','feather','sand','goblet','head'].map(k=>constrained[0][k]).filter(id=>id<10).length>=4);
 const hydro={...structuredClone(vody),target_function:{name:'VodyanitsaDefault',params:'NoConfig'},algorithm:'AStar',constraint:null};assert.ok(api.OptimizeSingleWasm.optimize(hydro,artifacts(sets[0])).length);
 assert.throws(()=>api.OptimizeSingleWasm.optimize(input,artifacts('UnknownFutureSet')),/未适配/);
});
test('2 三套实际效果：精通、月曜作用域、充能、元素增伤与攻击条件暴击',()=>{
 const base={...structuredClone(input),buffs:[],artifacts:gear.map(a=>({...a,set_name:'Empty'}))};const baseline=api.CommonInterface.get_attribute(base);
 const dawn={...input,buffs:[],artifacts:artifacts(sets[0]),artifact_config:{config_aubade_of_morningstar_and_moon:{rate:0,is_ascendant_gleam:true}}};near(sum(api.CommonInterface.get_attribute(dawn).elemental_mastery)-sum(baseline.elemental_mastery),80);
 const low=api.CalculatorInterface.get_damage_analysis(dawn).direct_stellarswirl;dawn.artifact_config.config_aubade_of_morningstar_and_moon.rate=1;near(api.CalculatorInterface.get_damage_analysis(dawn).direct_stellarswirl.expectation,low.expectation);
 const gift={...input,buffs:[],artifacts:artifacts(sets[1]),artifact_config:{config_heavens_gift:{rate:1,is_completed_witch_homework:true,is_secret_arts:true,on_field_element:6}}};const panel=api.CommonInterface.get_attribute(gift);near(sum(panel.recharge)-sum(baseline.recharge),.2);near(sum(panel.bonus_anemo)-sum(baseline.bonus_anemo),.4);gift.artifact_config.config_heavens_gift.is_completed_witch_homework=false;near(sum(api.CommonInterface.get_attribute(gift).bonus_anemo)-sum(baseline.bonus_anemo),0);
 const shadow={...input,buffs:[],artifacts:artifacts(sets[2]),artifact_config:{config_disenchantment_in_deep_shadow:{rate:0}}};assert.ok(sum(api.CommonInterface.get_attribute(shadow).atk)>sum(baseline.atk));const off=api.CalculatorInterface.get_damage_analysis(shadow).direct_stellarswirl;shadow.artifact_config.config_disenchantment_in_deep_shadow.rate=.5;const on=api.CalculatorInterface.get_damage_analysis(shadow).direct_stellarswirl;near(on.non_critical,off.non_critical);near(on.expectation-off.expectation,(off.critical-off.non_critical)*.08);
 const faruzan={...base,buffs:[named('FaruzanQ',{base_atk:650,q_level:6,rate_q1:0,rate_q2:1,rate_talent2:0,enable_c6:true})]};const ordinary=api.CalculatorInterface.get_damage_analysis(base).direct_stellarswirl,boosted=api.CalculatorInterface.get_damage_analysis(faruzan).direct_stellarswirl;near(boosted.non_critical,ordinary.non_critical);near(boosted.critical-ordinary.critical,ordinary.non_critical*.4);
});
test('3 前端消息协议：详细错误、成功、线程故障、超时及结束清理',async()=>{
 let w=fake(),p=runSingleOptimizeWorker(w,input,gear,1000);w.onmessage({data:{type:'ready'}});w.onmessage({data:{type:'ready'}});assert.equal(w.sent.length,1);w.onmessage({data:{type:'error',error:{phase:'optimization',message:'候选中存在未适配套装：Example'}}});await assert.rejects(p,/Example/);assert.equal(w.terminated,1);assert.equal(w.onmessage,null);
 w=fake();p=runSingleOptimizeWorker(w,input,gear,1000);w.onmessage({data:{type:'results',data:{results:[{value:123}]}}});assert.deepEqual(await p,[{value:123}]);assert.equal(w.terminated,1);
 w=fake();p=runSingleOptimizeWorker(w,input,gear,1000);w.onerror({message:'Loading chunk 123 failed',preventDefault(){}});await assert.rejects(p,/chunk 123/);assert.equal(w.terminated,1);
 w=fake();p=runSingleOptimizeWorker(w,input,gear,1);await assert.rejects(p,/计算超时/);assert.equal(w.terminated,1);
 w=fake();w.postMessage=()=>{throw Error('DataCloneError')};p=runSingleOptimizeWorker(w,input,gear,1000);w.onmessage({data:{type:'ready'}});await assert.rejects(p,/DataCloneError/);assert.equal(w.terminated,1);
});
test('4 后台消息协议：加载失败及真实内核候选不足错误返回',async()=>{
 const messages=[],scope={postMessage:m=>messages.push(m)};await initializeSingleOptimizeWorker(scope,async()=>{throw Error('WASM fetch 404')});assert.equal(messages[0].type,'error');assert.equal(messages[0].error.phase,'initialization');assert.match(messages[0].error.message,/404/);
 messages.length=0;await initializeSingleOptimizeWorker(scope,async()=>api);assert.equal(messages[0].type,'ready');scope.onmessage({data:{optimizeConfig:input,artifacts:gear.slice(0,2)}});assert.equal(messages[1].type,'error');assert.match(messages[1].error.message,/不足五个部位/);scope.onmessage({data:{optimizeConfig:input,artifacts:gear}});assert.equal(messages[2].type,'results');assert.ok(messages[2].data.results.length);
});
test('5 构建后的真实Worker加载共享脚本及双WASM并返回结果或具体错误',async()=>{
 const dist=process.env.MONA_RELEASE_DIST||'D:/Documents/ChatGPT/v7.1.07-fix1/web/dist';const success=await probeCompiledOptimizer(dist,input,artifacts(sets[2]));assert.equal(success.type,'results',JSON.stringify(success));assert.ok(success.data.results.length);const fail=await probeCompiledOptimizer(dist,input,gear.slice(0,2));assert.equal(fail.type,'error',JSON.stringify(fail));assert.match(fail.error.message,/不足五个部位/);
});

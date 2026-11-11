import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDirectLunarDamage} from '../../beta-data/lunar-damage.mjs';
import {api,vody,vesna,read,named,sum} from '../../beta-tools/runtime.mjs';
import {createDamageEvaluator} from '../../src/algorithms/stat-gain/curve.mjs';
const clone=structuredClone;
const near=(a,b,message='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<Math.max(1e-7,Math.abs(b)*1e-9),`${message}: ${a} != ${b}`);
const damage=x=>api.CalculatorInterface.get_damage_analysis(x,null);
const team=()=>({baseBonus:0,resistanceMultiplier:1,participants:[
 {id:'geo',element:'Geo',levelBase:50,em:0,critRate:.5,critDamage:1,flatBonus:20},
 {id:'hydro',element:'Hydro',levelBase:75,em:0,critRate:0,critDamage:0},
]});


test('4 直接星扩散独立范围隔离，定额不乘I，原生配装同样生效',()=>{
 const input={...clone(vesna),weapon:{name:'DullBlade',level:1,ascend:false,refine:1,params:'NoConfig'},buffs:[named('VesnaSupport',{flat:500,base:0,bonus:0,crit_damage:0,elevation:.25,anemo_res:0})]};
 const base=damage(input).direct_stellarswirl;
 const ordinary=damage({...input,buffs:[...input.buffs,named('IndependentDamageMultiplier',{p:200,scope:0})]}).direct_stellarswirl;
 near(ordinary.expectation,base.expectation,'ordinary scope must not inherit');
 assert.throws(()=>damage({...input,buffs:[named('IndependentDamageMultiplier',{p:200,scope:1})]}),/仅适用于普通伤害/);
 const scoped={...input,buffs:[...input.buffs,named('StellarSwirlDamageMultiplier',{p:200})]};
 const changed=damage(scoped).direct_stellarswirl;
 near(changed.non_critical,(base.non_critical-500*.9*1.25)*2+500*.9*1.25,'flat remains outside I');
 const gear=read('beta-data/skirk-fixture.json').input.artifacts.map((a,i)=>({...a,id:i+1,set_name:'GladiatorsFinale'}));
 const optimized={...scoped,artifacts:gear,target_function:{name:'VesnaDefault',params:'NoConfig'},algorithm:'Naive',constraint:null,filter:null};
 near(api.OptimizeSingleWasm.optimize(optimized,gear)[0].value,damage(optimized).direct_stellarswirl.expectation);
});

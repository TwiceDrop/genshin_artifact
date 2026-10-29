import test from 'node:test';
import assert from 'node:assert/strict';
import {scalarMath} from '../beta-data/team-dps-numeric-rules.mjs';
import {createNumericProgram,executeNumericProgram,compactNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {runtimeHealingChain,singerClock} from './helpers/team-runtime-health.mjs';

const near=(actual,expected)=>{assert.equal(actual.length,expected.length);actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<=1e-10*Math.max(1,Math.abs(expected[i])),`${i}: ${v} != ${expected[i]}`));};
const a1Times=out=>out.observed.filter(e=>e.healing==='furina_a1'&&(e.enabled??1)).map(e=>e.time);

test('runtime-only overheal creates A1 children and their actual healing feeds Clam',()=>{
 const out=runtimeHealingChain(scalarMath,1);
 assert.deepEqual(a1Times(out),[3,5]);
 near(out.outputs,[1,.54,.64,.74,17,2,160,170,144]);
 assert.deepEqual(out.observed.filter(e=>e.category==='equipment').map(e=>e.time),[6]);
 const builder=createNumericProgram(),program=compactNumericProgram(builder.finish(runtimeHealingChain(builder.math,builder.input(0)).outputs));
 for(const gate of [0,1,0])near(executeNumericProgram(program,[gate]),runtimeHealingChain(scalarMath,gate).outputs);
 assert.deepEqual(a1Times(runtimeHealingChain(scalarMath,0)),[]);
});

test('A1 refresh keeps one cadence, handles same-time refresh, and respects the axis end',()=>{
 const options={times:[1,2,3],duration:8},out=runtimeHealingChain(scalarMath,1,options);
 assert.deepEqual(a1Times(out),[3,5,7]);
 const builder=createNumericProgram(),program=builder.finish(runtimeHealingChain(builder.math,builder.input(0),options).outputs);
 for(const gate of [0,1])near(executeNumericProgram(program,[gate]),runtimeHealingChain(scalarMath,gate,options).outputs);
 assert.deepEqual(a1Times(runtimeHealingChain(scalarMath,1,{duration:5,endHit:'include'})),[3,5]);
 assert.deepEqual(a1Times(runtimeHealingChain(scalarMath,1,{duration:5,endHit:'exclude'})),[3]);
 assert.deepEqual(a1Times(runtimeHealingChain(scalarMath,1,{times:[1,6],duration:10})),[3,5,8,10]);
});

test('Singer selects candidate-dependent frames and reevaluates HP at each actual tick',()=>{
 const actual=singerClock(scalarMath,10000,40000);
 assert.deepEqual(actual.observed.map(e=>e.singerFrame),[63,178,293,394]);
 const builder=createNumericProgram(),expanded=singerClock(builder.math,builder.input(0),builder.input(1)),program=compactNumericProgram(builder.finish(expanded.outputs));
 assert.ok(expanded.observed.length>actual.observed.length);
 for(const values of [[10000,40000],[20000,40000],[40000,10000],[10000,10000],[10000,40000]])near(executeNumericProgram(program,values),singerClock(scalarMath,...values).outputs);
});

test('Singer replacement excludes the old window boundary in scalar and numeric execution',()=>{
 const options={end:1.05},builder=createNumericProgram(),program=builder.finish(singerClock(builder.math,builder.input(0),40000,options).outputs);
 assert.deepEqual(singerClock(scalarMath,10000,40000,options).observed,[]);
 near(executeNumericProgram(program,[10000]),Array(421).fill(0));
});

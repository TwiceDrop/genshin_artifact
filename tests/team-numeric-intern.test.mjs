import test from 'node:test';import assert from 'node:assert/strict';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
test('node reuse preserves signed zero, NaN, operand order, arity and stochastic identity',()=>{
 const b=createNumericProgram(),a=b.input(0),c=b.input(1),d=b.input(2),m=b.math;
 for(const value of [0,-0,NaN,Infinity,-Infinity,1,Number.MIN_VALUE])assert.strictEqual(b.literal(value),b.literal(value));
 assert.notEqual(b.literal(0).index,b.literal(-0).index);assert.strictEqual(b.literal(true),b.literal(1));
 assert.strictEqual(b.input(0),a);assert.strictEqual(m.add(a,c),m.add(a,c));assert.notEqual(m.add(a,c).index,m.add(c,a).index);
 assert.strictEqual(m.abs(a),m.abs(a));assert.strictEqual(m.choose(a,c,d),m.choose(a,c,d));
 assert.strictEqual(m.min(a,c,d,4),m.min(a,c,d,4));
 assert.strictEqual(b.bernoulli('same',a),b.bernoulli('same',a));assert.notEqual(b.bernoulli('same',a).index,b.bernoulli('other',a).index);
 const p=b.finish([b.literal(-0),b.literal(0),b.literal(NaN),m.min(a,c,d,4),m.choose(a,c,d),m.sub(a,c)]);
 // Bernoulli nodes are tested for identity above; arithmetic execution uses
 // a separate builder because random lowering is a different public stage.
 const n=createNumericProgram(),x=n.input(0),y=n.input(1),z=n.input(2),program=n.finish([-0,0,NaN,n.math.min(x,y,z,4),n.math.choose(x,y,z),n.math.sub(x,y)]);
 const values=executeNumericProgram(program,[1,2,3]);assert.ok(Object.is(values[0],-0));assert.ok(Object.is(values[1],0));assert.ok(Number.isNaN(values[2]));assert.deepEqual(values.slice(3),[1,2,-1]);
 assert.equal(p.outputs.length,6);assert.notStrictEqual(n.literal(0),b.literal(0));
});

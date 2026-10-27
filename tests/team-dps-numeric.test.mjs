import test from 'node:test';
import assert from 'node:assert/strict';
import {createNumericProgram,executeNumericProgram,boundNumericProgram,intervalMath} from '../beta-data/team-dps-numeric-program.mjs';
import {createTeamNumericRules,teamNumericRules} from '../beta-data/team-dps-numeric-rules.mjs';

const output=(rules,x)=>[
 rules.healthChange(x[0],x[1],x[2]),
 rules.fanfareGain(x[3],x[4],x[5],x[6]),
 rules.fanfare(x[3],x[5],x[6]),rules.overflow(x[3],x[5],x[6]),
 ...Object.values(rules.healing(x[7],x[8],x[0],x[2])),
 rules.healAmount(x[7],x[9],x[10]),
 ...Object.values(rules.damage(x[7],x[9],.5,1.15,1,x[0],x[10])),
];
test('numeric: shared health, fanfare, healing and damage expressions preserve scalar values and enclose domains',()=>{
 const builder=createNumericProgram(),rules=createTeamNumericRules(builder.math);
 const program=builder.finish(output(rules,Array.from({length:11},(_,i)=>builder.input(i))));
 const domain=[[0,1],[-3000,6000],[10000,50000],[0,800],[0,.5],[0,6],[0,1],[0,30000],[0,10000],[0,1],[0,2]];
 const bound=boundNumericProgram(program,domain);
 let seed=71;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let i=0;i<1024;i++){
  const values=domain.map(([a,b])=>a+(b-a)*rand());values[5]=[0,1,2,6][i%4];values[6]=i%2;
  const expected=output(teamNumericRules,values),actual=executeNumericProgram(program,values);
  for(let k=0;k<expected.length;k++){
   assert.ok(Object.is(actual[k],expected[k]),`${i}/${k}`);
   assert.ok(bound[k][0]<=expected[k]&&expected[k]<=bound[k][1],`bound ${i}/${k}`);
  }
 }
});
test('numeric: zero constants and zero times an unbounded real interval retain their meanings',()=>{
 const p=createNumericProgram(),program=p.finish([p.literal(-0),p.literal(0)]),out=executeNumericProgram(program,[]);
 assert.equal(program.nodes.length,2);assert.ok(Object.is(out[0],-0));assert.ok(Object.is(out[1],0));
 assert.deepEqual(intervalMath.mul([0,0],[-Infinity,Infinity]),[0,0]);
 const positive=intervalMath.mul([0,1],[0,Infinity]);assert.ok(positive[0]<=0&&positive[1]===Infinity);
});

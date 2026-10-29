import test from 'node:test';import assert from 'node:assert/strict';
import {createNumericProgram,executeNumericProgram} from '../beta-data/team-dps-numeric-program.mjs';
import {lowerExpectedProgram} from '../beta-data/team-dps-expectation-program.mjs';
import {artifactProgramRow,teamProgramInputBounds} from '../beta-data/team-dps-program-inputs.mjs';
import {TEAM_DPS_SLOTS} from '../beta-data/team-dps-config.mjs';

test('artifact envelopes contain every slot combination and ordering, without role-filter assumptions',()=>{
 const stats=['HPFixed','ATKPercentage','CriticalRate'],sets=['A','B'];
 const pools=TEAM_DPS_SLOTS.map((slot,i)=>Array.from({length:3},(_,j)=>({id:10*i+j,slot,set_name:j===2?'B':'A',main_stat:[stats[(i+j)%3],[1e-8,1e5,.0331][j]],sub_stats:[[stats[(i+j+1)%3],.0993]]})));
 const bounds=teamProgramInputBounds(pools.flat(),stats,sets,4),stride=stats.length+sets.length;
 function permutations(items){if(!items.length)return [[]];return items.flatMap((item,i)=>permutations(items.filter((_,j)=>j!==i)).map(rest=>[item,...rest]));}
 const orders=permutations([0,1,2,3,4]);
 for(let choice=0;choice<3**5;choice++){
  let index=choice;const rows=pools.map(pool=>{const item=pool[index%3];index=Math.floor(index/3);return artifactProgramRow(item,stats,sets);});
  for(const order of orders){const value=new Float64Array(stride);for(const k of order)for(let f=0;f<stride;f++)value[f]+=rows[k][f];for(let f=0;f<stride;f++)assert.ok(value[f]>=bounds[f][0]&&value[f]<=bounds[f][1]);}
 }
 assert.equal(bounds.length,4*stride);assert.deepEqual(bounds.slice(0,stride),bounds.slice(stride,2*stride));
});
test('range pruning preserves exceptional values, signed zeros and exact boundary decisions',()=>{
 const b=createNumericProgram(),m=b.math,a=b.input(0),c=b.input(1),d=b.input(2);
 const nan=m.div(a,a),outputs=[m.min(a,c),m.max(a,c),m.choose(a,7,9),m.ge(nan,0),m.min(nan,2),m.choose(m.lt(c,d),m.div(1,a),nan)];
 const raw=b.finish(outputs),bounded=lowerExpectedProgram(raw,{inputBounds:[[-0,0],[-1,1],[0,2]]}).program;
 for(const x of [-0,0])for(const y of [-1,-0,0,1])for(const z of [0,1,2])assert.deepEqual(executeNumericProgram(bounded,[x,y,z]),executeNumericProgram(raw,[x,y,z]));
});
test('conservative arithmetic ranges never change seeded numeric graphs over their domain',()=>{
 const inputs=[[-2,2],[0,1],[-.01,.01],[1,3]],samples=[[-2,0,-.01,1],[2,1,.01,3],[0,0,0,2],[-0,1,-0,1]];
 for(let seed=1;seed<=32;seed++){
  let state=seed;const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  const b=createNumericProgram(),values=Array.from({length:4},(_,i)=>b.input(i)),ops=['add','sub','mul','div','min','max','lt','gt','ge','eq','choose','abs','floor'];
  for(let i=0;i<150;i++){const op=ops[next()%ops.length],n=op==='choose'?3:['abs','floor'].includes(op)?1:2;values.push(b.math[op](...Array.from({length:n},()=>values[next()%values.length])));}
  const raw=b.finish(values.slice(-20)),bounded=lowerExpectedProgram(raw,{inputBounds:inputs}).program;
  for(const sample of samples)assert.deepEqual(executeNumericProgram(bounded,sample),executeNumericProgram(raw,sample));
 }
});
test('proven clipping removes random state while crossing domains retain it',()=>{
 const b=createNumericProgram(),m=b.math,x=b.bernoulli('heal',.5),hp=b.input(0),heal=b.input(1),raw=b.finish([m.min(1,m.add(hp,m.mul(heal,m.add(1,x))))]);
 const clipped=lowerExpectedProgram(raw,{inputBounds:[[.95,.99],[.1,.2]]}),crossing=lowerExpectedProgram(raw,{inputBounds:[[.8,.99],[.01,.2]]});
 assert.deepEqual(executeNumericProgram(clipped.program,[.95,.1]),[1]);assert.ok(clipped.stats.outputNodes<crossing.stats.outputNodes);
 assert.ok(executeNumericProgram(crossing.program,[.8,.1])[0]<1);
});

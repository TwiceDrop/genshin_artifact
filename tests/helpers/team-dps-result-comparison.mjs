import assert from 'node:assert/strict';
// Numeric comparisons allow WASM accumulation roundoff; IDs/order stay exact.
export function compareTeamResults(actual,expected){
 assert.deepEqual(actual.artifacts,expected.artifacts);
 function visit(a,b,path){
  if(a===b)return;
  if(typeof a==='number'&&typeof b==='number'){
   assert.ok(Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(b)),`${path}: ${a} != ${b}`);
  }else if(a&&b&&typeof a==='object'&&typeof b==='object'){
   assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);
   for(const k of Object.keys(a))if(k!=='elapsed_ms')visit(a[k],b[k],path+'.'+k);
  }else assert.equal(a,b,path);
 }
 visit(actual,expected,'result');
}

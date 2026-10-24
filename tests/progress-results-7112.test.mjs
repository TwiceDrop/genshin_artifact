import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import fs from 'node:fs';
const out='.build-target/progress-results-7112';
test('7.1.12 progress copies preserve both kernels and search algorithms',()=>{
 const run=flag=>JSON.parse(execFileSync(process.execPath,['beta-tools/progress-parity-7112.mjs'],{env:{...process.env,MONA_PROGRESS:flag},encoding:'utf8'}));const before=run('0'),after=run('1');assert.equal(after.length,12);
 for(let i=0;i<after.length;i++){const a=after[i],b=before[i];assert.equal(a.results.length,b.results.length);for(let j=0;j<a.results.length;j++){assert.equal(a.results[j].ids,b.results[j].ids);assert.ok(Math.abs(a.results[j].value-b.results[j].value)<1e-8*Math.max(1,Math.abs(b.results[j].value)));}const p=a.records.at(-1);assert.ok(p.evaluated>0);assert.ok(p.visitedGroups<=p.totalGroups,JSON.stringify(a));assert.equal(p.remainingGroups,0);assert.equal(p.percent,100);}
 fs.writeFileSync(out+'/parity.json',JSON.stringify(after,null,2));
});

import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';
import {onboardingInput} from './helpers/team-onboarding-input.mjs';
import {compareEventValues} from './helpers/team-dps-result-comparison.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-11*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('one test-only package covers delays, periodic damage, healing and three effects in fresh native/graph Workers',async()=>{
 const input=onboardingInput(),execute=graph=>new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./helpers/team-recipe-registration-worker.mjs',import.meta.url),{workerData:{input,graph,full:true,repeat:true,permutations:!graph}});let result;
  worker.once('message',value=>{result=value;});worker.once('error',reject);worker.once('exit',code=>code||!result?reject(Error('Worker exited '+code)):resolve(result));
 });
 const native=await execute(false),compiled=await execute(true);assert.equal(native.permutations,24);assert.deepEqual(native.registered.map(a=>a.id),['normal.1','skill','burst']);assert.deepEqual(compiled.registered,native.registered);
 for(let i=0;i<2;i++){for(const k of ['expectation','critical','non_critical','duration','fanfare'])near(compiled.results[i][k],native.results[i][k]);compareEventValues(compiled.results[i].eventTrace,native.results[i].eventTrace);}
 for(const output of [native,compiled])assert.deepEqual(output.results[2],output.results[0]);
 const r=native.results[0];assert.deepEqual(r.hits.filter(e=>e.role===3).map(e=>e.time),[.2,1.5,2,2.5]);assert.equal(r.heals.length,1);assert.equal(r.heals[0].time,.25);assert.deepEqual(r.heals[0].healedRecipients,[0,1,2,3]);assert.ok(r.heals[0].healingAmount>0);
 const effects=r.effects.filter(e=>e.effectId.startsWith('test.onboard.'));assert.deepEqual(effects.filter(e=>e.kind==='activate').map(e=>[e.effectId,e.time,e.expires]),[['test.onboard.fixed',0,3],['test.onboard.conversion',.25,5.25],['test.onboard.limited',1,4]]);
 assert.deepEqual(effects.filter(e=>e.kind==='consume').map(e=>[e.time,e.before,e.used,e.after]),[[1.5,2,2,0]]);
 assert.ok(native.results[1].expectation>r.expectation);assert.ok(native.results[1].heals[0].healingAmount>r.heals[0].healingAmount);assert.equal(characterPackages.Kaeya,undefined);
});

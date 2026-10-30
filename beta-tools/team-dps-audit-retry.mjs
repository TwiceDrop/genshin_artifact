// Re-evaluate error rows in fresh WASM instances. Crescent Pike's invalid enum
// panics before scoring; repeated panics can poison the instance's allocator.
// Original failures stay on disk. Each Pike case gets its own native instance.
import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
const dir='.build-target/team-dps-full-audit',roles=['Skirk','Furina','Escoffier','Vodyanitsa'];
const key=r=>[r.role,r.weapon,r.refine,r.cons,r.mode,r.set].join('/');
const all=fs.readdirSync(dir).filter(n=>/^matrix-\d+\.jsonl$/.test(n)).flatMap(n=>fs.readFileSync(`${dir}/${n}`,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)));
const failures=all.filter(r=>r.error||r.issues?.length),groups=new Map(),pikes=[];
for(const r of failures){const row={role:roles.indexOf(r.role),weapon:r.weapon,refine:r.refine,cons:r.cons,mode:r.mode,setNames:[r.set]};if(r.weapon==='CrescentPike'){pikes.push(row);continue;}const k=[r.role,r.weapon,r.refine,r.cons,r.mode].join('/');if(groups.has(k))groups.get(k).setNames.push(r.set);else groups.set(k,row);}
const work=[...groups.values()],count=6,progress={};
const spawn=(shard,prefix,selected)=>new Promise((resolve,reject)=>{const w=new Worker(new URL('./team-dps-full-audit.mjs',import.meta.url),{workerData:{shard,prefix,selected}});w.on('message',m=>{progress[prefix+'/'+shard]=m;});w.on('error',reject);w.on('exit',code=>code?reject(Error('worker exit '+code)):resolve());});
console.log(JSON.stringify({original:all.length,retryRows:failures.length,pikeRows:pikes.length,normalJobs:work.length}));
const timer=setInterval(()=>{const done=Object.values(progress).reduce((n,r)=>n+r.done,0);console.log(JSON.stringify({retryDone:done,total:failures.length}));},10000);
await Promise.all(Array.from({length:count},(_,shard)=>spawn(shard,'retry',work.filter((_,i)=>i%count===shard))));
let next=0;await Promise.all(Array.from({length:count},async()=>{while(next<pikes.length){const i=next++;await spawn(i,'isolated-pike',[pikes[i]]);}}));
clearInterval(timer);
const merged=new Map(all.map(r=>[key(r),r]));
for(const name of fs.readdirSync(dir).filter(n=>/^(retry|isolated-pike)-\d+\.jsonl$/.test(n)))for(const line of fs.readFileSync(`${dir}/${name}`,'utf8').trim().split('\n').filter(Boolean)){const r=JSON.parse(line);merged.set(key(r),r);}
fs.writeFileSync(`${dir}/final-matrix.jsonl`,[...merged.values()].map(r=>JSON.stringify(r)).join('\n')+'\n');
const summary={cases:merged.size,retried:failures.length,pikeIsolated:pikes.length,failures:[...merged.values()].filter(r=>r.error||r.issues?.length).length,hits:[...merged.values()].reduce((n,r)=>n+(r.hits||0),0)};
fs.writeFileSync(`${dir}/final-matrix-summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));

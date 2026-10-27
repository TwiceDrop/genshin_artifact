// Local synthetic audit. No account, UID, preset, or user inventory input.
import fs from 'node:fs';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {fixture,weapon,chars,weapons,sets} from './interface-audit-7108.mjs';
import {api} from './runtime-7106.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-config.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {defaultWeaponOptions} from '../beta-data/team-dps-weapon-options.mjs';
const directory='.build-target/team-dps-full-audit';
const mainStats=JSON.parse(fs.readFileSync('src/import/data/good-main-stat.json','utf8'));
export const axis=JSON.parse(fs.readFileSync('examples/team-dps/skirk-vodyanitsa-20_5.mona-axis.json','utf8'));
export const allSets=Object.values(sets),fullSets=allSets.filter(s=>s.flower);
export const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
export const close=(a,b)=>Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(b));
const fields=['Flower','Feather','Sand','Goblet','Head'],slots=['flower','feather','sand','cup','head'];
const names={hp:'HPFixed',atk:'ATKFixed','hp_':'HPPercentage','atk_':'ATKPercentage','cryo_dmg_':'CryoBonus','hydro_dmg_':'HydroBonus','heal_':'HealingBonus','critDMG_':'CriticalDamage','critRate_':'CriticalRate','enerRech_':'Recharge',eleMas:'ElementalMastery'};
export function gear(role,setName='GladiatorsFinale',variation=0){
 const chosen=allSets.find(s=>s.name2===setName),keys=['hp','atk',role===1||role===3?'hp_':'atk_',role===0?'cryo_dmg_':role===1?'hydro_dmg_':role===2?'atk_':'hp_',role===2?'heal_':role===3?'hp_':'critDMG_'];
 return fields.map((slot,k)=>{
  // Four-piece + off-piece. Prayer circlets occupy only the head slot.
  const off=allSets.find(s=>s.name2===(setName==='NoblesseOblige'?'GladiatorsFinale':'NoblesseOblige'));
  const part=chosen.flower?(k<4?chosen:off):(k===4?chosen:allSets.find(s=>s.name2==='GladiatorsFinale')),star=part.maxStar,level=star*4;
  const subKeys=['critRate_','critDMG_','enerRech_',role===3?'atk_':'hp_'].filter(x=>x!==keys[k]);if(subKeys.length===3)subKeys.push('eleMas');
  const rolls=star===5?[3,2,2,2]:star===4?[2,2,2,1]:[2,1,1,1];
  const unit={critRate_:.0331,critDMG_:.0662,enerRech_:.0551,'atk_':.0496,'hp_':.0496,eleMas:19.82},scale=star===5?1:star===4?.8:.6;
  return {id:10000+role*100+k+variation*100000,set_name:part.name2,slot,star,level,main_stat:[names[keys[k]],mainStats[star][keys[k]][level]],sub_stats:subKeys.map((name,i)=>[names[name],unit[name]*scale*rolls[i]])};
 });
}
export function sample(){
 const p=TEAM_DPS_ROLES.map((name,r)=>{const x=fixture(name);x.artifacts=gear(r);if(weapons[x.weapon.name].star<3)x.weapon.level=70;return x;});
 return {single_interfaces:p,team_dps:{axis:structuredClone(axis),enemy:{level:100,cryo_res:.1,hydro_res:.1,physical_res:.3},initial_ids:p.map(x=>x.artifacts.map(a=>a.id)),weapon_conditions:p.map(()=>defaultWeaponOptions()),result_count:5,max_evaluations:100,metric:'expectation'}};
}
export const builds=x=>x.single_interfaces.map(p=>p.artifacts);
export const run=x=>createTeamDpsEvaluator(api,x).evaluate(builds(x),true);
export function reconstruct(d,level,enemy){
 const base=(sum(d.atk)*sum(d.atk_ratio)+sum(d.hp)*sum(d.hp_ratio)+sum(d.def)*sum(d.def_ratio)+sum(d.em)*sum(d.em_ratio))*(1+sum(d.independent_damage_multiplier))+sum(d.atk)*sum(d.atk_additive_ratio)+sum(d.extra_damage);
 const defense=d.ignore_defense?1:(level+100)/(level+100+(enemy.level+100)*(1-Math.min(.9,sum(d.def_minus)))*(1-Math.min(1,sum(d.def_penetration))));
 const resistance=enemy[d.element.toLowerCase()+'_res']-sum(d.res_minus),res=resistance<0?1-resistance/2:resistance<.75?1-resistance:1/(1+4*resistance);
 const n=base*(1+sum(d.bonus))*defense*res*(d.event_probability??1)*(d.target_count??1),cr=Math.min(1,Math.max(0,sum(d.critical))),cd=sum(d.critical_damage);
 return {non_critical:n,critical:n*(1+cd),expectation:n*(1+cr*cd)};
}
export function inspect(out){
 const issues=[];
 for(const k of ['expectation','critical','non_critical']){
  if(!Number.isFinite(out[k])||out[k]<0)issues.push('total:'+k);
  if(!close(out[k],out.hits.reduce((n,h)=>n+h[k],0)))issues.push('sum:'+k);
  if(!close(out[k],out.character_damage.reduce((n,h)=>n+h[k],0)))issues.push('roleSum:'+k);
 }
 if(!close(out.dps,out.expectation/20.5))issues.push('dps');
 for(const h of out.hits){
  let calculated;
  if(h.branches){calculated={non_critical:0,critical:0,expectation:0};for(const b of h.branches){const a=reconstruct(b.analysis,out.profiles[h.role].character.level,out.enemy);for(const k of Object.keys(a))calculated[k]+=a[k]*b.probability;}}
  else calculated=reconstruct(h.analysis,out.profiles[h.role].character.level,out.enemy);
  for(const k of Object.keys(calculated))if(!close(calculated[k],h[k])){issues.push(`detail:${h.role}/${h.time}/${h.label}/${k}/${calculated[k]}/${h[k]}`);break;}
  if(h.critical+1e-7<h.expectation||h.expectation+1e-7<h.non_critical)issues.push('ordering:'+h.label);
 }
 return [...new Set(issues)];
}
const once=new Set(['CursedBlade','PrizedIsshinBlade','SwordOfDescension','Predator']);
export const refinements=n=>weapons[n].star<3||once.has(n)?[1]:[1,2,3,4,5];
export function jobs(){
 const out=[];
 for(let r=0;r<4;r++)for(const w of Object.values(weapons).filter(w=>w.type===chars[TEAM_DPS_ROLES[r]].weapon)){
  for(const refine of refinements(w.name))out.push({role:r,weapon:w.name,refine,cons:0,mode:'cross',setNames:allSets.map(s=>s.name2)});
  out.push({role:r,weapon:w.name,refine:refinements(w.name).at(-1),cons:6,mode:'cross',setNames:allSets.map(s=>s.name2)});
  for(let cons=1;cons<6;cons++)out.push({role:r,weapon:w.name,refine:refinements(w.name).at(-1),cons,mode:'intermediate',setNames:['GladiatorsFinale','EchoesOfAnOffering','OceanHuedClam','ScrollOfTheHeroOfCinderCity','FragmentOfHarmonicWhimsy']});
 }
 return out;
}
async function worker(){
 const prefix=workerData.prefix??'matrix',output=`${directory}/${prefix}-${workerData.shard}.jsonl`,failures=[];let done=0,hits=0,buffer='';fs.writeFileSync(output,'');
 const selected=workerData.selected??jobs().filter((_,i)=>i%workerData.count===workerData.shard),start=performance.now();
 for(const job of selected){
  const x=sample();x.single_interfaces[job.role].weapon=weapon(job.weapon);x.single_interfaces[job.role].weapon.refine=job.refine;
  if(weapons[job.weapon].star<3)x.single_interfaces[job.role].weapon.level=70;
  if(job.cons===6)for(const p of x.single_interfaces)p.character.constellation=6;else x.single_interfaces[job.role].character.constellation=job.cons;
  const original=JSON.stringify(x),evaluator=createTeamDpsEvaluator(api,x);
  for(const set of job.setNames){
   const b=builds(x);b[job.role]=gear(job.role,set,allSets.findIndex(s=>s.name2===set)+1);
   let record={role:TEAM_DPS_ROLES[job.role],weapon:job.weapon,refine:job.refine,cons:job.cons,mode:job.mode,set};
   try{const out=evaluator.evaluate(b,true),issues=inspect(out);hits+=out.hits.length;record={...record,expectation:out.expectation,critical:out.critical,non_critical:out.non_critical,hits:out.hits.length,issues};if(issues.length)failures.push(record);}
   catch(error){record.error=error.stack;failures.push(record);}
   buffer+=JSON.stringify(record)+'\n';done++;
   if(done%100===0){fs.appendFileSync(output,buffer);buffer='';parentPort.postMessage({shard:workerData.shard,done,hits,failures:failures.length,ms:performance.now()-start});}
  }
  if(JSON.stringify(x)!==original)throw Error('Audit input changed: '+JSON.stringify(job));
 }
 fs.appendFileSync(output,buffer);
 fs.writeFileSync(`${directory}/${prefix}-failures-${workerData.shard}.json`,JSON.stringify(failures,null,2));
 parentPort.postMessage({shard:workerData.shard,done,hits,failures:failures.length,ms:performance.now()-start,complete:true});
}
async function main(){
 const count=Number(process.env.AUDIT_WORKERS||6),work=jobs(),total=work.reduce((n,j)=>n+j.setNames.length,0),progress={};fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(`${directory}/manifest.json`,JSON.stringify({axis:axis.id,revision:axis.revision,total,jobs:work.length,legalRoleWeapons:220,weaponNames:160,sets:63,workers:count,refinements:'all legal refinement levels; C0, all-C6; C1-C5 on five mechanism sets'},null,2));
 console.log(JSON.stringify({total,jobs:work.length,workers:count}));
 const timer=setInterval(()=>{const v=Object.values(progress);console.log(JSON.stringify({done:v.reduce((n,x)=>n+x.done,0),total,hits:v.reduce((n,x)=>n+x.hits,0),failures:v.reduce((n,x)=>n+x.failures,0)}));fs.writeFileSync(`${directory}/progress.json`,JSON.stringify(progress,null,2));},10000);
 await Promise.all(Array.from({length:count},(_,shard)=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:{shard,count}});w.on('message',m=>{progress[shard]=m;});w.on('error',reject);w.on('exit',code=>code?reject(Error('Worker '+shard+' exit '+code)):resolve());})));
 clearInterval(timer);fs.writeFileSync(`${directory}/matrix-summary.json`,JSON.stringify(progress,null,2));console.log(JSON.stringify({complete:true,progress}));
}
if(!isMainThread)await worker();else if(process.argv.includes('--matrix'))await main();

import {createTeamDpsEvaluator,sum} from './team-dps-evaluator.mjs';
import {TEAM_DPS_SLOTS as slots} from './team-dps-config.mjs';
import {teamDpsArtifactAvailable} from './team-dps-equipment-support.mjs';
import {createTeamConstraintBounds} from './team-dps-constraint-bounds.mjs';
const teamKey=team=>team.flatMap(b=>b.map(a=>a.id)).join(',');
const entries=team=>team.map(b=>Object.fromEntries(b.map(a=>[a.slot.toLowerCase(),a.id])));
function createSearch(api,evaluator,input,artifacts,onProgress){
 const settings=input.team_dps,profiles=evaluator.profiles;
 const limit=settings.result_count,budget=settings.max_evaluations,metric=settings.metric||'expectation';
 const catalog=new Map(artifacts.map(a=>[a.id,a])),bySlot=slots.map(slot=>artifacts.filter(a=>teamDpsArtifactAvailable(a.set_name)&&a.slot===slot&&!a.omit&&a.level>=(settings.minimum_artifact_level??0)));
 const mainAllowed=(r,a)=>{const k={Sand:'sand_main_stat',Goblet:'goblet_main_stat',Head:'head_main_stat'}[a.slot],list=profiles[r].filter?.[k];return !list?.length||list.includes(a.main_stat[0]);};
 const pools=profiles.map((_,r)=>bySlot.map(pool=>pool.filter(a=>mainAllowed(r,a))));
 const initial=profiles.map(()=>[]);
 for(let k=0;k<slots.length;k++){
  const owners=new Map(),ordered=pools.map((p,r)=>[...p[k]].sort((a,b)=>Number(b.id===settings.initial_ids[r]?.[k])-Number(a.id===settings.initial_ids[r]?.[k])));
  function assign(r,visited){
   for(const a of ordered[r]){
    if(visited.has(a.id))continue;visited.add(a.id);
    const owner=owners.get(a.id);
    if(owner===undefined||assign(owner,visited)){owners.set(a.id,r);initial[r][k]=a;return true;}
   }
   return false;
  }
  for(const r of [0,1,2,3].sort((a,b)=>ordered[a].length-ordered[b].length))
   if(!assign(r,new Set()))throw Error('圣遗物不足以为四人分配不同装备：'+profiles[r].character.name+'/'+slots[k]);
 }
 function constraintDistance(team,panels){
  let distance=0;
  for(let r=0;r<4;r++){
   const b=team[r],p=profiles[r],c=p.constraint||{},counts={};
   for(const a of b)counts[a.set_name]=(counts[a.set_name]||0)+1;
   const mode=c.set_mode;
   if(mode?.Set4)distance+=Math.max(0,4-(counts[mode.Set4]||0))/4;
   if(mode?.Set22)for(const set of mode.Set22)distance+=Math.max(0,2-(counts[set]||0))/2;
   const panel=panels[r];
   for(const [stat,field]of [['recharge','recharge_min'],['critical','crit_min'],['critical_damage','crit_damage_min'],['elemental_mastery','em_min']])
    if(c[field]>0)distance+=Math.max(0,c[field]-sum(panel[stat]))/c[field];
  }
  return distance;
 }
 let evaluated=0,scheduled=0,feasibleTeams=0,lastProgress=0,visitedNodes=0,prunedNodes=0,completed=false;const started=performance.now(),seen=new Set(),found=[],beam=[];
 const possible=pools.flat().reduce((n,p)=>n*p.length,1),exact=possible<=budget;
 const branching=exact||settings.search_algorithm==='branch_bound';
 const planned=exact?possible:budget;
 let bounds,pruneCandidates=false;
 function prepareBounds(){
  if(!bounds){progress(false,'bounds');bounds=createTeamConstraintBounds(api,input,pools,()=>progress(false,'bounds'));}
  return bounds;
 }
 // Independent WASM instances can differ in the last floating-point bits.
 // Quantize only ranking keys; retain full-precision damage and use IDs for ties.
 const rank=value=>Number(value.toPrecision(12));
 const sort=(a,b)=>rank(b.value)-rank(a.value)||a.key.localeCompare(b.key);
 function progress(done=false,phase='search'){const now=performance.now();if(!done&&now-lastProgress<250)return;lastProgress=now;
  onProgress({phase:done?'complete':phase,evaluated_teams:evaluated,total_teams:planned,remaining_teams:done?0:Math.max(0,planned-evaluated),feasible_teams:feasibleTeams,retained_results:found.length,visited_nodes:visitedNodes,pruned_nodes:prunedNodes,elapsed_ms:now-started,eta_ms:done?0:!branching&&evaluated?(planned-evaluated)*(now-started)/evaluated:null,best_damage:found[0]?.result[metric]??null});}
 function* submit(team){
  if(scheduled>=budget)return;
  const key=teamKey(team);if(seen.has(key))return;seen.add(key);
  if(pruneCandidates){
   visitedNodes++;
   if(!bounds.feasible(team.map(b=>b.map(a=>[a])))){prunedNodes++;progress();return;}
  }
  scheduled++;
  yield {key,team:team.map(b=>[...b])};
 }
 function accept(job,result){
  evaluated++;
   const row={...job,value:result[metric],distance:constraintDistance(job.team,result.panels),result};
   // Feasibility comes first: ER/set repairs may lower damage before a legal build exists.
   beam.push(row);beam.sort((a,b)=>rank(a.distance)-rank(b.distance)||sort(a,b));if(beam.length>8)beam.length=8;
   if(row.distance===0){feasibleTeams++;found.push(row);found.sort(sort);if(found.length>limit)found.length=limit;}
  progress();return row;
 }
 function exchange(team,r,slot,item){
  const next=team.map(b=>[...b]),owner=next.findIndex(b=>b[slot].id===item.id);
  if(owner===r)return;
  if(owner>=0){const old=next[r][slot];if(!mainAllowed(owner,old))return;next[owner][slot]=old;}
  next[r][slot]=item;return next;
 }
 function* enumerate(){
  pruneCandidates=false;
  const bounds=prepareBounds(),selected=profiles.map(()=>[]),used=new Set();let cutOff=false;
  const variables=profiles.flatMap((p,r)=>slots.map((_,k)=>({r,k,size:pools[r][k].length,priority:Number(!!p.constraint?.set_mode?.Set4)+Number(!!p.constraint?.set_mode?.Set22)}))).sort((a,b)=>a.size-b.size||b.priority-a.priority||a.r-b.r||a.k-b.k);
  function* walk(n){
   visitedNodes++;progress();
   const domains=pools.map((row,r)=>row.map((pool,k)=>selected[r][k]?[selected[r][k]]:pool.filter(a=>!used.has(a.id))));
   if(!bounds.feasible(domains)){prunedNodes++;return;}
   if(n===20){
    if(seen.has(teamKey(selected)))return;
    if(scheduled>=budget){cutOff=true;return;}
    yield* submit(selected);return;
   }
   const {r,k}=variables[n];
   for(const a of domains[r][k]){
    used.add(a.id);selected[r][k]=a;yield* walk(n+1);selected[r][k]=undefined;used.delete(a.id);
    if(cutOff)return;
   }
  }
  yield* walk(0);completed=!cutOff;
 }
 function* heuristic(){
  const quality=a=>a.sub_stats.reduce((n,[k,v])=>n+(k==='CriticalRate'?v*2:k==='CriticalDamage'?v:k==='ATKPercentage'||k==='HPPercentage'?v:0),0)+(['ATKPercentage','HPPercentage','CryoBonus','HydroBonus','CriticalRate','CriticalDamage','Recharge'].includes(a.main_stat[0])?a.main_stat[1]:0);
  // Whole set moves and exchanges are scored with all four builds together.
  const setNames=[...new Set(bySlot.flat().map(a=>a.set_name))];
  for(const set of setNames)for(let r=0;r<4&&scheduled<budget;r++)for(let off=0;off<5&&scheduled<budget;off++){
   let next=initial.map(b=>[...b]);
   for(let k=0;k<5;k++)if(k!==off){const a=pools[r][k].filter(a=>a.set_name===set).sort((a,b)=>quality(b)-quality(a))[0];if(a)next=exchange(next,r,k,a)||next;}
   yield* submit(next);
  }
  // Merge all scores before choosing the next beam seed.
  yield null;
  const expanded=new Set();
  while(scheduled<budget){
   const seed=beam.find(row=>!expanded.has(row.key));if(!seed)break;expanded.add(seed.key);
   // Use the automatic search's seed and candidate order. Once all retained
   // seeds are feasible, an infeasible candidate cannot enter either the seed
   // beam or top K. Freeze that decision for the whole parallel phase.
   pruneCandidates=branching&&beam.length===8&&beam.every(row=>row.distance===0);
   if(pruneCandidates)prepareBounds();
   for(let k=0;k<5&&scheduled<budget;k++)for(const a of bySlot[k])for(let r=0;r<4&&scheduled<budget;r++){
    if(!mainAllowed(r,a))continue;const next=exchange(seed.team,r,k,a);if(next)yield* submit(next);
   }
   yield null;
  }
 }
 function* candidates(){
  yield* submit(initial);
  if(exact)yield* enumerate();
  else{
   yield* heuristic();
   if(branching&&scheduled<budget)yield* enumerate();
  }
 }
 function baseline(){
  const current=settings.initial_ids.map(ids=>ids.map(id=>catalog.get(id)));
  return current.every(b=>b.length===5&&b.every(a=>a&&teamDpsArtifactAvailable(a.set_name)))?evaluator.evaluate(current,true):null;
 }
 function finish(baseline){
 if(!found.length)throw Error('本次联合搜索未找到满足四人配装限制的组合；已评估 '+evaluated+' 组');
 progress(true);
 const results=found.map(row=>({...row.result,artifacts:entries(row.team)}));
 results[0]={...evaluator.evaluate(found[0].team,true),artifacts:entries(found[0].team)};
 return {results,baseline,
  artifacts:found.map(row=>entries(row.team)),evaluated_teams:evaluated,feasible_teams:feasibleTeams,legal_teams:completed?feasibleTeams:null,evaluation_budget:budget,search_complete:completed,elapsed_ms:performance.now()-started,metric,
  ...(branching?{search_stats:{visited_nodes:visitedNodes,pruned_nodes:prunedNodes}}:{})};
 }
 return {candidates,accept,baseline,finish};
}
export function optimizeTeamDps(api,input,artifacts,onProgress=()=>{}){
 const evaluator=createTeamDpsEvaluator(api,input),search=createSearch(api,evaluator,input,artifacts,onProgress),baseline=search.baseline();
 for(const job of search.candidates())if(job)search.accept(job,evaluator.evaluate(job.team));
 return search.finish(baseline);
}
export async function optimizeTeamDpsParallel(api,input,artifacts,evaluateBatch,batchSize,onProgress=()=>{}){
 const evaluator=createTeamDpsEvaluator(api,input),search=createSearch(api,evaluator,input,artifacts,onProgress),baseline=search.baseline();
 let pending=[];
 async function flush(){
  if(!pending.length)return;
  const jobs=pending;pending=[];
  const results=await evaluateBatch(jobs.map(job=>job.team.map(b=>b.map(a=>a.id))));
  for(let i=0;i<jobs.length;i++)search.accept(jobs[i],results[i]);
 }
 for(const job of search.candidates()){
  if(job)pending.push(job);
  if(!job||pending.length===batchSize)await flush();
 }
 await flush();
 return search.finish(baseline);
}
export function evaluateTeamDps(api,input,artifacts){
 const catalog=new Map(artifacts.map(a=>[a.id,a]));
 const builds=input.team_dps.initial_ids.map(ids=>slots.map((_,k)=>catalog.get(ids[k])));
 const result=createTeamDpsEvaluator(api,input).evaluate(builds,true);
 return {results:[{...result,artifacts:entries(builds)}],baseline:result,artifacts:[entries(builds)],evaluated_teams:1,search_complete:true,elapsed_ms:0,metric:input.team_dps.metric};
}

import {normalizeTeamProfiles,createCharacterRules} from './registry.mjs';
import {compileActionAxis} from './timeline.mjs';
import {scalarMath} from '../team-dps-numeric-rules.mjs';
import {createTeamDpsEvaluator} from '../team-dps-evaluator.mjs';

// Display coverage is the union of a buff's active intervals. In particular,
// separate usage pools remain independent in combat, but share one display bar.
// Call separately for each probabilistic outcome so branches never get joined.
export function mergeBuffCoverage(windows){
 const groups=new Map();
 for(const window of windows){
  if(window.end<=window.start)continue;
  const key=JSON.stringify([window.role,window.key]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(window);
 }
 return [...groups.values()].flatMap(rows=>{
  const merged=[];
  for(const row of rows.sort((a,b)=>a.start-b.start)){
   const last=merged.at(-1);
   if(last&&row.start<=last.end)last.end=Math.max(last.end,row.end);
   else merged.push({...row});
  }
  return merged;
 });
}
export function createBuffWindowPreview(api,axis,rawProfiles){
 const profiles=normalizeTeamProfiles(rawProfiles),rotation=compileActionAxis(axis,profiles);
 const charactersRules=createCharacterRules(profiles,()=>rotation,scalarMath,{});
 const elements=charactersRules.rules.map(rule=>rule.element);
 const describe=(row,window=row)=>({...row,details:charactersRules.rules[row.role].previewBuffDetails?.(row.key,{profile:profiles[row.role],window,elements,api})??[]});
 const windows=Object.entries(rotation.windows).flatMap(([key,rows])=>rows.filter(w=>w.enabled!==0&&w.end>w.start&&!charactersRules.rules[w.role].previewWindowEffects?.[key]).map(w=>describe({key,role:w.role,start:w.start,end:w.end},w)));
 if(!axis.timeline.length)return windows;
 windows.push(...mergeBuffCoverage(charactersRules.instances.flatMap(instance=>instance.previewWindows?.()??[])).map(row=>describe(row)));
 const result=createTeamDpsEvaluator(api,{single_interfaces:rawProfiles,team_dps:{axis,enemy:{level:100},enemy_count:1,damage_scope:'single'}}).evaluate(rawProfiles.map(()=>[]),true);
 const outcomes=result.trace_outcomes??[{output:result,probability:1,label:''}];
 for(const outcome of outcomes){
  const active=new Map(),effectWindows=[];
  for(const change of outcome.output.effects){
   if(!change.enabled)continue;
   const previous=active.get(change.instanceKey);
   if(change.kind==='activate'){
    if(previous)previous.end=Math.min(previous.end,change.time);
    const row={key:change.effectId,label:change.label,role:change.role,start:change.time,end:change.expires,probability:outcome.probability};effectWindows.push(row);active.set(change.instanceKey,row);
   }else if(change.kind==='consume'&&change.after===0&&previous)previous.end=Math.min(previous.end,change.time);
  }
  const grouped=[];
  for(const row of effectWindows){
   const group=Object.entries(charactersRules.rules[row.role].previewWindowEffects??{}).find(([,definition])=>definition.effects.includes(row.key));
   if(group)grouped.push({...row,key:group[0],label:group[1].label});
   else if(row.end>row.start)windows.push(describe(row));
  }
  windows.push(...mergeBuffCoverage(grouped).map(row=>describe(row)));
 }
 return windows;
}

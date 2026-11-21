import {actionTime} from './rule-utils.mjs';
import {TEAM_ACTION_CATALOG} from './action-catalog.mjs';
// Editor precision: convert the measured 60fps clock to tenths of a second.
export const castDurationMs=frames=>Math.round(frames/6)*100;
export function usesPrimaryTime(axis,row,profiles){
 if(!row.when)return true;
 const role=axis.members.findIndex(m=>m.slot===(row.when.slot??row.actor));
 return (profiles?.[role].character.constellation??0)>=row.when.constellationAtLeast;
}
export function actionAxisTimeline(c,profiles){
 return c.timeline.flatMap((a,order)=>{
  if(!a.when)return [{...a,order}];
  const timeMs=usesPrimaryTime(c,a,profiles)?a.timeMs:a.when.otherwiseTimeMs;
  return timeMs===undefined?[]:[{...a,timeMs,order}];
 }).sort((a,b)=>a.timeMs-b.timeMs||a.order-b.order);
}
export function actionAxisMaxDurationMs(c,profiles,completions){
 const members=new Map(c.members.map(m=>[m.slot,m.character]));let end=0;
 const ordered=actionAxisTimeline(c,profiles);
 for(const a of ordered){
  if(a.kind==='switch'){end=Math.max(end,a.timeMs);continue;}
  const timing=TEAM_ACTION_CATALOG[members.get(a.actor)].find(x=>x.id===a.action);
  // Expand against an upper bound; character modules supply actual endings
  // after resolving resources and mode. An early guess can drop valid hits.
  const offset=timing.completionOffsetMs?timing.completionOffsetMs(a.params):timing.endOffsetMs??0;
  end=Math.max(end,completions?.get(a.id)??a.timeMs+offset);
 }
 return actionTime(end/1000)*1000;
}

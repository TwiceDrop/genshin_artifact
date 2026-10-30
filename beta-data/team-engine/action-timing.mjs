import {actionTime} from './rule-utils.mjs';
import {TEAM_ACTION_CATALOG} from './action-catalog.mjs';
export function actionAxisTimeline(c,profiles){
 const slots=c.members.map(m=>m.slot);
 return c.timeline.map((a,order)=>({...a,order})).filter(a=>!a.when||(profiles?.[slots.indexOf(a.when.slot??a.actor)].character.constellation??0)>=a.when.constellationAtLeast).sort((a,b)=>a.timeMs-b.timeMs||a.order-b.order);
}
export function actionAxisMaxDurationMs(c,profiles,completions){
 const members=new Map(c.members.map(m=>[m.slot,m.character]));let end=0;
 const ordered=actionAxisTimeline(c,profiles);
 for(const a of ordered){
  if(a.kind==='switch'){end=Math.max(end,a.timeMs);continue;}
  const timing=TEAM_ACTION_CATALOG[members.get(a.actor)].find(x=>x.id===a.action);
  // Expand against an upper bound; character modules supply actual endings
  // after resolving resources and mode. An early guess can drop valid hits.
  const offset=timing.bubbleInput?(a.params?.bubbleDelayMs??8000)+timing.endOffsetMs:timing.endOffsetMs??0;
  end=Math.max(end,completions?.get(a.id)??a.timeMs+offset);
 }
 return actionTime(end/1000)*1000;
}

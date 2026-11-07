import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export function historyAxis(name,gate,{remove=false}={}){
 return (...args)=>{
  const r=compileActionAxis(...args),catalyst=['DawningFrost','NightweaversLookingGlass','SerenitysCall'].includes(name);
  const hit=r.events.find(e=>catalyst?e.eventId==='probe/skill':name==='KeyOfKhajNisut'||name==='PaleFlame'?e.role===1&&e.category==='skill'&&e.onField:e.eventId==='p0/normal.2');
  if(!hit)throw Error('Missing synthetic history contact: '+name);
  if(remove)r.events=r.events.filter(e=>e!==hit);else hit.enabled=gate;
  return r;
 };
}

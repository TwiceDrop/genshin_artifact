import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export const gatedWeaponAxis=(gate,{remove=false}={})=>(...args)=>{
 const rotation=compileActionAxis(...args),first=rotation.events.find(e=>e.eventId==='n0/normal.1');
 if(!first)throw Error('Missing synthetic first weapon contact');
 if(remove)rotation.events=rotation.events.filter(e=>e!==first);else first.enabled=gate;
 return rotation;
};

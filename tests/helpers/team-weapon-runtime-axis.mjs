import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export const gatedWeaponAxis=(gate,{remove=false}={})=>(...args)=>{
 const rotation=compileActionAxis(...args);
 // Skirk emits normals from its combat plugin; other fixtures expand them statically.
 const field=rotation.runtimeRoles.includes(rotation.roots.find(e=>e.id==='n0').role)&&args[1][rotation.roots.find(e=>e.id==='n0').role].character.name==='Skirk'?'roots':'events';
 const first=rotation[field].find(e=>field==='roots'?e.id==='n0':e.eventId==='n0/normal.1');
 if(!first)throw Error('Missing synthetic first weapon contact');
 if(remove)rotation[field]=rotation[field].filter(e=>e!==first);else first.enabled=gate;
 return rotation;
};

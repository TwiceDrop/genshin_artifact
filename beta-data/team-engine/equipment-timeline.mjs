export function equipmentTimeline(profiles,rotation){
 for(let role=0;role<profiles.length;role++)if(profiles[role].weapon.name==='PrototypeAmber'){
  for(const c of rotation.roots.filter(e=>e.role===role&&e.kind==='cast'&&e.action==='burst'))for(const offset of [2,4,6]){
   const time=c.time+offset;
   if(time<rotation.duration||(time===rotation.duration&&rotation.endHit==='include'))rotation.heals.push({...c,time,rootOrder:c.rootOrder+.5,kind:'heal',healing:'prototype_amber',recipients:profiles.map((_,i)=>i)});
  }
 }
}

import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
// Synthetic facts isolate resource/pickup contracts. A resource-only cast is
// not a product feature for conditionally executing an entire character action.
export function equipmentFactsAxis(name,gate,{remove=false}={}){
 return (...args)=>{
  const r=compileActionAxis(...args),add=e=>r.roots.push({...e,id:e.eventId});
  let target;
  if(['Azurelight','MistsplitterReforged','FinaleOfTheDeepGalleries'].includes(name)){
   target={kind:'cast',action:'burst',role:1,time:.5,rootOrder:50,order:0,eventId:'resource-only-cast',enabled:gate};add(target);
  }else if(name.startsWith('leaf-')){
   const role=name==='leaf-pickup'?0:2;
   const reaction={kind:'reaction',reaction:'Bloom',role,time:.25,rootOrder:25,order:0,eventId:'reaction1',enabled:name==='leaf-generate'?gate:1};add(reaction);
   add({kind:'reaction',reaction:'Bloom',role,time:.75,rootOrder:75,order:0,eventId:'reaction2'});
   const pickup={kind:'pickup',item:'leaf',source:r.slots[role],role:0,time:.5,rootOrder:50,order:0,eventId:'pickup1',enabled:name==='leaf-pickup'?gate:1};add(pickup);
   add({kind:'pickup',item:'leaf',source:r.slots[role],role:1,time:1,rootOrder:99,order:0,eventId:'pickup2'});
   target=name==='leaf-generate'?reaction:pickup;
  }else{
   target=r.events.find(e=>name==='KitainCrossSpear'?e.role===2&&e.category==='skill':e.eventId==='n1/normal.1');
   if(!target)throw Error('Missing synthetic fact contact: '+name);target.enabled=gate;
  }
  if(remove){r.events=r.events.filter(e=>e!==target);r.roots=r.roots.filter(e=>e.eventId!==target.eventId);}
  return r;
 };
}

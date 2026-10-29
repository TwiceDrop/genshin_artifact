import {characterPackages} from './character-packages.mjs';
import {actionTime} from './rule-utils.mjs';
import {eventKey,compareEvents} from './event-order.mjs';

export function createCharacterCombat(profiles,plan,{math:m,observeHit,refresh}){
 const windows={...plan.windows},providers=new Map(),completions=new Map(plan.combatCompletions);
 const rotation={...plan,windows,events:plan.events.map(e=>({...e}))};let current=rotation,enqueue,serial=plan.events.length;
 const known=new Map(rotation.events.map(e=>[eventKey(e),e])),plugins=new Map();
 rotation.covered=(key,time,rootOrder)=>providers.has(key)?providers.get(key).covered(time,rootOrder):plan.covered(key,time,rootOrder);
 const hit=(a,template,offset=0,suffix='',phase=20)=>{
  const time=actionTime(a.time+offset);
  for(let part=0;part<(template.hits??template.parts??1);part++)enqueue({...template,kind:'hit',time,role:a.role,
   rootOrder:a.rootOrder+phase,part:template.part??part,eventId:a.id+'/'+suffix,parentEventId:eventKey(a),runtimeHit:true});
 };
 for(const role of plan.runtimeRoles){
  const profile=profiles[role];let plugin;
  plugin=characterPackages[profile.character.name].createCombat({role,profile,profiles,math:m,activeRole:plan.activeRole,window:plan.window,covered:rotation.covered,windows,hit,observeHit,
   enqueue:e=>enqueue(e.kind==='hit'?{...e,runtimeHit:true}:e),
   addWindow(key,a,life,offset=0,values={}){
    if(!providers.has(key)){windows[key]=[];providers.set(key,plugin);}
    const w={start:actionTime(a.time+offset),end:actionTime(a.time+offset+life),rootOrder:a.rootOrder,role,...values};
    windows[key].push(w);return w;
   },
   complete(action,time){completions.set(action.id,time);current.duration=[...completions.values()].reduce((end,value)=>m.max(end,value),plan.combatDurationFloor);},
  });if(plugin)plugins.set(role,plugin);
 }
 const subscribers=[...plugins].sort(([a],[b])=>profiles[a].character.name.localeCompare(profiles[b].character.name));
 return {
  rotation,bind:next=>{current=next;},
  prepare(event,put){
   enqueue=put;
   if(event.kind==='hit'){
    const variants=event.characterPrepared?undefined:plugins.get(event.role)?.prepareHit?.(event);
    // Native formulas need concrete variants; the owner advances its state once.
    // Each alternative carries its own numeric existence gate and contact identity.
    if(variants){
     const key=eventKey(event);known.delete(key);current.events=current.events.filter(e=>eventKey(e)!==key);refresh(current);
     return variants.map(e=>({...e,characterPrepared:true,runtimeHit:true,eventKey:undefined,eventId:event.eventId+'/variant/'+e.variant,contactId:key}));
    }
    event.onField=plan.activeRole(event.time,event.rootOrder)===event.role;
    const character=characterPackages[profiles[event.role].character.name];
    event.element??=character.hitElement?.(event)??character.element;
    const row=known.get(eventKey(event));
    if(row){const changed=row.element!==event.element||row.enabled!==event.enabled||row.probability!==event.probability;Object.assign(row,event);if(changed)refresh(current);}
    else if(event.runtimeHit){
     known.set(eventKey(event),event);event.order??=serial++;event.serial=event.order;current.events.push(event);current.events.sort(compareEvents);refresh(current);
    }
   }else for(const [,plugin]of subscribers)plugin.onEvent?.(event);
  },
  after(event,put){enqueue=put;for(const [,plugin]of subscribers){if(event.kind==='hit')plugin.onHit?.(event);plugin.afterEvent?.(event);}},
 };
}

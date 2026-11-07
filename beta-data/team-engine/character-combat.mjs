import {characterPackages} from './character-packages.mjs';
import {actionTime} from './rule-utils.mjs';
import {eventKey,compareEvents} from './event-order.mjs';
import {createReactionEmitter} from './reaction-events.mjs';
import {createElementalRuntime} from './elemental-runtime.mjs';
import {triggersHit} from './damage-contract.mjs';

export function createCharacterCombat(profiles,plan,{math:m,observeHit,refresh,settings,random,readStat}){
 const windows={...plan.windows},providers=new Map(),completions=new Map(plan.combatCompletions);
 let followupEnd=-Infinity;
 const rotation={...plan,windows,events:plan.events.map(e=>({...e})),resources:[...(plan.resources??[])],reactionFacts:[...(plan.reactionFacts??[])]};let current=rotation,enqueue,serial=plan.events.length;
 const known=new Map(rotation.events.map(e=>[eventKey(e),e])),plugins=new Map();
 const emitReaction=createReactionEmitter({actorIds:plan.slots,settings,math:m,observeHit,enqueue:e=>enqueue(e),initialFacts:rotation.reactionFacts,
  record:fact=>{current.reactionFacts.push(fact);refresh(current);}});
 const reactions=createElementalRuntime({actorIds:plan.slots,actorElements:profiles.map(p=>characterPackages[p.character.name].element),settings,math:m,observeHit,emitReaction,stellarEnabled:profiles.some(p=>characterPackages[p.character.name].enablesStellarConduct),replacesStellarPrism:profiles.some(p=>characterPackages[p.character.name].replacesStellarPrism),stellarSwirlEnabled:profiles.some(p=>characterPackages[p.character.name].element==='Anemo')&&profiles.some(p=>characterPackages[p.character.name].enablesStellarSwirl),enqueue:e=>enqueue(e.kind==='hit'?{...e,runtimeHit:true}:e)});
 rotation.reactionAt=e=>reactions.at(e);
 rotation.characterState=(role,event)=>plugins.get(role)?.stateAt?.(event);
 rotation.elementalTargets=profiles.some(p=>characterPackages[p.character.name].usesElementalApplications)||plan.events.some(e=>e.application?.gauge>0);
 rotation.covered=(key,time,rootOrder)=>providers.has(key)?providers.get(key).covered(time,rootOrder,key):plan.covered(key,time,rootOrder);
 const hit=(a,template,offset=0,suffix='',phase=20)=>{
  const time=actionTime(a.time+offset);
  for(let part=0;part<(template.hits??template.parts??1);part++){
   const e={...template,kind:'hit',time,role:a.role,rootOrder:a.rootOrder+phase,part:template.part??part,eventId:a.id+'/'+suffix,parentEventId:eventKey(a),runtimeHit:true,...(!template.persistent?{completionRoot:a.completionRoot??a.id}:{})};
   if(e.variant){e.contactId=eventKey(e);e.eventId+='/variant/'+e.variant;}
   enqueue(e);
  }
 };
 for(const role of plan.runtimeRoles){
  const profile=profiles[role];let plugin;
  plugin=characterPackages[profile.character.name].createCombat({role,profile,profiles,roots:plan.roots,math:m,settings,reactions,actorIds:plan.slots,emitReaction,activeRole:plan.activeRole,window:plan.window,covered:rotation.covered,windows,hit,observeHit,
   random,readStat,recordResource:row=>current.resources.push(row),
   enqueue:e=>enqueue(e.kind==='hit'?{...e,runtimeHit:true}:e),
   addWindow(key,a,life,offset=0,values={}){
    if(!providers.has(key)){windows[key]=[];providers.set(key,plugin);}
    const w={start:actionTime(a.time+offset),end:actionTime(a.time+offset+life),rootOrder:a.rootOrder,role,...values};
    windows[key].push(w);return w;
   },
   complete(action,time){completions.set(action.id,time);current.duration=[...completions.values()].reduce((end,value)=>m.max(end,value),m.max(plan.combatDurationFloor,followupEnd));},
  });if(plugin)plugins.set(role,plugin);
 }
 const subscribers=[...plugins].sort(([a],[b])=>profiles[a].character.name.localeCompare(profiles[b].character.name));
 return {
  rotation,bind:next=>{current=next;},
  followup(event){if(!event.followup||event.completionRoot===undefined)return;followupEnd=m.max(followupEnd,m.choose(event.enabled??1,event.time,-Infinity));current.duration=m.max(current.duration,followupEnd);},
  prepare(event,put){
   enqueue=put;
   for(const [,plugin]of subscribers)plugin.beforeEvent?.(event);
   reactions.prepare(event);
   if(event.kind==='hit'){
    const variants=event.characterPrepared||!triggersHit(event)?undefined:plugins.get(event.role)?.prepareHit?.(event);
    // Native formulas need concrete variants; the owner advances its state once.
    // Each alternative carries its own numeric existence gate and contact identity.
    if(variants){
     const key=eventKey(event);known.delete(key);current.events=current.events.filter(e=>eventKey(e)!==key);refresh(current);
     return variants.map(e=>({...e,characterPrepared:true,runtimeHit:true,eventKey:undefined,eventId:event.eventId+'/variant/'+e.variant,contactId:key}));
    }
    event.onField=plan.activeRole(event.time,event.rootOrder)===event.role;
    const character=characterPackages[profiles[event.role].character.name];
    event.element??=character.hitElement?.(event)??character.element;
    if(triggersHit(event)&&character.isBlunt)event.blunt??=character.isBlunt(event);
    const row=known.get(eventKey(event));
    if(row){const changed=row.element!==event.element||row.enabled!==event.enabled||row.probability!==event.probability;Object.assign(row,event);if(changed)refresh(current);}
    else if(event.runtimeHit){
     known.set(eventKey(event),event);const ordinal=serial++;event.order??=ordinal;event.serial=ordinal;
     // Initial hits are sorted and scheduler delivery only inserts new hits.
     // Keep that order without re-sorting the entire growing reaction history.
     let low=0,high=current.events.length;
     while(low<high){const mid=(low+high)>>1;if(compareEvents(current.events[mid],event)<=0)low=mid+1;else high=mid;}
     current.events.splice(low,0,event);
     // Equipment histories observe contacts, not transformative tick damage.
     // The rotation itself is shared; only the contact-derived cache needs rebuilding.
     if(triggersHit(event))refresh(current);
    }
   }else for(const [,plugin]of subscribers)plugin.onEvent?.(event);
  },
  after(event,put){enqueue=put;reactions.after(event);for(const [,plugin]of subscribers){if(triggersHit(event))plugin.onHit?.(event);plugin.afterEvent?.(event);}},
 };
}

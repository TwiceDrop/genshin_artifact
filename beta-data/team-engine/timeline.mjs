import {characterRules} from './registry.mjs';
import {chronological,actionTime} from './rule-utils.mjs';
import {equipmentTimeline} from './equipment-timeline.mjs';
import {actionAxisMaxDurationMs,actionAxisTimeline} from './action-timing.mjs';
import {createEventScheduler} from './scheduler.mjs';
import {compareEvents,eventKey} from './event-order.mjs';
import {createReactionEmitter} from './reaction-events.mjs';

// An action is expanded by its installed character rule. This scheduler knows
// only event times, ownership, expiry, hit parts and the active party member.
export function compileActionAxis(c,profiles,settings={},execution={}){
 const slots=c.members.map(m=>m.slot),roots=[],events=[],heals=[],hpDrains=[],windows={},states={},resources=[],reactionFacts=[];
 let duration=actionTime(actionAxisMaxDurationMs(c,profiles)/1000);
 const inside=t=>actionTime(t)<duration||(actionTime(t)===duration&&c.endHit==='include');
 actionAxisTimeline(c,profiles).forEach(a=>{
  const role=slots.indexOf(a.actor);
  // A terminal cast still exists when its final hit is excluded from scoring.
  if(actionTime(a.timeMs/1000)>duration)return;
  roots.push({...a,actionId:a.action,eventId:a.id,kind:a.kind==='switch'?'switch':'action',time:actionTime(a.timeMs/1000),role,rootOrder:a.order*100});
 });
 roots.sort(chronological);
 const switches=[];let previous=slots.indexOf(c.initialActiveSlot);
 // Commands require the acting character on field. Persistent hits never
 // enter this list, so summons and delayed attacks keep their real owner.
 for(const a of [...roots]){
  if(a.kind==='switch')a.from=previous;
  if(a.role===previous)continue;
  const s=a.kind==='switch'?a:{id:a.id+'/switch',eventId:a.id+'/switch',kind:'switch',implicit:true,time:a.time,role:a.role,rootOrder:a.rootOrder-.5,from:previous};
  switches.push(s);if(s!==a)roots.push(s);previous=a.role;
 }
 roots.sort(chronological);
 const occurred=(e,t,o=Infinity)=>e.time<t||(e.time===t&&e.rootOrder<=o);
 const activeRole=(t,o)=>switches.filter(e=>occurred(e,t,o)).at(-1)?.role??slots.indexOf(c.initialActiveSlot);
 const casts=roots.filter(e=>e.kind==='action'&&['skill','burst'].includes(e.action.split('.')[0]));casts.forEach(e=>{e.kind='cast';e.castAction=e.action.split('.')[0];e.action=e.castAction;});
 const castTimes=action=>profiles.map((_,r)=>casts.filter(e=>e.role===r&&e.castAction===action).map(e=>e.time));
 const lastCast=(r,action,t,o)=>Math.max(-Infinity,...casts.filter(e=>e.role===r&&e.castAction===action&&occurred(e,t,o)).map(e=>e.time));
 const entered=(t,o)=>switches.filter(e=>occurred(e,t,o)).at(-1)?.time??0;
 const pending=[];let scheduler,hitOrder=0;
 // A bounded owner timer may finish its window metadata beyond the scoring
 // horizon. Damage remains clipped; resource diagnostics are trimmed below.
 const enqueue=e=>{if(e.time<=duration||e.kind==='timer'&&e.finalizePlan){if(scheduler){if(e.kind==='hit')e.order??=hitOrder++;scheduler.enqueue(e);}else pending.push(e);}};
 const emitReaction=createReactionEmitter({actorIds:slots,settings,enqueue,record:fact=>reactionFacts.push(fact)});
 function hit(a,template,offset=0,suffix='',phase=20){
  const time=actionTime(a.time+offset);if(!inside(time))return;
  for(let part=0;part<(template.hits??template.parts??1);part++){
   const e={...template,kind:'hit',time,role:a.role,rootOrder:a.rootOrder+phase,part:template.part??part,eventId:a.id+'/'+suffix,parentEventId:eventKey(a),label:template.label};
   if(e.variant){e.contactId=eventKey(e);e.eventId+='/variant/'+e.variant;}
   enqueue(e);
  }
 }
 function heal(a,offset,recipients,healing,phase=10,suffix='heal/'+offset){
  const time=actionTime(a.time+offset);if(!inside(time))return;
  heals.push({kind:'heal',time,role:a.role,rootOrder:a.rootOrder+phase,eventId:a.id+'/'+suffix,recipients:recipients==='team'?profiles.map((_,i)=>i):[activeRole(time,a.rootOrder+phase)],...(healing?{healing}:{})});
 }
 function periodic(a,{duration:life,start,interval,offsetAt},emit){
  const next=casts.find(e=>e.role===a.role&&e.castAction===a.castAction&&chronological(e,a)>0)?.time??Infinity;
  for(let i=0;;i++){
   const offset=offsetAt?offsetAt(i):Math.round((start+i*interval)*1000)/1000,t=actionTime(a.time+offset);
   if(offset>=life||!inside(t)||t>=next)break;emit(offset,Math.min(next,actionTime(a.time+life)));
  }
 }
 const addWindow=(key,a,life,offset=0,values={})=>{const w={start:actionTime(a.time+offset),end:actionTime(a.time+offset+life),rootOrder:a.rootOrder,role:a.role,...values};(windows[key]??=[]).push(w);return w;};
 const state=(key,init)=>states[key]??=(typeof init==='function'?init():init);
 const ruleContexts=profiles.map((profile,role)=>({profile,role,profiles,settings,duration,roots,heals,hpDrains,windows,switches,resources,actorIds:slots,emitReaction,activeRole,lastCast,hit,heal,periodic,addWindow,state,enqueue,actions:roots.filter(e=>e.role===role&&e.kind!=='switch')}));
 for(const ctx of ruleContexts)characterRules[ctx.profile.character.name].expand(ctx);
 const window=(key,t,o=Infinity)=>{
  const list=windows[key]||[],active=w=>t<w.end||t===w.end&&o<(w.endOrder??-Infinity);
  return list.findLastIndex(w=>(t>w.start||t===w.start&&w.rootOrder<=o)&&active(w));
 };
 // A later command cannot make its window visible to an earlier same-tick hit.
 const covered=(key,t,o=Infinity)=>window(key,t,o)>=0;
 // Each hit is prepared only by its owner, then becomes a fact visible to all
 // subscribers. Newly emitted hits re-enter this queue, including chains
 // produced by a character registered after their consumer.
 const runtimeRoles=execution.runtime?profiles.flatMap((p,r)=>characterRules[p.character.name].createCombat?[r]:[]):[];
 const plugins=ruleContexts.map(ctx=>runtimeRoles.includes(ctx.role)?undefined:characterRules[ctx.profile.character.name].createTimeline?.({...ctx,window,covered}));
 const subscribers=profiles.map((p,role)=>({id:p.character.name,plugin:plugins[role]})).sort((a,b)=>a.id.localeCompare(b.id));
 // Seed the same stable original-hit order used by candidate execution before
 // callbacks emit children. A causal child's inherited order must survive.
 for(const e of pending.filter(e=>e.kind==='hit').sort(compareEvents))e.order??=hitOrder++;
 scheduler=createEventScheduler([...roots,...pending]);
 for(const e of scheduler.events()){
  if(e.kind==='hit'){
   plugins[e.role]?.prepareHit?.(e);
   e.onField=e.role===activeRole(e.time,e.rootOrder);
   e.element??=characterRules[profiles[e.role].character.name].hitElement?.(e)??characterRules[profiles[e.role].character.name].element;
   events.push(e);
   for(const {plugin}of subscribers)plugin?.onHit?.(e);
  }else for(const {plugin}of subscribers)plugin?.onEvent?.(e);
 }
 const completions=new Map(roots.filter(a=>a.completionTime!==undefined).map(a=>[a.id,a.completionTime*1000]));
 if(completions.size){
  duration=actionTime(actionAxisMaxDurationMs(c,profiles,completions)/1000);
  for(const list of [events,heals,hpDrains])for(let i=list.length-1;i>=0;i--)if(!inside(list[i].time))list.splice(i,1);
 }
 // Resource changes at the terminal command still occur when terminal damage
 // is excluded. Hypothetical later ticks used to close windows stay out of Debug.
 for(let i=resources.length-1;i>=0;i--)if(resources[i].time>duration)resources.splice(i,1);
 resources.sort(compareEvents);
 events.sort(compareEvents);
 const rotation={model:'actions',events,heals,hpDrains,roots,switches,resources,reactionFacts,slots,duration,endHit:c.endHit,activeRole,entered,lastCast,castE:castTimes('skill'),castQ:castTimes('burst'),covered,window,windows,fanfareWindows:windows.fanfare||[]};
 if(runtimeRoles.length){
  const dynamic=roots.flatMap(a=>{const end=runtimeRoles.includes(a.role)?characterRules[profiles[a.role].character.name].combatCompletion?.(a):undefined;return end===undefined?[]:[{action:a,end}];});
  rotation.runtimeRoles=runtimeRoles;
  rotation.combatCompletions=dynamic.map(({action,end})=>[action.id,end]);
  rotation.combatDurationFloor=actionTime(actionAxisMaxDurationMs(c,profiles,new Map([...completions,...dynamic.map(({action:a})=>[a.id,a.time*1000])]))/1000);
 }
 for(const [serial,e]of events.entries()){e.order??=hitOrder++;e.serial=serial;}
 for(let i=heals.length-1;i>=0;i--)if(!inside(heals[i].time))heals.splice(i,1);
 equipmentTimeline(profiles,rotation);
 heals.sort(chronological);
 const initialHealth={ratios:settings.initial_hp??profiles.map(()=>1),fanfare:0,overflow:0,active:false};
 return {...rotation,initialHealth,healthAt:()=>initialHealth,hpEvents:[],salonCounts:new Map()};
}

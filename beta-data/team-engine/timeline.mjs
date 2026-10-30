import {characterRules} from './registry.mjs';
import {chronological,actionTime} from './rule-utils.mjs';
import {equipmentTimeline} from './equipment-timeline.mjs';
import {actionAxisMaxDurationMs,actionAxisTimeline} from './action-timing.mjs';
import {resolveCombatTimeline} from './combat-timeline.mjs';

// An action is expanded by its installed character rule. This scheduler knows
// only event times, ownership, expiry, hit parts and the active party member.
export function compileActionAxis(c,profiles,settings={}){
 const slots=c.members.map(m=>m.slot),roots=[],events=[],heals=[],hpDrains=[],windows={},states={},resources=[];
 let duration=actionTime(actionAxisMaxDurationMs(c,profiles)/1000);
 const combatRules=profiles.map(p=>characterRules[p.character.name]),hasCombat=combatRules.some(r=>r.createCombat);
 // Finite follow-up attacks may finish after a command's last native hit.
 // Reserve only the installed rules' bounded delay; summons never set endings.
 if(hasCombat)duration=actionTime(duration+combatRules.reduce((n,r)=>n+(r.completionDelay??0),0));
 let resolving=hasCombat;
 const inside=t=>actionTime(t)<duration||(actionTime(t)===duration&&(resolving||c.endHit==='include'));
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
 let serial=0,persistent=false;
 function hit(a,template,offset=0,suffix='',phase=20){
  const time=actionTime(a.time+offset);if(!inside(time))return;
  for(let part=0;part<(template.hits??template.parts??1);part++)events.push({originActionId:a.id,extendsAxis:!persistent&&!template.persistent,...template,time,role:a.role,rootOrder:a.rootOrder+phase,serial:serial++,part:template.part??part,eventId:a.id+'/'+suffix,label:template.label});
 }
 function heal(a,offset,recipients,healing,phase=10){
  const time=actionTime(a.time+offset);if(!inside(time))return;
  heals.push({kind:'heal',time,role:a.role,rootOrder:a.rootOrder+phase,eventId:a.id+'/heal/'+offset,recipients:recipients==='team'?profiles.map((_,i)=>i):[activeRole(time,a.rootOrder+phase)],...(typeof healing==='object'?healing:healing?{healing}:{})});
 }
 function periodic(a,{duration:life,start,interval,offsetAt},emit){
  const next=casts.find(e=>e.role===a.role&&e.castAction===a.castAction&&chronological(e,a)>0)?.time??Infinity;
  for(let i=0;;i++){
   const offset=offsetAt?offsetAt(i):Math.round((start+i*interval)*1000)/1000,t=actionTime(a.time+offset);
   if(offset>=life||!inside(t)||t>=next)break;persistent=true;emit(offset,Math.min(next,actionTime(a.time+life)));persistent=false;
  }
 }
 const addWindow=(key,a,life,offset=0,values={})=>{const w={start:actionTime(a.time+offset),end:actionTime(a.time+offset+life),rootOrder:a.rootOrder,role:a.role,...values};(windows[key]??=[]).push(w);return w;};
 const state=(key,init)=>states[key]??=(typeof init==='function'?init():init);
 const ruleContexts=profiles.map((profile,role)=>({profile,role,profiles,settings,duration,roots,events,heals,hpDrains,windows,switches,resources,activeRole,lastCast,hit,heal,periodic,addWindow,state,actions:roots.filter(e=>e.role===role&&e.kind!=='switch')}));
 for(const ctx of ruleContexts)characterRules[ctx.profile.character.name].expand(ctx);
 events.sort((a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||a.serial-b.serial);
 const window=(key,t,o=Infinity)=>{
  const list=windows[key]||[],active=w=>t<w.end||t===w.end&&o<(w.endOrder??-Infinity);
  const index=list.findLastIndex(w=>(t>w.start||t===w.start&&w.rootOrder<=o)&&active(w));
  // First activation remains available on the same tick. A refresh consumes
  // earlier hits from the existing pool, then replaces it at the cast's order.
  return index>=0?index:list.findIndex(w=>t===w.start&&active(w));
 };
 // Ordinary buffs retain the accepted same-time availability; ordered callers
 // use window() for finite pools and endOrder for actual exits.
 const covered=(key,t,o=Infinity)=>(windows[key]||[]).some(w=>t>=w.start&&(t<w.end||t===w.end&&o<(w.endOrder??-Infinity)));
 for(const ctx of ruleContexts)characterRules[ctx.profile.character.name].derive?.({...ctx,window,covered});
 const combat=resolveCombatTimeline(ruleContexts,combatRules,{duration,endHit:hasCombat?'include':c.endHit});
 resolving=false;
 const completions=new Map(roots.filter(a=>a.completionTime!==undefined).map(a=>[a.id,a.completionTime*1000]));
 if(completions.size||hasCombat){
  duration=actionTime(actionAxisMaxDurationMs(c,profiles,completions)/1000);
  for(const list of [events,heals,hpDrains])for(let i=list.length-1;i>=0;i--)if(!inside(list[i].time))list.splice(i,1);
 }
 // Resource changes at the terminal command still occur when terminal damage
 // is excluded. Hypothetical later ticks used to close windows stay out of Debug.
 for(let i=resources.length-1;i>=0;i--)if(resources[i].time>duration)resources.splice(i,1);
 events.sort((a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||a.serial-b.serial);
 const rotation={model:'actions',events,heals,hpDrains,roots,switches,resources,slots,duration,endHit:c.endHit,activeRole,entered,lastCast,castE:castTimes('skill'),castQ:castTimes('burst'),covered,window,windows,fanfareWindows:windows.fanfare||[],...(combat?{combatAt:combat.at,combatHistory:combat.history,reactionTimeline:combat.reactions}: {})};
 for(const [order,e]of events.entries()){e.order=order;e.onField=e.role===activeRole(e.time,e.rootOrder);e.element??=characterRules[profiles[e.role].character.name].hitElement?.(e)??characterRules[profiles[e.role].character.name].element;}
 for(const ctx of ruleContexts)characterRules[ctx.profile.character.name].decorate?.({...ctx,window,covered});
 for(let i=heals.length-1;i>=0;i--)if(!inside(heals[i].time))heals.splice(i,1);
 equipmentTimeline(profiles,rotation);
 heals.sort(chronological);
 const initialHealth={ratios:settings.initial_hp??profiles.map(()=>1),fanfare:0,overflow:0,active:false};
 return {...rotation,initialHealth,healthAt:()=>initialHealth,hpEvents:[],salonCounts:new Map()};
}

import {scalarMath} from '../team-dps-numeric-rules.mjs';
import {actionTime} from './rule-utils.mjs';
import {eventKey,afterEvent,compareEventPosition} from './event-order.mjs';
import {hitTargets} from './hit-targets.mjs';
import {reactionDamageEvent} from './reaction-events.mjs';
import {STELLAR_CONDUCT_COEFFICIENTS,STELLAR_CONDUCT_ELEMENT_BONUSES} from './ice-electro-reactions.mjs';
import {emptyFrozenAura,advanceFrozenAura,elementalFrame,frozenLifetimeFrames} from './frozen-aura.mjs';
import {createElectrochargedRuntime} from './electrocharged-runtime.mjs';
import {createShatterRuntime} from './shatter-runtime.mjs';
import {createSwirlRuntime} from './swirl-runtime.mjs';
import {createStellarSwirlRuntime} from './stellar-swirl-runtime.mjs';

// Candidate-owned aura and reaction state. Timers go through the combat queue;
// numeric gates change state, never the static list of reachable time slots.
// Frozen is distinct from the ordinary Cryo aura underneath it.
export function createElementalRuntime({math:m=scalarMath,actorIds,actorElements=[],settings={},stellarEnabled=false,replacesStellarPrism=false,stellarSwirlEnabled=false,enqueue,emitReaction,observeHit=e=>e.enabled??1}){
 const and=(a,b)=>m.choose(a,b,0),possible=x=>typeof x==='object'||!!x;
 // Facts from one contact must arrive in the same order as gauge resolution.
 // Fixed offsets also keep scalar/compiled positions equal when a candidate
 // disables an earlier reaction. Leave the next step for immediate damage.
 const reactionSteps={Shatter:0,Superconduct:2,StellarConduct:2,Frozen:4,ElectroCharged:6,Swirl:8,StellarSwirl:8};
 const publishReaction=(cause,definition)=>emitReaction({...cause,step:(cause.step??0)+reactionSteps[definition.reactionType]},definition);
 const targets=Array.from({length:settings.enemy_count??1},()=>({Cryo:{amount:0,decay:0},Electro:{amount:0,decay:0},Hydro:{amount:0,decay:0},Frozen:emptyFrozenAura(),superconductUntil:-Infinity}));
 const icds=new Map(),records=new Map(),reactionReady=new Map(),damageICDs=new Map(),scheduled=new Set(),before=new Map(),history=[],applications=[];
 const field={until:-Infinity,next:Infinity,pending:0},buff={until:-Infinity,count:0};let clock=0;
 const frozenWatches=targets.map(()=>-Infinity),frozenTimers=new Set();
 const electrocharged=createElectrochargedRuntime({math:m,targets,actorIds,enqueue,emitReaction:publishReaction});
 const shatter=createShatterRuntime({math:m,targets,actorIds,enqueue,emitReaction:publishReaction,observeHit});
 const stellarSwirl=stellarSwirlEnabled?createStellarSwirlRuntime({math:m,targets,actorIds,actorElements,enqueue,emitReaction:publishReaction}):null;
 const swirl=createSwirlRuntime({math:m,targets,actorIds,enqueue,emitReaction:publishReaction,stellar:stellarSwirl});
 const lookup=(table,index)=>table.reduce((value,entry,i)=>m.choose(m.eq(index,i),entry,value),table[0]);
 const targetIds=e=>hitTargets(e,settings);
 function snapshot(){return {time:clock,targets:targets.map(t=>({...t,Cryo:{...t.Cryo},Electro:{...t.Electro},Hydro:{...t.Hydro},Frozen:{...t.Frozen}})),field:{...field},buff:{...buff},swirlUntil:stellarSwirl?.until()??-Infinity,swirl:stellarSwirl?.state()};}
 const initial=snapshot();
 function view(row,time){
  const active=m.lt(time,row.buff.until),count=m.choose(active,row.buff.count,0),fieldActive=m.lt(time,row.field.until);
  return {time,fieldActive,fieldUntil:row.field.until,next:row.field.next,pending:row.field.pending,radiance:active,swirlRadiance:m.choose(active,0,m.lt(time,row.swirlUntil)),count,
   wanderingActive:row.swirl?m.max(m.choose(m.lt(time,row.swirl.vortexUntil),row.swirl.wandering,0),m.lt(time,row.swirl.wanderingAfter)):0,
   wanderingAnemoShred:row.swirl?m.lt(time,row.swirl.anemoShredUntil):0,
   coefficient:m.choose(active,lookup(STELLAR_CONDUCT_COEFFICIENTS,count),1),elementBonus:m.choose(active,lookup(STELLAR_CONDUCT_ELEMENT_BONUSES,count),0),buffUntil:row.buff.until,
   targets:row.targets.map(t=>{
    const Frozen=advanceFrozenAura(t.Frozen,elementalFrame(time)-elementalFrame(row.time),m).amount,Cryo=m.max(0,m.sub(t.Cryo.amount,m.mul(time-row.time,t.Cryo.decay)));
    return {Cryo,Electro:m.max(0,m.sub(t.Electro.amount,m.mul(time-row.time,t.Electro.decay))),Hydro:m.max(0,m.sub(t.Hydro.amount,m.mul(time-row.time,t.Hydro.decay))),Frozen,frozen:m.gt(Frozen,0),cryoAffected:m.gt(m.add(Cryo,Frozen),0),
     superconduct:m.lt(time,t.superconductUntil),stellarConduct:active,physicalResMinus:m.choose(m.max(active,m.lt(time,t.superconductUntil)),.4,0)};
   })};
 }
 function decay(time){
  const elapsed=time-clock;
  if(elapsed)for(const target of targets){
   for(const element of ['Cryo','Electro','Hydro']){
    const aura=target[element],amount=m.max(0,m.sub(aura.amount,m.mul(elapsed,aura.decay)));
    aura.amount=m.choose(m.lt(amount,1e-12),0,amount);
   }
   target.Frozen=advanceFrozenAura(target.Frozen,elementalFrame(time)-elementalFrame(clock),m);
  }
  clock=time;
 }
 function remember(e){history.push({position:afterEvent(e),state:snapshot()});}
 function watchFrozenTarget(id){
  const end=frozenWatches[id],state=targets[id].Frozen;
  if(end<=clock||!possible(m.gt(state.amount,0)))return;
  const start=elementalFrame(clock),limit=elementalFrame(end)-start;
  const timerAt=frame=>{
   const time=actionTime(frame/60),key='aura.Frozen.expiry/'+id+'/'+frame;
   if(frozenTimers.has(key))return;frozenTimers.add(key);
   enqueue({kind:'timer',mechanic:'aura.Frozen.expiry',targetIds:[id],time,rootOrder:-Infinity,eventId:key});
  };
  // Fixed auras need one exact expiry timer. Candidate-dependent auras use
  // deduplicated frame slots only inside the consumer's bounded watch window.
  if(typeof state.amount==='number'&&typeof state.decay==='number'){
   const frames=frozenLifetimeFrames(state,limit,m);
   if(frames>0&&!advanceFrozenAura(state,frames,m).amount)timerAt(start+frames);
  }else for(let frame=start+1;frame<=start+limit;frame++)timerAt(frame);
 }
 function frozenLost(e,id,before,reason){
  if(e.time>frozenWatches[id]||before===targets[id].Frozen.amount)return;
  const enabled=and(m.gt(before,0),m.eq(targets[id].Frozen.amount,0));
  if(!possible(enabled))return;
  const at=afterEvent(e);
  enqueue({kind:'aura_change',element:'Frozen',change:'expire',reason,targetIds:[id],enabled,time:at.time,rootOrder:at.rootOrder,order:at.order,step:at.step,
   eventId:JSON.stringify(['aura-change',eventKey(e),id,'Frozen',reason]),parentEventId:eventKey(e)});
 }
 function timer(time){
  time=actionTime(time);if(scheduled.has(time))return;scheduled.add(time);
  enqueue({kind:'timer',mechanic:'reaction.stellar.settle',eventId:'reaction.stellar.settle/'+time,time,rootOrder:-Infinity});
 }
 function passes(e,target,app,gate){
  if(!app.group)return gate;
  const key=JSON.stringify([actorIds[e.role],app.group,target]),state=icds.get(key)??{count:0,until:-Infinity};icds.set(key,state);
  const reset=m.ge(e.time,state.until),count=m.choose(reset,0,state.count),remainder=m.sub(count,m.mul(m.floor(m.div(count,app.hits)),app.hits));
  const pass=and(gate,m.eq(remainder,0));
  state.count=m.choose(gate,m.add(count,1),state.count);state.until=m.choose(and(gate,reset),actionTime(e.time+app.interval),state.until);
  return pass;
 }
 function damage(e,fact,origin,gate){
  const ready=reactionReady.get(origin)??-Infinity,trigger=and(gate,m.ge(e.time,ready));
  reactionReady.set(origin,m.choose(trigger,actionTime(e.time+.1),ready));
  if(!possible(trigger))return;
  const groups=new Map();
  for(let victim=0;victim<targets.length;victim++){
   const key=JSON.stringify([actorIds[e.role],victim]),state=damageICDs.get(key)??{count:0,until:-Infinity};damageICDs.set(key,state);
   const reset=m.ge(e.time,state.until),count=m.choose(reset,0,state.count),enabled=and(trigger,m.lt(count,2));
   state.count=m.choose(trigger,m.min(2,m.add(count,1)),state.count);state.until=m.choose(and(trigger,reset),actionTime(e.time+.5),state.until);
   if(!possible(enabled))continue;
   const groupKey=typeof enabled==='object'?enabled:enabled?1:0;
   if(!groups.has(groupKey))groups.set(groupKey,{enabled,targetIds:[]});groups.get(groupKey).targetIds.push(victim);
  }
  for(const {enabled,targetIds}of groups.values()){
   const reactionSnapshot={time:e.time,rootOrder:e.rootOrder,order:e.order,step:e.step??0,fields:['em','superconduct_bonus']};
   const hit=reactionDamageEvent(fact,{damageModel:'reaction.superconduct',element:'Cryo',label:'超导',reactionSnapshot,enabled,targetIds,key:'aoe/'+targetIds.join(',')},{actorIds,math:m});
   enqueue({...hit,time:actionTime(e.time+1/60)});
  }
 }
 function conduct(e,id,reacts){
  if(!possible(reacts))return;
  const fact=publishReaction(e,{reactionType:stellarEnabled?'StellarConduct':'Superconduct',elements:['Cryo','Electro'],targetIds:[id],enabled:reacts,instanceId:'aura/'+id});
  if(stellarEnabled){
   // A character replacement owns field creation and refresh via its resource.
   // The reaction fact and gauge consumption still occur at the contact time.
   if(replacesStellarPrism)return;
   const create=and(reacts,m.ge(e.time,field.until));
   field.next=m.choose(create,actionTime(e.time+4),field.next);field.pending=m.choose(create,0,field.pending);field.until=m.choose(reacts,actionTime(e.time+6),field.until);
   buff.count=m.choose(create,0,buff.count);buff.until=m.choose(create,actionTime(e.time+4),buff.until);
   if(possible(create))timer(e.time+4);
  }else{
   targets[id].superconductUntil=m.choose(reacts,actionTime(e.time+12),targets[id].superconductUntil);
   damage(e,fact,id,reacts);
  }
 }
 function freeze(e,id,gauge,gate){
  const target=targets[id],other=e.element==='Hydro'?'Cryo':'Hydro';
  // Gauge amounts are nonnegative. A provably empty counterpart cannot freeze;
  // preserve its literal zero instead of manufacturing symbolic min(0, gauge).
  // Otherwise an all-Cryo/Electro axis can acquire impossible Hydro branches.
  if(target[other].amount===0||gauge===0||gate===0)return 0;
  const consumed=m.min(target[other].amount,gauge),reacts=and(gate,m.gt(consumed,0));
  target[other].amount=m.choose(reacts,m.sub(target[other].amount,consumed),target[other].amount);
  if(settings.frozen!==false)target.Frozen.amount=m.choose(reacts,m.max(target.Frozen.amount,m.mul(2,consumed)),target.Frozen.amount);
  if(possible(reacts))publishReaction(e,{reactionType:'Frozen',elements:['Hydro','Cryo'],targetIds:[id],enabled:reacts,instanceId:'freeze/'+id});
  return reacts;
 }
 function apply(e){
  const app=e.application;
  if(!app||app.gauge<=0||!['Cryo','Electro','Hydro','Anemo'].includes(e.element))return;
  const enabled=e.enabled??1;if(!possible(enabled))return;
  const gate=and(enabled,observeHit(e)),existed=m.lt(e.time,field.until);let any=0;
  for(const id of targetIds(e)){
   const target=targets[id],pass=passes(e,id,app,gate);any=m.max(any,pass);
   electrocharged.changed(id,e.time,pass);
   applications.push({eventId:e.eventId,time:e.time,role:e.role,targetId:id,element:e.element,gauge:app.gauge,enabled:pass});
   if(e.element==='Anemo'){swirl.apply(e,id,pass);continue;}
   let reacted=0,remaining=app.gauge;
   if(e.element==='Cryo'){
    // Superconduct consumes the triggering gauge before any remaining Cryo
    // can Freeze a coexisting Hydro aura. Frozen shields the underlying aura.
    const reacts=and(pass,and(m.eq(target.Frozen.amount,0),m.gt(target.Electro.amount,0))),consumed=m.min(target.Electro.amount,remaining);
    target.Electro.amount=m.choose(reacts,m.sub(target.Electro.amount,consumed),target.Electro.amount);
    remaining=m.choose(reacts,m.sub(remaining,consumed),remaining);conduct(e,id,reacts);reacted=reacts;
    reacted=m.max(reacted,freeze(e,id,remaining,pass));
   }else if(e.element==='Hydro')reacted=freeze(e,id,remaining,pass);
   else{
    const frozen=m.gt(target.Frozen.amount,0),reacts=and(pass,m.gt(m.add(target.Cryo.amount,target.Frozen.amount),0)),cryo=m.min(target.Cryo.amount,remaining);
    target.Cryo.amount=m.choose(reacts,m.sub(target.Cryo.amount,cryo),target.Cryo.amount);
    target.Frozen.amount=m.choose(and(reacts,frozen),m.max(0,m.sub(target.Frozen.amount,m.sub(remaining,cryo))),target.Frozen.amount);
    conduct(e,id,reacts);reacted=reacts;
   }
   const attach=and(pass,m.choose(reacted,0,1)),aura=target[e.element];
   aura.decay=m.choose(and(attach,m.eq(aura.amount,0)),m.div(m.mul(.8,app.gauge),m.add(m.mul(2.5,app.gauge),7)),aura.decay);
   // Electro applied into Hydro is capped by the remaining Hydro gauge,
   // while retaining its own ordinary decay rate. Hydro is not capped.
   const taxed=m.mul(.8,app.gauge),amount=e.element==='Electro'?m.choose(and(m.eq(target.Frozen.amount,0),m.gt(target.Hydro.amount,0)),m.min(taxed,target.Hydro.amount),taxed):taxed;
   aura.amount=m.choose(attach,m.max(aura.amount,amount),aura.amount);
   stellarSwirl?.record(e,id,pass,attach,m.gt(target.Frozen.amount,0));
   electrocharged.changed(id,e.time,pass);
   if(e.element==='Hydro'||e.element==='Electro'){
    const ec=and(attach,and(m.eq(target.Frozen.amount,0),and(m.gt(target.Hydro.amount,0),m.gt(target.Electro.amount,0))));
    electrocharged.apply(e,id,ec);
   }
  }
  const key=actorIds[e.role],ready=records.get(key)??-Infinity,record=['Hydro','Anemo'].includes(e.element)?0:and(existed,and(any,m.ge(e.time,ready)));
  field.pending=m.choose(record,m.min(12,m.add(field.pending,1)),field.pending);records.set(key,m.choose(record,actionTime(e.time+.1),ready));
  remember(e);
 }
 return {
  targetIds,applications,
  enableWandering(e,duration,enabled){stellarSwirl?.enableWandering(e,duration,enabled);remember(e);},
  refreshField(e,duration,enabled){
   const create=and(enabled,m.ge(e.time,field.until));field.next=m.choose(create,actionTime(e.time+4),field.next);field.pending=m.choose(create,0,field.pending);
   field.until=m.choose(enabled,m.max(field.until,actionTime(e.time+duration)),field.until);buff.count=m.choose(create,0,buff.count);buff.until=m.choose(create,actionTime(e.time+4),buff.until);
   if(possible(create))timer(e.time+4);remember(e);
  },
  view:()=>view(snapshot(),clock),
  at(e){return before.get(eventKey(e))??view(history.findLast(row=>compareEventPosition(row.position,e)<=0)?.state??initial,e.time);},
  currentAura:(element,id)=>targets[id][element].amount,
  watchFrozen(ids,until){for(const id of ids){frozenWatches[id]=Math.max(frozenWatches[id],until);watchFrozenTarget(id);}},
  prepare(e){
   swirl.prepare(e);
   const frozenBefore=targets.map(t=>t.Frozen.amount);
   decay(e.time);
   stellarSwirl?.prepare(e);
   if(e.mechanic==='reaction.vortex.expire')remember(e);
   frozenBefore.forEach((amount,id)=>frozenLost(e,id,amount,'decay'));
   electrocharged.prepare(e);
   if(e.mechanic==='reaction.ec.wane')remember(e);
   if(e.mechanic==='reaction.stellar.settle'){
    const due=and(e.enabled??1,and(m.eq(field.next,e.time),m.lt(e.time,field.until)));
    buff.count=m.choose(due,field.pending,buff.count);buff.until=m.choose(due,actionTime(e.time+4),buff.until);
    field.pending=m.choose(due,0,field.pending);field.next=m.choose(due,actionTime(e.time+4),field.next);
    if(possible(due))timer(e.time+4);remember(e);
   }
   const state=view(snapshot(),e.time);before.set(eventKey(e),state);
   if(e.kind==='hit'&&e.damageModel==='reaction.stellarConduct')e.stellarCoefficient??=state.coefficient;
  },
  after(e){
   if(e.kind!=='hit'&&e.kind!=='application')return;
   if(e.kind==='hit'){
    const frozenBefore=targets.map(t=>t.Frozen.amount);
    if(shatter.apply(e,targetIds(e))){remember(e);frozenBefore.forEach((amount,id)=>frozenLost(e,id,amount,'shatter'));}
   }
   const frozenBefore=targets.map(t=>t.Frozen.amount);
   apply(e);frozenBefore.forEach((amount,id)=>frozenLost(e,id,amount,'reaction'));
   for(const id of targetIds(e))watchFrozenTarget(id);
   if(e.kind==='hit')electrocharged.after(e);
  },
 };
}

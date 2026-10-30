import {actionTime,chronological} from './rule-utils.mjs';

// Game gauge units, not damage instances. The first application pays aura tax;
// a reaction consumes the existing aura and never leaves excess trigger gauge.
export const STELLAR_CONDUCT_COEFFICIENTS=Object.freeze([1,1.45,1.5,1.55,1.6,1.65,1.7,1.75,1.8,1.85,1.9,1.95,2]);
export const STELLAR_CONDUCT_ELEMENT_BONUSES=Object.freeze([.2,.29,.3,.31,.32,.33,.34,.35,.36,.37,.38,.39,.4]);
export const stellarConductCoefficient=count=>STELLAR_CONDUCT_COEFFICIENTS[Math.min(12,count)];
export const elementalApplication=(gauge=1,group=null,hits=1,interval=0)=>({gauge,group,hits,interval});
const emptyAura=()=>({amount:0,decay:0});
const copy=state=>structuredClone(state);

export function createIceElectroReactions({stellarEnabled=false,targetCount=1}={}){
 const targets=Array.from({length:targetCount},()=>({Cryo:emptyAura(),Electro:emptyAura(),superconductUntil:-Infinity}));
 const icds=new Map(),recordReady=new Map(),reactionReady=new Map(),damageICDs=new Map();
 let clock=0,field=null,buff={count:0,until:-Infinity};
 const history=[],applications=[],reactions=[],fieldEvents=[];
 const targetIds=e=>e.targetIds??Array.from({length:Math.min(targetCount,e.targetLimit??targetCount)},(_,i)=>i);
 function decayTo(time){
  for(const target of targets)for(const element of ['Cryo','Electro']){
   const a=target[element];a.amount=Math.max(0,a.amount-(time-clock)*a.decay);
   if(a.amount<1e-12)a.amount=0;
  }
  clock=time;
 }
 function view(time=clock){
  const active=time<buff.until;
  return {time,field:field?{...field}:null,radiance:active,count:active?buff.count:0,
   coefficient:active?stellarConductCoefficient(buff.count):1,
   elementBonus:active?STELLAR_CONDUCT_ELEMENT_BONUSES[buff.count]:0,
   buffUntil:buff.until,
   targets:targets.map(target=>({
    Cryo:Math.max(0,target.Cryo.amount-(time-clock)*target.Cryo.decay),
    Electro:Math.max(0,target.Electro.amount-(time-clock)*target.Electro.decay),
    superconduct:time<target.superconductUntil,stellarConduct:active,
    physicalResMinus:active||time<target.superconductUntil?.4:0,
   }))};
 }
 function remember(time,rootOrder,kind){
  history.push({time,rootOrder,kind,targets:copy(targets),field:copy(field),buff:{...buff}});
 }
 function advance(time){
  time=actionTime(time);
  while(field&&field.next<=time&&field.next<field.until){
   const at=field.next;decayTo(at);
   buff={count:field.pending,until:actionTime(at+4)};
   field.pending=0;field.next=actionTime(at+4);
   fieldEvents.push({time:at,kind:'settle',count:buff.count,coefficient:stellarConductCoefficient(buff.count)});
   remember(at,-Infinity,'settle');
  }
  if(field&&field.until<=time){
   const at=field.until;decayTo(at);field=null;
   fieldEvents.push({time:at,kind:'expire'});remember(at,-Infinity,'expire');
  }
  decayTo(time);
 }
 function passes(e,target,application){
  if(!application.group)return true;
  const key=e.role+'/'+application.group+'/'+target;
  let state=icds.get(key);
  if(!state||e.time>=state.until){state={count:0,until:actionTime(e.time+application.interval)};icds.set(key,state);}
  // Hit-rule applications do not restart the timer. Its expiry resets both.
  return state.count++%application.hits===0;
 }
 function apply(event){
  const e={...event,time:actionTime(event.time)};advance(e.time);
  const before=view(),applied=[],triggered=[],damage=[];
  const app=e.application;
  if(!app||app.gauge<=0||!['Cryo','Electro'].includes(e.element))return {before,after:before,applied,triggered,damage};
  const existingField=field!==null,other=e.element==='Cryo'?'Electro':'Cryo';
  for(const targetId of targetIds(e)){
   const target=targets[targetId],pass=passes(e,targetId,app);
   const entry={time:e.time,rootOrder:e.rootOrder,role:e.role,eventId:e.eventId,targetId,element:e.element,gauge:app.gauge,group:app.group,applied:pass};
   applications.push(entry);if(!pass)continue;applied.push(targetId);
   if(target[other].amount>0){
    const consumed=Math.min(target[other].amount,app.gauge);target[other].amount=Math.max(0,target[other].amount-consumed);
    const reaction=stellarEnabled?'StellarConduct':'Superconduct';
    const fact={...entry,kind:'reaction',reaction,elements:['Cryo','Electro'],consumed,owner:e.role};
    triggered.push(fact);reactions.push(fact);
    if(stellarEnabled){
     if(!field){
      field={start:e.time,until:actionTime(e.time+6),next:actionTime(e.time+4),pending:0};
      buff={count:0,until:actionTime(e.time+4)};
      fieldEvents.push({time:e.time,rootOrder:e.rootOrder,kind:'create',count:0,coefficient:1});
     }else field.until=actionTime(e.time+6);
    }else{
     target.superconductUntil=actionTime(e.time+12);
     if(e.time>=(reactionReady.get(targetId)??-Infinity)){
      reactionReady.set(targetId,actionTime(e.time+.1));
      const affected=[];
      // Under the existing grouped-enemy model every target is in the AoE.
      // Reaction-A damage is limited to two hits / .5 s per owner and victim.
      for(let victim=0;victim<targetCount;victim++){
       const key=e.role+'/'+victim;let state=damageICDs.get(key);
       if(!state||e.time>=state.until){state={count:0,until:actionTime(e.time+.5)};damageICDs.set(key,state);}
       if(state.count++<2)affected.push(victim);
      }
      if(affected.length)damage.push({time:actionTime(e.time+1/60),rootOrder:e.rootOrder+.01,role:e.role,kind:'reactionDamage',reaction:'Superconduct',damageKind:'superconduct',category:'reaction',element:'Cryo',targetIds:affected,originTarget:targetId,eventId:e.eventId+'/superconduct/'+targetId,label:'超导',application:null});
     }
    }
   }else{
    const aura=target[e.element];
    if(aura.amount===0)aura.decay=.8*app.gauge/(2.5*app.gauge+7);
    aura.amount=Math.max(aura.amount,.8*app.gauge);
   }
  }
  // The creating application, including all its targets, contributes no count.
  if(existingField&&applied.length&&e.time>=(recordReady.get(e.role)??-Infinity)){
   field.pending=Math.min(12,field.pending+1);recordReady.set(e.role,actionTime(e.time+.1));
   fieldEvents.push({time:e.time,rootOrder:e.rootOrder,role:e.role,eventId:e.eventId,kind:'record',count:field.pending});
  }
  remember(e.time,e.rootOrder+.001,'application');
  return {before,after:view(),applied,triggered,damage};
 }
 function at(e){
  const row=history.findLast(h=>chronological(h,e)<=0);
  if(!row)return {time:e.time,field:null,radiance:false,count:0,coefficient:1,elementBonus:0,buffUntil:-Infinity,targets:targets.map(()=>({Cryo:0,Electro:0,superconduct:false,stellarConduct:false,physicalResMinus:0}))};
  const active=e.time<row.buff.until;
  return {time:e.time,field:row.field&&e.time<row.field.until?{...row.field}:null,radiance:active,count:active?row.buff.count:0,
   coefficient:active?stellarConductCoefficient(row.buff.count):1,elementBonus:active?STELLAR_CONDUCT_ELEMENT_BONUSES[row.buff.count]:0,buffUntil:row.buff.until,
   targets:row.targets.map(target=>({Cryo:Math.max(0,target.Cryo.amount-(e.time-row.time)*target.Cryo.decay),Electro:Math.max(0,target.Electro.amount-(e.time-row.time)*target.Electro.decay),superconduct:e.time<target.superconductUntil,stellarConduct:active,physicalResMinus:active||e.time<target.superconductUntil?.4:0}))};
 }
 return {apply,advance,view,at,targetIds,applications,reactions,fieldEvents,history};
}

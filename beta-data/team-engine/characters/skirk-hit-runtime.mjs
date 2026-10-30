import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {actionTime} from '../rule-utils.mjs';
import {eventKey} from '../event-order.mjs';

// The legacy absorption input is a declared count at its command. Sever's
// subsequent expiry/consumption belongs to actual candidate events, not to
// command expansion. Preview and numerical compilation share this state.
export function createSkirkHitRuntime({role,profile,window,windows,covered,hit,enqueue,resources,burstWindows,
 recordResource=row=>resources.push(row),observeHit=()=>1,math:m=scalarMath}){
 const uses=new Map(),commands=new Map(),spent=new Map();
 const enabled=profile.character.constellation>=6&&teamTalentUnlocked(profile.character,1);
 const and=(a,b)=>m.choose(a,b,0),possible=value=>typeof value==='object'||!!value;
 let slots=Array.from({length:3},()=>({active:0,expires:-Infinity}));
 const count=()=>slots.reduce((n,s)=>m.add(n,s.active),0);
 const record=(e,kind,label,before,gate)=>{
  if(!possible(gate))return;
  const after=count();recordResource({kind:'resource',resource:'极恶技·斩',role,time:e.time,rootOrder:e.rootOrder,order:e.order,
   eventId:(e.eventId??e.id)+'/skirk.sever/'+kind,label,before,after,amount:m.sub(after,before),enabled:gate,
   stackExpiries:slots.map(s=>m.choose(s.active,s.expires,-Infinity)),triggerEventId:eventKey(e)});
 };
 function grant(e,n){
  const gate=e.enabled??1;if(!n||!possible(gate))return;
  const before=count();
  for(let i=0;i<n;i++)slots=slots.map((old,j)=>{
   const next=j===2?{active:1,expires:actionTime(e.time+15)}:slots[j+1];
   return {active:m.choose(gate,next.active,old.active),expires:m.choose(gate,next.expires,old.expires)};
  });
  record(e,'grant','吸收裂隙·获得斩层',before,gate);
  enqueue({kind:'timer',mechanic:'skirk.sever.expire',role,time:actionTime(e.time+15),rootOrder:-Infinity,eventId:e.id+'/skirk.sever.expire'});
 }
 return {
  onEvent(e){
   if(!enabled||e.role!==role)return;
   if(e.mechanic==='skirk.sever.expire'){
    const before=count();slots=slots.map(s=>({...s,active:m.choose(and(e.enabled??1,m.eq(s.expires,e.time)),0,s.active)}));
    record(e,'expire','斩层到期',before,m.gt(before,count()));return;
   }
   if(!['cast','action'].includes(e.kind))return;
   commands.set(e.id,e);grant(e,e.skirkAbsorbedRifts??0);
   if(e.burstMode==='ruin'){
    const gate=e.enabled??1,before=count();
    for(let i=0;i<3;i++){
     const use=and(gate,m.gt(before,i));if(!possible(use))continue;
     hit(e,{index:15,category:'burst',parts:1,ratio:7.5,cunning:50,skirkBurst:true,element:'Cryo',enabled:use,label:'虚境裂隙·六命爆发追加'},.2,'burst/c6/'+i,21);
    }
    slots=slots.map(s=>({...s,active:m.choose(gate,0,s.active)}));record(e,'burst','爆发消耗斩层',before,and(gate,m.gt(before,0)));
   }
  },
  onHit(e){
   if(!enabled||e.role!==role||!e.skirkSeverCommand||e.targetIds?.length===0)return;
   const phase=covered('skirkPhase',e.time,e.rootOrder);
   const before=count(),previous=spent.get(e.skirkSeverCommand)??0;
   let gate=and(phase,and(e.enabled??1,and(m.eq(previous,0),m.gt(before,0))));
   if(!possible(gate))return;
   gate=and(gate,observeHit(e));if(!possible(gate))return;
   let remaining=gate;
   slots=slots.map(s=>{const use=and(remaining,s.active);remaining=m.choose(use,0,remaining);return {...s,active:m.choose(use,0,s.active)};});
   spent.set(e.skirkSeverCommand,m.max(previous,gate));record(e,'normal','普攻消耗斩层',before,gate);
   const a=commands.get(e.skirkSeverCommand),suffix=e.part?'c6/from/'+e.part:'c6';
   hit(a,{index:9,category:'normal',parts:1,hits:3,ratio:1.8,c6:true,element:'Cryo',enabled:gate,triggerEventId:eventKey(e),label:'虚境裂隙·六命'},e.time-a.time,suffix,e.rootOrder-a.rootOrder+1);
  },
  prepareHit(e){
   if(e.category!=='normal'||e.c6)return;
   if(burstWindows){
    let bonus=0,rifts=0;
    for(const {key,active,qRifts}of burstWindows(e)){
     const used=uses.get(key)??0,gate=e.sevenPhase?and(e.enabled??1,and(active,m.lt(used,10))):0;
     bonus=m.max(bonus,gate);rifts=m.choose(active,qRifts,rifts);
     if(possible(gate))uses.set(key,m.add(used,m.choose(gate,1,0)));
    }
    e.qRifts=rifts;e.qBonus=typeof bonus==='object'?bonus:!!bonus;return;
   }
   const cycle=window('skirkC2',e.time,e.rootOrder),used=uses.get(cycle)??0;
   e.qRifts=windows.skirkC2?.[cycle]?.qRifts??0;
   const gate=e.sevenPhase&&cycle>=0?m.choose(e.enabled??1,m.lt(used,10),0):0;
   e.qBonus=typeof gate==='object'?gate:!!gate;
   if(typeof gate==='object'||gate)uses.set(cycle,m.add(used,m.choose(gate,1,0)));
  },
 };
}

import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {actionTime} from '../rule-utils.mjs';
import {afterEvent,eventKey,compareEventPosition} from '../event-order.mjs';
import {hitTargets} from '../hit-targets.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {triggersHit} from '../damage-contract.mjs';

// Provisional animation delays from the supplied axis; resource/target rules
// are independent of those delays and are not tied to a particular party.
export const VALERIY_TIMING={skill:.5,burst:1.1,mortar:.5,barrage:1};
export function createValeriyRuntime({role,profile,settings={},math:m=scalarMath,reactions,enqueue,activeRole,observeHit=e=>e.enabled??1,resources=[],recordResource=row=>resources.push(row),complete=(a,t)=>{a.completionTime=t;}}){
 const c=profile.character,and=(a,b)=>m.choose(a,b,0),possible=v=>typeof v==='object'||!!v;
 const s={momentum:0,first:1,shieldUntil:-Infinity,burstUntil:-Infinity,burstToken:0,gained:0,convertUntil:-Infinity,remaining:0,usedMomentum:0,directiveUntil:-Infinity};
 const history=[],usage=new Map();let serial=0;
 const remember=e=>history.push({at:afterEvent(e),...s});
 const log=(e,before,reason)=>recordResource({kind:'resource',role,time:e.time,rootOrder:e.rootOrder,eventId:eventKey(e)+'/momentum/'+reason,resource:'valeriy.momentum',before,after:s.momentum,reason,enabled:e.enabled??1});
 const gain=(e,amount,gate)=>{const old=s.momentum;s.momentum=m.choose(gate,m.min(c.constellation>=4?130:100,m.add(old,amount)),old);if(possible(gate))log({...e,enabled:gate},old,'gain');};
 function hit(e,delay,values,key){if(!possible(values.enabled??1))return;enqueue({kind:'hit',role,time:actionTime(e.time+delay),rootOrder:e.rootOrder+20,order:e.order,step:delay?0:(e.step??0)+1,parts:1,part:0,element:'Electro',...values,eventId:eventKey(e)+'/'+key,parentEventId:eventKey(e)});}
 return {
  stateAt(e){return {...(history.findLast(h=>compareEventPosition(h.at,e)<=0)??{momentum:0,remaining:0,usedMomentum:0,shieldUntil:-Infinity}),usage:usage.get(eventKey(e))??{}};},
  beforeEvent(e){
   if(!triggersHit(e)||e.element!=='Electro'||activeRole(e.time,e.rootOrder)!==e.role||!['normal','charged','plunge','skill','burst'].includes(e.category))return;
   const star=reactions.at(e).radiance,eligible=and(and(e.enabled??1,observeHit(e)),and(m.lt(e.time,s.directiveUntil),e.damageModel==='reaction.stellarConduct'?star:m.choose(star,0,1)));
   const ids=hitTargets(e,settings),used=m.choose(eligible,m.min(s.remaining,ids.length),0);
   usage.set(eventKey(e),Object.fromEntries(ids.map((id,i)=>[id,m.gt(used,i)])));s.remaining=m.sub(s.remaining,used);remember(e);
  },
  onEvent(e){
   if(e.role!==role)return;const gate=e.enabled??1;
   if(e.kind==='cast'&&e.action==='skill'){
    gain(e,m.mul(c.constellation>=4?1.3:1,m.choose(c.constellation>=1?s.first:0,100,40)),gate);s.first=m.choose(gate,0,s.first);
    s.shieldUntil=m.choose(gate,actionTime(e.time+18),s.shieldUntil);s.convertUntil=m.choose(gate,actionTime(e.time+.8),s.convertUntil);
    hit(e,VALERIY_TIMING.skill,{index:8,category:'skill',application:application(),enabled:gate,label:'攻势防御·堡垒骤进',completionRoot:e.id},'skill');complete(e,actionTime(e.time+VALERIY_TIMING.skill));remember(e);
   }else if(e.kind==='cast'&&e.action==='burst'){
    s.convertUntil=m.choose(gate,actionTime(e.time+.8),s.convertUntil);s.burstUntil=m.choose(gate,actionTime(e.time+VALERIY_TIMING.burst+12),s.burstUntil);s.gained=m.choose(gate,0,s.gained);
    const token=++serial;s.burstToken=m.choose(gate,token,s.burstToken);
    hit(e,VALERIY_TIMING.burst,{index:10,category:'burst',application:application(),enabled:gate,label:'火力焦点·雷霰急袭',completionRoot:e.id},'burst');
    for(let i=0;i<12;i++)enqueue({kind:'timer',role,time:actionTime(e.time+VALERIY_TIMING.burst+i),rootOrder:e.rootOrder+30,eventId:e.id+'/barrage/'+i,mechanic:'valeriy.barrage',token,enabled:gate});
    complete(e,actionTime(e.time+VALERIY_TIMING.burst));remember(e);
   }else if(e.mechanic==='valeriy.barrage')hit(e,0,{index:11,category:'burst',application:application(1,'valeriy.barrage',2,2),enabled:and(gate,m.eq(e.token,s.burstToken)),label:'雷霰重弹'},'hit');
   else if(e.kind==='action'&&(e.action==='charged'||e.action.startsWith('normal.'))){
    const special=and(gate,and(m.ge(s.momentum,40),e.action==='charged'?1:m.lt(e.time,s.convertUntil))),ordinary=and(gate,m.choose(special,0,1));
    const spent=s.momentum,old=s.momentum;s.momentum=m.choose(special,0,s.momentum);if(possible(special))log({...e,enabled:special},old,'mortar');
    // Grant after the mortar resolves: it cannot spend its own fresh pool.
    hit(e,VALERIY_TIMING.mortar,{index:4,category:'charged',application:application(),enabled:special,valeriyGrant:spent,label:'臼炮直射·抵近轰击',completionRoot:e.id},'mortar');
    hit(e,0,{index:e.action==='charged'?3:Number(e.action.at(-1))-1,category:e.action==='charged'?'charged':'normal',element:'Physical',application:null,enabled:ordinary,label:e.action==='charged'?'重击':'普通攻击',completionRoot:e.id},'ordinary');
    complete(e,m.choose(special,actionTime(e.time+VALERIY_TIMING.mortar),e.time));remember(e);
   }
  },
  onHit(e){
   const gate=and(e.enabled??1,observeHit(e)),front=activeRole(e.time,e.rootOrder)===e.role;
   if(front&&e.element==='Electro'&&['normal','charged','plunge','skill','burst'].includes(e.category)){
    if(e.role!==role&&teamTalentUnlocked(c,1)){
     const limit=c.constellation>=4?104:80,amount=m.min(m.sub(limit,s.gained),c.constellation>=4?6.5:5),live=and(gate,m.lt(e.time,s.burstUntil));
     gain(e,amount,live);s.gained=m.choose(live,m.add(s.gained,amount),s.gained);
    }
   }
   if(e.role===role&&e.valeriyGrant!==undefined){s.remaining=m.choose(gate,15,s.remaining);s.usedMomentum=m.choose(gate,e.valeriyGrant,s.usedMomentum);s.directiveUntil=m.choose(gate,actionTime(e.time+18),s.directiveUntil);}
   remember(e);
  },
 };
}

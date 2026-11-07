import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {actionTime} from '../rule-utils.mjs';
import {afterEvent,eventKey,compareEventPosition} from '../event-order.mjs';
import {hitTargets} from '../hit-targets.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

export const YAE_TIMING=Object.freeze({spawn:34/60,duration:24,firstShot:2,interval:176/60,hitDelay:1/60,extraDelay:64/60,stellarDelay:.2,enhanceCooldown:2.5,enhanceWindow:8,burst:100/60,thunderbolt:154/60,thunderboltInterval:.4});
export function createYaeRuntime({role,profile,settings={},math:m=scalarMath,reactions,enqueue,observeHit=e=>e.enabled??1,complete=(a,time)=>{a.completionTime=time;}}){
 const c=profile.character,T=YAE_TIMING,and=(a,b)=>m.choose(a,b,0),possible=v=>typeof v==='object'||!!v;
 const totems=[],history=[];let enhanceUntil=-Infinity,enhanceReady=-Infinity,c1Until=-Infinity,c4Until=-Infinity;
 const alive=(t,time)=>and(t.enabled,m.lt(time,t.until));
 const countAt=(list,time)=>list.reduce((n,t)=>m.add(n,alive(t,time)),0);
 const rank=(list,time)=>{const n=countAt(list,time);return m.choose(m.gt(n,0),m.add(n,c.constellation>=2?1:0),0);};
 function remember(e){history.push({at:afterEvent(e),totems:totems.map(t=>({enabled:t.enabled,until:t.until})),c1Until,c4Until});}
 function timer(action,time,mechanic,extra={}){enqueue({kind:'timer',role,time:actionTime(time),rootOrder:action.rootOrder+10,mechanic,eventId:action.id+'/'+mechanic+'/'+actionTime(time),action,...extra});}
 function hit(cause,values,delay,key){
  if(!possible(values.enabled??1))return;
  enqueue({kind:'hit',role,time:actionTime(cause.time+delay),rootOrder:cause.rootOrder,order:cause.order,step:delay?0:(cause.step??0)+1,parts:1,part:0,element:'Electro',...values,
   eventId:eventKey(cause)+'/'+key,parentEventId:eventKey(cause)});
 }
 return {
  stateAt(e){const row=history.findLast(h=>compareEventPosition(h.at,e)<=0);return {rank:row?rank(row.totems,e.time):0,c1:row?m.lt(e.time,row.c1Until):0,c4:row?m.lt(e.time,row.c4Until):0};},
  onEvent(e){
   if(e.kind==='reaction'&&['Superconduct','StellarConduct'].includes(e.reactionType)){
    const gate=e.enabled??1;enhanceUntil=m.choose(gate,actionTime(e.time+T.enhanceWindow),enhanceUntil);
    if(e.role===role&&c.constellation>=1)c1Until=m.choose(gate,actionTime(e.time+10),c1Until);remember(e);return;
   }
   if(e.role!==role)return;
   const gate=e.enabled??1;if(!possible(gate))return;
   if(e.kind==='cast'&&e.action==='skill'){
    timer(e,e.time+T.spawn,'yae.spawn',{enabled:gate});
   }else if(e.kind==='cast'&&e.action==='burst'){
    const count=countAt(totems,e.time),ends=[T.burst,T.thunderbolt,T.thunderbolt+T.thunderboltInterval,T.thunderbolt+2*T.thunderboltInterval];
    complete(e,ends.reduce((end,offset,n)=>m.choose(m.eq(count,n),actionTime(e.time+offset),end),e.time));
    for(let i=0;i<3;i++)hit(e,{index:12,category:'burst',application:application(),enabled:and(gate,m.gt(count,i)),label:'天狐霆雷·第'+(i+1)+'道'},T.thunderbolt+i*T.thunderboltInterval,'thunder/'+i);
   }else if(e.mechanic==='yae.spawn'){
    const replace=and(gate,m.ge(countAt(totems,e.time),3));let removed=0;
    for(const t of totems){const remove=and(replace,and(m.choose(removed,0,1),alive(t,e.time)));t.enabled=m.choose(remove,0,t.enabled);removed=m.max(removed,remove);}
    const totem={id:e.action.id,action:e.action,enabled:gate,until:actionTime(e.time+T.duration)};totems.push(totem);timer(e.action,e.action.time+T.firstShot,'yae.shot',{totemId:totem.id});
    complete(e.action,m.choose(teamTalentUnlocked(c,1)?replace:0,actionTime(e.time+T.extraDelay),e.time));
    if(teamTalentUnlocked(c,1)){
     const stellar=reactions.view().radiance,ordinary=and(replace,m.choose(stellar,0,1)),star=and(replace,stellar);
     hit(e,{index:13,category:'other',application:null,completionRoot:e.action.id,enabled:ordinary,label:'神篱之御荫·额外雷击'},T.extraDelay,'replacement');
     hit(e,{index:14,category:'skill',damageModel:'reaction.stellarConduct',application:null,completionRoot:e.action.id,enabled:star,label:'神篱之御荫·星超导'},T.extraDelay,'replacement-star');
    }
    remember(e);
   }else if(e.mechanic==='yae.shot'){
    const totem=totems.find(t=>t.id===e.totemId),live=and(gate,alive(totem,e.time));if(!possible(live))return;
    const level=rank(totems,e.time),enhanced=and(live,and(m.lt(e.time,enhanceUntil),m.ge(e.time,enhanceReady))),stellar=and(enhanced,reactions.view().radiance);
    enhanceUntil=m.choose(enhanced,-Infinity,enhanceUntil);enhanceReady=m.choose(enhanced,actionTime(e.time+T.enhanceCooldown),enhanceReady);
    for(let rank=1;rank<=4;rank++)hit(e,{index:6+rank,category:'skill',application:application(1,'yae.sakura',3,2.5),enabled:and(live,m.eq(level,rank)),
     yaeSakura:totem.id,yaeEnhanced:enhanced,yaeStellar:stellar,label:'杀生樱·落雷'},T.hitDelay,'rank/'+rank);
    const next=actionTime(e.time+T.interval);if(next<totem.until)timer(totem.action,next,'yae.shot',{totemId:totem.id});
   }
  },
  onHit(e){
   if(e.role!==role)return;
   if(!e.yaeSakura&&e.damageModel!=='reaction.stellarConduct')return;
   const gate=and(e.enabled??1,observeHit(e));
   if(c.constellation>=1&&e.damageModel==='reaction.stellarConduct')c1Until=m.choose(gate,actionTime(e.time+10),c1Until);
   if(e.yaeSakura){
    if(c.constellation>=4)c4Until=m.choose(gate,actionTime(e.time+5),c4Until);
    const targets=hitTargets(e,settings);
    if(targets.length)hit(e,{index:16,category:'skill',damageModel:'reaction.stellarConduct',application:null,targetIds:[targets[0]],enabled:and(gate,e.yaeStellar??0),label:'祓所之讬宣·星超导'},T.stellarDelay,'enhanced-star');
   }
   remember(e);
  },
 };
}

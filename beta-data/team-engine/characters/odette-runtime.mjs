import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {actionTime} from '../rule-utils.mjs';
import {afterEvent,eventKey,compareEventPosition} from '../event-order.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

export function createOdetteRuntime({role,profile,math:m=scalarMath,reactions,enqueue,activeRole,observeHit=e=>e.enabled??1,complete=(a,time)=>{a.completionTime=time;}}){
 const c=profile.character,and=(a,b)=>m.choose(a,b,0),possible=v=>typeof v==='object'||!!v,maxStacks=4+(c.constellation>=1?2:0),history=[];
 const s={doubleUntil:-Infinity,recastUntil:-Infinity,upgradeUntil:-Infinity,dreamUntil:-Infinity,self:0,others:0,nextDance:0,danceToken:0,splendorToken:0,c4Ready:-Infinity},ends=new Map();let serial=0;
 function finish(action,time){ends.set(action.id,time);complete(action,time);}
 function remember(e,before=false){history.push({at:before?{...e}:afterEvent(e),...s});}
 function timer(cause,delay,mechanic,values={}){const time=actionTime(cause.time+delay);enqueue({kind:'timer',role,time,rootOrder:cause.rootOrder+(cause.kind==='cast'?10:0),eventId:eventKey(cause)+'/'+mechanic+'/'+time+'/'+(values.type??values.n??''),mechanic,...values});}
 function hit(cause,delay,values,key){if(!possible(values.enabled??1))return;
  if(values.damageModel==='reaction.stellarConduct'&&!values.stellarVariant){const swirl=reactions.view().swirlRadiance??0;hit(cause,delay,{...values,stellarVariant:true,enabled:and(values.enabled??1,m.choose(swirl,0,1))},key);hit(cause,delay,{...values,stellarVariant:true,index:{12:13,15:16,18:19,22:23,24:25}[values.index],damageModel:'direct.stellarSwirl',enabled:and(values.enabled??1,swirl),label:values.label.replace('星超导','星扩散')},key+'/swirl');return;}
  enqueue({kind:'hit',role,time:actionTime(cause.time+delay),rootOrder:cause.rootOrder+(cause.kind==='cast'?20:0),order:cause.order,step:delay?0:(cause.step??0)+1,part:0,parts:1,element:'Cryo',application:null,...values,eventId:eventKey(cause)+'/'+key,parentEventId:eventKey(cause)});}
 function dance(cause,delay,type,token,enabled){if(possible(enabled))timer(cause,delay,'odette.dance',{type,token,enabled});}
 function splendor(origin,n,token,enabled){if(possible(enabled))timer(origin,Math.floor(n*59.25)/60,'odette.splendor',{origin,n,token,enabled});}
 return {
  stateAt(e){const row=history.findLast(h=>compareEventPosition(h.at,e)<=0);return {live:row?m.lt(e.time,row.doubleUntil):0,self:row?.self??0,others:row?.others??0,dream:row?m.lt(e.time,row.dreamUntil):0};},
  onEvent(e){
   if(e.role!==role)return;const gate=e.enabled??1;if(!possible(gate))return;
   if(e.kind==='cast'&&e.action==='skill'){
    const recast=and(gate,m.lt(e.time,s.recastUntil)),normal=and(gate,m.choose(recast,0,1));
    s.recastUntil=m.choose(recast,-Infinity,m.choose(normal,actionTime(e.time+6),s.recastUntil));
    const token=++serial;s.danceToken=m.choose(recast,token,s.danceToken);
    for(const [i,frame]of [11,20,28].entries())hit(e,frame/60,{index:11,category:'skill',application:application(1,'odette.coda',4,3),enabled:recast,label:'破晓终奏·第'+(i+1)+'段'},'coda/'+i);
    hit(e,62/60,{index:12,category:'skill',damageModel:'reaction.stellarConduct',enabled:recast,odetteFinal:true,odetteAction:e,label:'破晓终奏·星超导'},'coda-star');
    dance(e,114/60,0,token,recast);
    hit(e,23/60,{index:10,category:'skill',application:application(),enabled:normal,label:'夜中独舞'},'skill');
    if(possible(normal))timer(e,23/60,'odette.summon',{enabled:normal,refresh:false,firstDelay:134/60});
    finish(e,m.choose(recast,actionTime(e.time+(c.constellation>=4?67:62)/60),actionTime(e.time+23/60)));remember(e);
   }else if(e.kind==='cast'&&e.action==='burst'){
    s.recastUntil=m.choose(gate,actionTime(e.time+6),s.recastUntil);
    timer(e,1/60,'odette.summon',{enabled:gate,refresh:true,firstDelay:252/60});
    for(const [i,frame]of [112,128,140].entries())hit(e,frame/60,{index:20,category:'burst',application:application(),parts:3,part:i,enabled:gate,label:'青鸟终曲·第'+(i+1)+'段'},'burst/'+i);
    hit(e,144/60,{index:21,category:'burst',application:application(),odetteBurstFinal:true,enabled:gate,label:'青鸟终曲·终结'},'burst-final');finish(e,actionTime(e.time+144/60));remember(e);
   }else if(e.mechanic==='odette.summon'){
    const reset=and(gate,e.refresh?m.ge(e.time,s.doubleUntil):1);s.doubleUntil=m.choose(gate,actionTime(e.time+20),s.doubleUntil);
    s.self=m.choose(reset,teamTalentUnlocked(c,1)?maxStacks:0,s.self);s.others=m.choose(reset,0,s.others);s.nextDance=m.choose(reset,0,s.nextDance);s.upgradeUntil=m.choose(reset,-Infinity,s.upgradeUntil);
    const token=++serial;s.splendorToken=m.choose(reset,token,s.splendorToken);if(teamTalentUnlocked(c,1))splendor(e,1,token,reset);
    s.danceToken=m.choose(gate,token,s.danceToken);
    for(const type of [0,1])dance(e,e.firstDelay,type,token,and(gate,m.eq(s.nextDance,type)));remember(e);
   }else if(e.mechanic==='odette.dance'){
    const enabled=and(gate,and(m.eq(e.token,s.danceToken),m.lt(e.time,s.doubleUntil)));if(!possible(enabled))return;
    hit(e,0,{index:e.type===0?14:17,category:'skill',application:application(),enabled,odetteDance:e.type,label:e.type===0?'倒影·翎舞':'倒影·翼舞'},'dance');
    s.nextDance=m.choose(enabled,1-e.type,s.nextDance);dance(e,(e.type===0?109:125)/60,1-e.type,e.token,enabled);remember(e);
   }else if(e.mechanic==='odette.splendor'){
    const enabled=and(gate,and(m.eq(e.token,s.splendorToken),and(m.lt(e.time,s.doubleUntil),m.lt(s.others,maxStacks))));if(!possible(enabled))return;
    const transfer=activeRole(e.time,e.rootOrder)===role?0:m.choose(enabled,m.min(s.self,c.constellation>=1?2:1),0);
    s.others=m.add(s.others,transfer);if(c.constellation<6)s.self=m.sub(s.self,transfer);remember(e);splendor(e.origin,e.n+1,e.token,enabled);
   }
  },
  prepareHit(e){if(e.odetteBurstFinal){s.dreamUntil=m.choose(e.enabled??1,actionTime(e.time+20),s.dreamUntil);remember(e,true);}},
  onHit(e){
   const gate=and(e.enabled??1,observeHit(e));if(!possible(gate))return;
   if(e.role===role&&e.odetteFinal){
    s.upgradeUntil=m.choose(gate,actionTime(e.time+20),s.upgradeUntil);
    if(c.constellation>=1)hit(e,0,{index:22,category:'skill',damageModel:'reaction.stellarConduct',followup:true,enabled:gate,label:'奥黛塔·一命终奏'},'c1');
    if(c.constellation>=4)finish(e.odetteAction,m.choose(gate,m.choose(m.ge(e.time,s.c4Ready),actionTime(e.time+5/60),e.time),ends.get(e.odetteAction.id)));remember(e);
   }
   if(e.role===role&&e.odetteDance!==undefined){const enabled=and(gate,and(m.lt(e.time,s.upgradeUntil),m.max(reactions.view().radiance,reactions.view().swirlRadiance??0)));hit(e,0,{index:e.odetteDance===0?15:18,category:'skill',damageModel:'reaction.stellarConduct',enabled,label:e.odetteDance===0?'翎舞·星超导':'翼舞·星超导'},'dance-star');}
   // This 5-frame child is always inside the 3.5-second cooldown that emitted
   // it. Do not expand an impossible self-trigger chain into the numeric graph.
   if(c.constellation>=4&&['reaction.stellarConduct','reaction.stellarSwirl','direct.stellarSwirl'].includes(e.damageModel)&&!e.odetteC4){
    const enabled=and(gate,m.ge(e.time,s.c4Ready));s.c4Ready=m.choose(enabled,actionTime(e.time+3.5),s.c4Ready);
    hit(e,5/60,{index:24,category:'other',damageModel:'reaction.stellarConduct',followup:true,odetteC4:true,enabled,label:'奥黛塔·四命协同'},'c4');
   }
  },
  afterEvent(e){if(e.kind==='hit'&&e.damageModel==='reaction.stellarSwirl')this.onHit(e);},
 };
}

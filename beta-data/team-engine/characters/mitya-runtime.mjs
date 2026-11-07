import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {actionTime} from '../rule-utils.mjs';
import {afterEvent,eventKey,compareEventPosition} from '../event-order.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
// Talent coefficients also checked against release 7.2.0 / 49008628.
export const MITYA_RATIOS={"gradient":[2.24,2.408,2.576,2.8,2.968,3.136,3.36,3.584,3.808,4.032,4.256,4.48,4.76,5.04,5.32],"overflow":[0.8,0.86,0.92,1,1.06,1.12,1.2,1.28,1.36,1.44,1.52,1.6,1.7,1.8,1.9],"detonation":[0.92,0.989,1.058,1.15,1.219,1.288,1.38,1.472,1.564,1.656,1.748,1.84,1.955,2.07,2.185],"steady":[0.72,0.774,0.828,0.9,0.954,1.008,1.08,1.152,1.224,1.296,1.368,1.44,1.53,1.62,1.71]};

// Hold E, Q and the overload opening hit use the user's frame-counted
// reference confirmed 2026-11-07. Ordinary CA and repeat spacing are separate.
export const MITYA_TIMING={tap:.3,hold:.7,burst:2.2,core:1.5,charged:1,firstPulse:.5,pulse:.45};
export function createMityaRuntime({role,profile,math:m=scalarMath,enqueue,reactions,activeRole,resources=[],recordResource=r=>resources.push(r),random=()=>0,complete=(a,t)=>{a.completionTime=t;}}){
 const c=profile.character,and=(a,b)=>m.choose(a,b,0),possible=v=>typeof v==='object'||!!v,limit=c.constellation>=1?5:4,life=teamTalentUnlocked(c,4)?10:6;
 const s={mode:0,coreUntil:-Infinity,coreToken:0,channelToken:0,beacons:0,beaconUntil:-Infinity,crit:0,critUntil:-Infinity,consumed:0,generationUntil:-Infinity,generationNext:Infinity,recastUntil:-Infinity,recastReady:-Infinity};
 const history=[];let token=0,channelSerial=0,channel;
 const mode=e=>m.choose(m.lt(e.time,s.coreUntil),s.mode,0),count=e=>m.choose(m.lt(e.time,s.beaconUntil),s.beacons,0);
 const remember=e=>history.push({at:afterEvent(e),...s});
 function timer(e,delay,mechanic,values={}){enqueue({kind:'timer',role,time:actionTime(e.time+delay),rootOrder:e.rootOrder+10,order:e.order,step:delay?0:(e.step??0)+1,eventId:eventKey(e)+'/'+mechanic+'/'+(values.n??values.token??''),mechanic,...values});}
 function hit(e,delay,values,key){if(!possible(values.enabled??1))return;enqueue({kind:'hit',role,time:actionTime(e.time+delay),rootOrder:e.rootOrder+20,order:e.order,step:delay?0:(e.step??0)+1,parts:1,part:0,element:'Electro',application:null,...values,eventId:eventKey(e)+'/'+key,parentEventId:eventKey(e)});}
 const ratios={gradient:MITYA_RATIOS.gradient[c.skill1],overflow:MITYA_RATIOS.overflow[c.skill2],detonation:MITYA_RATIOS.detonation[c.skill2],c4:3};
 const star=(e,kind,enabled,n=1)=>hit(e,0,{index:8,category:kind==='gradient'?'charged':kind==='c4'?'other':'skill',damageModel:'reaction.stellarConduct',stellarScaling:'em',mityaKind:kind,mityaCount:n,stellarRatio:m.mul(ratios[kind],n),stellarIndependent:c.constellation>=6?m.choose(m.eq(s.mode,1),1.15,1):1,enabled:and(enabled,m.gt(n,0)),label:{gradient:'递变聚爆·星超导',overflow:'稳态炉心·信标溢出',detonation:'稳态炉心·引爆',c4:'米提亚·同位素'}[kind]},kind);
 function consume(e,n,gate){
  const used=m.choose(gate,n,0),total=m.add(s.consumed,used),proc=and(gate,m.ge(total,5));s.consumed=m.sub(total,m.mul(m.floor(m.div(total,5)),5));
  if(c.constellation>=4)star(e,'c4',and(proc,m.gt(mode(e),0)),m.floor(m.div(total,5)));
 }
 function gain(e,n,gate){
  const before=count(e),overflow=and(gate,and(m.eq(mode(e),1),m.ge(before,limit))),add=m.choose(gate,n,0);
  const excess=m.choose(m.eq(mode(e),1),m.max(0,m.sub(m.add(before,add),limit)),0);
  s.beacons=m.choose(gate,m.min(limit,m.add(before,n)),s.beacons);s.beaconUntil=m.choose(gate,actionTime(e.time+life),s.beaconUntil);
  if(teamTalentUnlocked(c,4)){s.crit=m.choose(gate,m.min(4,m.add(m.choose(m.lt(e.time,s.critUntil),s.crit,0),n)),s.crit);s.critUntil=m.choose(gate,actionTime(e.time+15),s.critUntil);}
  star(e,'overflow',and(gate,m.gt(excess,0)),excess);consume(e,excess,gate);
  reactions.refreshField(e,life,gate);
  recordResource({kind:'resource',role,time:e.time,rootOrder:e.rootOrder,eventId:eventKey(e)+'/beacon',resource:'mitya.beacons',before,after:s.beacons,enabled:gate,reason:'gain'});remember(e);
 }
 return {
  beforeEvent(e){
   if(e.role===role&&['cast','action'].includes(e.kind)||e.kind==='switch'&&e.from===role&&e.role!==role){
    const gate=e.enabled??1;s.channelToken=m.choose(gate,++channelSerial,s.channelToken);
    if(channel){channel.end=m.choose(gate,m.min(channel.end,e.time),channel.end);complete(channel.action,channel.end);}
   }
  },
  stateAt(e){const row=history.findLast(h=>compareEventPosition(h.at,e)<=0);return {mode:row?m.choose(m.lt(e.time,row.coreUntil),row.mode,0):0,beacons:row?m.choose(m.lt(e.time,row.beaconUntil),row.beacons,0):0,crit:row?m.choose(m.lt(e.time,row.critUntil),row.crit,0):0};},
  onEvent(e){
   const gate=e.enabled??1;if(!possible(gate))return;
   if(e.kind==='reaction'&&e.reactionType==='StellarConduct'){
    const duration=teamTalentUnlocked(c,1)?m.choose(m.eq(mode(e),2),6,3):3;
    const start=and(gate,m.gt(e.time,s.generationUntil));s.generationUntil=m.choose(gate,m.add(e.time,duration),s.generationUntil);
    s.generationNext=m.choose(start,actionTime(e.time+1.5),s.generationNext);if(possible(start))timer(e,1.5,'mitya.generate',{enabled:start});remember(e);return;
   }
   if(e.role!==role)return;
   if(e.kind==='cast'&&e.action==='skill'){
    const inRecast=m.lt(e.time,s.recastUntil),recast=e.actionId==='skill'?and(gate,and(inRecast,m.ge(e.time,s.recastReady))):0;
    const fresh=and(gate,m.choose(inRecast,0,1)),old=mode(e),held=count(e);star(e,'detonation',and(fresh,m.eq(old,1)),held);consume(e,held,and(fresh,m.eq(old,1)));s.beacons=m.choose(and(fresh,m.eq(old,1)),0,s.beacons);
    const next=e.actionId==='skill.hold'?2:1;s.mode=m.choose(recast,m.sub(3,old),m.choose(fresh,next,s.mode));s.coreUntil=m.choose(fresh,actionTime(e.time+(next===1?MITYA_TIMING.tap:MITYA_TIMING.hold)+25),s.coreUntil);
    s.recastUntil=m.choose(fresh,actionTime(e.time+6),s.recastUntil);s.recastReady=m.choose(m.max(fresh,recast),actionTime(e.time+1.5),s.recastReady);
    const id=++token;s.coreToken=m.choose(fresh,id,s.coreToken);
    hit(e,next===1?MITYA_TIMING.tap:MITYA_TIMING.hold,{index:next===1?9:10,category:'skill',application:application(),enabled:fresh,label:next===1?'律定·变量侦测·点按':'律定·变量侦测·长按',completionRoot:e.id},'skill');
    timer(e,next===1?MITYA_TIMING.tap:MITYA_TIMING.hold,'mitya.core',{token:id,enabled:fresh});timer(e,(next===1?MITYA_TIMING.tap:MITYA_TIMING.hold)+25,'mitya.expire',{token:id,enabled:fresh});
    if(c.constellation>=1)gain(e,1,fresh);remember(e);complete(e,actionTime(e.time+(next===1?MITYA_TIMING.tap:MITYA_TIMING.hold)));
   }else if(e.kind==='cast'&&e.action==='burst'){
    hit(e,MITYA_TIMING.burst,{index:14,category:'burst',application:application(2),enabled:gate,label:'解析·递变之理',completionRoot:e.id},'burst');timer(e,MITYA_TIMING.burst,'mitya.burst-beacons',{enabled:gate,rootOrder:e.rootOrder+30});complete(e,actionTime(e.time+MITYA_TIMING.burst));
   }else if(e.kind==='action'&&e.action==='charged'){
    const special=and(gate,and(m.eq(mode(e),2),m.gt(count(e),0)));
    hit(e,MITYA_TIMING.charged,{index:3,category:'charged',application:application(),enabled:and(gate,m.choose(special,0,1)),label:'重击',completionRoot:e.id},'charged');
    hit(e,MITYA_TIMING.firstPulse,{index:7,category:'charged',application:application(1,'mitya.gradient',3,2.5),enabled:special,label:'递变聚爆',completionRoot:e.id},'gradient');
    const duration=(e.params?.holdMs??2800)/1000;
    // Resolve the opening Electro contact before the simultaneous first
    // consumption/refund, so that refund cannot buff the earlier contact.
    for(let n=0;MITYA_TIMING.firstPulse+n*MITYA_TIMING.pulse<=duration+1e-9;n++)timer(e,MITYA_TIMING.firstPulse+n*MITYA_TIMING.pulse,'mitya.pulse',{n,origin:e,channelToken:s.channelToken,enabled:special,rootOrder:e.rootOrder+30});
    channel={action:e,end:actionTime(e.time+duration)};complete(e,channel.end);
   }else if(e.mechanic==='mitya.generate'){
    const live=and(gate,and(m.eq(e.time,s.generationNext),m.ge(s.generationUntil,e.time)));gain(e,1,live);
    s.generationNext=m.choose(live,actionTime(e.time+1.5),s.generationNext);if(possible(live))timer(e,1.5,'mitya.generate',{enabled:live});remember(e);
   }else if(e.mechanic==='mitya.burst-beacons')gain(e,3,gate);
   else if(e.mechanic==='mitya.core'){
    const live=and(gate,and(m.eq(e.token,s.coreToken),m.lt(e.time,s.coreUntil))),steady=and(live,m.eq(mode(e),1));
    hit(e,0,{index:11,ratio:MITYA_RATIOS.steady[c.skill2]*(c.constellation>=6?1.15:1),category:'skill',application:application(1,'mitya.core',3,2.5),mityaSteady:true,enabled:steady,label:'侦测炉心·稳态'},'core');
    if(possible(live))timer(e,MITYA_TIMING.core,'mitya.core',{token:e.token,enabled:live});
   }else if(e.mechanic==='mitya.expire'){
    const live=and(gate,m.eq(e.token,s.coreToken)),held=count(e),steady=and(live,m.eq(s.mode,1));star(e,'detonation',steady,held);consume(e,held,steady);s.beacons=m.choose(steady,0,s.beacons);s.mode=m.choose(live,0,s.mode);remember(e);
   }else if(e.mechanic==='mitya.pulse'){
    const live=and(gate,and(m.eq(e.channelToken,s.channelToken),and(activeRole(e.time,e.rootOrder)===role?1:0,and(m.eq(mode(e),2),m.gt(count(e),0)))));
    star(e,'gradient',live);const before=count(e);s.beacons=m.choose(live,m.sub(before,1),s.beacons);consume(e,1,live);
    if(c.constellation>=6)gain(e,1,random('mitya.refund/'+eventKey(e),m.mul(.34,live),'米提亚·六命信标返还'));
    recordResource({kind:'resource',role,time:e.time,rootOrder:e.rootOrder,eventId:eventKey(e)+'/consume',resource:'mitya.beacons',before,after:s.beacons,enabled:live,reason:'gradient'});remember(e);
   }
  },
 };
}

import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {actionTime} from '../rule-utils.mjs';
import {afterEvent,compareEventPosition,eventKey} from '../event-order.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {hitTargets} from '../hit-targets.mjs';
import {characterPackages} from '../character-packages.mjs';
import {hasAscendantGleam} from '../moon-crystallize.mjs';

// A distribution over the 19 possible C1 stack counts retains the correlation
// between a double projectile, the stacks it spends and the following hits.
function createCatalog(c,m){
 let expires=-Infinity;
 let distribution=Array.from({length:19},(_,i)=>Number(i===0));
 const possible=v=>typeof v==='object'||!!v,unit=c===6?2:1,scale=c===6?1.5:1;
 function transition(gate,move){
  const next=Array(19).fill(0);
  distribution.forEach((probability,n)=>{
   if(!possible(probability))return;
   const dest=move(n);
   if(dest===n){next[n]=m.add(next[n],probability);return;}
   next[n]=m.add(next[n],m.mul(probability,m.sub(1,gate)));
   next[dest]=m.add(next[dest],m.mul(probability,gate));
  });distribution=next;
 }
 function expire(e){const dead=m.ge(e.time,expires);if(possible(dead))transition(dead,()=>0);}
 return {grant(e,amount){
  expire(e);const gate=e.enabled??1;transition(gate,n=>Math.min(18,n+amount));expires=m.choose(gate,e.time+10,expires);
 },direct(e,targets){
  expire(e);const mega=e.index===10&&e.linneaHammer,limit=(mega?5:1)*unit,used={};
  for(const target of targets){
   const mean=distribution.reduce((n,p,i)=>m.add(n,m.mul(p,Math.min(limit,i))),0);
   used[target]=m.mul(mean,(mega?1.5:.75)*scale);
   transition(e.enabled??1,n=>Math.max(0,n-limit));
  }
  return used;
 },projectile(e){
  expire(e);
  const cases=[],next=Array(19).fill(0);
  for(const [n,p] of distribution.entries()){
   if(!possible(p))continue;
   let remaining=n;
   const read=()=>e.contributors.map(c=>{
    const spend=m.choose(c.enabled,m.min(remaining,unit),0);remaining=m.sub(remaining,spend);return m.mul(.75*scale,spend);
   });
   const first=read(),afterFirst=remaining;
   const chance=e.domainDouble ? .33 : 0,second=chance?read():null;
   cases.push({weight:p,flat:first});if(chance)cases.push({weight:m.mul(p,chance),flat:second});
   // Remaining can be symbolic when a candidate changes reaction ownership.
   const accumulate=(amount,prob)=>{
    if(typeof amount==='number'){next[amount]=m.add(next[amount],prob);return;}
    for(let k=0;k<=n;k++)next[k]=m.add(next[k],m.choose(m.eq(amount,k),prob,0));
   };
   accumulate(n,m.mul(p,m.sub(1,e.enabled)));
   accumulate(afterFirst,m.mul(p,m.mul(e.enabled,1-chance)));
   if(chance)accumulate(remaining,m.mul(p,m.mul(e.enabled,chance)));
  }
  distribution=next;return cases;
 }};
}

export function createLinneaRuntime({role,profiles,profile,roots,settings,math:m=scalarMath,enqueue,reactions,actorIds,previewWindow}){
 const c=profile.character.constellation,history=[],pummeler=application(1,'linnea.pummeler',3,2.5),full=hasAscendantGleam(profiles);
 const catalog=c>=1?createCatalog(c,m):null;
 const first=roots.find(e=>e.role===role&&e.kind==='cast');
 let token=0,warm=first?.actionId==='skill.refresh',expires=warm?25:-Infinity,chainUntil=-Infinity,presses=0,superPower=true;
 const initialExpires=expires,spent=new Map(),scheduled=new Map();
 const possible=value=>typeof value==='object'||!!value;
 let window=warm&&previewWindow?previewWindow('露米',{...first,time:0},initialExpires):undefined;
 function save(e){
  history.push({at:afterEvent(e),expires});
  if(!previewWindow)return;
  if(window&&window.end>=e.time){window.end=expires>e.time?expires:e.time;return;}
  if(expires>e.time)window=previewWindow('露米',e,expires-e.time);
 }
 function timer(e,delay,phase,enabled=1,sequence=0){
  if(!possible(enabled))return;
  const time=actionTime(e.time+delay);
  const eventId=['linnea',role,token,phase,sequence,time].join('/');
  const existing=scheduled.get(eventId);
  scheduled.set(eventId,existing===undefined?enabled:m.max(existing,enabled));
  if(existing===undefined)enqueue({kind:'timer',role,time,rootOrder:e.rootOrder,order:e.order,step:(e.step??0)+1,token,phase,sequence,mechanic:'linnea.summon',eventId});
 }
 function hit(e,index,label,delay,part,enabled){
  enqueue({kind:'hit',role,index,label,part,parts:1,element:'Geo',category:'skill',linneaHammer:true,persistent:true,enabled,
   time:actionTime(e.time+delay),rootOrder:e.rootOrder,order:e.order,step:(e.step??0)+2,eventId:eventKey(e)+'/hit/'+part,
   ...(index===8?{application:pummeler}:{lunarStat:'def',damageModel:'direct.lunarCrystallize'})});
 }
 function summon(e,delay,withCages){
  expires=actionTime(e.time+25);warm=false;superPower=true;save(e);
  const cages=reactions.at(e).moonCages;
  timer(e,delay,'attack',m.choose(cages,0,e.enabled??1),0);
  timer(e,delay,'attack',m.choose(cages,e.enabled??1,0),withCages);
 }
 return {stateAt:e=>({expires:history.findLast(h=>compareEventPosition(h.at,e)<=0)?.expires??initialExpires,spent:spent.get(eventKey(e))}),
  beforeEvent(e){
   if(e.mechanic==='linnea.summon'){e.enabled=m.choose(e.enabled??1,scheduled.get(e.eventId),0);scheduled.delete(e.eventId);}
   if(e.cycleLumi&&(!warm||e.time>=expires))e.enabled=0;
   if(e.damageModel==='direct.lunarCrystallize'&&catalog)spent.set(eventKey(e),catalog.direct(e,hitTargets(e,settings)));
   if(e.mechanic==='lunar.launch'&&catalog){e.catalogCases=catalog.projectile(e);e.catalogOwner=role;}
  },onEvent(e){
   if(e.mechanic==='lunar.harmony'){
    catalog?.grant(e,c===6?18:6);
    if(c>=2)enqueue({...afterEvent(e),role,mechanic:'linnea.harmony',eventId:e.eventId+'/linnea'});
    return;
   }
   if(e.role!==role)return;
   if(e.kind==='cast'&&e.action==='burst'){
    if(e.time<expires){expires=e.time+25;save(e);}else{token++;summon(e,214/60,1);}
    return;
   }
   if(e.kind==='cast'&&e.action==='skill'){
    if(e.actionId==='skill.refresh'&&warm&&e.time<expires){expires=e.time+25;save(e);catalog?.grant(e,6);return;}
    if(e.time<chainUntil||e.actionId==='skill.mega'){
     presses++;chainUntil=e.time+.6;
     if(e.actionId==='skill.mega'&&presses===1)catalog?.grant(e,6);
     if(presses>=3||e.actionId==='skill.mega'){
      warm=false;superPower=false;expires=e.time+25;chainUntil=-Infinity;token++;timer(e,50/60,'mega');timer(e,98/60,'attack');save(e);
     }else{token++;timer(e,.6,'summon',e.enabled??1);}
    }else{presses=0;chainUntil=e.time+.6;token++;warm=false;expires=-Infinity;save(e);timer(e,.6,'summon',e.enabled??1);catalog?.grant(e,6);}
    return;
   }
   if(e.mechanic!=='linnea.summon'||e.token!==token)return;
   if(e.phase==='summon'){summon(e,122/60,presses?1:2);return;}
   if(e.time>=expires)return;
   if(e.phase==='mega'){hit(e,10,'露米·百万吨重锤',0,0,e.enabled);return;}
   const i=e.sequence,heavy=superPower&&i===2;
   if(heavy)hit(e,9,'露米·加力重锤',0,0,e.enabled);
   else{hit(e,8,'露米·捶捶乱打',0,0,e.enabled);hit(e,8,'露米·捶捶乱打',21/60,1,e.enabled);}
   const delay=superPower?[62,122,90][i]/60:2;
   if(!superPower){timer(e,delay,'attack',e.enabled);return;}
   const cages=reactions.at(e).moonCages;
   timer(e,delay,'attack',m.choose(cages,e.enabled,0),(i+1)%3);
   timer(e,delay,'attack',m.choose(cages,0,e.enabled),0);
  },onHit(e){
   if(e.role!==role||e.index!==10||!e.linneaHammer||c<2||!full)return;
   const members=profiles.map((p,r)=>({role:r,actorId:actorIds[r],enabled:Number(['Hydro','Geo'].includes(characterPackages[p.character.name].element))}));
   reactions.projectiles(e,hitTargets(e,settings)[0],members,e.enabled??1);
  },
 };
}

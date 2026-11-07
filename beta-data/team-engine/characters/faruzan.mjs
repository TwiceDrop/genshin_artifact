import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {effect,numericSum,actionTime} from '../rule-utils.mjs';
import {afterEvent,eventKey,compareEventPosition} from '../event-order.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {hitTargets} from '../hit-targets.mjs';
import {triggersHit} from '../damage-contract.mjs';

export function createFaruzanRuntime({role,profile,settings={},math:m=scalarMath,enqueue,activeRole,observeHit=e=>e.enabled??1,complete=(a,t)=>{a.completionTime=t;}}){
 const c=profile.character,and=(a,b)=>m.choose(a,b,0),possible=v=>typeof v==='object'||!!v,history=[],guard=new Map();let serial=0;
 const s={manifestUntil:-Infinity,arrows:0,benefitUntil:-Infinity,token:0,resUntil:{},a4Ready:-Infinity,c6Ready:-Infinity};
 const remember=e=>history.push({at:afterEvent(e),...s,resUntil:{...s.resUntil}});
 function hit(e,delay,index,category,element,enabled,key,extra={}){if(possible(enabled))enqueue({kind:'hit',role,time:actionTime(e.time+delay),rootOrder:e.rootOrder+(e.kind==='action'||e.kind==='cast'?20:0),order:e.order,step:delay?0:(e.step??0)+1,index,category,element,application:element==='Anemo'?application():null,part:0,parts:1,enabled,eventId:eventKey(e)+'/'+key,parentEventId:eventKey(e),...extra});}
 function timer(e,delay,mechanic,values={},key=mechanic){enqueue({kind:'timer',role,time:actionTime(e.time+delay),rootOrder:e.rootOrder+10,order:e.order,step:delay?0:(e.step??0)+1,eventId:eventKey(e)+'/'+key,mechanic,...values});}
 function shred(e,gate){for(const id of hitTargets(e,settings))s.resUntil[id]=m.choose(gate,actionTime(e.time+4),s.resUntil[id]??-Infinity);remember(e);}
 function collapse(e,gate,key){hit(e,33/60,10,'skill','Anemo',gate,key,{label:'风压塌陷',followup:true,statSnapshot:{time:e.time,rootOrder:e.rootOrder,order:e.order,step:(e.step??0)+1}});}
 return {
  stateAt(e){const h=history.findLast(h=>compareEventPosition(h.at,e)<=0);return {benefit:h?m.lt(e.time,h.benefitUntil):0,resUntil:h?.resUntil??{},guard:guard.get(eventKey(e))};},
  beforeEvent(e){
   if(!teamTalentUnlocked(c,4)||!triggersHit(e)||e.element!=='Anemo'||e.damageModel&&e.damageModel!=='native.skill'||!['normal','charged','plunge','skill','burst'].includes(e.category))return;
   const enabled=and(e.enabled??1,and(m.lt(e.time,s.benefitUntil),m.ge(e.time,s.a4Ready))),used=and(enabled,observeHit(e));
   guard.set(eventKey(e),{target:hitTargets(e,settings)[0],enabled:used});s.a4Ready=m.choose(used,actionTime(e.time+.8),s.a4Ready);
  },
  onEvent(e){
   if(e.role!==role)return;const gate=e.enabled??1;
   if(e.kind==='cast'&&e.action==='skill'){
    s.manifestUntil=m.choose(gate,actionTime(e.time+18.2),s.manifestUntil);s.arrows=m.choose(gate,c.constellation>=1?2:1,s.arrows);remember(e);
    hit(e,14/60,9,'skill','Anemo',gate,'skill',{label:'非想风天',completionRoot:e.id});complete(e,actionTime(e.time+14/60));
   }else if(e.kind==='cast'&&e.action==='burst'){
    const token=++serial;s.token=m.choose(gate,token,s.token);const duration=745+(c.constellation>=2?360:0);
    timer(e,43/60,'faruzan.benefit',{token,enabled:gate,until:actionTime(e.time+(43+duration)/60+4)});
    hit(e,54/60,11,'burst','Anemo',gate,'burst',{label:'抟风秘道',completionRoot:e.id});
    for(let frame=137;frame<=duration;frame+=120)timer(e,(43+frame)/60,'faruzan.pulse',{token,enabled:gate},'pulse/'+frame);
    complete(e,actionTime(e.time+54/60));remember(e);
   }else if(e.mechanic==='faruzan.benefit'){s.benefitUntil=m.choose(and(gate,m.eq(e.token,s.token)),e.until,s.benefitUntil);remember(e);}
   else if(e.mechanic==='faruzan.pulse')shred(e,and(gate,m.eq(e.token,s.token)));
   else if(e.kind==='action'){
    if(e.action==='charged'){
     const empowered=and(m.lt(e.time,s.manifestUntil),m.gt(s.arrows,0)),quick=teamTalentUnlocked(c,1)?empowered:0;
     // Travel time is an action fact, not a final buff or damage multiplier.
     const travel=(e.params?.travelMs??0)/1000;
     for(const fast of [true,false]){const enabled=and(gate,fast?quick:m.choose(quick,0,1)),delay=(fast?49:86)/60+travel;
      hit(e,delay,5,'charged','Anemo',enabled,'aim/'+fast,{label:'满蓄力瞄准射击',hurricane:empowered,completionRoot:e.id});}
     s.arrows=m.sub(s.arrows,m.choose(and(gate,empowered),1,0));complete(e,m.add(e.time+travel,m.choose(quick,49/60,86/60)));remember(e);
    }else{const normal=e.action.startsWith('normal.'),index=normal?Number(e.action.at(-1))-1:({'aimed':4,'plunge.collision':6,'plunge.low':7,plunge:8})[e.action],delay=normal?[14,10,24,29][index]/60:index===4?15/60:0;
     hit(e,delay,index,normal?'normal':index===4?'charged':'plunge','Physical',gate,'attack',{label:normal?'普通攻击·第'+(index+1)+'段':index===4?'瞄准射击':'下落攻击',completionRoot:e.id});complete(e,actionTime(e.time+delay));}
   }
  },
  onHit(e){if(e.role!==role)return;const gate=and(e.enabled??1,observeHit(e));if(e.index===11||e.index===10&&teamTalentUnlocked(c,1))shred(e,gate);if(e.hurricane!==undefined)collapse(e,and(gate,e.hurricane),'hurricane-collapse');},
  afterEvent(e){
   if(c.constellation<6||e.kind!=='hit')return;
   const front=activeRole(e.time,e.rootOrder),owner=e.contributors?e.contributors.find(c=>c.role===front)?.enabled??0:e.role===front?1:0;
   // Existence follows the resolved contact. The amount is not a separate
   // proc chance; putting the whole damage graph in this gate recursively
   // expands every later collapse even though its fixed cooldown forbids it.
   const gate=and(e.enabled??1,and(owner,and(m.lt(e.time,s.benefitUntil),and(m.ge(e.time,s.c6Ready),observeHit(e)))));
   s.c6Ready=m.choose(gate,actionTime(e.time+3),s.c6Ready);if(possible(gate))collapse(e,gate,'c6-collapse');remember(e);
  },
 };
}
export const faruzan={
 id:'Faruzan',element:'Anemo',weaponType:'Bow',panelIndex:9,reactionStatIndex:0,usesElementalApplications:true,nativeBackend:'legacy',constellationTalents:{3:'skill2',5:'skill3'},
 defaultWeapon:'FavoniusWarbow',previewWeapon:'HuntersBow',capabilities:{energy:80,shield:false,nightsoul:false,arkhe:false},isBlunt:e=>[7,8].includes(e.index),
 nativeDamage:Object.fromEntries(Array.from({length:12},(_,index)=>[index,{category:index<4?'normal':index<6?'charged':index<9?'plunge':index<11?'skill':'burst',element:index===5||index>=9?'Anemo':'Physical',...(index>=6&&index<9?{plungeImpact:index!==6}:{})}])),
 actions:[...[14,10,24,29].map((f,i)=>({id:'normal.'+(i+1),label:'普通攻击·第'+(i+1)+'段',endOffsetMs:f/60*1000})),{id:'aimed',label:'瞄准射击',endOffsetMs:250},
  {id:'charged',label:'满蓄力／飓烈箭',endOffsetMs:(86+33)/60*1000,parameters:[{key:'travelMs',label:'箭矢飞行时间（秒）',min:0,max:3000,scale:1000,step:.05,error:'箭矢飞行时间须为0～3秒'}]},
  {id:'plunge',label:'高空下落攻击'},{id:'plunge.low',label:'低空下落攻击'},{id:'plunge.collision',label:'下落期间伤害'},
  {id:'skill',label:'非想风天',endOffsetMs:14/60*1000},{id:'burst',label:'抟风秘道',endOffsetMs:54/60*1000}],
 modeled:['FaruzanQ'],normalize:p=>{p.character.params={Faruzan:{q_ratio:0}};},skillConfig:()=>({Faruzan:{talent2_ratio:0}}),
 expand(){},createTimeline:createFaruzanRuntime,createCombat:createFaruzanRuntime,finiteFollowupDelay:()=>33/60,combatCompletion:a=>a.kind==='cast'||a.kind==='action'?a.time:undefined,
 create({role,profiles,rotation,math:m}){const c=profiles[role].character,sum=numericSum(m),bonus=[.18,.1935,.207,.225,.2385,.252,.27,.288,.306,.324,.342,.36,.3825,.405,.4275][c.skill3];return {
  needsIndividualTargets:e=>e.element==='Anemo',
  damageBuffs(r,e,_p,source){const s=rotation().characterState?.(role,e);if(!s||e.element!=='Anemo')return [];
   const ids=e.targetIds??[],minus=ids.length?ids.reduce((n,id)=>m.add(n,m.choose(m.lt(e.time,s.resUntil[id]??-Infinity),.3,0)),0):0,star=['reaction.stellarSwirl','direct.stellarSwirl'].includes(e.damageModel);
   const out=[effect('珐露珊·祈风之赐',{BonusAnemo:m.mul(bonus,s.benefit)}),effect('珐露珊·诡风之祸',{ResMinusBase:ids.length?m.div(minus,ids.length):0})];
   if(c.constellation>=6)out.push(effect('珐露珊·六命',star?{StellarSwirlCritDamage:m.mul(.4,s.benefit)}:{CriticalDamageAnemo:m.mul(.4,s.benefit)}));
   if(s.guard&&ids.includes(s.guard.target))out.push(effect('珐露珊·七窟遗智',{ExtraDmgBase:m.mul(.32,m.mul(s.guard.enabled,sum(source(role).base_atk)))}));return out;
  },
 };},
};

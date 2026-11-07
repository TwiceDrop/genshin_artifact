import {effect,actionTime} from '../rule-utils.mjs';
import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {afterEvent,eventKey,compareEventPosition} from '../event-order.mjs';
import {defineActionRecipes} from '../action-recipes.mjs';

const basics=defineActionRecipes([
 ...[14,18,27,28].map((frame,index)=>({id:'normal.'+(index+1),label:'普通攻击·第'+(index+1)+'段',endOffsetMs:frame/60*1000,events:[{kind:'hit',index,category:'normal',element:'Anemo',delay:frame/60,application:application(1,'sucrose.normal',3,2.5)}]})),
 {id:'charged',label:'重击',endOffsetMs:900,events:[{kind:'hit',index:4,category:'charged',element:'Anemo',delay:.9,application:application()}]},
 ...[['plunge',7,'高空下落攻击'],['plunge.low',6,'低空下落攻击'],['plunge.collision',5,'下落期间伤害']].map(([id,index,label])=>({id,label,events:[{kind:'hit',index,category:'plunge',element:'Anemo',application:index===5?null:application()}]})),
 {id:'skill',label:'风灵作成·陆叁零捌',endOffsetMs:700,events:[{kind:'hit',index:8,category:'skill',element:'Anemo',delay:.7,application:application()}]},
]);
export function createSucroseRuntime({role,profile,settings={},math:m=scalarMath,reactions,enqueue,readStat=()=>0,observeHit=e=>e.enabled??1,complete=(a,t)=>{a.completionTime=t;}}){
 const c=profile.character,and=(a,b)=>m.choose(a,b,0),possible=v=>typeof v==='object'||!!v,history=[];
 const s={a1:{},a4:0,a4Until:-Infinity,burstUntil:-Infinity,absorbed:0,token:0};let serial=0;
 const elements=['Hydro','Electro','Cryo'],remember=e=>history.push({at:afterEvent(e),...s,a1:{...s.a1}});
 function absorb(e,gate){
  const targets=reactions.view().targets;
  for(const [i,element]of elements.entries()){
   const present=targets.reduce((n,t)=>m.max(n,element==='Cryo'?t.cryoAffected:m.gt(t[element],0)),0),yes=and(gate,and(m.eq(s.absorbed,0),present));
   s.absorbed=m.choose(yes,i+1,s.absorbed);
  }
 }
 return {
  stateAt(e){return history.findLast(h=>compareEventPosition(h.at,e)<=0)??{a1:{},a4:0,a4Until:-Infinity,burstUntil:-Infinity,absorbed:0};},
  onEvent(e){
   const gate=e.enabled??1;
   if(e.role===role&&e.kind==='reaction'&&['Swirl','StellarSwirl'].includes(e.reactionType)&&teamTalentUnlocked(c,1)){
    for(const element of e.elements.filter(el=>el!=='Anemo'))s.a1[element]=m.choose(gate,actionTime(e.time+8),s.a1[element]??-Infinity);remember(e);
   }
   if(e.role!==role)return;
   if(e.kind==='cast'&&e.action==='burst'){
    const token=++serial;s.token=m.choose(gate,token,s.token);s.absorbed=m.choose(gate,0,s.absorbed);s.burstUntil=m.choose(gate,actionTime(e.time+47/60+6+(c.constellation>=2?2:0)),s.burstUntil);
    const snapshot={time:actionTime(e.time+47/60),rootOrder:e.rootOrder+10,order:e.order,step:0};
    for(let n=0;n<(c.constellation>=2?4:3);n++)enqueue({kind:'timer',role,time:actionTime(e.time+137/60+2*n),rootOrder:e.rootOrder+20,eventId:e.id+'/pulse/'+n,mechanic:'sucrose.pulse',token,enabled:gate,statSnapshot:snapshot});
    complete(e,actionTime(e.time+137/60));remember(e);
   }else if(e.mechanic==='sucrose.pulse'){
    const live=and(gate,m.eq(s.token,e.token));absorb(e,live);remember(e);
    const emit=(index,element,enabled,key)=>{if(!possible(enabled))return;enqueue({kind:'hit',role,time:e.time,rootOrder:e.rootOrder,order:e.order,step:(e.step??0)+1,parts:1,part:0,index,element,category:'burst',application:application(),enabled,statSnapshot:e.statSnapshot,label:'禁·风灵作成'+(index===9?'':'·'+element),eventId:eventKey(e)+'/'+key,parentEventId:eventKey(e)});};
    emit(9,'Anemo',live,'anemo');for(const [i,element]of elements.entries())emit({Hydro:11,Electro:12,Cryo:13}[element],element,and(live,m.eq(s.absorbed,i+1)),element);
   }else if(e.mechanic==='sucrose.share'){
    s.a4=m.choose(gate,m.mul(.2,readStat(role,'elemental_mastery_convertible',e)),s.a4);s.a4Until=m.choose(gate,actionTime(e.time+8),s.a4Until);remember(e);
   }
  },
  onHit(e){if(e.role!==role||!['skill','burst'].includes(e.category)||!teamTalentUnlocked(c,4))return;
   enqueue({kind:'timer',role,time:e.time,rootOrder:e.rootOrder,order:e.order,step:(e.step??0)+100,eventId:eventKey(e)+'/share',mechanic:'sucrose.share',enabled:and(e.enabled??1,observeHit(e))});
  },
  afterEvent(e){if(e.kind==='hit'||e.kind==='application'){absorb(e,m.lt(e.time,s.burstUntil));remember(e);}},
 };
}
export const sucrose={
 id:'Sucrose',element:'Anemo',weaponType:'Catalyst',panelIndex:8,reactionStatIndex:0,usesElementalApplications:true,nativeBackend:'legacy',
 constellationTalents:{3:'skill2',5:'skill3'},defaultWeapon:'SacrificialFragments',previewWeapon:'ApprenticesNotes',capabilities:{energy:80,shield:false,nightsoul:false,arkhe:false},isBlunt:e=>[6,7].includes(e.index),
 nativeDamage:Object.fromEntries(Array.from({length:14},(_,index)=>[index,{category:index<4?'normal':index===4?'charged':index<8?'plunge':index===8?'skill':'burst',element:index<10?'Anemo':['Pyro','Hydro','Electro','Cryo'][index-10],...(index>=5&&index<=7?{plungeImpact:index!==5}:{})}])),
 actions:[...basics.actions,{id:'burst',label:'禁·风灵作成·柒伍同构贰型',endOffsetMs:137/60*1000}],
 modeled:['SucroseTalent1','SucroseTalent2','SucroseC6'],normalize:p=>{p.character.params='NoConfig';},
 expand:ctx=>basics.expand({...ctx,actions:ctx.actions.filter(a=>a.action!=='burst')}),createTimeline:createSucroseRuntime,createCombat:createSucroseRuntime,
 finiteFollowupDelay:()=>5/60,
 create({role,profiles,elements,rotation,math:m}){return {attackBuffs(r,e){const s=rotation().characterState?.(role,e);if(!s)return [];const out=[];
  if(r!==role)out.push(effect('砂糖·触媒置换术',{ElementalMastery:m.choose(m.lt(e.time,s.a1[elements[r]]??-Infinity),50,0)}),effect('砂糖·小小的慧风',{ElementalMasteryExtra:m.choose(m.lt(e.time,s.a4Until),s.a4,0)}));
  if(profiles[role].character.constellation>=6)out.push(effect('砂糖·混元熵增论',Object.fromEntries(['Hydro','Electro','Cryo'].map((el,i)=>['Bonus'+el,m.choose(m.lt(e.time,s.burstUntil),m.choose(m.eq(s.absorbed,i+1),.2,0),0)]))));return out;
 }};},
};

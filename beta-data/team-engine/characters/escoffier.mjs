import {teamTalentUnlocked} from '../../team-dps-character-rules.mjs';
import {effect,numericSum,hydroCryo} from '../rule-utils.mjs';

export const escoffier={
 id:'Escoffier',element:'Cryo',panelIndex:8,
 modeled:['EscoffierTalent3','EscoffierC1','EscoffierC2'],
 normalize:p=>{p.character.params={Escoffier:{hydro_cryo_count:0,after_burst:false}};},
 // The prototype retains the existing Frosty Parfait clock. Initial E/Arkhe
 // strikes remain outside this registered action model, as in the legacy axis.
 timing:{parfait:{start:0,interval:1,duration:20},rehab:{start:1,interval:1,duration:9}},
 expand({actions,profile,hit,heal,periodic,addWindow}){
  for(const a of actions){
   if(a.action==='skill'){
    addWindow('escoFlat',a,15,0,{uses:5});
    periodic(a,escoffier.timing.parfait,offset=>hit(a,{index:8,category:'skill',parts:1,label:'冻霜芭菲'},offset,'parfait/'+offset));
   }else if(a.action==='burst'){
    heal(a,0,'team');hit(a,{index:9,category:'burst',parts:1,label:'花刀技法'},0,'burst');
    if(teamTalentUnlocked(profile.character,1))periodic(a,{...escoffier.timing.rehab,duration:escoffier.timing.rehab.duration+1+(profile.character.constellation>=4?6:0)},offset=>heal(a,offset,'active'));
   }else{const {index,category,label}={'normal.1':{index:0,category:'normal',label:'普通攻击·一段'},charged:{index:3,category:'charged',label:'重击'},plunge:{index:6,category:'plunge',label:'下落攻击'}}[a.action];hit(a,{index,category,label,parts:1,element:'Physical'},0,a.action);}
  }
 },
 derive({role,profile,events,activeRole,lastCast}){
  if(profile.character.constellation<6)return;
  let last=-Infinity,remaining=0,cast=-Infinity;
  for(const e of [...events].filter(e=>e.role===activeRole(e.time,e.rootOrder)&&['normal','charged','plunge'].includes(e.category))){
   const latest=lastCast(role,'skill',e.time,e.rootOrder);if(latest!==cast){cast=latest;remaining=6;}
   if(e.time<cast+20&&remaining>0&&e.time-last>=.5){events.push({role,index:8,category:'skill',parts:1,ratio:5,element:'Cryo',time:e.time,label:'特级冻霜芭菲·六命追加',part:0,serial:events.length,rootOrder:e.rootOrder+.01,eventId:e.eventId+'/escoffier.c6'});last=e.time;remaining--;}
  }
 },
 decorate({role,profile,events,window,settings}){
  const used=new Map(),targets=settings.damage_scope==='all'?(settings.enemy_count??1):1;
  for(const e of events){const cycle=window('escoFlat',e.time,e.rootOrder),eligible=e.role!==role&&e.onField&&e.element==='Cryo'&&cycle>=0;
   const n=used.get(cycle)||0;e.escoTargets=eligible?Math.max(0,Math.min(targets,5-n)):0;e.escoFlat=e.escoTargets>0;if(eligible)used.set(cycle,n+e.escoTargets);
  }
 },
 create({role,profiles,elements,rotation,math:m,settings}){
  const c=profiles[role].character,a4=teamTalentUnlocked(c,4),sum=numericSum(m),count=hydroCryo(elements);
  return {
   damageBuffs(r,e,panels,source){
    const out=[],rot=rotation();
    const active=a4&&rot.events.some(h=>h.role===role&&['skill','burst'].includes(h.category)&&h.time<=e.time&&e.time<h.time+12);
    if(active&&['Hydro','Cryo'].includes(e.element))out.push(effect('爱可菲·灵感浸入调味',{ResMinusBase:[0,.05,.1,.15,.55][count]}));
    const cast=Math.max(rot.lastCast(role,'skill',e.time),rot.lastCast(role,'burst',e.time));
    if(a4&&count===4&&c.constellation>=1&&e.time<cast+15&&e.element==='Cryo')out.push(effect('爱可菲·一命',{CriticalDamageBase:.6}));
    if(e.escoFlat&&c.constellation>=2){const targets=settings.damage_scope==='all'?(settings.enemy_count??1):1;out.push(effect('爱可菲·二命·冷盘',{ExtraDmgBase:m.div(m.mul(m.mul(2.4,sum(source(role).atk)),e.escoTargets),targets)}));}
    return out;
   },
   healingBase:(h,p,native)=>h.recipients.length===1?{amount:m.mul(1.3824,sum(p.atk)),outgoing:sum(p.healing_bonus)}:native(10),
  };
 },
 createHealth({role,profiles,base,math:m,total,panelAt}){
  const c=profiles[role].character,state={cast:-Infinity,mass:[1,0,0,0,0,0,0,0]};
  return {
   keepHeal:h=>h.role!==role||h.healing||h.recipients.length!==1||teamTalentUnlocked(c,1),
   healMultiplier(h,enabled){
    if(h.role!==role||h.healing==='traveling_doctor'||h.recipients.length!==1||c.constellation<4)return 1;
    const cast=base.lastCast(role,'burst',h.time,h.rootOrder),reset=m.eq(cast,state.cast),mass=state.mass.map((v,i)=>m.choose(reset,v,i===0?1:0)),cr=m.min(1,m.max(0,total(panelAt(role,h).critical))),next=mass.map(()=>0);
    let multiplier=1;
    for(let i=0;i<8;i++){
     if(i===7){next[7]=m.add(next[7],mass[i]);continue;}
     const won=m.mul(mass[i],cr);multiplier=m.add(multiplier,won);next[i]=m.add(next[i],m.mul(mass[i],m.sub(1,cr)));next[i+1]=m.add(next[i+1],won);
    }
    state.mass=next.map((v,i)=>m.choose(enabled,v,state.mass[i]));state.cast=m.choose(enabled,cast,state.cast);return multiplier;
   },
  };
 },
};

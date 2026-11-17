import {createEscoffierRuntime,escoffierSkillApplication} from './escoffier-runtime.mjs';
import {elementalApplication} from '../ice-electro-reactions.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {effect,numericSum,hydroCryo} from '../rule-utils.mjs';
import {compareEventPosition} from '../event-order.mjs';
import {eventKey} from '../event-order.mjs';
import {defineActionRecipes} from '../action-recipes.mjs';
import {percent} from '../buff-preview-format.mjs';

// gcsim's measured 60fps clock: 21 shots, first at frame 148, 58.5f
// intervals rounded up, then 5f default flight. Recasts stop future shots,
// while a projectile already in flight may still land.
const timing={initial:23/60,arkhe:83/60,travel:5/60,parfait:{duration:(148+Math.ceil(58.5*20)+1)/60,offsetAt:i=>(148+Math.ceil(58.5*i))/60},rehab:{start:1,interval:1,duration:9}};
const arkheRatio=[.336,.3612,.3864,.42,.4452,.4704,.504,.5376,.5712,.6048,.6384,.672,.714,.756,.798];
const resistanceByCount=[0,.05,.1,.15,.55],coldPlatterRatio=2.4,coldPlatterUses=5,c1CriticalDamage=.6;
const actions=defineActionRecipes([
 {id:'skill',label:'冻霜芭菲',endOffsetMs:timing.arkhe*1000,events:({character})=>[
  {kind:'hit',key:'initial',delay:timing.initial,index:7,category:'skill',parts:1,application:escoffierSkillApplication,label:'低温烹饪·施放'},
  {kind:'hit',key:'arkhe',delay:timing.arkhe,index:7,category:'skill',parts:1,ratio:arkheRatio[character.skill2],escoArkhe:true,arkhe:'ousia',label:'流涌之刃'},
  {kind:'hit',key:'parfait',repeat:timing.parfait,delay:timing.travel,index:8,category:'skill',parts:1,application:escoffierSkillApplication},
 ]},
 {id:'burst',label:'花刀技法',events:({character})=>[
  {kind:'heal',recipients:'team'},
  {kind:'hit',index:9,category:'burst',parts:1,application:elementalApplication(2)},
  ...(teamTalentUnlocked(character,1)?[{kind:'heal',recipients:'active',repeat:{...timing.rehab,duration:timing.rehab.duration+1+(character.constellation>=4?6:0)}}]:[]),
 ]},
 ...[['normal.1',0,'normal','普通攻击·一段'],['normal.2',1,'normal','普通攻击·二段'],['normal.3',2,'normal','普通攻击·三段'],['charged',3,'charged','重击'],['plunge',6,'plunge','下落攻击'],['plunge.low',5,'plunge','低空下落攻击'],['plunge.collision',4,'plunge','下落期间伤害']].map(([id,index,category,label])=>({id,label,events:index===2?[.45,.55].map((talentShare,part)=>({kind:'hit',index,category,parts:2,hits:1,part,talentShare,element:'Physical'})):[{kind:'hit',index,category,parts:1,element:'Physical'}]})),
]);

export const escoffier={
 id:'Escoffier',element:'Cryo',panelIndex:8,reactionStatIndex:0,usesElementalApplications:true,
 nativeBackend:'legacy',constellationTalents:{3:'skill2',5:'skill3'},
 isBlunt:e=>[5,6].includes(e.index),
 nativeDamage:{
  ...Object.fromEntries([0,1,2].map(index=>[index,{category:'normal',element:'Physical'}])),
  3:{category:'charged',element:'Physical'},
  ...Object.fromEntries([4,5,6].map(index=>[index,{category:'plunge',element:'Physical',plungeImpact:index!==4}])),
  7:{category:'skill',element:'Cryo'},8:{category:'skill',element:'Cryo'},
  9:{category:'burst',element:'Cryo'},10:{kind:'healing'},
 },
 defaultWeapon:'SymphonistOfScents',previewWeapon:'BeginnersProtector',
 capabilities:{energy:70,shield:false,nightsoul:false,arkhe:true},
 ...actions,
 previewBuffDetails(key,{elements}){
  if(key==='escoffier.a4')return [`效果：水元素与冰元素抗性降低 ${percent(resistanceByCount[hydroCryo(elements)])}`];
  if(key==='escoffier.c1')return [`效果：冰元素伤害暴击伤害提高 ${percent(c1CriticalDamage)}`];
  if(key==='escoffier.c2')return [`效果：冰元素伤害定额加值为爱可菲攻击力的 ${percent(coldPlatterRatio)}`,`冷盘初始 ${coldPlatterUses} 次，按命中敌人数消耗`];
  return [];
 },
 effects:(profile,{elements})=>[...(profile.character.constellation>=2?[{
  id:'escoffier.c2',label:'爱可菲·二命·冷盘',stage:'damage',target:'otherOnField',
  trigger:{kind:'cast',action:'skill'},duration:15,uses:coldPlatterUses,targetAggregation:'linearFlat',
  filter:{element:'Cryo',category:['normal','charged','plunge','skill','burst']},
  reads:{attack:{stat:'atk',stage:'attack',timing:'live'}},
  value:({m,read})=>({ExtraDmgBase:m.mul(coldPlatterRatio,read('attack'))}),
  legacy:(_rotation,event)=>({active:event.escoFlat?1:0,usage:{used:event.escoTargets??0}}),
 }]:[]),...(profile.character.constellation>=1&&teamTalentUnlocked(profile.character,4)&&hydroCryo(elements)===4?[{
  id:'escoffier.c1',label:'爱可菲·一命',stage:'damage',target:'team',
  trigger:{kind:'cast',action:['skill','burst']},duration:15,filter:{element:'Cryo'},reads:{},
  value:()=>({CriticalDamageBase:c1CriticalDamage}),
 }]:[])],
 modeled:['EscoffierTalent3','EscoffierC1','EscoffierC2'],
 normalize:p=>{p.character.params={Escoffier:{hydro_cryo_count:0,after_burst:false}};},
 // 60fps animation lengths, separate from hitmarks and summon lifetimes.
 castFrames:a=>a.action==='skill'?35:a.action==='burst'?110:undefined,
 timing,
 createTimeline:createEscoffierRuntime,
 createCombat:createEscoffierRuntime,
 create({role,profiles,elements,rotation,math:m,settings}){
  const c=profiles[role].character,a4=teamTalentUnlocked(c,4),sum=numericSum(m),count=hydroCryo(elements);
  // Calculation and timeline observation share the trigger set and expiry.
  const resistanceWindows=()=>a4?rotation().events.filter(h=>h.role===role&&['skill','burst'].includes(h.category)).map(event=>({event,start:event.time,end:event.time+12})):[];
  return {
   previewWindows:()=>resistanceWindows().filter(w=>w.event.enabled!==0).map(({start,end})=>({key:'escoffier.a4',label:'爱可菲·灵感浸入调味',role,start,end})),
   damageBuffs(r,e,panels,source){
    const out=[];
     const active=resistanceWindows().filter(w=>compareEventPosition(w.event,e)<0&&e.time<w.end).reduce((n,w)=>m.max(n,w.event.enabled??1),0);
     if((typeof active==='object'||active)&&['Hydro','Cryo'].includes(e.element))out.push(effect('爱可菲·灵感浸入调味',{ResMinusBase:m.mul(active,resistanceByCount[count])}));
    return out;
   },
   healingBase:(h,p,native)=>h.recipients.length===1?{amount:m.mul(1.3824,sum(p.atk)),outgoing:sum(p.healing_bonus)}:native(10),
  };
 },
 randomHealth:profile=>profile.character.constellation>=4,
 createHealth({role,profiles,base,math:m,total,panelAt,random}){
  const c=profiles[role].character,state={cast:-Infinity,used:0};
  return {
   keepHeal:h=>h.role!==role||h.healing||h.recipients.length!==1||teamTalentUnlocked(c,1),
   healMultiplier(h,enabled){
    if(h.role!==role||h.healing==='traveling_doctor'||h.recipients.length!==1||c.constellation<4)return 1;
    const cast=base.lastCast(role,'burst',h.time,h.rootOrder),used=m.choose(m.eq(cast,state.cast),state.used,0),cr=m.min(1,m.max(0,total(panelAt(role,h).critical)));
    const chance=m.choose(enabled,m.choose(m.lt(used,7),cr,0),0),won=random('health.escoffier.c4/'+base.slots[role]+'/'+eventKey(h),chance,'爱可菲·四命治疗');
    state.used=m.choose(enabled,m.add(used,won),state.used);state.cast=m.choose(enabled,cast,state.cast);return m.add(1,won);
   },
  };
 },
};

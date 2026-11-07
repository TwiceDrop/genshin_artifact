import {effect,numericSum} from '../rule-utils.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {createValeriyRuntime,VALERIY_TIMING} from './valeriy-runtime.mjs';
export const valeriy={
 id:'Valeriy',element:'Electro',weaponType:'Sword',panelIndex:8,reactionStatIndex:0,usesElementalApplications:true,
 nativeBackend:'extension',constellationTalents:{3:'skill1',5:'skill2'},defaultWeapon:'FavoniusSword',previewWeapon:'DullBlade',
 capabilities:{energy:60,shield:true,nightsoul:false,arkhe:false},isBlunt:e=>[3,6,7].includes(e.index),
 nativeDamage:Object.fromEntries([0,1,2,3,4,5,6,7,8,10,11].map(index=>[index,{category:index<3?'normal':index<5?'charged':index<8?'plunge':index===8?'skill':'burst',element:[4,8,10,11].includes(index)?'Electro':'Physical',...(index>=5&&index<=7?{plungeImpact:index!==5}:{})}])),
 actions:[{id:'skill',label:'攻势防御·堡垒骤进',endOffsetMs:VALERIY_TIMING.skill*1000},{id:'burst',label:'火力焦点·雷霰急袭',endOffsetMs:VALERIY_TIMING.burst*1000},
  ...[1,2,3].map(n=>({id:'normal.'+n,label:'普通攻击·第'+n+'段',endOffsetMs:VALERIY_TIMING.mortar*1000})),{id:'charged',label:'重击／臼炮直射',endOffsetMs:VALERIY_TIMING.mortar*1000},
  ...[['plunge',7,'高空下落攻击'],['plunge.low',6,'低空下落攻击'],['plunge.collision',5,'下落期间伤害']].map(([id,index,label])=>({id,label,index}))],
 modeled:['ValeriyDirective','ValeriyC2','ValeriyC6'],
 normalize:p=>{p.character.params={Valeriy:{radiance:false,directive:false,momentum:0,shield_overflow:0,c2_active:false,c6_active:false,on_field:false}};},
 expand({actions,hit}){for(const a of actions)if(a.action.startsWith('plunge'))hit(a,{index:{plunge:7,'plunge.low':6,'plunge.collision':5}[a.action],category:'plunge',element:'Physical',application:null,label:'下落攻击'});},
 effects:({character:c})=>[
  ...(c.constellation>=2?[{id:'valeriy.c2',label:'瓦列里·伴随冲阵的队型',stage:'attack',target:'team',trigger:{kind:'cast',action:'skill'},duration:18,reads:{},value:()=>({ElementalMastery:100})}]:[]),
  ...(c.constellation>=6?[{id:'valeriy.c6',label:'瓦列里·穿透敌阵的威能',stage:'damage',target:'team',targetScope:'hitTargets',trigger:{kind:'hit',index:[4,11]},duration:7,filter:{element:'Electro'},reads:{},value:()=>({CriticalElectro:.1,StellarConductCritDamage:.4})}]:[]),
 ],
 createTimeline:createValeriyRuntime,createCombat:createValeriyRuntime,
 create({role,profiles,rotation,math:m,settings}){
  const c=profiles[role].character,sum=numericSum(m),ratios=[.2432,.26144,.27968,.304,.32224,.34048,.3648,.38912,.41344,.43776,.46208,.4864,.5168,.5472,.5776];
  return {needsIndividualTargets:e=>e.element==='Electro',damageBuffs(r,e,_p,source){
   const rot=rotation(),s=rot.characterState?.(role,e);if(!s||e.element!=='Electro'||rot.activeRole(e.time,e.rootOrder)!==r)return [];
   const targets=e.targetIds??[],count=targets.length?m.div(targets.reduce((n,id)=>m.add(n,s.usage[id]??0),0),targets.length):0;
   const value=m.mul(count,m.mul(sum(source(role).atk),m.add(ratios[c.skill1],teamTalentUnlocked(c,4)?m.mul(.003,s.usedMomentum):0)));
   return [effect('瓦列里·攻斥指令',e.damageModel==='reaction.stellarConduct'?{StellarConductFlat:m.mul(3,value)}:{ExtraDmgElectro:value})];
  }};
 },
};

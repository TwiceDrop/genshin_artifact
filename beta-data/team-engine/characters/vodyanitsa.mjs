import {teamTalentUnlocked} from '../character-levels.mjs';
import {effect} from '../rule-utils.mjs';
import {eventBefore} from '../event-order.mjs';
import {defineActionRecipes} from '../action-recipes.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

const timing={horn:{start:3,interval:3,duration:16},healing:{start:0,interval:1.5,duration:15}};
const isSwirl=e=>['direct.stellarSwirl','reaction.stellarSwirl'].includes(e.damageModel);
const ordinary=e=>['Hydro','Cryo'].includes(e.element)&&['normal','charged','plunge','skill','burst'].includes(e.category)&&!isSwirl(e);
const mode=({rotation,event})=>rotation.reactionAt?.(event).wanderingActive??0;
function createVodyanitsaRuntime({role,profile,reactions}){
 return {onEvent(e){if(e.role===role&&e.kind==='cast'&&e.action==='skill'&&teamTalentUnlocked(profile.character,1))reactions.enableWandering(e,16+(profile.character.constellation>=2?9:0),e.enabled??1);}};
}
const actions=defineActionRecipes([
 {id:'skill',label:'晨声纷流',events:({character})=>{
  const duration=16+(character.constellation>=2?9:0);
  return [
   {kind:'window',key:'vodySong',duration},
   {kind:'window',key:'vodyFlat',duration:30,values:{frontUses:25,backUses:10}},
   {kind:'hit',index:8,category:'skill',parts:1,element:'Hydro',application:application(1,'vodyanitsa.skill',3,2.5),label:'晨声纷流·施放'},
   {kind:'hit',key:'horn',repeat:{...timing.horn,duration},index:9,category:'skill',parts:1,element:'Hydro',application:application(1,'vodyanitsa.skill',3,2.5),label:'唤春角笛'},
   {kind:'heal',recipients:'active',repeat:{...timing.healing,duration}},
  ];
 }},
 {id:'burst',label:'终奏·伴尔沉沦',events:[{kind:'hit',index:11,category:'burst',parts:1,element:'Hydro',application:application(2)}]},
 ...Array.from({length:4},(_,index)=>({id:'normal.'+(index+1),label:'普通攻击·'+['一段','二段','三段','四段'][index],events:[{kind:'hit',index,category:'normal',parts:1,element:'Hydro',application:application(1,'vodyanitsa.normal',3,2.5)}]})),
 ...[['charged',4,'charged','重击'],['plunge',7,'plunge','下落攻击'],['plunge.low',6,'plunge','低空下落攻击'],['plunge.collision',5,'plunge','下落期间伤害']].map(([id,index,category,label])=>({id,label,events:[{kind:'hit',index,category,parts:1,element:'Hydro',...(index===5?{}:{application:application()})}]})),
]);

export const vodyanitsa={
 id:'Vodyanitsa',element:'Hydro',panelIndex:8,reactionStatIndex:0,usesElementalApplications:true,hpRatioLabel:'遥久之歌·独立倍率',
 nativeBackend:'extension',constellationTalents:{3:'skill2',5:'skill3'},
 nativeDamage:{
  ...Object.fromEntries([0,1,2,3].map(index=>[index,{category:'normal',element:'Hydro'}])),
  4:{category:'charged',element:'Hydro'},
  ...Object.fromEntries([5,6,7].map(index=>[index,{category:'plunge',element:'Hydro',plungeImpact:index!==5}])),
  8:{category:'skill',element:'Hydro'},9:{category:'skill',element:'Hydro'},
  10:{kind:'healing'},11:{category:'burst',element:'Hydro'},
 },
 defaultWeapon:'HymnOfTheMaelstrom',previewWeapon:'ApprenticesNotes',
 capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},
 ...actions,
 createTimeline:createVodyanitsaRuntime,createCombat:createVodyanitsaRuntime,
 effects:profile=>[{
  id:'vodyanitsa.skill.resistance',label:'沃雅妮莎·宣叙·晨声纷流',stage:'damage',target:'team',targetScope:'hitTargets',
  trigger:{kind:'hit',index:[8,9]},duration:6,filter:{element:['Hydro','Cryo']},reads:{},
  value:()=>({ResMinusBase:[.165,.18,.195,.21,.225,.24,.255,.27,.285,.3,.318,.336,.354,.372,.39][profile.character.skill2]}),
 },...(profile.character.constellation>=2?[{
  id:'vodyanitsa.c2',label:'沃雅妮莎·二命',stage:'damage',target:profile.character.constellation>=6?'team':'teamOnField',
  trigger:{kind:'hit',index:9},duration:5,reads:{},
  condition:ctx=>isSwirl(ctx.event)?mode(ctx):['Hydro','Cryo'].includes(ctx.event.element)?ctx.m.choose(mode(ctx),0,1):0,
  value:({event})=>isSwirl(event)?{StellarSwirlCritDamage:.6}:{CriticalDamageBase:.5},
 }]:[]),...(profile.character.constellation>=1?[{
  id:'vodyanitsa.c1',label:'沃雅妮莎·一命',stage:'attack',target:'team',
  trigger:{kind:'heal',healing:null},duration:5,
  reads:{maxHP:{stat:'hp',stage:'base',timing:'live'}},
  value:({m,read})=>({ATKFixed:m.mul(.008,read('maxHP'))}),
  // Legacy event axes supply coverage facts rather than action lifecycles.
  legacy:(rotation,event)=>({active:event.time<rotation.lastCast(profile.role,'skill',event.time)+16?1:0}),
 }]:[]),...(teamTalentUnlocked(profile.character,4)?[
  ['front','teamOnField',25],['back','teamOffField',10],
 ].map(([pool,target,uses])=>({
  id:'vodyanitsa.a4.'+pool,label:'沃雅妮莎·十二弦的泪歌',stage:'damage',target,
  trigger:{kind:'cast',action:'skill'},duration:30,uses,targetAggregation:'linearFlat',reactionDamage:true,
  condition:ctx=>isSwirl(ctx.event)?mode(ctx):ordinary(ctx.event)?ctx.m.choose(mode(ctx),0,1):0,
  reads:{maxHP:{stat:'hp',stage:'base',timing:'live'}},
  value:({m,read,event})=>isSwirl(event)?{StellarSwirlFlat:m.min(6500,m.mul(m.max(0,m.sub(read('maxHP'),40000)),.26))}:{ExtraDmgBase:m.min(3500,m.mul(m.max(0,m.sub(read('maxHP'),40000)),.14))},
  legacy:(_rotation,event)=>({active:event.vodyFlat?1:0,usage:{used:event.vodyTargets??0}}),
 })):[])],
 modeled:['VodyanitsaE','VodyanitsaA1','VodyanitsaA4','VodyanitsaC1','VodyanitsaC2','VodyanitsaC6','VodyanitsaSignature'],
 normalize:p=>{p.character.params={Vodyanitsa:{e_active:false,song_active:false,ordinary_mode:true,c1_active:false,c2_active:false,c4_stacks:0,on_field:true}};},
 skillConfig:()=>({Vodyanitsa:{low_hp_heal:false,q_song_bonus:false}}),
 timing,
 create({role,profiles,rotation,math:m,settings}){
  const c=profiles[role].character;
  const active=e=>rotation().model==='actions'?rotation().covered('vodySong',e.time,e.rootOrder):e.time<rotation().lastCast(role,'skill',e.time)+16;
  return {
   prepare(p,e){
    const params=p.character.params.Vodyanitsa;params.on_field=e.onField;
    // Equal independent six-second lifetimes: at most the latest three
    // successful heals in the live window survive replacement of the oldest.
    // The coefficient-only preview has scheduled heals but no health outcomes.
    // Only resolved heals may grant this HP-dependent attribute effect.
    params.c4_stacks=c.constellation>=4?m.min(3,rotation().heals.filter(h=>h.hpRatiosBefore&&h.role===role&&!h.healing&&eventBefore(h,e)&&e.time<h.time+6).reduce((n,h)=>m.add(n,m.choose(h.enabled??1,h.recipients.reduce((gate,j)=>m.max(gate,m.ge(h.hpRatiosBefore[j],.4)),0),0)),0)):0;
   },
   hpRatioMultiplier:e=>e.index===11&&active(e)?1+[.48,.516,.552,.6,.636,.672,.72,.768,.816,.864,.912,.96,1.02,1.08,1.14][c.skill3]:1,
   damageBuffs(r,e,panels){
    const out=[],add=(label,values)=>out.push(effect(label,values));
    if(e.element==='Anemo'&&teamTalentUnlocked(c,1))add('沃雅妮莎·最后的塑诗者',{ResMinusBase:m.mul(.35,rotation().reactionAt?.(e).wanderingAnemoShred??0)});
    if(active(e)&&c.constellation>=6&&isSwirl(e))add('沃雅妮莎·六命',{StellarSwirlElevation:.25});
    if(active(e)&&['Hydro','Cryo'].includes(e.element)){
     if(c.constellation>=6)add('沃雅妮莎·六命',{BonusBase:.6});
    }
    return out;
   },
   healingBase:(h,p,native)=>native(10),
   recipientHealing(h,j,value){return !h.healing&&c.constellation>=4?m.choose(m.lt(rotation().healthAt(h).ratios[j],.4),m.mul(value,1.5),value):value;},
  };
 },
};

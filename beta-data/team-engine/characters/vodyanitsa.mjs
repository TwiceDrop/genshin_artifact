import {teamTalentUnlocked} from '../character-levels.mjs';
import {effect} from '../rule-utils.mjs';
import {eventBefore} from '../event-order.mjs';
import {defineActionRecipes} from '../action-recipes.mjs';

const timing={horn:{start:3,interval:3,duration:16},healing:{start:0,interval:1.5,duration:15}};
const actions=defineActionRecipes([
 {id:'skill',label:'晨声纷流',events:({character})=>{
  const duration=16+(character.constellation>=2?9:0);
  return [
   {kind:'window',key:'vodySong',duration},
   {kind:'window',key:'vodyFlat',duration:30,values:{frontUses:25,backUses:10}},
   {kind:'hit',index:8,category:'skill',parts:1,element:'Hydro',label:'晨声纷流·施放'},
   {kind:'hit',key:'horn',repeat:{...timing.horn,duration},index:9,category:'skill',parts:1,element:'Hydro',label:'唤春角笛'},
   {kind:'heal',recipients:'active',repeat:{...timing.healing,duration}},
  ];
 }},
 {id:'burst',label:'终奏·伴尔沉沦',events:[{kind:'hit',index:11,category:'burst',parts:1,element:'Hydro'}]},
 ...Array.from({length:4},(_,index)=>({id:'normal.'+(index+1),label:'普通攻击·'+['一段','二段','三段','四段'][index],events:[{kind:'hit',index,category:'normal',parts:1,element:'Hydro'}]})),
 ...[['charged',4,'charged','重击'],['plunge',7,'plunge','下落攻击'],['plunge.low',6,'plunge','低空下落攻击'],['plunge.collision',5,'plunge','下落期间伤害']].map(([id,index,category,label])=>({id,label,events:[{kind:'hit',index,category,parts:1,element:'Hydro'}]})),
]);

export const vodyanitsa={
 id:'Vodyanitsa',element:'Hydro',panelIndex:8,hpRatioLabel:'遥久之歌·独立倍率',
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
 effects:profile=>[...(profile.character.constellation>=1?[{
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
  trigger:{kind:'cast',action:'skill'},duration:30,uses,
  filter:{element:['Hydro','Cryo'],category:['normal','charged','plunge','skill','burst']},
  reads:{maxHP:{stat:'hp',stage:'base',timing:'live'}},
  value:({m,read})=>({ExtraDmgBase:m.min(3500,m.mul(m.max(0,m.sub(read('maxHP'),40000)),.14))}),
  legacy:(_rotation,event)=>({active:event.vodyFlat?1:0,usage:{used:event.vodyTargets??0}}),
 })):[])],
 modeled:['VodyanitsaE','VodyanitsaA4','VodyanitsaC1','VodyanitsaC2','VodyanitsaC6','VodyanitsaSignature'],
 normalize:p=>{p.character.params={Vodyanitsa:{e_active:false,song_active:false,ordinary_mode:true,c1_active:false,c2_active:false,c4_stacks:0,on_field:true}};},
 skillConfig:()=>({Vodyanitsa:{low_hp_heal:false,q_song_bonus:false}}),
 timing,
 create({role,profiles,rotation,math:m,settings}){
  const c=profiles[role].character;
  const active=e=>rotation().model==='actions'?rotation().covered('vodySong',e.time,e.rootOrder):e.time<rotation().lastCast(role,'skill',e.time)+16;
  return {
   prepare(p,e){const params=p.character.params.Vodyanitsa;params.on_field=e.onField;params.c4_stacks=c.constellation>=4?m.min(3,rotation().heals.filter(h=>h.role===role&&eventBefore(h,e)&&h.time>=rotation().lastCast(role,'skill',e.time,e.rootOrder)).reduce((n,h)=>m.add(n,h.enabled??1),0)):0;},
   hpRatioMultiplier:e=>e.index===11&&active(e)?1+[.48,.516,.552,.6,.636,.672,.72,.768,.816,.864,.912,.96,1.02,1.08,1.14][c.skill3]:1,
   damageBuffs(r,e,panels){
    const out=[],add=(label,values)=>out.push(effect(label,values));
    if(active(e)){
     if(['Hydro','Cryo'].includes(e.element))add('沃雅妮莎·宣叙·晨声纷流',{ResMinusBase:[.165,.18,.195,.21,.225,.24,.255,.27,.285,.3,.318,.336,.354,.372,.39][c.skill2]});
     if(c.constellation>=2&&(e.onField||c.constellation>=6))add('沃雅妮莎·二命',{CriticalDamageBase:.5});
     if(c.constellation>=6)add('沃雅妮莎·六命',{BonusBase:.6});
    }
    return out;
   },
   healingBase:(h,p,native)=>native(10),
   recipientHealing(h,j,value){return !h.healing&&c.constellation>=4?m.choose(m.lt(rotation().healthAt(h).ratios[j],.5),m.mul(value,1.5),value):value;},
  };
 },
};

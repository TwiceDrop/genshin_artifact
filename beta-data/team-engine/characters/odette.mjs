import {teamTalentUnlocked} from '../../team-dps-character-rules.mjs';
import {effect,numericSum,actionTime} from '../rule-utils.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

const dream=Array.from({length:15},(_,i)=>.14+.04*i);
export const odette={
 id:'Odette',element:'Cryo',weaponType:'Sword',panelIndex:10,enablesStellarConduct:true,completionDelay:5/60,
 modeled:['OdetteTalent1','OdetteMarvelousSplendor','OdetteC2MarvelousSplendor','OdetteC2ResMinus','OdetteC4SnowSwanDream','OdetteC6MarvelousSplendor'],
 normalize:p=>{p.character.params={Odette:{radiance_mode:0,marvelous_splendor_stacks:0,snow_swan_dream:false,solo_dance_double:false}};},
 expand({actions,hit}){
  for(const a of actions){
   if(a.action==='skill'||a.action==='burst')continue;
   const indices={'normal.1':[0],'normal.2':[1],'normal.3':[2,3],'normal.4':[4],'normal.5':[5],charged:[6],'plunge.collision':[7],'plunge.low':[8],plunge:[9]}[a.action];
   indices.forEach((index,i)=>hit(a,{index,category:a.action.startsWith('normal')?'normal':a.action.startsWith('plunge')?'plunge':'charged',element:'Physical',application:null,label:a.action.startsWith('normal')?'普通攻击·第'+a.action.at(-1)+'段':a.action==='charged'?'重击':'下落攻击'},i/20,a.action+'/'+i));
  }
 },
 createCombat({role,profile,roots,reactions,schedule,addHit,activeRole}){
  const c=profile.character,s={doubleUntil:-Infinity,recastUntil:-Infinity,upgradeUntil:-Infinity,dreamUntil:-Infinity,self:0,others:0,nextDance:0,danceToken:0,splendorToken:0,c4Ready:-Infinity};
  const at=(parent,delay,run)=>schedule({time:actionTime(parent.time+delay),rootOrder:parent.rootOrder+10,role,combatKind:'state',run});
  const completion=(e,delay)=>{roots.find(r=>r.id===e.id).completionTime=actionTime(e.time+delay);};
  function dance(parent,delay,type,token){
   at(parent,delay,()=>{
    const e={...parent,time:actionTime(parent.time+delay),extendsAxis:false};
    if(token!==s.danceToken||e.time>=s.doubleUntil)return;
    addHit(e,{role,index:type===0?14:17,element:'Cryo',category:'skill',application:application(),odetteDance:type,label:type===0?'倒影·翎舞':'倒影·翼舞'});
    s.nextDance=1-type;dance(e,(type===0?109:125)/60,1-type,token);
   });
  }
  function splendor(parent,n,token){
   at(parent,Math.floor(n*59.25)/60,()=>{
    const time=actionTime(parent.time+Math.floor(n*59.25)/60);
    if(token!==s.splendorToken||time>=s.doubleUntil||s.others>=4+(c.constellation>=1?2:0))return;
    if(activeRole(time,parent.rootOrder+10)!==role){
     const count=Math.min(s.self,c.constellation>=1?2:1);s.others+=count;if(c.constellation<6)s.self-=count;
    }
    splendor(parent,n+1,token);
   });
  }
  function summon(e,delay,firstDelay,refresh){
   at(e,delay,()=>{
    const time=actionTime(e.time+delay),existed=time<s.doubleUntil;
    s.doubleUntil=actionTime(time+20);
    if(!refresh||!existed){
     s.nextDance=0;s.self=teamTalentUnlocked(c,1)?4+(c.constellation>=1?2:0):0;s.others=0;
     s.upgradeUntil=-Infinity;++s.splendorToken;if(s.self)splendor({...e,time},1,s.splendorToken);
    }
    dance({...e,time},firstDelay,s.nextDance,++s.danceToken);
   });
  }
  return {state:s,onCommand(e){
   if(e.role!==role||e.kind!=='cast')return;
   if(e.action==='skill'){
    if(e.time<s.recastUntil){
     s.recastUntil=-Infinity;++s.danceToken;
     for(const [i,frame]of [11,20,28].entries())addHit(e,{role,index:11,element:'Cryo',category:'skill',application:application(1,'odette.coda',4,3),label:'破晓终奏·第'+(i+1)+'段'},frame/60);
     addHit(e,{role,index:12,element:'Cryo',category:'skill',damageKind:'stellarConduct',odetteFinal:true,label:'破晓终奏·星超导'},62/60);
     dance(e,114/60,0,s.danceToken);completion(e,62/60);
    }else{
     s.recastUntil=actionTime(e.time+6);
     addHit(e,{role,index:10,element:'Cryo',category:'skill',application:application(),label:'夜中独舞'},23/60);
     summon(e,23/60,134/60,false);completion(e,23/60);
    }
   }else if(e.action==='burst'){
    s.recastUntil=actionTime(e.time+6);
    summon(e,1/60,252/60,true);
    for(const [i,frame]of [112,128,140].entries())addHit(e,{role,index:20,parts:3,part:i,element:'Cryo',category:'burst',application:application(),label:'青鸟终曲·第'+(i+1)+'段'},frame/60);
    addHit(e,{role,index:21,element:'Cryo',category:'burst',application:application(),odetteBurstFinal:true,label:'青鸟终曲·终结'},144/60);completion(e,144/60);
   }
  },beforeHit(e){
   if(e.role===role&&e.odetteBurstFinal)s.dreamUntil=actionTime(e.time+20);
  },afterHit(e){
   if(e.role===role&&e.odetteFinal){
    s.upgradeUntil=actionTime(e.time+20);
    if(c.constellation>=1)addHit(e,{role,index:22,element:'Cryo',category:'skill',damageKind:'stellarConduct',label:'奥黛塔·一命终奏'});
   }
   if(e.role===role&&e.odetteDance!==undefined&&e.time<s.upgradeUntil&&reactions.view().radiance)addHit(e,{role,index:e.odetteDance===0?15:18,element:'Cryo',category:'skill',damageKind:'stellarConduct',label:e.odetteDance===0?'翎舞·星超导':'翼舞·星超导'});
   if(c.constellation>=4&&e.damageKind==='stellarConduct'&&e.time>=s.c4Ready){
    s.c4Ready=actionTime(e.time+3.5);addHit(e,{role,index:24,element:'Cryo',category:'skill',damageKind:'stellarConduct',label:'奥黛塔·四命协同'},5/60);
   }
  }};
 },
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m);
  return {attackBuffs(r,e){
   const s=rotation().combatAt(e).states[role],live=e.time<s.doubleUntil,count=live?(r===role?s.self:s.others):0;
   const bonus=e.time<s.dreamUntil?(r===role?dream[c.skill3]:c.constellation>=4?dream[c.skill3]*.5:0):0;
   return [effect('奥黛塔·华彩',{EnhanceStellarSuperconduct:.15*count,ATKPercentage:c.constellation>=2?.07*count:0,StellarConductElevation:c.constellation>=6&&count>0?(r===role?.45:.25):0}),effect('奥黛塔·雪鹄之梦',{EnhanceStellarSuperconduct:bonus})];
  },damageBuffs(r,e,panels,source){
   const combat=rotation().combatAt(e),s=combat.states[role];
   return [...(e.damageKind==='stellarConduct'?[effect('奥黛塔·银晓之舞',{StellarConductBaseBonus:m.min(.14,m.mul(sum(source(role).atk),.00007))})]:[]),...(c.constellation>=2&&e.time<s.doubleUntil&&combat.reaction.radiance?[effect('奥黛塔·二命倒影',{ResMinusCryo:.2,ResMinusElectro:.2})]:[])];
  }};
 },
};

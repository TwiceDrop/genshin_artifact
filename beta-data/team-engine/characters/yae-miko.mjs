import {effect,numericSum,actionTime} from '../rule-utils.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {YAE_TIMING,createYaeRuntime} from './yae-miko-runtime.mjs';
export {YAE_TIMING};

// Placement / projectile timings follow gcsim; each Sakura owns its clock.
// Duration follows the updated talent's 14 + 10 seconds after creation.
const enhancedRatio=.8;
export const yaeMiko={
 id:'YaeMiko',element:'Electro',weaponType:'Catalyst',panelIndex:7,reactionStatIndex:0,usesElementalApplications:true,
 nativeBackend:'legacy',constellationTalents:{3:'skill2',5:'skill3'},defaultWeapon:'KagurasVerity',previewWeapon:'ApprenticesNotes',
 capabilities:{energy:90,shield:false,nightsoul:false,arkhe:false},
 nativeDamage:{
  ...Object.fromEntries([0,1,2].map(index=>[index,{category:'normal',element:'Electro'}])),3:{category:'charged',element:'Electro'},
  ...Object.fromEntries([4,5,6].map(index=>[index,{category:'plunge',element:'Electro',plungeImpact:index!==4}])),
  ...Object.fromEntries([7,8,9,10,14,15,16].map(index=>[index,{category:'skill',element:'Electro',infusable:false}])),
  11:{category:'burst',element:'Electro',infusable:false},12:{category:'burst',element:'Electro',infusable:false},13:{category:'other',element:'Electro',infusable:false},
 },
 actions:[{id:'skill',label:'野干役咒·杀生樱',endOffsetMs:98/60*1000},{id:'burst',label:'大密法·天狐显真',endOffsetMs:202/60*1000},
  ...Array.from({length:3},(_,i)=>({id:'normal.'+(i+1),label:'普通攻击·第'+(i+1)+'段',endOffsetMs:[24,32,43][i]/60*1000})),
  {id:'charged',label:'重击',endOffsetMs:1500},{id:'plunge',label:'高空下落攻击'},{id:'plunge.low',label:'低空下落攻击'},{id:'plunge.collision',label:'下落期间伤害'}],
 modeled:['YaeMikoC1','YaeMikoC2','YaeMikoC4'],
 // The native radiance switch also enables unconditional C2 stats. Timeline
 // owns C2 and C6, while the kernel supplies talent coefficients / A4 / DEF ignore.
 normalize:p=>{p.character.params={YaeMiko:{stellar_conduct_state:false,sakura_level:0}};},
 skillConfig:()=>({YaeMiko:{c4_q_buff:false}}),
 adjustNativeDamage({result,native,math:m,adjustSource}){
  const label='八重神子天赋「启蜇之祝词」',original=native.bonus[label];
  if(original!==undefined){const value=m.mul(numericSum(m)(result.em),.0015);result.bonus.compiled=m.add(m.sub(result.bonus.compiled,original),value);adjustSource?.('bonus',label,value,true);}
 },
 atkRatioLabel:'八重神子·祓所之讬宣',
 expand({actions,hit}){
  for(const a of actions){
   if(a.action==='skill')a.completionTime=actionTime(a.time+YAE_TIMING.spawn);
   else if(a.action==='burst')hit(a,{index:11,category:'burst',application:application(),label:'大密法·天狐显真'},YAE_TIMING.burst,'burst');
   else{
    const index={'normal.1':0,'normal.2':1,'normal.3':2,charged:3,'plunge.collision':4,'plunge.low':5,plunge:6}[a.action];
    const normal=index<3,offset=normal?[24,32,43][index]/60:index===3?1.5:0;
    hit(a,{index,category:normal?'normal':index===3?'charged':'plunge',application:normal?application(1,'yae.normal',3,2.5):index===4?null:application(),label:normal?'普通攻击·第'+(index+1)+'段':index===3?'重击':'下落攻击'},offset,a.action);
   }
  }
 },
 createTimeline:createYaeRuntime,
 createCombat:createYaeRuntime,
 combatCompletion:a=>a.kind==='cast'?actionTime(a.time+(a.action==='skill'?98/60:202/60)):undefined,
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m),enhanced=e=>m.choose(e.yaeEnhanced??0,enhancedRatio,0);
  return {
   atkRatioBonus:enhanced,
   attackBuffs(r,e){
    const rot=rotation(),s=rot.characterState?.(role,e),out=[];
    if(s){
     if(c.constellation>=2&&(r===role||r===rot.activeRole(e.time,e.rootOrder)))out.push(effect('八重神子·望月吼哕声',{ElementalMastery:[0,60,90,120,200].reduce((v,n,i)=>m.choose(m.eq(s.rank,i),n,v),0)}));
     out.push(effect('八重神子·野狐供真篇',{BonusElectro:m.choose(s.c1,.5,0)}),effect('八重神子·绯樱引雷章',{BonusElectro:m.choose(s.c4,.2,0)}));
    }
    if(r===role&&c.constellation>=4)out.push(effect('八重神子·四命爆发增伤',{BonusElementalBurst:1}));
    return out;
   },
   damageBuffs(r,e,panels,source){
    const out=[];
    if(r===role&&(typeof e.yaeEnhanced==='object'||e.yaeEnhanced))out.push(effect('八重神子·祓所之讬宣',{ExtraDmgBase:m.mul(enhanced(e),sum(source(role).atk))}));
    if(e.damageModel==='reaction.stellarConduct'){
     const s=rotation().characterState?.(role,e);if(s)out.push(effect('八重神子·野狐供真篇·星伤',{EnhanceStellarSuperconduct:m.choose(s.c1,.5,0)}));
     if(r===role&&c.constellation>=6)out.push(effect('八重神子·大杀生咒禁·星超导',{StellarConductCritDamage:2}));
    }
    return out;
   },
  };
 },
};

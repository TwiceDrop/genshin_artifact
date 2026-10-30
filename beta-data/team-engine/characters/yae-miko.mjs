import {teamTalentUnlocked} from '../../team-dps-character-rules.mjs';
import {effect,numericSum,actionTime} from '../rule-utils.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

// Placement / projectile timings follow gcsim; each Sakura owns its clock.
// Duration follows the updated talent's 14 + 10 seconds after creation.
export const YAE_TIMING=Object.freeze({spawn:34/60,duration:24,firstShot:2,interval:176/60,hitDelay:1/60,extraDelay:64/60,stellarDelay:.2,enhanceCooldown:2.5,enhanceWindow:8,burst:100/60,thunderbolt:154/60,thunderboltInterval:.4});
const enhancedRatio=.8;
const levelAt=(state,c,time)=>{const count=state.totems.filter(t=>time<t.until).length;return count?count+Number(c.constellation>=2):0;};
export const yaeMiko={
 id:'YaeMiko',element:'Electro',weaponType:'Catalyst',panelIndex:7,completionDelay:.2,
 modeled:['YaeMikoC1','YaeMikoC2','YaeMikoC4'],
 // The native radiance switch also enables unconditional C2 stats. Timeline
 // owns C2 and C6, while the kernel supplies talent coefficients / A4 / DEF ignore.
 normalize:p=>{p.character.params={YaeMiko:{stellar_conduct_state:false,sakura_level:0}};},
 skillConfig:()=>({YaeMiko:{c4_q_buff:false}}),
 compileNativeDamage({result,base,math:m}){
  const original=base.bonus['八重神子天赋「启蜇之祝词」'];
  if(original!==undefined)result.bonus.compiled=m.add(m.sub(result.bonus.compiled,original),m.mul(result.em.compiled,.0015));
 },
 atkRatioLabel:'八重神子·祓所之讬宣',
 expand({actions,hit}){
  for(const a of actions){
   if(a.action==='skill')a.completionTime=actionTime(a.time+YAE_TIMING.spawn);
   else if(a.action==='burst')hit(a,{index:11,category:'burst',application:application(),label:'大密法·天狐显真'},YAE_TIMING.burst,'burst');
   else{
    const index={'normal.1':0,'normal.2':1,'normal.3':2,charged:3,'plunge.collision':4,'plunge.low':5,plunge:6}[a.action];
    const normal=index<3,offset=normal?[24,32,43][index]/60:index===3?1.5:0;
    hit(a,{index,category:normal?'normal':index===3?'charged':'plunge',application:normal?application(1,'yae.normal',3,2.5):application(),label:normal?'普通攻击·第'+(index+1)+'段':index===3?'重击':'下落攻击'},offset,a.action);
   }
  }
 },
 createCombat({role,profile,roots,reactions,schedule,addHit}){
  const c=profile.character,s={totems:[],enhanceUntil:-Infinity,enhanceReady:-Infinity,c1Until:-Infinity,c4Until:-Infinity};
  const prune=time=>{s.totems=s.totems.filter(t=>time<t.until);};
  function shot(cast,totem,time){
   schedule({time,rootOrder:cast.rootOrder+20,role,combatKind:'state',run(){
    if(!s.totems.some(t=>t.id===totem.id))return;
    const enhanced=time<s.enhanceUntil&&time>=s.enhanceReady;
    if(enhanced){s.enhanceUntil=-Infinity;s.enhanceReady=actionTime(time+YAE_TIMING.enhanceCooldown);}
    addHit({...cast,time},{index:6+levelAt(s,c,time),category:'skill',element:'Electro',application:application(1,'yae.sakura',3,2.5),yaeSakura:totem.id,yaeEnhanced:enhanced,yaeStellar:enhanced&&reactions.view().radiance,extendsAxis:false,label:'杀生樱·落雷'},YAE_TIMING.hitDelay);
    shot(cast,totem,actionTime(time+YAE_TIMING.interval));
   }});
  }
  return {state:s,advance(e){prune(e.time);},onCommand(e){
   if(e.role!==role||e.kind!=='cast')return;
   if(e.action==='skill')schedule({time:actionTime(e.time+YAE_TIMING.spawn),rootOrder:e.rootOrder+10,role,combatKind:'state',run(){
    const time=actionTime(e.time+YAE_TIMING.spawn),replace=s.totems.length===3;
    if(replace)s.totems.shift();
    const totem={id:e.id,until:actionTime(time+YAE_TIMING.duration)};s.totems.push(totem);
    shot(e,totem,actionTime(e.time+YAE_TIMING.firstShot));
    if(replace&&teamTalentUnlocked(c,1)){
     const stellar=reactions.view().radiance;
     addHit({...e,time},{index:stellar?14:13,category:stellar?'reaction':'other',element:'Electro',damageKind:stellar?'stellarConduct':'normal',application:null,label:stellar?'神篱之御荫·星超导':'神篱之御荫·额外雷击'},YAE_TIMING.extraDelay);
    }
   }});
   if(e.action==='burst'){
    const count=s.totems.length;
    const root=roots.find(a=>a.id===e.id);
    root.completionTime=actionTime(e.time+(count?YAE_TIMING.thunderbolt+(count-1)*YAE_TIMING.thunderboltInterval:YAE_TIMING.burst));
    for(let i=0;i<count;i++)addHit(e,{index:12,category:'burst',element:'Electro',application:application(),label:'天狐霆雷·第'+(i+1)+'道'},YAE_TIMING.thunderbolt+i*YAE_TIMING.thunderboltInterval);
   }
  },afterHit(e){
   const reaction=e.reactionFacts.some(f=>f.reaction==='Superconduct'||f.reaction==='StellarConduct');
   if(reaction)s.enhanceUntil=actionTime(e.time+YAE_TIMING.enhanceWindow);
   if(e.role!==role)return;
   if(c.constellation>=1&&(reaction||e.damageKind==='stellarConduct'))s.c1Until=actionTime(e.time+10);
   if(e.yaeSakura){
    if(c.constellation>=4)s.c4Until=actionTime(e.time+5);
    if(e.yaeStellar)addHit(e,{index:16,category:'reaction',damageKind:'stellarConduct',application:null,targetIds:[reactions.targetIds(e)[0]],label:'祓所之讬宣·星超导'},YAE_TIMING.stellarDelay);
   }
  }};
 },
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m);
  return {
   atkRatioBonus:e=>e.yaeEnhanced?enhancedRatio:0,
   attackBuffs(r,e){
    const rot=rotation(),s=rot.combatAt(e).states[role],out=[],level=levelAt(s,c,e.time);
    if(c.constellation>=2&&level&&(r===role||r===rot.activeRole(e.time,e.rootOrder)))out.push(effect('八重神子·望月吼哕声',{ElementalMastery:[0,60,90,120,200][level]}));
    if(e.time<s.c1Until)out.push(effect('八重神子·野狐供真篇',{BonusElectro:.5,EnhanceStellarSuperconduct:.5}));
    if(e.time<s.c4Until)out.push(effect('八重神子·绯樱引雷章',{BonusElectro:.2}));
    if(r===role&&c.constellation>=4)out.push(effect('八重神子·四命爆发增伤',{BonusElementalBurst:1}));
    if(r===role&&c.constellation>=6)out.push(effect('八重神子·大杀生咒禁·星超导',{StellarConductCritDamage:2}));
    return out;
   },
   damageBuffs(r,e,panels,source){return r===role&&e.yaeEnhanced?[effect('八重神子·祓所之讬宣',{ExtraDmgBase:m.mul(enhancedRatio,sum(source(role).atk))})]:[];},
  };
 },
};

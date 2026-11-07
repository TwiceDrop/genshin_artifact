import {teamTalentUnlocked} from '../character-levels.mjs';
import {effect,numericSum,actionTime} from '../rule-utils.mjs';
import {createSandroneRuntime,SANDRONE_TIMING} from './sandrone-runtime.mjs';
export {SANDRONE_TIMING};

export const sandrone={
 enablesStellarSwirl:true,
 id:'Sandrone',element:'Cryo',weaponType:'Claymore',panelIndex:10,reactionStatIndex:0,enablesStellarConduct:true,usesElementalApplications:true,
 nativeBackend:'legacy',constellationTalents:{3:'skill1',5:'skill3'},defaultWeapon:'FavoniusGreatsword',previewWeapon:'WasterGreatsword',
 capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},
 isBlunt:e=>[0,1,2,4,5,8,9,13,14,16,17].includes(e.index),
 nativeDamage:{
  ...Object.fromEntries([0,1,2].map(index=>[index,{category:'normal',element:'Physical'}])),
  ...Object.fromEntries([3,4,5,6,16,17].map(index=>[index,{category:'charged',element:'Cryo',infusable:false}])),
  ...Object.fromEntries([7,8,9].map(index=>[index,{category:'plunge',element:'Physical',plungeImpact:index!==7}])),
  10:{category:'skill',element:'Cryo',infusable:false},11:{category:'skill',element:'Cryo',infusable:false},
  ...Object.fromEntries([12,13,14].map(index=>[index,{category:'burst',element:'Cryo',infusable:false}])),15:{category:'other',element:'Cryo',infusable:false},
  ...Object.fromEntries([18,19,20,21,22].map(index=>[index,{category:[18,22].includes(index)?'charged':index===19?'skill':index===20?'burst':'other',element:'Cryo',infusable:false}])),
 },
 nativeParameters:{
  'skill.config.Sandrone.prism_overcharge':{zero:false,unit:true,values:[0,1],constantFields:['direct_stellarconduct_ratio','direct_stellarswirl_ratio']},
  'skill.config.Sandrone.burst_tactics_stacks':{constantFields:['atk_ratio','direct_stellarconduct_ratio','direct_stellarswirl_ratio'],constantTerms:{atk_ratio:['技能倍率']}},
  'skill.config.Sandrone.c2_ray_stacks':{constantFields:['critical_damage','critical_damage_stellarconduct','critical_damage_stellarswirl']},
 },
 actions:[{id:'skill',label:'事象数式·游衍解析',endOffsetMs:400},{id:'burst',label:'事象数式·万理证毕',endOffsetMs:2600},{id:'charged',label:'重击·解算模式',endOffsetMs:8000},
  ...Array.from({length:3},(_,i)=>({id:'normal.'+(i+1),label:'普通攻击·第'+(i+1)+'段'})),{id:'plunge',label:'高空下落攻击'},{id:'plunge.low',label:'低空下落攻击'},{id:'plunge.collision',label:'下落期间伤害'}],
 modeled:['SandroneTalent1','SandroneC1','SandroneC6'],
 normalize:p=>{p.character.params={Sandrone:{stellar_base_active:false,em_conversion_active:teamTalentUnlocked(p.character,4),c1_team_stellar:false,c6_elevate_active:false}};},
 skillConfig:e=>({Sandrone:{stellarconduct_hits:0,c2_ray_stacks:e.sandroneRayStacks??0,prism_overcharge:typeof e.sandroneOvercharge==='object'?e.sandroneOvercharge:!!e.sandroneOvercharge,burst_tactics_stacks:e.sandroneTactics??0}}),
 expand({actions,hit}){for(const a of actions){if(['skill','burst','charged'].includes(a.action))continue;const index={'normal.1':0,'normal.2':1,'normal.3':2,'plunge.collision':7,'plunge.low':8,plunge:9}[a.action];hit(a,{index,category:a.action.startsWith('normal')?'normal':'plunge',element:'Physical',label:a.action.startsWith('normal')?'普通攻击·第'+a.action.at(-1)+'段':'下落攻击'});}},
 createTimeline:createSandroneRuntime,createCombat:createSandroneRuntime,
 combatCompletion:a=>a.action==='charged'?actionTime(a.time+8):undefined,
 finiteFollowupDelay:profile=>profile.character.constellation>=6?SANDRONE_TIMING.c6Delay:0,
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m);
  return {damageBuffs(r,e,_panels,source){
   if(!['reaction.stellarConduct','reaction.stellarSwirl','direct.stellarSwirl'].includes(e.damageModel))return [];
   const out=[effect('桑多涅·解算模式',{EnhanceStellarSuperconduct:c.constellation>=1?m.choose(rotation().characterState?.(role,e)?.decoding??0,.3,0):0}),
    effect('桑多涅·六命',{StellarConductElevation:c.constellation>=6&&r===role?.2:0}),effect('桑多涅·唯理为光',{StellarConductBaseBonus:m.min(.14,m.mul(sum(source(role).atk),.00007))})];
   if(e.damageModel!=='reaction.stellarConduct')for(const buff of out){const values=buff.config.ExtensionEffect.values;for(const [from,to]of [['EnhanceStellarSuperconduct','StellarSwirlBonus'],['StellarConductElevation','StellarSwirlElevation'],['StellarConductBaseBonus','StellarSwirlBaseBonus']])if(from in values){values[to]=values[from];delete values[from];}}
   return out;
  }};
 },
};

import {effect,numericSum,actionTime} from '../rule-utils.mjs';
import {createOdetteRuntime} from './odette-runtime.mjs';
const dream=Array.from({length:15},(_,i)=>.14+.04*i);
export const odette={
 enablesStellarSwirl:true,
 id:'Odette',element:'Cryo',weaponType:'Sword',panelIndex:10,reactionStatIndex:0,enablesStellarConduct:true,usesElementalApplications:true,
 nativeBackend:'legacy',constellationTalents:{3:'skill2',5:'skill3'},defaultWeapon:'FavoniusSword',previewWeapon:'DullBlade',
 capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},
 isBlunt:e=>[8,9].includes(e.index)||e.index===20&&e.part===0,
 nativeDamage:{
  ...Object.fromEntries([0,1,2,3,4,5].map(index=>[index,{category:'normal',element:'Physical'}])),6:{category:'charged',element:'Physical'},
  ...Object.fromEntries([7,8,9].map(index=>[index,{category:'plunge',element:'Physical',plungeImpact:index!==7}])),
  ...Object.fromEntries([10,11,12,14,15,17,18,22].map(index=>[index,{category:'skill',element:'Cryo',infusable:false}])),
  20:{category:'burst',element:'Cryo',infusable:false},21:{category:'burst',element:'Cryo',infusable:false},24:{category:'other',element:'Cryo',infusable:false},
  ...Object.fromEntries([13,16,19,23,25].map(index=>[index,{category:index===25?'other':'skill',element:'Cryo',infusable:false}])),
 },
 actions:[{id:'skill',label:'夜中独舞／破晓终奏',endOffsetMs:67/60*1000},{id:'burst',label:'青鸟终曲',endOffsetMs:2400},
  ...Array.from({length:5},(_,i)=>({id:'normal.'+(i+1),label:'普通攻击·第'+(i+1)+'段',endOffsetMs:i===2?50:0})),
  {id:'charged',label:'重击'},{id:'plunge',label:'高空下落攻击'},{id:'plunge.low',label:'低空下落攻击'},{id:'plunge.collision',label:'下落期间伤害'}],
 modeled:['OdetteTalent1','OdetteMarvelousSplendor','OdetteC2MarvelousSplendor','OdetteC2ResMinus','OdetteC4SnowSwanDream','OdetteC6MarvelousSplendor'],
 normalize:p=>{p.character.params={Odette:{radiance_mode:0,marvelous_splendor_stacks:0,snow_swan_dream:false,solo_dance_double:false}};},
 expand({actions,hit}){
  for(const a of actions){
   if(a.action==='skill'||a.action==='burst')continue;
   const indices={'normal.1':[0],'normal.2':[1],'normal.3':[2,3],'normal.4':[4],'normal.5':[5],charged:[6],'plunge.collision':[7],'plunge.low':[8],plunge:[9]}[a.action];
   indices.forEach((index,i)=>hit(a,{index,category:a.action.startsWith('normal')?'normal':a.action.startsWith('plunge')?'plunge':'charged',element:'Physical',application:null,label:a.action.startsWith('normal')?'普通攻击·第'+a.action.at(-1)+'段':a.action==='charged'?'重击':'下落攻击'},i/20,a.action+'/'+i));
  }
 },
 createTimeline:createOdetteRuntime,createCombat:createOdetteRuntime,
 finiteFollowupDelay:profile=>profile.character.constellation>=4?5/60:0,
 combatCompletion:a=>a.kind==='cast'?actionTime(a.time+(a.action==='skill'?67/60:144/60)):undefined,
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m);
  const state=e=>rotation().characterState?.(role,e),count=(r,s)=>s?m.choose(s.live,r===role?s.self:s.others,0):0;
  return {
   attackBuffs(r,e){return c.constellation>=2?[effect('奥黛塔·华彩',{ATKPercentage:m.mul(.07,count(r,state(e)))})]:[];},
   damageBuffs(r,e,panels,source){
    const s=state(e),out=[],n=count(r,s),radiance=rotation().reactionAt?.(e).radiance??0;
    if(['reaction.stellarConduct','reaction.stellarSwirl','direct.stellarSwirl'].includes(e.damageModel)){
     out.push(effect('奥黛塔·华彩',{EnhanceStellarSuperconduct:m.mul(.15,n),StellarConductElevation:c.constellation>=6?m.choose(m.gt(n,0),r===role?.45:.25,0):0}));
     out.push(effect('奥黛塔·雪鹄之梦',{EnhanceStellarSuperconduct:m.choose(s?.dream??0,r===role?dream[c.skill3]:c.constellation>=4?dream[c.skill3]*.5:0,0)}));
     out.push(effect('奥黛塔·银晓之舞',{StellarConductBaseBonus:m.min(.14,m.mul(sum(source(role).atk),.00007))}));
     if(e.damageModel!=='reaction.stellarConduct')for(const buff of out){const values=buff.config.ExtensionEffect.values;for(const [from,to]of [['EnhanceStellarSuperconduct','StellarSwirlBonus'],['StellarConductElevation','StellarSwirlElevation'],['StellarConductBaseBonus','StellarSwirlBaseBonus']])if(from in values){values[to]=values[from];delete values[from];}}
    }
    if(c.constellation>=2){const active=m.choose(s?.live??0,radiance,0),swirl=m.choose(s?.live??0,rotation().reactionAt?.(e).swirlRadiance??0,0);out.push(effect('奥黛塔·二命倒影',{ResMinusCryo:m.mul(.2,m.max(active,swirl)),ResMinusElectro:m.mul(.2,active),ResMinusAnemo:m.mul(.2,swirl)}));}
    return out;
   },
  };
 },
};

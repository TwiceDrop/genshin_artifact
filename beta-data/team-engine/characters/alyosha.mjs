import {effect,actionTime} from '../rule-utils.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {createAlyoshaRuntime} from './alyosha-runtime.mjs';
import {defineActionRecipes} from '../action-recipes.mjs';

const precision=[.1166,.1272,.1378,.1484,.159,.1696,.1802,.1908,.2014,.212,.2247,.2374,.2502,.2629,.2756];
// These physical attacks have the same native and event shape. Keep their
// indices in one declaration; skill/burst mechanics remain explicit below.
const basicDefinitions=[
 ['normal.1','普通攻击·第1段','normal',[0],0],
 ['normal.2','普通攻击·第2段','normal',[1],0],
 ['normal.3','普通攻击·第3段','normal',[2,3],50],
 ['normal.4','普通攻击·第4段','normal',[4],0],
 ['charged','重击','charged',[5]],
 ['plunge','高空下落攻击','plunge',[8]],
 ['plunge.low','低空下落攻击','plunge',[7]],
 ['plunge.collision','下落期间伤害','plunge',[6]],
].map(([id,label,category,indices,endOffsetMs])=>({id,label,...(endOffsetMs===undefined?{}:{endOffsetMs}),
 events:indices.map((index,part)=>({kind:'hit',key:id+'/'+part,delay:part/20,index,category,element:'Physical',application:null,
  alyoshaMark:index===4?'apply':null,label:category==='plunge'?'下落攻击':label})),
}));
const basicActions=defineActionRecipes(basicDefinitions);
export const alyosha={
 id:'Alyosha',element:'Electro',weaponType:'Polearm',panelIndex:9,reactionStatIndex:0,usesElementalApplications:true,
 nativeBackend:'legacy',constellationTalents:{3:'skill2',5:'skill3'},defaultWeapon:'FavoniusLance',previewWeapon:'BeginnersProtector',
 capabilities:{energy:70,shield:false,nightsoul:false,arkhe:false},
 isBlunt:e=>[7,8].includes(e.index),
 nativeDamage:{
  ...Object.fromEntries(basicDefinitions.flatMap(({events})=>events.map(({index,category,element})=>[index,{category,element,...(category==='plunge'?{plungeImpact:index!==6}:{})}]))),
  ...Object.fromEntries([9,10].map(index=>[index,{category:'skill',element:'Electro'}])),
  ...Object.fromEntries([11,12].map(index=>[index,{category:'burst',element:'Electro'}])),13:{kind:'healing'},14:{kind:'healing'},
 },
 actions:[
  {id:'skill',label:'伏袭霆击·点按',endOffsetMs:300},{id:'skill.hold',label:'伏袭霆击·长按',endOffsetMs:113/60*1000},
  {id:'burst',label:'守猎进踞',endOffsetMs:118/60*1000},
  ...basicActions.actions,
 ],
 modeled:['AlyoshaHunterPrecision'],
 normalize:p=>{p.character.params={Alyosha:{hunter_precision_stacks:0,stellar_conduct_state:false}};},
 expand(context){
  const {actions,profile,hit,periodic}=context;
  for(const a of actions){
   if(a.action==='skill'){
    const hold=a.actionId==='skill.hold',offset=(hold?113:18)/60;
    a.completionTime=actionTime(a.time+offset);
    hit(a,{index:hold?10:9,category:'skill',application:application(),alyoshaMark:'apply',label:hold?'伏袭霆击·长按':'伏袭霆击·点按'},offset,'skill');
   }else if(a.action==='burst'){
    const life=14+(profile.character.constellation>=2?6:0);
    periodic(a,{duration:life,start:79/60,offsetAt:i=>(79+i*118)/60},(offset,end)=>{
     hit(a,{index:11,category:'burst',application:application(1,'alyosha.burst',2,1.6),alyoshaField:true,persistent:true,label:'轰霆猎场'},offset,'field/'+offset);
     if(actionTime(a.time+offset+39/60)<end)hit(a,{index:12,category:'burst',application:application(1,'alyosha.burst',2,1.6),alyoshaDog:true,persistent:true,label:'图加林'},offset+39/60,'tugarin/'+offset);
    });
   }else{
    basicActions.expand({...context,actions:[a]});
   }
  }
 },
 createTimeline:createAlyoshaRuntime,
 createCombat:createAlyoshaRuntime,
 create({role,profiles,rotation,math:m}){
  const c=profiles[role].character;
  return {attackBuffs(r,e){
   const rot=rotation(),s=rot.characterState?.(role,e);
   if(!s||rot.activeRole(e.time,e.rootOrder)!==r)return [];
   const count=s.stacks;
   return typeof count==='object'||count?[effect('阿罗夏·猎者之准',{ATKPercentage:m.mul(precision[c.skill2],count),ElementalMastery:c.constellation>=6?m.choose(m.eq(count,2),100,0):0})]:[];
  },damageBuffs(r,e){
   const rot=rotation();if(e.damageModel!=='reaction.stellarConduct'||rot.activeRole(e.time,e.rootOrder)!==r)return [];
   const count=rot.characterState(role,e).stacks,radiance=rot.reactionAt(e).radiance;
   return [effect('阿罗夏·猎者之准·星伤',{EnhanceStellarSuperconduct:m.choose(radiance,m.mul(.2,count),0)})];
  },healingBase:(h,p,native)=>native(h.healing==='alyosha.c4'?14:13)};
 },
};

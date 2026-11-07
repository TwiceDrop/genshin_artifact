import {effect,chronological,actionTime} from '../rule-utils.mjs';
import {createMonaRuntime,MONA_BUBBLE_APPLICATION_DELAY,monaBubbleCompletion} from './mona-runtime.mjs';
import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {defineActionRecipes} from '../action-recipes.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';

const basicActions=defineActionRecipes([
 ...Array.from({length:4},(_,index)=>({id:'normal.'+(index+1),label:'普通攻击·第'+(index+1)+'段',events:[{kind:'hit',index,category:'normal',parts:1,element:'Hydro',application:application(1,'mona.normal',3,2.5)}]})),
 ...[['plunge',7,'高空下落攻击'],['plunge.low',6,'低空下落攻击'],['plunge.collision',5,'下落期间伤害']].map(([id,index,label])=>({id,label,events:[{kind:'hit',index,category:'plunge',parts:1,element:'Hydro',application:application(1,'mona.plunge',1,.5)}]})),
]);

const omenBonus=level=>[.42,.44,.46,.48,.5,.52,.54,.56,.58,.6,.6,.6,.6,.6,.6][level];
export const mona={
 id:'Mona',element:'Hydro',panelIndex:10,reactionStatIndex:0,usesElementalApplications:true,
 nativeBackend:'legacy',constellationTalents:{3:'skill3',5:'skill2'},
 nativeDamage:{
  ...Object.fromEntries([0,1,2,3].map(index=>[index,{category:'normal',element:'Hydro'}])),
  ...Object.fromEntries([5,6,7].map(index=>[index,{category:'plunge',element:'Hydro',plungeImpact:index!==5}])),
  4:{category:'charged',element:'Hydro'},8:{category:'skill',element:'Hydro'},
  9:{category:'skill',element:'Hydro'},10:{category:'burst',element:'Hydro'},
 },
 nativeParameters:{
  'skill.config.Mona.c6_omen':{zero:false,unit:true,constantFields:['atk_ratio']},
  'skill.config.Mona.c6_charged_stack':{zero:0,unit:1,constantFields:['bonus']},
 },
 defaultWeapon:'ThrillingTalesOfDragonSlayers',previewWeapon:'ApprenticesNotes',
 capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},
 actions:[
  {id:'burst',label:'星命定轨',completionOffsetMs:p=>MONA_BUBBLE_APPLICATION_DELAY*1000+(p?.bubbleDelayMs??8000)+1000/60,parameters:[
   {key:'bubbleDelayMs',label:'附加后破泡延迟（秒）',min:0,max:8000,scale:1000,step:.1,placeholder:'自动',help:'留空：泡影附加后自动判断破裂，最多等待8秒',error:'泡影破裂延迟须为0～8秒'},
  ]},
  {id:'skill',label:'水中幻愿·点按',endOffsetMs:329/60*1000},
  {id:'skill.hold',label:'水中幻愿·长按',endOffsetMs:344/60*1000},
  {id:'charged',label:'重击'},
  ...basicActions.actions,
 ],
 modeled:['MonaQ','MonaC1','MonaC2','MonaMagusGlow'],
 normalize:p=>{p.character.params='NoConfig';},
 skillConfig(e,rotation){
  const omen=e.monaC6Stacks===undefined?0:rotation?.model==='actions'?(rotation.characterState(e.role,e)?.omen[e.targetIds?.[0]??0]??0):e.monaC6Omen??false;
  return {Mona:{c6_charged_stack:e.monaC6Stacks??0,c6_omen:typeof omen==='object'?omen:!!omen}};
 },
 expand(context){
  const {actions,hit,profile,addWindow,enqueue}=context;
  for(const a of actions.filter(a=>a.kind==='cast'&&a.action==='burst'))enqueue({kind:'application',role:a.role,castId:a.id,monaBubbleApplication:true,
   eventId:a.id+'/bubble-application',time:actionTime(a.time+MONA_BUBBLE_APPLICATION_DELAY),rootOrder:a.rootOrder+10,element:'Hydro',category:'burst',application:application(1,'mona.burst',3,2.5)});
  basicActions.expand({...context,actions:actions.filter(a=>a.action.startsWith('normal.')||a.action.startsWith('plunge'))});
  const skills=actions.filter(a=>a.action==='skill');
  for(const [i,a]of skills.entries()){
   const first=a.actionId==='skill.hold'?101:86,next=skills[i+1];
   a.completionTime=a.time;
   for(const [j,frame]of [first,first+59,first+118,first+177,first+243].entries()){
    const time=actionTime(a.time+frame/60);
    if(next&&chronological({time,rootOrder:a.rootOrder+20},next)>=0)continue;
    a.completionTime=time;
    hit(a,{index:j===4?9:8,category:'skill',parts:1,element:'Hydro',application:j===4?application():application(1,'mona.skill',3,2.5),statSnapshot:{time:a.time,rootOrder:a.rootOrder,onField:true},label:j===4?'水中幻愿·爆裂':'水中幻愿·持续伤害'},frame/60,'phantom/'+j);
   }
  }
  for(const a of actions.filter(a=>a.action==='charged')){
   hit(a,{index:4,category:'charged',parts:1,element:'Hydro',application:application(),label:'重击'},0,'charged');
   if(profile.character.constellation>=2)addWindow('monaC2',a,12);
  }
 },
 createTimeline:createMonaRuntime,
 createCombat:createMonaRuntime,
 combatCompletion:a=>a.kind==='cast'&&a.action==='burst'?monaBubbleCompletion(a):undefined,
 create({role,profiles,rotation,math:m=scalarMath}){
  const c=profiles[role].character;
  const omen=e=>rotation().model==='actions'?(rotation().characterState(role,e)?.omen[e.targetIds?.[0]??0]??0):rotation().covered('monaOmen',e.time,e.rootOrder);
  return {needsIndividualTargets:()=>rotation().model==='actions',attackBuffs(r,e){return c.constellation>=2&&rotation().covered('monaC2',e.time,e.rootOrder)?[effect('莫娜·星月的连珠',{ElementalMastery:80})]:[];},damageBuffs(r,e){
   const active=omen(e);
   return typeof active==='object'||active?[effect('莫娜·星异',{BonusBase:m.mul(active,omenBonus(c.skill3))})]:[];
  },criticalBuffs:e=>{
   const active=omen(e);
   return c.constellation>=4&&(typeof active==='object'||active)?[effect('莫娜·灭绝的预言',{CriticalBase:m.mul(.15,active),...(e.role===role?{CriticalDamageBase:m.mul(.15,active)}:{})})]:[];
  }};
 },
};

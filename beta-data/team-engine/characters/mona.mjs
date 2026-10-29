import {effect,chronological,actionTime} from '../rule-utils.mjs';
import {createMonaRuntime} from './mona-runtime.mjs';
import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {defineActionRecipes} from '../action-recipes.mjs';

const basicActions=defineActionRecipes([
 ...Array.from({length:4},(_,index)=>({id:'normal.'+(index+1),label:'普通攻击·第'+(index+1)+'段',events:[{kind:'hit',index,category:'normal',parts:1,element:'Hydro'}]})),
 ...[['plunge',7,'高空下落攻击'],['plunge.low',6,'低空下落攻击'],['plunge.collision',5,'下落期间伤害']].map(([id,index,label])=>({id,label,events:[{kind:'hit',index,category:'plunge',parts:1,element:'Hydro'}]})),
]);

const omenBonus=level=>[.42,.44,.46,.48,.5,.52,.54,.56,.58,.6,.6,.6,.6,.6,.6][level];
export const mona={
 id:'Mona',element:'Hydro',panelIndex:10,
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
  {id:'burst',label:'星命定轨',completionOffsetMs:p=>(p?.bubbleDelayMs??8000)+1000/60,parameters:[
   {key:'bubbleDelayMs',label:'破泡延迟（秒）',min:0,max:8000,scale:1000,step:.1,placeholder:'自动',help:'留空：下一次命中破泡，最多等待8秒',error:'泡影破裂延迟须为0～8秒'},
  ]},
  {id:'skill',label:'水中幻愿·点按',endOffsetMs:329/60*1000},
  {id:'skill.hold',label:'水中幻愿·长按',endOffsetMs:344/60*1000},
  {id:'charged',label:'重击'},
  ...basicActions.actions,
 ],
 modeled:['MonaQ','MonaC1','MonaC2','MonaMagusGlow'],
 normalize:p=>{p.character.params='NoConfig';},
 skillConfig:e=>({Mona:{c6_charged_stack:e.monaC6Stacks??0,c6_omen:e.monaC6Omen??false}}),
 expand(context){
  const {actions,hit,profile,addWindow}=context;
  basicActions.expand({...context,actions:actions.filter(a=>a.action.startsWith('normal.')||a.action.startsWith('plunge'))});
  const skills=actions.filter(a=>a.action==='skill');
  for(const [i,a]of skills.entries()){
   const first=a.actionId==='skill.hold'?101:86,next=skills[i+1];
   a.completionTime=a.time;
   for(const [j,frame]of [first,first+59,first+118,first+177,first+243].entries()){
    const time=actionTime(a.time+frame/60);
    if(next&&chronological({time,rootOrder:a.rootOrder+20},next)>=0)continue;
    a.completionTime=time;
    hit(a,{index:j===4?9:8,category:'skill',parts:1,element:'Hydro',statSnapshot:{time:a.time,rootOrder:a.rootOrder,onField:true},label:j===4?'水中幻愿·爆裂':'水中幻愿·持续伤害'},frame/60,'phantom/'+j);
   }
  }
  for(const a of actions.filter(a=>a.action==='charged')){
   hit(a,{index:4,category:'charged',parts:1,element:'Hydro',label:'重击'},0,'charged');
   if(profile.character.constellation>=2)addWindow('monaC2',a,12);
  }
 },
 createTimeline:createMonaRuntime,
 createCombat:createMonaRuntime,
 combatCompletion:a=>a.kind==='cast'&&a.action==='burst'?actionTime(a.time+(a.params?.bubbleDelayMs??8000)/1000+1/60):undefined,
 create({role,profiles,rotation,math:m=scalarMath}){
  const c=profiles[role].character;
  return {attackBuffs(r,e){return c.constellation>=2&&rotation().covered('monaC2',e.time,e.rootOrder)?[effect('莫娜·星月的连珠',{ElementalMastery:80})]:[];},damageBuffs(r,e){
   const active=rotation().covered('monaOmen',e.time,e.rootOrder);
   return typeof active==='object'||active?[effect('莫娜·星异',{BonusBase:m.mul(active,omenBonus(c.skill3))})]:[];
  },criticalBuffs:e=>{
   const active=rotation().covered('monaOmen',e.time,e.rootOrder);
   return c.constellation>=4&&(typeof active==='object'||active)?[effect('莫娜·灭绝的预言',{CriticalBase:m.mul(.15,active),...(e.role===role?{CriticalDamageBase:m.mul(.15,active)}:{})})]:[];
  }};
 },
};

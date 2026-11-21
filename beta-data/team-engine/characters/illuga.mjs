import {castFrameTable} from '../cast-frame-table.mjs';
import {defineActionRecipes,basicAttackRecipes,basicNativeDamage} from '../action-recipes.mjs';
import {elementalApplication as application} from '../ice-electro-reactions.mjs';
import {actionTime,effect,numericSum} from '../rule-utils.mjs';
import {eventKey,afterEvent,compareEventPosition} from '../event-order.mjs';
import {hitTargets} from '../hit-targets.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {hasAscendantGleam} from '../moon-crystallize.mjs';
import {ILLUGA_SONG_GEO,ILLUGA_SONG_LUNAR,ILLUGA_PARTY_GEO,ILLUGA_PARTY_LUNAR} from '../../lunar-effect-rule-book.mjs';

function song({role,profile,activeRole,settings,enqueue,reactions,math:m=scalarMath,observeHit=e=>e.enabled??1}){
 let used=0,capacity=0,until=-Infinity;
 const usage=new Map(),history=[];
 const record=e=>history.push({at:afterEvent(e),until,remaining:m.sub(capacity,used)});
 return {stateAt(e){
  const row=history.findLast(h=>compareEventPosition(h.at,e)<=0);
  return {quills:usage.get(eventKey(e)),song:row?m.choose(m.lt(e.time,row.until),m.gt(row.remaining,0),0):0};
 },
  beforeEvent(e){
   if(e.kind!=='hit'||e.hitTriggers===false||e.element!=='Geo'||e.role!==activeRole(e.time,e.rootOrder)||e.time>=until)return;
   const perTarget=new Map(),before=used;
   for(const id of hitTargets(e,settings)){
    const spent=m.choose(e.enabled??1,m.choose(m.lt(used,capacity),observeHit(e),0),0);perTarget.set(id,spent);used=m.add(used,spent);
   }
   usage.set(eventKey(e),perTarget);record(e);
   if(profile.character.constellation<2)return;
   const count=m.sub(m.floor(m.div(used,7)),m.floor(m.div(before,7)));
   for(let i=0;i<Math.ceil(perTarget.size/7);i++){
    const enabled=m.gt(count,i);if(typeof enabled!=='object'&&!enabled)continue;
    enqueue({kind:'hit',role,index:11,category:'burst',element:'Geo',time:actionTime(e.time+50/60),rootOrder:e.rootOrder,order:e.order,
     targetIds:[0],application:application(),enabled,persistent:true,eventId:eventKey(e)+'/illuga-c2/'+i,label:'叶洛亚·二命'});
   }
  },onEvent(e){
   if(e.kind==='reaction'&&e.reactionType==='LunarCrystallize'&&e.time<until){capacity=m.choose(m.choose(e.enabled??1,m.lt(used,capacity),0),36,capacity);record(e);}
  },onHit(e){if(e.role===role&&e.index===10&&e.damageModel===undefined){
   used=0;capacity=m.choose(reactions.at(e).moonCages,36,21);until=e.time+20;record(e);
  }},
 };
}
const ordinary=basicAttackRecipes({normals:[[0,13],[1,16],[2,[20,32]],[3,43]],charged:[4,23],plunge:[5,6,7]});
export const illuga={
 castFrames:castFrameTable({skill:47,'skill.hold':58,burst:65,charged:66},[30,33,57,80]),
 id:'Illuga',element:'Geo',weaponType:'Polearm',panelIndex:8,reactionStatIndex:8,nativeBackend:'legacy',usesElementalApplications:true,moonsign:true,
 defaultConstellation:6,defaultWeapon:'BeginnersProtector',previewWeapon:'BeginnersProtector',capabilities:{energy:60,shield:false,nightsoul:false,arkhe:false},constellationTalents:{3:'skill3',5:'skill2'},
 nativeDamage:{...basicNativeDamage(ordinary),9:{category:'skill',element:'Geo'},8:{category:'skill',element:'Geo'},10:{category:'burst',element:'Geo'},11:{category:'burst',element:'Geo'}},
 ...defineActionRecipes([
  ...ordinary,{id:'skill.hold',label:'衔莺破晓·长按',endOffsetMs:600,events:[{kind:'hit',index:9,category:'skill',element:'Geo',application:application(),delay:.6}]},
  {id:'skill',label:'衔莺破晓',events:[{kind:'hit',index:8,category:'skill',element:'Geo',application:application()}]},
  {id:'burst',label:'鉴照无影',endOffsetMs:700,events:[{kind:'hit',index:10,category:'burst',element:'Geo',application:application(),delay:.7}]},
 ]),
 createTimeline:song,createCombat:song,
 modeled:['IllugaP2','IllugaQ','IllugaC4'],
 normalize(p){p.character.params={Illuga:{q_buff_active:false,p2_buff_active:false,full_moon:false,team_hydro_geo_count:1}};},
 effects({character:c,role},{profiles}){
  const trigger={kind:'hit',index:10},full=hasAscendantGleam(profiles);
  return [...(teamTalentUnlocked(c,1)?[{id:'illuga.oath',label:'执灯之誓',stage:'base',target:'other',trigger:{kind:'hit',index:[8,9,10]},duration:20,reads:{},value:()=>({CriticalGeo:c.constellation===6?.1:.05,CriticalDamageGeo:c.constellation===6?.3:.1,ElementalMastery:full?(c.constellation===6?80:50):0})}]:[]),
   ...(c.constellation>=4?[{id:'illuga.c4',label:'逐日之狼',stage:'base',target:'teamOnField',trigger,duration:20,condition:({rotation,event})=>rotation.characterState(role,event)?.song??0,reads:{},value:()=>({DEFFixed:200})}]:[])];
 },
 create({role,profiles,elements,rotation,math:m}){
  const c=profiles[role].character,sum=numericSum(m),count=teamTalentUnlocked(c,4)?elements.filter(el=>['Geo','Hydro'].includes(el)).length-1:0;
  return {damageBuffs(r,e,_panels,source){
   const use=rotation().characterState(role,e)?.quills;
   if(!use||!e.targetIds.length)return [];
   const coverage=m.div(e.targetIds.reduce((total,id)=>m.add(total,use.get(id)??0),0),e.targetIds.length);
   const lunar=e.damageModel==='direct.lunarCrystallize',ratio=lunar?ILLUGA_SONG_LUNAR[c.skill3]+ILLUGA_PARTY_LUNAR[count]:ILLUGA_SONG_GEO[c.skill3]+ILLUGA_PARTY_GEO[count];
   return [effect('叶洛亚·夜莺之歌',{[lunar?'ExtraDmgDirectMoonCrystallize':'ExtraDmgGeo']:m.mul(coverage,m.mul(ratio,sum(source(role).elemental_mastery)))})];
  }};
 },
};

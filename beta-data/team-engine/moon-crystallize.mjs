import {characterPackages} from './character-packages.mjs';
import {actionTime,effect,numericSum} from './rule-utils.mjs';
import {teamTalentUnlocked} from './character-levels.mjs';
import {eventKey,afterEvent,eventBefore} from './event-order.mjs';
export {isMoonCrystallize} from './native-damage-fields.mjs';
export const hasAscendantGleam=profiles=>profiles.filter(p=>characterPackages[p.character.name].moonsign).length>=2;

// At Full Moon the most recent eligible caster supplies a 20s blessing.
export function createGleamBlessing(profiles,rotation){
 const casts=hasAscendantGleam(profiles)?rotation.roots.filter(e=>e.kind==='cast'&&!characterPackages[profiles[e.role].character.name].moonsign):[];
 const stats={Hydro:['hp',.000006],Geo:['def',.0001],Anemo:['elemental_mastery_convertible',.000225],Dendro:['elemental_mastery_convertible',.000225],
  Cryo:['atk',.00009],Electro:['atk',.00009],Pyro:['atk',.00009]};
 return (e,panelsAt,m)=>{
  const cast=casts.findLast(c=>eventBefore(c,e)&&e.time<c.time+20);
  if(!cast)return [];
  const seconds=Math.floor(actionTime(e.time-cast.time));
  const at=seconds?{time:actionTime(cast.time+seconds),rootOrder:-Infinity,order:0}:afterEvent(cast);
  const [stat,rate]=stats[characterPackages[profiles[cast.role].character.name].element];
  return [effect('月兆·满辉',{EnhanceMoonReaction:m.min(.36,m.mul(rate,numericSum(m)(panelsAt(at)[cast.role][stat])))})];
 };
}

export function moonCrystallizeOptions(profiles,domainActive){
 const columbina=profiles.find(p=>p.character.name==='Columbina')?.character;
 const double=columbina&&teamTalentUnlocked(columbina,4)&&hasAscendantGleam(profiles);
 return {lunarCrystallizeEnabled:profiles.some(p=>characterPackages[p.character.name].enablesLunarCrystallize),domainDoubleAt:e=>double&&domainActive(e)};
}

// Encounters use the engine's target IDs. Each harmony attacks its triggering
// target; the three launches snapshot independently before their travel time.
export function createMoonCrystallize({math:m,targets,actorIds,enqueue,emitReaction,domainDoubleAt}){
 const water=targets.map(()=>actorIds.map(()=>0));
 let count=0,ready=-Infinity,expires=-Infinity,lastHarmony=-Infinity,clock=0,contributors=actorIds.map(()=>0);
 const possible=value=>typeof value==='object'||!!value;
 function sync(id){
  const amounts=water[id],highest=amounts.reduce((v,x)=>m.max(v,x),0),spent=m.max(0,m.sub(highest,targets[id].Hydro.amount));
  water[id]=amounts.map(value=>m.max(0,m.sub(value,spent)));
 }
 return {state:()=>({lastHarmony,expires}),
  advance(time){
   const elapsed=time-clock;clock=time;
   for(let id=0;id<water.length;id++){
    if(elapsed)water[id]=water[id].map(value=>m.max(0,m.sub(value,m.mul(elapsed,targets[id].Hydro.decay))));
    sync(id);
   }
  },
  record(e,id,attach){if(e.element==='Hydro')water[id][e.role]=m.choose(attach,m.max(water[id][e.role],.8*e.application.gauge),water[id][e.role]);},
  projectiles,
  launch(e){
   const {time,mechanic,kind,...fields}=e;
   enqueue({...fields,kind:'hit',index:0,category:'reaction',element:'Geo',nativeElement:'Geo',damageModel:'reaction.lunarCrystallize',label:'月笼谐奏',
    hitTriggers:false,reactionDamage:true,persistent:true,time:actionTime(e.harmonyTime+(e.frame+10)/60),eventId:e.eventId+'/impact',reactionContact:true,blunt:true,lunarSnapshot:{time,rootOrder:e.rootOrder,order:e.order??0}});
  },
  apply(e,id,pass,gauge=e.application.gauge){
   const aura=targets[id].Hydro,gate=m.choose(pass,m.choose(m.gt(gauge,0),m.gt(aura.amount,0),0),0);
   if(!possible(gate))return gauge;
   sync(id);
   contributors=contributors.map((old,r)=>m.max(old,m.choose(gate,r===e.role?1:m.gt(water[id][r],0),0)));
   count=m.choose(gate,m.min(6,m.add(count,1)),count);
   const fact=emitReaction(e,{reactionType:'LunarCrystallize',elements:['Hydro','Geo'],targetIds:[id],enabled:gate,instanceId:'water/'+id});
   const harmony=m.choose(gate,m.choose(m.lt(e.time,expires),m.choose(m.ge(e.time,ready),m.ge(count,3),0),0),0);
   expires=m.choose(m.choose(gate,m.max(m.ge(e.time,expires),harmony),0),actionTime(e.time+9),expires);
   const consumed=m.min(aura.amount,m.mul(.5,gauge)),remaining=m.choose(gate,m.sub(gauge,m.mul(2,consumed)),gauge);
   aura.amount=m.choose(gate,m.sub(aura.amount,consumed),aura.amount);sync(id);
   if(!possible(harmony))return remaining;
   count=m.choose(harmony,m.sub(count,3),count);ready=m.choose(harmony,actionTime(e.time+37/60),ready);
   lastHarmony=m.choose(harmony,e.time,lastHarmony);
   const members=contributors.map((enabled,role)=>({enabled,role,actorId:actorIds[role]}));
   contributors=contributors.map(value=>m.choose(harmony,0,value));
   enqueue({kind:'timer',role:e.role,time:e.time,rootOrder:e.rootOrder,order:e.order,step:(fact.step??0)+1,enabled:harmony,mechanic:'lunar.harmony',eventId:eventKey(fact)+'/harmony'});
   projectiles(fact,id,members,harmony);return remaining;
  },
 };
 function projectiles(e,id,members,enabled){
  for(const frame of [13,25,37])enqueue({kind:'timer',mechanic:'lunar.launch',role:e.role,time:actionTime(e.time+frame/60),rootOrder:-1,
   eventId:eventKey(e)+'/launch/'+frame,parentEventId:eventKey(e),contributors:members,targetIds:[id],enabled,frame,harmonyTime:e.time,domainDouble:domainDoubleAt(e)});
 }
}

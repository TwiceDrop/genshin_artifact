import {scalarMath} from '../../team-dps-numeric-rules.mjs';
import {teamTalentUnlocked} from '../character-levels.mjs';
import {actionTime} from '../rule-utils.mjs';
import {afterEvent,eventKey,compareEventPosition} from '../event-order.mjs';
import {hitTargets} from '../hit-targets.mjs';

export function createAlyoshaRuntime({role,profile,profiles,settings={},math:m=scalarMath,enqueue,activeRole,observeHit=e=>e.enabled??1,recordResource,resources}){
 const c=profile.character,marks=Array(settings.enemy_count??1).fill(-Infinity),history=[];
 const and=(a,b)=>m.choose(a,b,0),possible=x=>typeof x==='object'||!!x;
 let stacks=0,expires=-Infinity;
 function remember(e){
  history.push({at:afterEvent(e),stacks,expires});
  const row={...afterEvent(e),kind:'resource',resource:'alyosha.precision',label:'阿罗夏·猎者之准',value:stacks,expires};
  if(recordResource)recordResource(row);else resources.push(row);
 }
 function heal(e,healing,recipients,label,step,extra={}){
  enqueue({kind:'heal',time:e.time,rootOrder:e.rootOrder,order:e.order,step:(e.step??0)+step,role,enabled:e.enabled??1,recipients,healing,label,...extra,
   eventId:eventKey(e)+'/'+healing,parentEventId:eventKey(e)});
 }
 return {
  stateAt(e){const row=history.findLast(h=>compareEventPosition(h.at,e)<=0);return {stacks:row?m.choose(m.lt(e.time,row.expires),row.stacks,0):0};},
  onEvent(e){
   if(e.role!==role||e.mechanic!=='alyosha.mark')return;
   const gate=e.enabled??1;stacks=m.choose(m.ge(e.time,expires),0,stacks);
   for(const id of e.targetIds){
    const marked=m.lt(e.time,marks[id]),activate=and(gate,marked),apply=and(gate,m.choose(marked,0,e.canApply?1:0));
    marks[id]=m.choose(activate,-Infinity,m.choose(apply,actionTime(e.time+15),marks[id]));
    stacks=m.choose(activate,m.min(c.constellation>=6?2:1,m.add(stacks,1)),stacks);expires=m.choose(activate,actionTime(e.time+15),expires);
   }
   remember(e);
  },
  onHit(e){
   if(e.role!==role||!e.alyoshaField&&!e.alyoshaMark&&!e.alyoshaDog)return;
   const possibleHit=e.enabled??1;if(!possible(possibleHit))return;
   const gate=and(possibleHit,observeHit(e)),ids=hitTargets(e,settings);
   // C2's mark is placed by the field before the following bite; it does not
   // itself activate an existing mark.
   if(e.alyoshaField&&c.constellation>=2&&ids.length)marks[ids[0]]=m.choose(gate,actionTime(e.time+15),marks[ids[0]]);
   if(e.alyoshaMark||e.alyoshaDog)enqueue({kind:'timer',mechanic:'alyosha.mark',role,time:actionTime(e.time+.1),rootOrder:e.rootOrder,order:e.order,
    enabled:gate,targetIds:[...ids],canApply:!!e.alyoshaMark,eventId:eventKey(e)+'/mark',parentEventId:eventKey(e)});
   if(e.alyoshaDog){
    const cause={...e,enabled:gate};
    if(teamTalentUnlocked(c,1))heal(cause,'alyosha.a1',[activeRole(e.time,e.rootOrder)],'阿罗夏·图加林治疗',1);
    if(c.constellation>=4)heal(cause,'alyosha.c4',profiles.map((_,i)=>i),'阿罗夏·四命治疗',2,{lowestOnly:true});
   }
  },
 };
}

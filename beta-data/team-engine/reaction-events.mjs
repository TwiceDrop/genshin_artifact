import {afterEvent,eventKey} from './event-order.mjs';
import {hitTargets} from './hit-targets.mjs';
import {scalarMath} from '../team-dps-numeric-rules.mjs';
import {observeProcHit} from './proc-outcomes.mjs';

const actorRole=(actorIds,id)=>{const role=actorIds.indexOf(id);if(role<0)throw Error('反应事实角色身份无效：'+id);return role;};

// The caller has already resolved whether a reaction occurs. This helper only
// preserves causality, actual-hit gating, ownership and explicit target facts.
export function createReactionEmitter({actorIds,settings={},math:m=scalarMath,observeHit=observeProcHit,enqueue,record,initialFacts=[]}){
 const known=new Set(initialFacts.map(eventKey));
 return (cause,definition)=>{
  const {reactionType,elements,instanceId='primary'}=definition;
  if(!reactionType||!Array.isArray(elements)||!elements.length)throw Error('反应事实必须声明类型及参与元素');
  const triggerActorId=definition.triggerActorId??actorIds[cause.role],role=actorRole(actorIds,triggerActorId),sourceActorId=definition.sourceActorId??cause.sourceActorId??actorIds[cause.role],ownerActorId=definition.ownerActorId??triggerActorId;
  const targetIds=[...(definition.targetIds??hitTargets(cause,settings))],at=afterEvent(cause),parentEventId=eventKey(cause);
  const possible=m.choose(cause.enabled??1,targetIds.length?definition.enabled??1:0,0),enabled=typeof possible!=='object'&&!possible?0:m.choose(possible,observeHit(cause),0);
  const fact={kind:'reaction',reaction:reactionType,reactionType,reactionOrigin:'resolved',elements:[...elements],time:at.time,rootOrder:at.rootOrder,order:at.order,step:at.step,
   eventId:JSON.stringify(['reaction',parentEventId,triggerActorId,reactionType,instanceId,targetIds]),parentEventId,role,sourceActorId,triggerActorId,ownerActorId,targetIds,category:cause.category,enabled,
   ...(definition.contributors?{contributors:definition.contributors.map(value=>({...value}))}:{}),...(cause.resolvedInstances?{resolvedInstances:[...cause.resolvedInstances]}:{})};
  const key=eventKey(fact);if(known.has(key))throw Error('反应事实身份重复：'+key);known.add(key);
  // A zero gate still records that this cause/type was resolved. Legacy theory
  // must not invent a replacement reaction when the candidate says it failed.
  record(fact);enqueue(fact);return fact;
 };
}

// A reaction fact and its damage are separate events. Neither the reaction's
// trigger nor an elemental contributor is automatically the damage owner.
export function reactionDamageEvent(fact,definition,{actorIds,math:m=scalarMath}){
 const {ownerActorId=fact.ownerActorId,enabled=1,key='damage',...payload}=definition;
 if(!payload.damageModel||!payload.element)throw Error('反应伤害必须声明伤害模型及元素');
 const at=afterEvent(fact),parentEventId=eventKey(fact);
 return {...payload,kind:'hit',category:payload.category??'reaction',reactionDamage:true,reactionType:fact.reactionType,reactionOrigin:fact.reactionOrigin,
  time:at.time,rootOrder:at.rootOrder,order:at.order,step:at.step,eventKey:undefined,eventId:JSON.stringify(['reaction-damage',parentEventId,ownerActorId,key]),parentEventId,role:actorRole(actorIds,ownerActorId),
  sourceActorId:fact.sourceActorId,triggerActorId:fact.triggerActorId,ownerActorId,targetIds:[...(payload.targetIds??fact.targetIds)],
  enabled:m.choose(fact.enabled??1,enabled,0),...(fact.contributors?{contributors:fact.contributors.map(value=>({...value}))}:{})};
}

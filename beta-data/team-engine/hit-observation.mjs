import {eventKey} from './event-order.mjs';

// Execution identity drives lifecycle once. A target observation has its own
// typed identity for traces, while retaining the original hit and stable owner.
export function targetObservation(row,event,targetId,actorId){
 const key=JSON.stringify(['target',event.contactId??eventKey(event),actorId,targetId]);
 return {...row,eventKey:key,contactId:key,hitEventId:eventKey(event),ownerActorId:actorId,sourceActorId:row.sourceActorId??actorId,targetIds:[targetId]};
}

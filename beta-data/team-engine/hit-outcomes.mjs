import {eventKey} from './event-order.mjs';

// A contact owns its critical result. Scoring selections and later mechanism
// events read this same record; neither resamples nor rereads later stats.
export function createHitOutcomes(m,draw,actorId){
 const hits=new Map();
 return {
  begin(event){const hit=eventKey(event);if(!hits.has(hit))hits.set(hit,new Map());},
  contact(event,targetId,rate,damage){
   const hit=eventKey(event);if(!hits.has(hit))hits.set(hit,new Map());
   const contacts=hits.get(hit);if(contacts.has(targetId))return contacts.get(targetId);
   const id='hit.critical/'+JSON.stringify([actorId(event.role),hit,targetId]),chance=m.choose(event.enabled??1,rate,0);
   const critical=draw(id,chance,'命中暴击'),dealt=m.choose(critical,damage.critical,damage.non_critical);
   const result={targetId,criticalId:id,rate,critical,damage:dealt,non_critical:damage.non_critical,critical_damage:damage.critical};
   contacts.set(targetId,result);return result;
  },
  anyCritical(hit){return [...hits.get(hit).values()].reduce((value,contact)=>m.max(value,contact.critical),0);},
 };
}

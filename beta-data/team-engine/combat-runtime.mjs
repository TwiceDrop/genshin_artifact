import {createEventScheduler} from './scheduler.mjs';
import {scalarMath} from '../team-dps-numeric-rules.mjs';
import {compareEvents} from './event-order.mjs';

// Casts, hits and resolved health changes share one causal delivery stream.
// Resolving an event reads its pre-event state. Its fact is then published to
// effect lifecycles before the post-event health snapshot is committed.
export function resolveCombatTimeline(events,health,effects,hooks={}){
 const scheduler=createEventScheduler([...events,...health.events]);
 const horizon=hooks.horizon??health.rotation.duration,m=hooks.math??scalarMath;
 let cause;
 const enqueue=event=>{
  if(cause?.resolvedInstances)event={...event,resolvedInstances:[...new Set([...cause.resolvedInstances,...(event.resolvedInstances??[])])]};
  if(event.time<horizon||event.time===horizon&&(hooks.horizon!==undefined||health.rotation.endHit==='include'))scheduler.enqueue(event);
 };
 for(const raw of scheduler.events()){
  let event=raw;
  if(hooks.horizon!==undefined){
   const end=health.rotation.duration,terminal=event.kind==='cast'||event.kind==='switch'||health.rotation.endHit==='include';
   const floor=hooks.minimumDuration??-Infinity;
   const inside=event.time<floor||event.time===floor&&terminal?1:m.choose(m.lt(event.time,end),1,terminal?m.eq(event.time,end):0);
   const enabled=event.probability===0?0:m.choose(inside,event.enabled??1,0);
   if(typeof enabled!=='object'&&!enabled)continue;
   event={...event,enabled};
  }
  cause=event;
  const variants=hooks.prepareEvent?.(event,enqueue);
  if(variants){for(const variant of variants)enqueue(variant);continue;}
  const transition=health.resolve(event,enqueue);
  const fact=transition?.event??event;
  effects?.publish(fact);
  let damage;
  if(fact.kind==='hit'){hooks.beforeHit?.(fact);damage=hooks.hit?.(fact);}
  transition?.commit?.();
  for(const child of transition?.facts??[])enqueue(child);
  if(fact.kind==='hit')health.afterHit?.(fact,enqueue);
  hooks.afterEvent?.(damage?{...fact,damage}:fact,enqueue);
 }
 if(hooks.horizon!==undefined){
  const visible=(event,terminal)=>m.choose(m.lt(event.time,health.rotation.duration),event.enabled??1,terminal?m.choose(m.eq(event.time,health.rotation.duration),event.enabled??1,0):0);
  const trim=(rows,terminal)=>rows.flatMap(event=>{const enabled=visible(event,terminal);return typeof enabled==='object'?[{...event,enabled}]:enabled?[event]:[];});
  health.rotation.events=trim(health.rotation.events,health.rotation.endHit==='include');
  health.rotation.resources=trim(health.rotation.resources??[],true);
 }
 health.rotation.resources?.sort(compareEvents);
 return health.rotation;
}

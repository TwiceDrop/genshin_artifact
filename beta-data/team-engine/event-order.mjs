// A position describes causality. Identity only breaks otherwise independent
// ties; it must not make a state change visible before the event that caused it.
export const compareEventPosition=(a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||
 (a.order??0)-(b.order??0)||(a.step??0)-(b.step??0);
export const eventKey=e=>e.eventKey??[e.eventId??e.id??e.kind,e.time,e.rootOrder,e.part??0].join('/');
export const compareEvents=(a,b)=>compareEventPosition(a,b)||eventKey(a).localeCompare(eventKey(b));
export const afterEvent=e=>({...e,step:(e.step??0)+1});
export const eventBefore=(a,b)=>compareEventPosition(a,b)<0;

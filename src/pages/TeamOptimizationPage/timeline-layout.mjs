export const TIMELINE_SCALE=64;
export const TIMELINE_LABEL_WIDTH=150;
// Unmeasured actions retain a label-sized block, aligned to the editing grid.
// This is display geometry, not a measured animation duration.
const unmeasuredBlockWidth=Math.round(132/TIMELINE_SCALE*10)/10*TIMELINE_SCALE;
export const actionBlockWidth=durationMs=>durationMs===undefined?unmeasuredBlockWidth:durationMs/1000*TIMELINE_SCALE;
export function pointerTime(clientX,left,scrollLeft,offset=0,snapToGrid=true){
 const time=(clientX-left+scrollLeft-TIMELINE_LABEL_WIDTH-offset)/TIMELINE_SCALE*1000;
 return Math.max(0,snapToGrid?Math.round(time/100)*100:time);
}
export function edgeVelocity(x,left,right){
 const edge=48;
 if(x<left+edge)return -Math.min(18,Math.max(0,(left+edge-x)/edge*18));
 if(x>right-edge)return Math.min(18,Math.max(0,(x-right+edge)/edge*18));
 return 0;
}
// Separate overlapping labels without changing action order or event times.
export function stackBlocks(items,width){
 const ends=[];
 return [...items].sort((a,b)=>a.timeMs-b.timeMs||a.order-b.order).map(item=>{
  const x=item.timeMs/1000*TIMELINE_SCALE;
  let level=ends.findIndex(end=>end<=x+1e-6);
  if(level<0)level=ends.length;
  ends[level]=x+(typeof width==='function'?width(item):width);
  return {...item,level};
 });
}
export function snapToTimelineEdge(timeMs,rows,selectedId){
 return findTimelineSnap(timeMs,rows,selectedId,100)??timeMs;
}
export function findTimelineSnap(timeMs,rows,selectedId,rangeMs){
 const other=rows.filter(row=>row.id!==selectedId);
 const ends=other.filter(row=>row.width!==undefined||row.durationMs!==undefined).map(row=>row.timeMs+(row.width!==undefined?row.width/TIMELINE_SCALE*1000:row.durationMs)).filter(end=>Math.abs(end-timeMs)<=rangeMs);
 const candidates=ends.length?ends:other.map(row=>row.timeMs).filter(start=>Math.abs(start-timeMs)<=rangeMs);
 return candidates.sort((a,b)=>Math.abs(a-timeMs)-Math.abs(b-timeMs)||a-b)[0];
}
export const nudgeActionTime=(timeMs,direction)=>Math.max(0,timeMs+direction*100);

import {scalarMath} from './team-dps-numeric-rules.mjs';

// Both healing accumulators use the candidate's event gates and raw healing.
// Expiry instants are static; the active record and its amount are numeric state.
export function equipmentHealingDamage(profiles,rotation,healAmount,has,settings={},math=scalarMath){
 const m=math,and=(a,b)=>m.choose(a,b,0),enabled=h=>h.enabled??1;
 const queue=rotation.heals.map(h=>({...h,kind:'heal'})),waves=[],procs=[],flat=new Map();
 for(const time of new Set(rotation.heals.map(h=>h.time+6)))queue.push({time,kind:'song_end',rootOrder:-Infinity,order:-Infinity});
 for(const time of new Set(rotation.heals.map(h=>h.time+3)))queue.push({time,kind:'bubble_end',rootOrder:-Infinity,order:-Infinity});
 queue.sort((a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||(a.order??0)-(b.order??0));
 let songActive=0,songEnd=Infinity,songStart=0,songAmount=0,bubbleActive=0,bubbleEnd=Infinity,bubbleOwner=-1,bubbleAmount=0;
 const cooldowns=profiles.map(()=>-Infinity),put=(list,row,gate)=>{
  if(typeof gate!=='object'){if(gate)list.push(row);}else list.push({...row,enabled:gate});
 };
 for(const h of queue){
  if(h.kind==='song_end'){
   const due=and(songActive,m.eq(songEnd,h.time));
   put(waves,{start:songStart,end:h.time,amount:songAmount},due);songActive=m.choose(due,0,songActive);continue;
  }
  if(h.kind==='bubble_end'){
   const due=and(bubbleActive,m.eq(bubbleEnd,h.time));
   for(let r=0;r<profiles.length;r++){
    const owner=and(due,m.eq(bubbleOwner,r));
    put(procs,{time:h.time,role:r,label:'海染砗磲·海染泡沫',fixed:m.choose(owner,m.mul(.9,m.min(30000,bubbleAmount)),0),ignoreDefense:true,noCrit:true,rootOrder:-1,order:-1},owner);
   }
   bubbleActive=m.choose(due,0,bubbleActive);continue;
  }
  const song=and(enabled(h),has(h.role,'SongOfDaysPast')),start=and(song,m.eq(songActive,0));
  songStart=m.choose(start,h.time,songStart);songEnd=m.choose(start,h.time+6,songEnd);songAmount=m.choose(start,0,songAmount);
  songAmount=m.add(songAmount,m.choose(song,healAmount(h),0));songActive=m.max(songActive,song);
  const clam=and(enabled(h),has(h.role,'OceanHuedClam')),spawn=and(clam,and(m.eq(bubbleActive,0),m.ge(h.time,cooldowns[h.role])));
  bubbleEnd=m.choose(spawn,h.time+3,bubbleEnd);bubbleOwner=m.choose(spawn,h.role,bubbleOwner);bubbleAmount=m.choose(spawn,0,bubbleAmount);
  bubbleAmount=m.add(bubbleAmount,m.choose(and(clam,m.eq(bubbleOwner,h.role)),healAmount(h),0));bubbleActive=m.max(bubbleActive,spawn);cooldowns[h.role]=m.choose(spawn,h.time+3.5,cooldowns[h.role]);
 }
 let previous=-1,uses=0;
 for(const e of rotation.events){
  let index=-1,amount=0;
  for(let i=0;i<waves.length;i++)if(e.time>=waves[i].end&&e.time<waves[i].end+10){
   const active=enabled(waves[i]);index=m.choose(active,i,index);amount=m.choose(active,waves[i].amount,amount);
  }
  uses=m.choose(m.eq(index,previous),uses,0);previous=index;
  const active=e.onField?and(m.ge(index,0),m.lt(uses,5)):0,targets=settings.damage_scope==='all'?(settings.enemy_count??1):1,used=m.min(targets,m.sub(5,uses));
  if(typeof active==='object'||active)flat.set(e.order,m.choose(active,m.div(m.mul(m.mul(.08,m.min(15000,amount)),used),targets),0));
  uses=m.add(uses,m.choose(active,used,0));
 }
 return {waves,procs,flat};
}

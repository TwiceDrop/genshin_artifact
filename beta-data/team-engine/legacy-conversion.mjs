import {TEAM_ACTION_RULES_VERSION,validateActionAxis} from './action-config.mjs';

// Convert commands, not generated damage/healing. The installed character
// modules own summons, constellation hits and buff windows in the new format.
export function legacyActionAxis(axis){
 axis=JSON.parse(JSON.stringify(axis));
 const timeline=[],rifts=new Map(),carry=axis.members.find(m=>m.character==='Skirk').slot;
 for(const event of axis.timeline){
  const {id,kind,actor,action,timeMs,when}=event;
  if(kind==='hit'&&action==='skirk.c1'){
   for(let i=0;i<(event.repeat?.count??1);i++){const time=timeMs+i*(event.repeat?.intervalMs??0);if(time<=axis.durationMs)rifts.set(time,(rifts.get(time)??0)+1);}continue;
  }
  let command;
  if(kind==='switch')command={id,kind,actor,timeMs};
  else if(kind==='cast')command={id,kind:'action',actor,action,timeMs};
  else if(kind==='hit'){
   if(action==='furina.c6.normal')command={id,kind:'action',actor,action:'normal.1',timeMs};
   else if(/\.(normal\.\d|charged|plunge)$/.test(action))command={id,kind:'action',actor,action:action.slice(action.indexOf('.')+1),timeMs};
   else continue;
  }else if(kind==='heal'||kind==='state'&&['frozen','cryo_aura'].includes(event.state))continue;
  else throw Error('尚不能转换的轴事件：'+id+'（'+kind+'）');
  if(when)command.when=structuredClone(when);
  for(let i=0;i<(event.repeat?.count??1);i++){
   const time=timeMs+i*(event.repeat?.intervalMs??0);if(time>axis.durationMs)break;
   timeline.push({...command,id:i?id+'/'+i:id,timeMs:time});
  }
 }
 for(const [time,count]of rifts){
  const command=timeline.find(e=>e.actor===carry&&e.timeMs===time&&['burst','charged'].includes(e.action));
  if(!command)throw Error('找不到裂隙吸收对应动作：'+time/1000+'秒');
  command.params={absorbedRifts:count};
 }
 timeline.sort((a,b)=>a.timeMs-b.timeMs);
 return validateActionAxis({format:'mona-action-axis',formatVersion:1,rulesVersion:TEAM_ACTION_RULES_VERSION,id:axis.id,title:axis.title,endHit:axis.endHit,initialActiveSlot:axis.initialActiveSlot,members:structuredClone(axis.members),timeline});
}

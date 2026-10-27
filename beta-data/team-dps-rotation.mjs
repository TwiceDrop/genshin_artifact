import {TEAM_DPS_ACTIONS,validateTeamDpsConfiguration} from './team-dps-config.mjs';
import {teamTalentUnlocked} from './team-dps-character-rules.mjs';
export function compileTeamDpsAxis(configuration,profiles,settings={}){
 const c=validateTeamDpsConfiguration(configuration),slots=c.members.map(m=>m.slot),duration=c.durationMs/1000;
 const roots=[];
 for(const e of c.timeline){
  if(e.when&&profiles[slots.indexOf(e.when.slot)].character.constellation<e.when.constellationAtLeast)continue;
  for(let n=0;n<(e.repeat?.count??1);n++){
   const ms=e.timeMs+n*(e.repeat?.intervalMs??0);
   if(ms>c.durationMs||(ms===c.durationMs&&c.endHit==='exclude'))continue;
   roots.push({...e,time:ms/1000,role:slots.indexOf(e.actor),rootOrder:roots.length});
  }
 }
 const switches=roots.filter(e=>e.kind==='switch').sort((a,b)=>a.time-b.time);
 const occurred=(e,t,order=Infinity)=>e.time<t||(e.time===t&&e.rootOrder<=order);
 const activeRole=(t,order)=>{let role=slots.indexOf(c.initialActiveSlot);for(const e of switches)if(occurred(e,t,order))role=e.role;return role;};
 const castTimes=kind=>slots.map((slot,r)=>roots.filter(e=>e.role===r&&e.kind==='cast'&&e.action===kind).map(e=>e.time));
 const castE=castTimes('skill'),castQ=castTimes('burst');
 const lastCast=(role,kind,t,order)=>Math.max(-Infinity,...roots.filter(e=>e.role===role&&e.kind==='cast'&&e.action===kind&&occurred(e,t,order)).map(e=>e.time));
 const entered=(t,order)=>{const e=switches.filter(e=>occurred(e,t,order)).at(-1);return e?e.time:0;};
 let previous=slots.indexOf(c.initialActiveSlot);for(const e of switches){e.from=previous;previous=e.role;}
 const heals=roots.filter(e=>e.kind==='heal').map(e=>({...e,recipients:e.recipients==='team'?[0,1,2,3]:[activeRole(e.time,e.rootOrder)]})).sort((a,b)=>a.time-b.time);
 for(let r=0;r<profiles.length;r++)if(profiles[r].weapon.name==='PrototypeAmber')for(const c of roots.filter(e=>e.role===r&&e.kind==='cast'&&e.action==='burst'))for(const offset of [2,4,6])if(c.time+offset<=duration)heals.push({...c,time:c.time+offset,rootOrder:c.rootOrder+.5,kind:'heal',healing:'prototype_amber',recipients:[0,1,2,3]});
 heals.sort((a,b)=>a.time-b.time||a.rootOrder-b.rootOrder);
 const events=[];let serial=0,normal=0;
 for(const e of roots)if(e.kind==='hit'){
  if(['skirk.c1','skirk.c6'].includes(e.action)&&!teamTalentUnlocked(profiles[0].character,1))continue;
  const a=TEAM_DPS_ACTIONS[e.action];
  for(let part=0;part<(a.hits??a.parts);part++){
   const event={...a,time:e.time,label:e.label||e.action,weakpoint:e.weakpoint===true,part,serial:serial++,rootOrder:e.rootOrder,eventId:e.id};
   events.push(event);
  }
 }
 if(profiles[2].character.constellation>=6){
  let last=-Infinity,remaining=0,cast=-Infinity;
  const hits=events.filter(e=>e.role===activeRole(e.time,e.rootOrder)&&['normal','charged','plunge'].includes(e.category)).sort((a,b)=>a.time-b.time||a.serial-b.serial);
  for(const e of hits){const latest=lastCast(2,'skill',e.time,e.rootOrder);if(latest!==cast){cast=latest;remaining=6;}
   if(e.time<cast+20&&remaining>0&&e.time-last>=.5){events.push({...TEAM_DPS_ACTIONS['escoffier.c6'],time:e.time,label:'特级冻霜芭菲·六命追加',part:0,serial:serial++,rootOrder:e.rootOrder,eventId:e.eventId+'/escoffier.c6'});last=e.time;remaining--;}
  }
 }
 if(profiles[1].character.constellation>=6){
  let cast=-Infinity,last=-Infinity,uses=0,end=-Infinity,next=Infinity;
  for(const e of events.filter(e=>e.role===1&&['normal','charged','plunge'].includes(e.category)).sort((a,b)=>a.time-b.time||a.serial-b.serial)){
   const latest=lastCast(1,'skill',e.time,e.rootOrder);if(latest!==cast){cast=latest;uses=0;}
   e.furinaC6=e.time<cast+10&&uses<6;
   if(!e.furinaC6||e.time-last<.1-1e-9)continue;
   while(next<=end&&next<=e.time){heals.push({time:next,role:1,rootOrder:e.rootOrder-.1,kind:'heal',healing:'furina_c6',recipients:[0,1,2,3]});next+=1;}
   if(e.time>=end){end=e.time+2.9;next=e.time+1;}else end+=2.9;
   last=e.time;uses++;
  }
  while(next<=end&&next<=duration){heals.push({time:next,role:1,rootOrder:Infinity,kind:'heal',healing:'furina_c6',recipients:[0,1,2,3]});next+=1;}
 }
 heals.sort((a,b)=>a.time-b.time||a.rootOrder-b.rootOrder);
 events.sort((a,b)=>a.time-b.time||a.serial-b.serial);
 const casts={fanfare:castQ[1],skirkC2:castE[0],vodyFlat:castE[3],escoFlat:castE[2]};
 const windows=Object.fromEntries(Object.keys(casts).map(k=>[k,casts[k].map(t=>({start:c.coverage[k].startMs/1000+t-casts[k][0],end:c.coverage[k].endMs/1000+t-casts[k][0]}))]));
 const window=(key,t)=>windows[key].findLastIndex(w=>t>=w.start&&t<w.end),covered=(key,t)=>window(key,t)>=0;
 const uses=new Map();let normalCycle=0;
 for(const [order,e]of events.entries()){
  e.order=order;e.onField=e.role===activeRole(e.time,e.rootOrder);
  if(e.role===0&&e.category==='normal'&&!e.c6){const cycle=Math.max(0,castE[0].findLastIndex(t=>t<=e.time));if(cycle!==normalCycle){normal=0;normalCycle=cycle;}e.normal=++normal;}
  const targets=settings.damage_scope==='all'?(settings.enemy_count??1):1;
  const spend=(key,limit)=>{const n=uses.get(key)||0,used=Math.max(0,Math.min(targets,limit-n));uses.set(key,n+used);return used;};
  e.vodyTargets=covered('vodyFlat',e.time)?spend('vody/'+window('vodyFlat',e.time)+'/'+e.onField,e.onField?c.coverage.vodyFlat.frontUses:c.coverage.vodyFlat.backUses):0;e.vodyFlat=e.vodyTargets>0;
  e.escoTargets=e.role===0&&covered('escoFlat',e.time)?spend('esco/'+window('escoFlat',e.time),c.coverage.escoFlat.uses):0;e.escoFlat=e.escoTargets>0;
  e.qBonus=e.role===0&&e.category==='normal'&&!e.c6&&e.normal>=c.coverage.deathCrossing.startNormal&&e.normal<c.coverage.deathCrossing.startNormal+c.coverage.deathCrossing.uses;
 }
 const initialHealth={ratios:settings.initial_hp??[1,1,1,1],fanfare:0,overflow:0,active:false};
 return {events,heals,roots,switches,slots,duration,endHit:c.endHit,activeRole,castE,castQ,lastCast,entered,covered,fanfareWindows:windows.fanfare,initialHealth,healthAt:()=>initialHealth,hpEvents:[],salonCounts:new Map()};
}

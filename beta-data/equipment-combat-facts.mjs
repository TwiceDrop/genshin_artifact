import characters from '../src/assets/_gen_character.js';
import {TEAM_DPS_CHARACTER_CAPABILITIES} from './team-dps-config.mjs';
const order=(a,b)=>a.time-b.time||a.rootOrder-b.rootOrder||(a.order??0)-(b.order??0);
const before=(a,b)=>order(a,b)<0;

export function equipmentHitElement(profile,event){
 if(event.element)return event.element;
 const character=characters[profile.character.name];
 if(event.furinaC6)return 'Hydro';
 return ['skill','burst'].includes(event.category)||character.weapon==='Catalyst'?character.element:'Physical';
}

// Energy only spends in this fixed-rotation model. A zero balance cannot emit
// an energy-loss trigger; refund and particle events remain outside this model.
export function equipmentEnergy(profiles,rotation){
 const histories=profiles.map((p,r)=>{
  const maximum=TEAM_DPS_CHARACTER_CAPABILITIES[p.character.name].energy;
  const rows=[];let current=maximum,ready=-Infinity;
  const drains=['KitainCrossSpear','KatsuragikiriNagamasa'].includes(p.weapon.name);
  const sequence=[...rotation.roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='burst').map(h=>({...h,rootOrder:h.rootOrder+.01,spend:maximum})),
   ...(drains?rotation.events.filter(h=>h.role===r&&h.category==='skill').map(h=>({...h,order:h.order+.01,spend:3,weapon:true})):[])].sort(order);
  for(const h of sequence){
   if(h.weapon){if(h.time<ready)continue;ready=h.time+10;}
   const amount=Math.min(current,h.spend);if(amount===0)continue;
   current-=amount;rows.push({...h,amount,current});
  }
  return {maximum,rows};
 });
 return {histories,at(r,e){const {maximum,rows}=histories[r],current=rows.filter(h=>before(h,e)).at(-1)?.current??maximum;return {current,maximum,zero:current===0,full:maximum>0&&current===maximum};}};
}

// Axis facts choose leaf recipient/time. Weapon ownership determines leaf type,
// generation, cooldown and lifetime. A generated leaf is consumed once.
export function equipmentPickups(profiles,rotation,reactions){
 const leaves=[],pickups=[];
 for(let r=0;r<profiles.length;r++){
  const name=profiles[r].weapon.name;if(!['ForestRegalia','SapwoodBlade','Moonpiercer'].includes(name))continue;
  let ready=-Infinity;
  for(const h of reactions.filter(h=>h.role===r&&['Burning','Quicken','Aggravate','Spread','Bloom','Hyperbloom','Burgeon'].includes(h.reaction)).sort(order)){
   if(h.time<ready)continue;ready=h.time+20;leaves.push({...h,source:r,used:false});
  }
 }
 for(const h of rotation.roots.filter(h=>h.kind==='pickup'&&h.item==='leaf').sort(order)){
  const source=rotation.slots.indexOf(h.source),leaf=leaves.find(l=>l.source===source&&!l.used&&before(l,h)&&h.time<l.time+10);
  if(leaf){leaf.used=true;pickups.push({...h,source});}
 }
 const elements=profiles.map(p=>characters[p.character.name].element),crystals=[];
 for(const h of rotation.events){
  if(elements[h.role]!=='Geo'||equipmentHitElement(profiles[h.role],h)!=='Geo')continue;
  const compatible=[...new Set(elements.filter(el=>['Pyro','Hydro','Electro','Cryo'].includes(el)))];
  if(compatible.length)crystals.push({...h,role:rotation.activeRole(h.time,h.rootOrder),source:h.role,elements:compatible,order:h.order+.02});
 }
 return {leaves:pickups,crystals};
}

export function aimingStacks(rotation,r,e){
 let stacks=0,aiming=false,ended=-Infinity,lastShot=-Infinity;
 const rows=rotation.roots.filter(h=>(h.kind==='aim'&&h.role===r)||(h.kind==='switch'&&h.from===r&&h.role!==r)).filter(h=>before(h,e)).sort(order);
 for(const h of rows){
  if(!aiming&&h.time>=ended+10)stacks=0;
  if(h.kind==='aim'&&h.phase==='start')aiming=true;
  else if(h.kind==='aim'&&h.phase==='shot'){
   if(aiming&&rotation.activeRole(h.time,h.rootOrder)===r&&h.time-lastShot>=.5-1e-9){stacks=Math.min(6,stacks+1);lastShot=h.time;}
  }else {aiming=false;ended=h.time;}
 }
 return aiming||e.time<ended+10?stacks:0;
}

export function fieldWeaponState(name,rotation,r,e){
 if(name==='SerpentSpine'){
  let stacks=0;for(let t=4;t<=e.time;t+=4)if(rotation.activeRole(t,t===e.time?e.rootOrder:Infinity)===r)stacks=Math.min(5,stacks+1);
  return stacks;
 }
 let front=rotation.activeRole(0,-1)===r,since=0,stacks=0;
 for(const h of [...rotation.switches.filter(h=>(h.from===r)!==(h.role===r)&&before(h,e)),{time:e.time,role:rotation.activeRole(e.time,e.rootOrder)}]){
  const duration=h.time-since;
  if(name==='AlleyHunter')stacks=front?Math.max(0,stacks-2*Math.max(0,Math.floor(duration)-3)):Math.min(10,stacks+Math.floor(duration));
  if((h.role===r)!==front){front=h.role===r;since=h.time;}
 }
 return stacks;
}

export function equipmentWeakpoint(profile,event){
 return characters[profile.character.name].weapon==='Bow'&&event.category==='charged'&&event.weakpoint===true;
}

export function daybreakStacks(rotation,r,e,magus){
 const result={normal:0,skill:0,burst:0},last={normal:-Infinity,skill:-Infinity,burst:-Infinity};
 let front=rotation.activeRole(0,-1)===r,since=0,tick=1;
 const rows=[...rotation.switches.filter(h=>h.from===r||h.role===r),...rotation.events.filter(h=>h.role===r&&h.category in result)].filter(h=>before(h,e)).sort(order);
 for(const h of [...rows,{time:e.time}]){
  if(front)while(tick<=h.time){for(const key of Object.keys(result))result[key]=Math.max(0,result[key]-1);tick++;}
  else if(h.time>=since+3)for(const key of Object.keys(result))result[key]=6;
  if(h.kind==='switch'&&(h.role===r)!==front){front=h.role===r;since=h.time;tick=h.time+1;}
  if(h.category&&h.time-last[h.category]>=.1-1e-9){last[h.category]=h.time;for(const key of magus?Object.keys(result):[h.category])result[key]=Math.min(6,result[key]+(magus?2:1));}
 }
 return result;
}

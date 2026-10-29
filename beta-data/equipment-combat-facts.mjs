import characters from '../src/assets/_gen_character.js';
import {TEAM_DPS_CHARACTER_CAPABILITIES} from './team-dps-config.mjs';
import {scalarMath} from './team-dps-numeric-rules.mjs';
import {createCombatHistory} from './team-engine/combat-history.mjs';
import {compareEvents as order,eventBefore as before} from './team-engine/event-order.mjs';
const possible=value=>typeof value==='object'||!!value,boolean=value=>typeof value==='object'?value:!!value;

export function equipmentHitElement(profile,event){
 if(event.element)return event.element;
 const character=characters[profile.character.name];
 if(event.furinaC6)return 'Hydro';
 return ['skill','burst'].includes(event.category)||character.weapon==='Catalyst'?character.element:'Physical';
}

// Energy only spends in this fixed-rotation model. A zero balance cannot emit
// an energy-loss trigger; refund and particle events remain outside this model.
export function equipmentEnergy(profiles,rotation,{math:m=scalarMath,history=createCombatHistory(m)}={}){
 const histories=profiles.map((p,r)=>{
  const maximum=TEAM_DPS_CHARACTER_CAPABILITIES[p.character.name].energy;
  const rows=[];let current=maximum,ready=-Infinity;
  const drains=['KitainCrossSpear','KatsuragikiriNagamasa'].includes(p.weapon.name);
  const sequence=[...rotation.roots.filter(h=>h.role===r&&h.kind==='cast'&&h.action==='burst').map(h=>({...h,rootOrder:h.rootOrder+.01,spend:maximum})),
   ...(drains?rotation.events.filter(h=>h.role===r&&h.category==='skill').map(h=>({...h,order:h.order+.01,spend:3,weapon:true})):[])].sort(order);
  for(const h of sequence){
   const enabled=m.choose(history.gate(h),h.weapon?m.ge(h.time,ready):1,0);
   if(h.weapon)ready=m.choose(enabled,h.time+10,ready);
   const amount=m.choose(enabled,m.min(current,h.spend),0),changed=m.gt(amount,0);
   current=m.sub(current,amount);
   if(possible(changed))rows.push({...h,enabled:changed,amount,current});
  }
  return {maximum,rows};
 });
 return {histories,at(r,e){
  const {maximum,rows}=histories[r];let current=maximum;
  for(const h of rows)if(before(h,e))current=m.choose(h.enabled,h.current,current);
  return {current,maximum,zero:boolean(m.eq(current,0)),full:boolean(m.choose(maximum>0,m.eq(current,maximum),0))};
 }};
}

// Axis facts choose leaf recipient/time. Weapon ownership determines leaf type,
// generation, cooldown and lifetime. A generated leaf is consumed once.
export function equipmentPickups(profiles,rotation,reactions,{math:m=scalarMath,history=createCombatHistory(m)}={}){
 const leaves=[],pickups=[],and=(a,b)=>m.choose(a,b,0);
 for(let r=0;r<profiles.length;r++){
  if(!['ForestRegalia','SapwoodBlade','Moonpiercer'].includes(profiles[r].weapon.name))continue;
  for(const h of history.spaced(reactions.filter(h=>h.role===r&&['Burning','Quicken','Aggravate','Spread','Bloom','Hyperbloom','Burgeon'].includes(h.reaction)).sort(order),20))leaves.push({...h,source:r,remaining:history.gate(h)});
 }
 for(const h of rotation.roots.filter(h=>h.kind==='pickup'&&h.item==='leaf').sort(order)){
  const source=rotation.slots.indexOf(h.source);let taken=0;
  for(const leaf of leaves)if(leaf.source===source&&before(leaf,h)&&h.time<leaf.time+10){
   const consume=and(history.gate(h),and(m.choose(taken,0,1),leaf.remaining));
   leaf.remaining=m.choose(consume,0,leaf.remaining);taken=m.max(taken,consume);
  }
  if(possible(taken))pickups.push({...h,source,enabled:taken});
 }
 const elements=profiles.map(p=>characters[p.character.name].element),crystals=[];
 for(const h of rotation.events){
  if(elements[h.role]!=='Geo'||equipmentHitElement(profiles[h.role],h)!=='Geo')continue;
  const compatible=[...new Set(elements.filter(el=>['Pyro','Hydro','Electro','Cryo'].includes(el)))],enabled=history.gate(h);
  if(compatible.length&&possible(enabled))crystals.push({...h,enabled,role:rotation.activeRole(h.time,h.rootOrder),source:h.role,elements:compatible,order:h.order+.02});
 }
 return {leaves:pickups,crystals};
}

export function aimingStacks(rotation,r,e,m=scalarMath){
 const {gate}=createCombatHistory(m),and=(a,b)=>m.choose(a,b,0);
 let stacks=0,aiming=0,ended=-Infinity,lastShot=-Infinity;
 const rows=rotation.roots.filter(h=>(h.kind==='aim'&&h.role===r)||(h.kind==='switch'&&h.from===r&&h.role!==r)).filter(h=>before(h,e)).sort(order);
 for(const h of rows){
  stacks=m.choose(and(m.choose(aiming,0,1),m.ge(h.time,m.add(ended,10))),0,stacks);
  const enabled=gate(h);
  if(h.kind==='aim'&&h.phase==='start')aiming=m.choose(enabled,1,aiming);
  else if(h.kind==='aim'&&h.phase==='shot'){
   const trigger=and(enabled,and(aiming,rotation.activeRole(h.time,h.rootOrder)===r?m.ge(h.time,m.add(lastShot,.5-1e-9)):0));
   stacks=m.choose(trigger,m.min(6,m.add(stacks,1)),stacks);lastShot=m.choose(trigger,h.time,lastShot);
  }else{aiming=m.choose(enabled,0,aiming);ended=m.choose(enabled,h.time,ended);}
 }
 return m.choose(m.choose(aiming,1,m.lt(e.time,m.add(ended,10))),stacks,0);
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

export function daybreakStacks(rotation,r,e,magus,m=scalarMath){
 const {gate}=createCombatHistory(m);
 const result={normal:0,skill:0,burst:0},last={normal:-Infinity,skill:-Infinity,burst:-Infinity};
 let front=rotation.activeRole(0,-1)===r,since=0,tick=1;
 const rows=[...rotation.switches.filter(h=>h.from===r||h.role===r),...rotation.events.filter(h=>h.role===r&&h.category in result)].filter(h=>before(h,e)).sort(order);
 for(const h of [...rows,{time:e.time}]){
  if(front)while(tick<=h.time){for(const key of Object.keys(result))result[key]=m.max(0,m.sub(result[key],1));tick++;}
  else if(h.time>=since+3)for(const key of Object.keys(result))result[key]=6;
  if(h.kind==='switch'&&(h.role===r)!==front){front=h.role===r;since=h.time;tick=h.time+1;}
  if(h.category){const trigger=m.choose(gate(h),m.ge(h.time,m.add(last[h.category],.1-1e-9)),0);last[h.category]=m.choose(trigger,h.time,last[h.category]);for(const key of magus?Object.keys(result):[h.category])result[key]=m.choose(trigger,m.min(6,m.add(result[key],magus?2:1)),result[key]);}
 }
 return result;
}

// Field switches define the fixed command schedule; only actual Geo contacts
// advance the on-field stack clock. Candidate gates stay in the numeric program.
export function huskStacks(profiles,rotation,r,e,m=scalarMath){
 const {gate}=createCombatHistory(m);let stacks=0,lastGain=0,lastHit=-Infinity,backTick=3,front=rotation.activeRole(0,-1)===r;
 const hits=rotation.events.filter(h=>h.role===r&&h.onField&&equipmentHitElement(profiles[r],h)==='Geo');
 const rows=[...rotation.switches.filter(s=>s.from===r||s.role===r),...hits].filter(h=>before(h,e)).sort(order);
 for(const h of [...rows,{time:e.time}]){
  if(!front)while(backTick<=h.time){stacks=m.min(4,m.add(stacks,1));lastGain=backTick;backTick+=3;}
  else{const lost=m.max(0,m.floor(m.div(m.sub(h.time,lastGain),6)));stacks=m.max(0,m.sub(stacks,lost));lastGain=m.add(lastGain,m.mul(lost,6));}
  if(h.category){const trigger=m.choose(gate(h),m.ge(h.time,m.add(lastHit,.3-1e-9)),0);stacks=m.choose(trigger,m.min(4,m.add(stacks,1)),stacks);lastGain=m.choose(trigger,h.time,lastGain);lastHit=m.choose(trigger,h.time,lastHit);}
  if(h.kind==='switch'&&(h.role===r)!==front){front=h.role===r;if(!front)backTick=h.time+3;}
 }
 return stacks;
}

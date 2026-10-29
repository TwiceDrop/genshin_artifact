import {characterPackages} from './character-packages.mjs';
import {AUTO_EQUIPMENT_BUFFS} from '../equipment-axis-rules.mjs';
import {effect} from './rule-utils.mjs';
import {compareEventPosition} from './event-order.mjs';

export const characterRules=characterPackages;
export function normalizeTeamProfiles(input){
 const rules=input.map(p=>characterRules[p.character.name]),elements=rules.map(r=>r.element);
 const modeled=new Set([...rules.flatMap(r=>r.modeled),'ResonanceHydro2','ResonanceCryo2',...AUTO_EQUIPMENT_BUFFS]);
 const levels=rules.reduce((n,r)=>n+(r.teamSkillLevels?.(elements)||0),0);
 return input.map((p,i)=>{const x=structuredClone(p);x.character.skill2=Math.min(14,x.character.skill2+levels);x.buffs=(x.buffs||[]).filter(b=>!modeled.has(b.source_buff||b.name));rules[i].normalize(x);return x;});
}
export function createCharacterRules(profiles,rotation,math,settings){
 const rules=profiles.map(p=>characterRules[p.character.name]),elements=rules.map(r=>r.element);
 const instances=rules.map((rule,role)=>rule.create({role,profiles,elements,rotation,math,settings}));
  const cryoCasts=rotation().roots.filter(e=>e.kind==='cast'&&e.action==='skill'&&elements[e.role]==='Cryo');
  const criticalBuffs=e=>[...(elements.filter(x=>x==='Cryo').length>=2?[effect('双冰共鸣',{CriticalBase:cryoCasts.some(c=>compareEventPosition(c,e)<=0)?.15:0})]:[]),...instances.flatMap(i=>i.criticalBuffs?.(e)||[])];
 return {
  rules,instances,
  baseBuffs:elements.filter(e=>e==='Hydro').length>=2?[effect('双水共鸣',{HPPercentage:.25})]:[],
  prepare:(p,r,e)=>instances[r].prepare?.(p,e),
  hitElement:(r,e)=>e.element??rules[r].hitElement?.(e)??elements[r],
  attackBuffs:(r,e,panels)=>instances.flatMap(i=>i.attackBuffs?.(r,e,panels)||[]),
  damageBuffs(r,e,panels,source){return [...criticalBuffs(e),...instances.flatMap(i=>i.damageBuffs?.(r,e,panels,source)||[])];},
  criticalBuffs,
  incoming:e=>instances.reduce((n,i)=>math.add(n,i.incoming?.(e)||0),0),
 };
}
export function createCharacterHealth(profiles,base,context){
 return profiles.flatMap((p,role)=>{const rule=characterRules[p.character.name];return rule.createHealth?[rule.createHealth({...context,role,profiles,base})]:[];});
}

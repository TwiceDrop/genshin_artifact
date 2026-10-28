import {validateActionAxis} from './action-config.mjs';
import {compileActionAxis} from './timeline.mjs';
import {normalizeTeamProfiles,createCharacterRules} from './registry.mjs';
import {scalarMath} from '../team-dps-numeric-rules.mjs';
import {normalizeEnemy} from '../enemy-interface.mjs';

const stats=['atk','hp','def','em'];
const total=values=>Object.values(values||{}).reduce((a,b)=>a+b,0);
const empty=()=>Object.fromEntries(stats.map(key=>[key,0]));
// This preview measures character skill coefficients, without equipment or
// HP-consumption amplification. Conditional damage additions stay in scoring.
export function createSkillMultiplierPreview(api,axis,characters){
 validateActionAxis(axis);
 const profiles=normalizeTeamProfiles(axis.members.map(({character},r)=>({
  character:structuredClone(characters?.[r]??{name:character,level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9}),
  weapon:{name:character==='Escoffier'?'BeginnersProtector':['Vodyanitsa','Mona'].includes(character)?'ApprenticesNotes':'DullBlade',level:1,ascend:false,refine:1,params:'NoConfig'},
  artifacts:[],artifact_config:{},buffs:[],
 })));
 const rotation=compileActionAxis(axis,profiles),charactersRules=createCharacterRules(profiles,()=>rotation,scalarMath,{});
 for(const e of rotation.events)if(e.salonKey)rotation.salonCounts.set(e.salonKey,0);
 const cache=new Map(),roles=profiles.map(p=>({character:p.character,hits:[],base:empty(),effective:empty()}));
 for(const event of rotation.events){
  const {role}=event,rule=charactersRules.rules[role],instance=charactersRules.instances[role];
  const config=rule.skillConfig?.(event,rotation)||'NoConfig',key=JSON.stringify([role,event.index,event.nativeElement,config]);
  if(!cache.has(key))cache.set(key,api.CalculatorInterface.get_damage_analysis({...profiles[role],enemy:normalizeEnemy({level:100}),skill:{index:event.index,config},team_effects:{on_field:event.onField,recipient_on_field:event.onField}},event.nativeElement??null));
  const native=cache.get(key),parts=event.parts||1,base=Object.fromEntries(stats.map(stat=>[stat,total(native[stat+'_ratio'])/parts]));
  if(rule.separateAtkRatio||event.ratio!==undefined){
   const fields=new Set(['技能倍率',...(event.talentRatioFields||[])]);
   base.atk=event.ratio??Object.entries(native.atk_ratio).filter(([name])=>fields.has(name)).reduce((sum,[,v])=>sum+v,0)/parts;
  }
  const atkMultiplier=instance.multiplier?.(event)??1,hpMultiplier=instance.hpRatioMultiplier?.(event)??1;
  const effective={...base,atk:base.atk*atkMultiplier,hp:base.hp+((native.hp_ratio['技能倍率']??0)*(hpMultiplier-1)+(event.hpRatioBonus??0))/parts};
  const modifiers=[];
  if(atkMultiplier!==1)modifiers.push({label:rule.ratioLabel,stat:'atk',value:effective.atk-base.atk});
  if(effective.hp!==base.hp)modifiers.push({label:rule.hpRatioLabel,stat:'hp',value:effective.hp-base.hp});
  const hit={time:event.time,label:event.label,element:event.element,onField:event.onField,eventId:event.eventId,part:event.part,base,effective,modifiers};
  roles[role].hits.push(hit);
  for(const stat of stats){roles[role].base[stat]+=base[stat];roles[role].effective[stat]+=effective[stat];}
 }
 return {duration:rotation.duration,endHit:axis.endHit,roles};
}

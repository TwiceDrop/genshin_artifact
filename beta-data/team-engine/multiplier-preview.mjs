import {validateActionAxis} from './action-config.mjs';
import {compileActionAxis} from './timeline.mjs';
import {normalizeTeamProfiles,createCharacterRules} from './registry.mjs';
import {scalarMath} from '../team-dps-numeric-rules.mjs';
import {normalizeEnemy} from '../enemy-interface.mjs';
import {scaleTalentPart} from './rule-utils.mjs';
import {isStellarConduct,isStellarSwirl} from './native-damage-fields.mjs';
import {transformativeReaction} from './transformative-reactions.mjs';
import {normalizeNativeDamage} from './native-bindings.mjs';
import {createSkillPreviewProfiles,actionCastTimings} from './action-cast-preview.mjs';
import {createBuffWindowPreview} from './buff-window-preview.mjs';

const stats=['atk','hp','def','em'];
const total=values=>Object.values(values||{}).reduce((a,b)=>a+b,0);
const empty=()=>Object.fromEntries(stats.map(key=>[key,0]));
// This preview measures character skill coefficients, without equipment or
// HP-consumption amplification. Conditional damage additions stay in scoring.
export function createSkillMultiplierPreview(api,axis,characters,includeEffects=false,buffConstellations){
 validateActionAxis(axis);
 const rawProfiles=createSkillPreviewProfiles(axis,characters);
 const profiles=normalizeTeamProfiles(rawProfiles);
 const rotation=compileActionAxis(axis,profiles),charactersRules=createCharacterRules(profiles,()=>rotation,scalarMath,{});
 for(const e of rotation.events)if(e.salonKey)rotation.salonCounts.set(e.salonKey,0);
 const cache=new Map(),roles=profiles.map(p=>({character:p.character,hits:[],base:empty(),effective:empty()}));
 for(const event of rotation.events){
  if(event.enabled!==undefined&&!event.enabled)continue;
  const {role}=event,rule=charactersRules.rules[role],instance=charactersRules.instances[role];
  if(transformativeReaction(event)||event.damageModel==='reaction.stellarSwirl'){
   roles[role].hits.push({time:event.time,label:event.label,element:event.element,onField:event.onField,eventId:event.eventId,part:event.part,damageModel:event.damageModel,base:empty(),effective:empty(),modifiers:[]});continue;
  }
  const profile=structuredClone(profiles[role]);instance.prepare?.(profile,event);
  const config=rule.skillConfig?.(event,rotation)||'NoConfig',key=JSON.stringify([role,profile.character,event.index,event.nativeElement,config]);
  if(!cache.has(key)){
   const input={...profile,enemy:normalizeEnemy({level:100}),skill:{index:event.index,config},team_effects:{on_field:event.onField,recipient_on_field:event.onField}},raw=api.CalculatorInterface.get_damage_analysis(input,event.nativeElement??null);
   cache.set(key,raw.stellar_detail?normalizeNativeDamage(raw,api.CommonInterface.get_attribute(input)):raw);
  }
  const native=cache.get(key),part=value=>scaleTalentPart(scalarMath,event,value),base=Object.fromEntries(stats.map(stat=>[stat,part(total(native[stat+'_ratio']))]));
  const stellar=isStellarConduct(event)||isStellarSwirl(event);
  if(stellar)Object.assign(base,{atk:event.stellarScaling==='em'?0:part(event.stellarRatio??total(native[isStellarSwirl(event)?'direct_stellarswirl_ratio':'direct_stellarconduct_ratio'])),hp:0,def:0,em:event.stellarScaling==='em'?part(event.stellarRatio):0});
  if(rule.separateAtkRatio||event.ratio!==undefined){
   const fields=new Set(['技能倍率',...(event.talentRatioFields||[])]);
   base.atk=event.ratio??part(Object.entries(native.atk_ratio).filter(([name])=>fields.has(name)).reduce((sum,[,v])=>sum+v,0));
  }
  const atkMultiplier=stellar?event.stellarCoefficient??1:instance.multiplier?.(event)??1,hpMultiplier=instance.hpRatioMultiplier?.(event)??1;
  const effective={...base,atk:base.atk*atkMultiplier,em:base.em*(event.stellarScaling==='em'?atkMultiplier*(event.stellarIndependent??1):1),hp:base.hp+part((native.hp_ratio['技能倍率']??0)*(hpMultiplier-1)+(event.hpRatioBonus??0))};
  const modifiers=[];
  if(atkMultiplier!==1)modifiers.push({label:stellar?'极星辉域':rule.ratioLabel,stat:event.stellarScaling==='em'?'em':'atk',value:event.stellarScaling==='em'?effective.em-base.em:effective.atk-base.atk});
  const atkExtra=instance.atkRatioBonus?.(event)??0;
  if(atkExtra){effective.atk+=atkExtra;modifiers.push({label:rule.atkRatioLabel,stat:'atk',value:atkExtra});}
  if(effective.hp!==base.hp)modifiers.push({label:rule.hpRatioLabel,stat:'hp',value:effective.hp-base.hp});
  const hit={time:event.time,label:event.label,element:event.element,onField:event.onField,eventId:event.eventId,part:event.part,...(event.damageModel?{damageModel:event.damageModel}:{}),base,effective,modifiers};
  roles[role].hits.push(hit);
  for(const stat of stats){roles[role].base[stat]+=base[stat];roles[role].effective[stat]+=effective[stat];}
 }
 // Constellation overrides belong exclusively to the BUFF observation context.
 // Coefficients, cast widths and the caller's saved profiles keep their values.
 const buffProfiles=buffConstellations===undefined?rawProfiles:rawProfiles.map((p,r)=>({...p,character:{...p.character,constellation:buffConstellations[r]}}));
 const windows=includeEffects?createBuffWindowPreview(api,axis,buffProfiles):Object.entries(rotation.windows).flatMap(([key,rows])=>rows.filter(w=>w.enabled!==0&&w.end>w.start).map(w=>({key,role:w.role,start:w.start,end:w.end})));
 const casts=actionCastTimings(rotation,profiles);
 return {duration:rotation.duration,endHit:axis.endHit,roles,windows,casts};
}

import {normalizeBuffParameters} from './buff-rule-registry.mjs';
const num=(p,k,d,min,max,integer=false)=>{const v=p[k]===undefined?d:p[k];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw Error('月曜装备参数无效：'+k);return v;};
const flag=(p,k,d=true)=>{const v=p[k]===undefined?d:p[k];if(typeof v!=='boolean')throw Error('月曜装备开关无效：'+k);return v;};
const refine=p=>num(p,'refine',1,1,5,true);
const rate=p=>num(p,'rate',1,0,1);
// Legacy rate means the TOTAL bonus from distinct Gleaming Moon types, not uptime.
const moon=p=>{const v=num(p,'rate',.1,0,.2);if(![0,.1,.2].some(x=>Math.abs(v-x)<1e-9))throw Error('月辉明光须按不同类型填写0、0.1或0.2，不是覆盖率');return v;};
export const MOONLIGHT_SETS=Object.freeze(['SpinMoonSerenade','RealmMirrorNight']);
export const LUNAR_EQUIPMENT_RULES=Object.freeze({
 NightweaversLookingGlass:p=>{const r=refine(p),overlap=num(p,'overlap_rate',1,0,1);if(!flag(p,'northernmost_runo_active')||!flag(p,'crescent_verse_active'))return {};const v=(.3+.1*r)*overlap;return {EnhanceBloom:3*v,EnhanceHyperbloom:2*v,EnhanceBurgeon:2*v,EnhanceMoonbloom:v};},
 GoldenFrostboundOath:p=>{const r=refine(p),coverage=rate(p);if(flag(p,'recipient_is_wielder',false)||!flag(p,'favor_active')||!flag(p,'moondrift_present'))return {};const v=(.15+.05*r)*coverage;return {BonusGeo:v,EnhanceMoonCrystallize:v};},
 FracturedHalo:p=>{const r=refine(p),coverage=rate(p);return flag(p,'edict_active')?{EnhanceMoonelectro:(.3+.1*r)*coverage}:{};},
 SpinMoonSerenade:p=>{const bonus=moon(p),mode=num(p,'mode',0,0,2,true);return flag(p,'effect_active')?{EnhanceMoonReaction:bonus,ElementalMastery:[0,60,120][mode]}:{};},
 RealmMirrorNight:p=>{const bonus=moon(p);return flag(p,'effect_active')?{EnhanceMoonReaction:bonus}:{};},
});
export const LUNAR_EQUIPMENT_NAMES=Object.freeze(Object.keys(LUNAR_EQUIPMENT_RULES));
const isSet=n=>MOONLIGHT_SETS.includes(n);
// Resolve the shared team total once. Preserve claims so repeated preparation and
// raw/compiled mixtures remain idempotent; don't add two declarations of 20%.
export function prepareLunarEquipmentBuffs(buffs=[],input={}){
 const out=[],sets=new Map(),seen=new Map();
 for(const b of buffs){
  const name=b.name==='ExtensionEffect'?b.source_buff:b.name;
  if(!LUNAR_EQUIPMENT_RULES[name]){out.push(b);continue;}
  const raw=b.config==='NoConfig'||b.config===undefined?{}:b.config?.[name];
  if(b.lock===true||(b.name!=='ExtensionEffect'&&raw?.active===false))continue;
  let effect=b;
  if(b.name!=='ExtensionEffect'){
   const values=LUNAR_EQUIPMENT_RULES[name](normalizeBuffParameters(name,raw),input);
   effect={...b,name:'ExtensionEffect',source_buff:name,config:{ExtensionEffect:{label:name,values}}};
  }
  const values=effect.config?.ExtensionEffect?.values||{};
  if(!isSet(name)){
   if(!seen.has(name)){seen.set(name,out.length);out.push(effect);}
   else {const index=seen.get(name),old=out[index].config.ExtensionEffect.values;
    // Copies of one named source don't stack. Choose its strongest scaled effect.
    const strength=x=>Math.max(0,...Object.values(x));
    if(strength(values)>strength(old))out[index]=effect;
   }
   continue;
  }
  const claim=effect.moonlight_claim??values.EnhanceMoonReaction??0;
  const em=values.ElementalMastery||0;
  if(!Number.isFinite(claim)||claim<0||claim>.2||!Number.isFinite(em)||![0,60,120].includes(em))throw Error('月辉明光编译属性无效');
  const previous=sets.get(name);
  sets.set(name,{effect,claim:Math.max(claim,previous?.claim||0),em:Math.max(em,previous?.em||0)});
 }
 const active=[...sets.values()].filter(s=>s.claim>0);
 const total=Math.max(0,...active.map(s=>s.claim),active.length*.1);
 let assigned=false;
 for(const [name,s]of sets){
  const bonus=!assigned&&s.claim>0?total:0;if(bonus>0)assigned=true;
  out.push({...s.effect,moonlight_claim:s.claim,config:{ExtensionEffect:{label:name,values:{EnhanceMoonReaction:bonus,...(name==='SpinMoonSerenade'?{ElementalMastery:s.em}:{})}}}});
 }
 // Equipped 4pc has its own native consumer. Reject ambiguous duplicate totals
 // rather than baking a subtraction into an optimizer's changing artifact set.
 if(total>0||[...sets.values()].some(s=>s.em>0)){for(const [name,key]of [['SpinMoonSerenade','config_spin_moon_serenade'],['RealmMirrorNight','config_realm_mirror_night']]){
  const c=input.artifact_config?.[key];
  if(c&&((c.moon_reaction_bonus||0)>0||(name==='SpinMoonSerenade'&&sets.has(name)&&(c.moon_state||0)>0)))throw Error('月辉明光已由队友BUFF统一计数：请将自身套装配置的月曜增伤设为0；纺月精通也只在一处填写');
 }}
 return out;
}

// ABI layouts belong to the backend. Character packages select a backend;
// adding another character on an existing ABI does not add a name check here.
export const nativeBackends={
 legacy:{library:0,extension:false,slot:index=>index,transformativeCoefficients:{superconduct:.5,electro_charged:1.2,shatter:1.5,swirl_cryo:.6,swirl_electro:.6,swirl_hydro:.6},stellarConduct:{
  direct_stellarconduct_compose:[213,227],direct_stellarconduct_base_compose:[214],direct_stellarconduct_extra_fixed:[218],
  critical_stellarconduct:[216],critical_damage_stellarconduct:[217],elevate_stellarconduct_compose:[215],
  elevate_stellar_glimmer_reaction_compose:[226],stellar_glimmer_reaction_damage_multiplier:[228],
 },stellarSwirl:{direct_stellarswirl_compose:[220,227],direct_stellarswirl_base_compose:[221],critical_stellarswirl:[223],critical_damage_stellarswirl:[224],elevate_stellarswirl_compose:[222],elevate_stellar_glimmer_reaction_compose:[226],stellar_glimmer_reaction_damage_multiplier:[228]}},
 extension:{library:1,extension:true,slot:index=>index+(index>=70?24:23),transformativeCoefficients:{superconduct:1.5,electro_charged:2,shatter:3,swirl_cryo:.6,swirl_electro:.6,swirl_hydro:.6},effectSlots:{EnhanceSuperconduct:112,EnhanceElectroCharged:111,EnhanceShatter:110,EnhanceSwirlElectro:113,EnhanceSwirlPyro:114,EnhanceSwirlHydro:115,EnhanceSwirlCryo:116,EnhanceSwirlBase:117,
  StellarConductFlat:4,StellarConductFlatElectro:5,StellarConductFlatCryo:6,StellarConductCritRate:7,StellarConductCritDamage:8,StellarConductCritDamageElectro:9,StellarConductCritDamageCryo:10,StellarConductElevation:11,EnhanceStellarSuperconduct:126,StellarConductBaseBonus:212,
  StellarSwirlBonus:17,StellarSwirlFlat:18,StellarSwirlCritRate:19,StellarSwirlCritDamage:20,StellarSwirlElevation:21,StellarSwirlBaseBonus:22,StellarSwirlIndependentBaseMultiplier:187},stellarConduct:{
  direct_stellarconduct_compose:[126],direct_stellarconduct_base_compose:[212],direct_stellarconduct_extra_fixed:[4,5],critical_stellarconduct:[61,67,7],critical_damage_stellarconduct:[81,8,9],elevate_stellarconduct_compose:[11],
 },stellarSwirl:{direct_stellarswirl_compose:[17],direct_stellarswirl_base_compose:[22],direct_stellarswirl_extra_fixed:[18],critical_stellarswirl:[61,19],critical_damage_stellarswirl:[20],elevate_stellarswirl_compose:[21],stellar_glimmer_reaction_damage_multiplier:[187]}},
};

// The extension exports the same stellar quantities under stellar_detail.
// Normalize its result at both scalar and graph entry points, without changing
// the public WASM interfaces or their binaries.
export function normalizeNativeDamage(d,panel){
 const s=d.stellar_detail;if(!s)return d;
 const extra=(typed,base,reaction)=>Object.fromEntries([...new Set([...Object.keys(typed),...Object.keys(base),...Object.keys(reaction)])].map(k=>[k,(typed[k]??0)-(base[k]??0)+(reaction[k]??0)]));
 if(s.element==='Anemo')return {...d,direct_stellarswirl_ratio:s.ratio,direct_stellarswirl_compose:s.bonus,direct_stellarswirl_base_compose:s.base_bonus,direct_stellarswirl_extra_fixed:s.flat,
  critical_stellarswirl:extra(s.critical,panel.critical,s.reaction_critical),critical_damage_stellarswirl:extra(s.critical_damage,panel.critical_damage,s.reaction_critical_damage),elevate_stellarswirl_compose:s.elevation,
  elevate_stellar_glimmer_reaction_compose:s.universal_elevation,stellar_glimmer_reaction_damage_multiplier:s.independent};
 return {...d,direct_stellarconduct_ratio:{},direct_stellarconduct_compose:s.bonus,direct_stellarconduct_base_compose:s.base_bonus,direct_stellarconduct_extra_fixed:s.flat,
  critical_stellarconduct:extra(s.critical,panel.critical,s.reaction_critical),critical_damage_stellarconduct:extra(s.critical_damage,panel.critical_damage,s.reaction_critical_damage),elevate_stellarconduct_compose:s.elevation,
  elevate_stellar_glimmer_reaction_compose:s.universal_elevation,stellar_glimmer_reaction_damage_multiplier:s.final_multiplier};
}

// The preserved legacy ABI has no StellarSwirlFlat slot. This additive
// quantity belongs to the existing reaction result contract, after EM/base
// amplification, and can remain numeric (including candidate references).
export function prepareNativeDamageEffects(input,binding){
 const fields={};if(binding.nativeBackend!=='legacy')return {input,fields};
 const buffs=(input.buffs??[]).flatMap(buff=>{
  const effect=buff.config?.ExtensionEffect;
  if(buff.name!=='ExtensionEffect'||effect.values.StellarSwirlFlat===undefined)return [buff];
  (fields.direct_stellarswirl_extra_fixed??=[]).push([effect.label,effect.values.StellarSwirlFlat]);
  const {StellarSwirlFlat,...values}=effect.values;
  return Object.keys(values).length?[{...buff,config:{ExtensionEffect:{...effect,values}}}]:[];
 });return {input:{...input,buffs},fields};
}

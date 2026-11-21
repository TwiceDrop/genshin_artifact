import {transformativeReaction} from './transformative-reactions.mjs';
export const NATIVE_DAMAGE_FIELDS=['atk','hp','def','em','atk_ratio','hp_ratio','def_ratio','em_ratio','extra_damage','bonus','critical','critical_damage','independent_damage_multiplier','def_minus','def_penetration','res_minus','healing_bonus'];
export const STELLAR_DAMAGE_FIELDS=[
 'direct_stellarconduct_ratio','direct_stellarconduct_compose','direct_stellarconduct_base_compose',
 'direct_stellarconduct_extra_damage','direct_stellarconduct_extra_fixed',
 'critical_stellarconduct','critical_damage_stellarconduct','elevate_stellarconduct_compose',
 'elevate_stellar_glimmer_reaction_compose','stellar_glimmer_reaction_damage_multiplier',
];
export const isStellarConduct=event=>event.damageModel==='reaction.stellarConduct';
export const isStellarSwirl=event=>['reaction.stellarSwirl','direct.stellarSwirl'].includes(event.damageModel);
export const STELLAR_SWIRL_FIELDS=STELLAR_DAMAGE_FIELDS.map(name=>name.replaceAll('stellarconduct','stellarswirl'));
export const isMoonCrystallize=e=>e.damageModel==='direct.lunarCrystallize'||e.damageModel==='reaction.lunarCrystallize';
export const MOON_CRYSTALLIZE_FIELDS=['mooncrystallize_extra_fixed','direct_mooncrystallize_ratio','direct_mooncrystallize_extra_def_ratio','direct_mooncrystallize_compose','direct_mooncrystallize_extra_fixed','mooncrystallize_base_compose','enhance_moon_reaction_compose','critical_moon_reaction','critical_damage_moon_reaction','moon_reaction_damage_multiplier','elevate_mooncrystallize_compose','elevate_moon_reaction_compose'];
export const isSuperconduct=event=>event.damageModel==='reaction.superconduct';
export const nativeDamageFields=event=>isMoonCrystallize(event)?[...NATIVE_DAMAGE_FIELDS,...MOON_CRYSTALLIZE_FIELDS]:isStellarConduct(event)?[...NATIVE_DAMAGE_FIELDS,...STELLAR_DAMAGE_FIELDS]:isStellarSwirl(event)?[...NATIVE_DAMAGE_FIELDS,...STELLAR_SWIRL_FIELDS]:transformativeReaction(event)?[...NATIVE_DAMAGE_FIELDS,transformativeReaction(event).bonus]:NATIVE_DAMAGE_FIELDS;

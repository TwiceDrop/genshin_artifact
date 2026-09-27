// Confirmed input data, consumed by lunar-character-rules.mjs.
// Lv1-13 checked against KQM TCL; Lv14-15 supplied by the user.
// The talent level is the ACTUAL level, already including constellation bonuses.
export const LAUMA_SKILL_RES_MINUS=Object.freeze([.025,.05,.075,.10,.125,.15,.175,.20,.225,.25,.28,.31,.34,.37,.40]);
export const LAUMA_BURST_BLOOM_FLAT=Object.freeze([2.778,2.986,3.194,3.472,3.680,3.889,4.166,4.444,4.722,5.000,5.277,5.555,5.902,6.250,6.597]);
export const LAUMA_BURST_LUNAR_BLOOM_FLAT=Object.freeze([2.222,2.389,2.556,2.778,2.945,3.111,3.334,3.556,3.778,4.000,4.223,4.445,4.723,5.000,5.278]);
export const LAUMA_STATE_RULES=Object.freeze({resShredSeconds:10,basePaleHymnStacks:18,stacksPerMoonSong:6,maxMoonSong:3,conversionWindowSeconds:15,paleHymnStackSeconds:15,moonSongConversionOncePerBurst:true,consumePerEligibleTarget:true,resShredRefreshesWithoutStacking:true});
export const LAUMA_CONSTELLATION_EFFECTS=Object.freeze({c2BloomFlatCoefficient:5,c2LunarBloomFlatCoefficient:4,c2FullMoonLunarBloomBonus:.40,c6FullMoonLunarBloomElevation:.25});
// C2 .40 is additive in (1 + EM bonus + Lunar damage bonus), NOT a new *1.4
// on the whole hit. C6 .25 belongs to final elevation, which also amplifies F.

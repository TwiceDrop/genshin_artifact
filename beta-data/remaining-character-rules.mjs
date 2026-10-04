// Compatibility exports; formulas live in character-effect-rules.mjs.
import {evaluateEffectRule} from './effect-rule-engine.mjs';
import {CHARACTER_EFFECT_RULES} from './character-effect-rules.mjs';
export const ALYOSHA_PRECISION=Object.freeze([.1166,.1272,.1378,.1484,.159,.1696,.1802,.1908,.2014,.212,.2247,.2374,.2502,.2629,.2756]);
export const REMAINING_CHARACTER_RULES=Object.freeze(Object.fromEntries(["CynoC2StellarConduct", "KleeC1", "TravelerElements", "TravelerEnhancedAttribute", "AetherCryoTalent1", "AetherCryoC6", "YaeMikoC1", "NahidaC2", "DurinTalent2", "DurinC2", "IfaTalent2", "AlyoshaHunterPrecision"].map(name=>[name,(parameters,input)=>evaluateEffectRule(CHARACTER_EFFECT_RULES[name],parameters,input)])));
export const REMAINING_CHARACTER_NAMES=Object.freeze(Object.keys(REMAINING_CHARACTER_RULES));

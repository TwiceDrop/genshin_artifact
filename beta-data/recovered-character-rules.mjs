// Compatibility exports; formulas live in character-effect-rules.mjs.
import {evaluateEffectRule} from './effect-rule-engine.mjs';
import {CHARACTER_EFFECT_RULES} from './character-effect-rules.mjs';
export const RECOVERED_CHARACTER_RULES=Object.freeze(Object.fromEntries(["IansanTalent2", "NicoleE"].map(name=>[name,(parameters,input)=>evaluateEffectRule(CHARACTER_EFFECT_RULES[name],parameters,input)])));

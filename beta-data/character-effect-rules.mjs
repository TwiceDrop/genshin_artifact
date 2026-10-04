import {CLASSIC_STATIC_RULES} from './classic-static-effect-rules.mjs';
import {CLASSIC_EFFECT_RULE_BOOK} from './classic-effect-rule-book.mjs';
import {LUNAR_EFFECT_RULE_BOOK} from './lunar-effect-rule-book.mjs';
import {CHARACTER_RULE_BOOK} from './character-rule-book.mjs';
// Authoring helpers produce serializable data; only the engine evaluates it.
const p=name=>({ref:'parameters.'+name}), i=path=>({ref:'input.'+path}), v=name=>({local:name});
const op=(name,...args)=>({op:name,args});
const effect=(attribute,value,when)=>({attribute,value,...(when===undefined?{}:{when})});
const candidates={
 ...CLASSIC_STATIC_RULES,
 ...CLASSIC_EFFECT_RULE_BOOK,
 ...CHARACTER_RULE_BOOK,
 ...LUNAR_EFFECT_RULE_BOOK,
 AlyoshaHunterPrecision:{version:1,source:'Alyosha',variables:{
  stacks:op('min',p('stacks'),op('if',p('c6'),2,1)),
  onField:op('coalesce',i('team_effects.recipient_on_field'),p('recipient_on_field'),true),
 },when:op('and',v('onField'),p('effect_active')),effects:[
  effect('ATKPercentage',op('mul',op('at',[.1166,.1272,.1378,.1484,.159,.1696,.1802,.1908,.2014,.212,.2247,.2374,.2502,.2629,.2756],op('sub',p('skill_level'),1)),v('stacks'))),
  effect('ElementalMastery',op('if',op('and',p('c6'),op('eq',v('stacks'),2)),100,0)),
  effect('EnhanceStellarSuperconduct',op('if',p('stellar_conduct'),op('mul',.2,v('stacks')),0)),
 ]},
};

export const PENDING_CHARACTER_RULES=Object.freeze({});
export const CHARACTER_EFFECT_RULES=Object.freeze(Object.fromEntries(Object.entries(candidates).filter(([name])=>!Object.hasOwn(PENDING_CHARACTER_RULES,name))));

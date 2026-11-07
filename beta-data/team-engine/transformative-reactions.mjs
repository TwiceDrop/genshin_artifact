// Shared damage contracts. Aura, ownership and tick clocks are scheduled by
// the elemental runtime; these definitions only describe numerical scaling.
export const transformativeReactions={
 ...Object.fromEntries(['Cryo','Electro','Hydro'].map(element=>['swirl'+element,{id:'reaction.swirl'+element,kind:'swirl',native:'swirl_'+element.toLowerCase(),effect:'EnhanceSwirl'+element,effects:['EnhanceSwirl'+element,'EnhanceSwirlBase'],bonus:'swirl_bonus',element,coefficient:.6}])),
 superconduct:{id:'reaction.superconduct',kind:'superconduct',native:'superconduct',effect:'EnhanceSuperconduct',bonus:'superconduct_bonus',element:'Cryo',coefficient:1.5},
 electroCharged:{id:'reaction.electroCharged',kind:'electroCharged',native:'electro_charged',effect:'EnhanceElectroCharged',bonus:'electro_charged_bonus',element:'Electro',coefficient:2},
 shatter:{id:'reaction.shatter',kind:'shatter',native:'shatter',effect:'EnhanceShatter',bonus:'shatter_bonus',element:'Physical',coefficient:3},
};
const byId=new Map(Object.values(transformativeReactions).map(rule=>[rule.id,rule]));
export const transformativeReaction=event=>byId.get(event.damageModel);

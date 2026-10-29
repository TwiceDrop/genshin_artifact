// Fixed-size expiry slots keep independent lifetimes candidate-dependent
// without changing the compiled event structure. Equal-duration new stacks
// replace the oldest slots; expired slots are naturally replaced first.
export function initialEffectStacks(rule,captures){
 return rule?{stacks:0,...(rule.refresh==='independent'?{stackExpiries:Array(rule.limit).fill(-Infinity),...(captures?{stackCaptures:Array.from({length:rule.limit},()=>({...captures}))}:{})}:{})}:{};
}
export function effectStackCount(state,time,m){
 return state.stackExpiries?state.stackExpiries.reduce((n,end)=>m.add(n,m.lt(time,end)),0):state.stacks;
}
export function activateEffectStacks(rule,old,event,activate,m,captures){
 if(!rule)return {};
 const gain=typeof rule.gain==='function'?rule.gain(event):rule.gain??1;
 if(!Number.isInteger(gain)||gain<1)throw Error('效果叠层增量必须为正整数');
 if(rule.refresh==='all')return {stacks:m.choose(activate,m.min(rule.limit,m.add(m.choose(m.lt(event.time,old.expires),old.stacks,0),gain)),old.stacks)};
 const shift=Math.min(rule.limit,gain),stackExpiries=old.stackExpiries.map((end,i)=>m.choose(activate,i+shift<rule.limit?old.stackExpiries[i+shift]:event.time+rule.duration,end));
 // Capture slots move with their expiry slots. A disabled grant changes
 // neither slot; historical states retain their original immutable arrays.
 const stackCaptures=old.stackCaptures?.map((prior,i)=>Object.fromEntries(Object.keys(prior).map(name=>[name,m.choose(activate,i+shift<rule.limit?old.stackCaptures[i+shift][name]:captures[name],prior[name])])));
 return {stackExpiries,stacks:effectStackCount({stackExpiries},event.time,m),...(stackCaptures?{stackCaptures}:{})};
}

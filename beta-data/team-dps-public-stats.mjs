import {EXTENSION_BUFF_REGISTRY} from './extension-buffs.mjs';
import {scalarMath} from './team-dps-numeric-rules.mjs';

// Supplemental attacks and recipient healing use these same public BUFF rules.
// The published panel endpoint does not expose resistance or incoming healing.
export function teamDpsBuffComposition(input,attributes,m=scalarMath){
 const out=Object.fromEntries(attributes.map(k=>[k,{}])),seen=new Set();
 for(const b of input.buffs){
  if(b.lock===true||b.config?.[b.name]?.active===false)continue;
  let effects;
  if(b.name==='ExtensionEffect')effects=[b];
  else if(b.name==='DEFMinus'||b.name==='ResMinus')effects=[{config:{ExtensionEffect:{label:b.name,values:{[b.name==='DEFMinus'?'DefMinus':'ResMinusBase']:b.config[b.name].p/100}}}}];
  else {
   if(seen.has(b.name))continue;
   seen.add(b.name);effects=EXTENSION_BUFF_REGISTRY.compile(b,input)||[];
  }
  for(const effect of effects){const {label,values}=effect.config.ExtensionEffect;for(const k of attributes)if(values[k])out[k][label]=m.add(out[k][label]||0,values[k]);}
 }
 return out;
}

export function royalHit(state,baseCritical,refine,m=scalarMath){
 const next=[0,0,0,0,0,0];let critical=0;
 for(let stacks=0;stacks<6;stacks++){
  const chance=m.min(1,m.max(0,m.add(baseCritical,stacks*(.06+.02*refine)))),mass=state[stacks];
  critical=m.add(critical,m.mul(mass,chance));next[0]=m.add(next[0],m.mul(mass,chance));next[Math.min(5,stacks+1)]=m.add(next[Math.min(5,stacks+1)],m.mul(mass,m.sub(1,chance)));
 }
 return {critical,state:next};
}

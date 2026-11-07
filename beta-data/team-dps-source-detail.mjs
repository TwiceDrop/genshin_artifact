import {scalarMath} from './team-dps-numeric-rules.mjs';

// Symbol metadata survives field copies without entering sums or trace JSON.
// Sources are read only for observations, never used to recompute scoring totals.
const compiledSources=Symbol('team-native-sources');
export function attachTeamSources(values,read){
 const extracted=Object.keys(values).filter(key=>key!=='compiled');
 values[compiledSources]={read,extracted};return values;
}
export function describeCompiledTeamSources(result){
 return Object.fromEntries(Object.entries(result).map(([field,values])=>{
  const provenance=values?.[compiledSources];if(!provenance)return [field,values];
  const parts={...provenance.read()};
  for(const name of provenance.extracted)delete parts[name];
  for(const [name,value]of Object.entries(values))if(name!=='compiled')parts[name]=value;
  return [field,parts];
 }));
}

// The published legacy bridge groups percentage conversions under one label.
// Split only that displayed composition; native scoring remains unchanged.
export function describeTeamBuffSources(input,result,m=scalarMath){
 const out={...result};
 for(const [field,attribute,key,bases]of [
  ['atk','ATKPercentage','BUFF: 攻击力%',['角色基础攻击','武器基础攻击']],
  ['hp','HPPercentage','BUFF: 生命值%',['角色基础生命']],
  ['def','DEFPercentage','BUFF: 防御力%',['角色基础防御']],
 ]){
  if(!Object.hasOwn(result[field],key))continue;
  const base=bases.reduce((n,k)=>m.add(n,result[field][k]||0),0),parts={...result[field]};
  for(const buff of input.buffs)if(buff.name==='ExtensionEffect'&&buff.lock!==true){
   const {label,values}=buff.config.ExtensionEffect;
   if(values[attribute]){const value=m.mul(base,values[attribute]);parts[key]=m.sub(parts[key],value);parts[label]=m.add(parts[label]||0,value);}
  }
  if(parts[key]===0)delete parts[key];out[field]=parts;
 }
 return out;
}

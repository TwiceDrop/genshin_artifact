// The published legacy bridge groups percentage conversions under one label.
// Split only that displayed composition; native scoring remains unchanged.
export function describeTeamBuffSources(input,result){
 const out={...result};
 for(const [field,attribute,key,bases]of [
  ['atk','ATKPercentage','BUFF: 攻击力%',['角色基础攻击','武器基础攻击']],
  ['hp','HPPercentage','BUFF: 生命值%',['角色基础生命']],
  ['def','DEFPercentage','BUFF: 防御力%',['角色基础防御']],
 ]){
  if(!Object.hasOwn(result[field],key))continue;
  const base=bases.reduce((n,k)=>n+(result[field][k]||0),0),parts={...result[field]};
  for(const buff of input.buffs)if(buff.name==='ExtensionEffect'&&buff.lock!==true){
   const {label,values}=buff.config.ExtensionEffect;
   if(values[attribute]){const value=base*values[attribute];parts[key]-=value;parts[label]=(parts[label]||0)+value;}
  }
  if(parts[key]===0)delete parts[key];out[field]=parts;
 }
 return out;
}

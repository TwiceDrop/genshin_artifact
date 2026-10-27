import {EXTENSION_BUFF_REGISTRY} from './extension-buffs.mjs';
export function stellarSwirlMultiplier(input){
 let delta=0,seen=false;
 for(const buff of input.buffs||[]){
  if(buff.lock===true||buff.config?.[buff.name]?.active===false)continue;
  if(buff.name==='StellarSwirlDamageMultiplier'&&!seen){
   seen=true;
   for(const effect of EXTENSION_BUFF_REGISTRY.compile(buff,input))
    delta+=effect.config.ExtensionEffect.values.StellarSwirlIndependentBaseMultiplier||0;
  }else if(buff.name==='ExtensionEffect'){
   delta+=buff.config.ExtensionEffect.values.StellarSwirlIndependentBaseMultiplier||0;
  }
 }
 return 1+delta;
}
export function withoutStellarSwirlMultiplier(input){
 return {...input,buffs:(input.buffs||[]).filter(buff=>buff.name!=='StellarSwirlDamageMultiplier').map(buff=>{
  if(buff.name!=='ExtensionEffect')return buff;
  const {StellarSwirlIndependentBaseMultiplier,...values}=buff.config.ExtensionEffect.values;
  return {...buff,config:{ExtensionEffect:{...buff.config.ExtensionEffect,values}}};
 })};
}

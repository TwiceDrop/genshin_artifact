import {prepareLunarEquipmentBuffs} from './lunar-equipment-rules.mjs';
import {normalizeBuffParameters} from './buff-rule-registry.mjs';
import {LEGACY_EFFECT_SLOTS as scalarSlots} from './legacy-effect-slots.mjs';
// Pinned native scalar slots. Percentage conversions use the native dependency API.
import {EXTENSION_BUFF_REGISTRY} from './extension-buffs.mjs';
import {CHARACTER_EFFECT_RULES} from './character-effect-rules.mjs';

const conversion={ATKPercentage:'ATKPercentage',HPPercentage:'HPPercentage',DEFPercentage:'DEFPercentage'};
const marker=1099511627776;
const hpToATK='HymnHPToATKPercentage';
export const LEGACY_NATIVE_SCOPE=new Set(['OdetteTalent1','OdetteMarvelousSplendor','OdetteC4SnowSwanDream','OdetteC6MarvelousSplendor','DionaC6StellarConduct','YumemizukiMizukiE','YumemizukiMizukiC6']);
export function withLegacyEffectBridge(api,wasm){
 if(wasm.__mona_effect_bridge_version?.()!==2)throw Error('7.1.08 BUFF bridge core mismatch');
 let busy=false;
 return Object.fromEntries(Object.entries(api).map(([name,Class])=>[name,name==='TransformativeDamage'?Class:new Proxy(Class,{get(target,method){
  const fn=Reflect.get(target,method);if(typeof fn!=='function')return fn;
  return (...args)=>{
   const inputIndex=name==='DSLInterface'&&method==='run'?1:0;
   const input=args[inputIndex];
   const invoke=prepared=>{const forwarded=[...args];forwarded[inputIndex]=prepared;return fn(...forwarded);};
   if(!input?.character||!Array.isArray(input.buffs))return fn(...args);
   const records=[],buffs=[],seen=new Set();
   let independentDelta=0;
   for(const buff of prepareLunarEquipmentBuffs(input.buffs,input)){
    const direct=buff.name==='ExtensionEffect';
    if(!direct&&buff.name!=='StellarSwirlDamageMultiplier'&&(LEGACY_NATIVE_SCOPE.has(buff.name)||(buff.name==='AlbedoWitchEve'&&buff.config?.AlbedoWitchEve?.def===0)||!Object.hasOwn(CHARACTER_EFFECT_RULES,buff.name))){buffs.push(buff);continue;}
    if(buff.lock===true||buff.config?.[buff.name]?.active===false||(!direct&&seen.has(buff.name)))continue;
    seen.add(direct?buff:buff.name);
    for(const compiled of (direct?[buff]:EXTENSION_BUFF_REGISTRY.compile(buff,input))||[]){
     const {label,values}=compiled.config.ExtensionEffect;
     if(Object.entries(values).some(([a,v])=>v!==0&&a!=='StellarSwirlIndependentBaseMultiplier'&&a!==hpToATK&&!conversion[a]&&!Object.hasOwn(scalarSlots,a))){if(direct)throw Error('Uncalibrated compiled legacy effect');const parameters=normalizeBuffParameters(buff.name,buff.config?.[buff.name]||{});buffs.push({...buff,config:Object.keys(parameters).length?{[buff.name]:parameters}:'NoConfig'});continue;}
     for(const [attribute,value]of Object.entries(values)){
      if(typeof value!=='number'||!Number.isFinite(value))throw Error('Invalid legacy effect value: '+attribute);
      if(value===0)continue;
      if((compiled.source_buff==='EnhanceStellarGlimmerReaction'&&attribute==='StellarSwirlBonus')||(compiled.source_buff==='ElevateStellarGlimmerReaction'&&attribute==='StellarSwirlElevation')){
       const name=compiled.source_buff;buffs.push({name,config:{[name]:{p:100*value}}});continue;
      }
      if(attribute==='StellarSwirlIndependentBaseMultiplier'){independentDelta+=value;continue;}
      if(conversion[attribute]){const n=conversion[attribute];buffs.push({name:n,config:{[n]:{p:100*value}}});continue;}
      if(attribute!==hpToATK&&!Object.hasOwn(scalarSlots,attribute))throw Error('Legacy effect slot not calibrated: '+attribute);
      const index=records.length;records.push({slot:attribute===hpToATK?0xffffffff:scalarSlots[attribute],value,label});
      buffs.push({name:'CustomBonus',config:{CustomBonus:{p:-100*(marker+index)}}});
     }
    }
   }
   // Preparation can remove disabled equipment even when no scalar was emitted.
   if(busy)throw Error('Nested legacy effect transactions are unsupported');
   const prepared={...input,buffs};
   if(!records.length&&!independentDelta)return invoke(prepared);
   const encoder=new TextEncoder(),labels=records.map(r=>encoder.encode(r.label));
   const dynamic=records.some(r=>r.slot===0xffffffff);
   const bytes=24*records.length+labels.reduce((n,b)=>n+b.length,0)+(dynamic?48:0);
   const ptr=bytes?wasm.__wbindgen_export_0(bytes,8):0;if(bytes&&!ptr)throw Error('Effect bridge allocation failed');
   busy=true;
   try{
    const view=new DataView(wasm.memory.buffer);const tables=ptr+24*records.length;let offset=tables+(dynamic?48:0);
    records.forEach((r,j)=>{const base=ptr+j*24;view.setUint32(base,r.slot,true);view.setFloat64(base+8,r.value,true);view.setUint32(base+16,offset,true);view.setUint32(base+20,labels[j].length,true);new Uint8Array(wasm.memory.buffer,offset,labels[j].length).set(labels[j]);offset+=labels[j].length;});
    if(dynamic){
     const table=(address,index)=>[0,8,8,index,index,index].forEach((v,i)=>view.setUint32(address+4*i,v,true));
     table(tables,wasm.__mona_hp_to_atk_forward_index());table(tables+24,wasm.__mona_hp_to_atk_backward_index());
     wasm.__mona_hp_to_atk_tables_set(tables,tables+24);
    }
    wasm.__mona_effect_bridge_set(ptr,records.length);
    wasm.__mona_stellar_swirl_multiplier_set(1+independentDelta);
    const result=invoke(prepared);
    if(name==='CalculatorInterface'&&method==='get_damage_analysis'&&result.direct_stellarswirl&&independentDelta){
     for(const key of ['direct_stellarswirl_ratio','direct_stellarswirl_extra_damage']){
      const composition=result[key];
      const base=Object.values(composition||{}).reduce((a,b)=>a+b,0);
      if(base)composition['直接星扩散独立倍率修正']=base*independentDelta;
     }
    }
    return result;
   }finally{if(dynamic)wasm.__mona_hp_to_atk_tables_set(0,0);wasm.__mona_stellar_swirl_multiplier_set(1);wasm.__mona_effect_bridge_set(0,0);if(ptr)wasm.__wbindgen_export_2(ptr,bytes,8);busy=false;}
  };
 }})]));
}

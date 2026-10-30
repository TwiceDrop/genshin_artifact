import {prepareLunarEquipmentBuffs} from './lunar-equipment-rules.mjs';
import characterElements from './character-elements.mjs';
import {createStarsealedEdictAdapter} from './starsealed-edict.mjs';
import {previewDefaults} from './preview-7201-config.mjs';
import {PREVIEW_BUFFS,previewBuffValues,previewRecipientOnField} from './preview-7201-buffs.mjs';
import {EXTENSION_BUFF_REGISTRY} from './extension-buffs.mjs';
import {normalizeBuffParameters} from './buff-rule-registry.mjs';
import {normalizeLimitedWeapon,isLimitedWeapon} from './limited-weapons.mjs';
import {normalizeSignatureWeapon,isSignatureWeapon} from './weapon-effects.mjs';
import {markReactionAvailability} from './reaction-availability.mjs';
const names=new Set(['Mitya','Valeriy']);
const effect=(name,values)=>({name:'ExtensionEffect',source_buff:name,config:{ExtensionEffect:{label:name,values}}});
const add=(v,k,n)=>{v[k]=(v[k]||0)+n;};
export function compilePreviewBuff(b,input){
 const name=b.name,p=normalizeBuffParameters(name,b.config==='NoConfig'?{}:b.config?.[name]||{});
 if(b.lock||p.active===false)return [];
 if(PREVIEW_BUFFS[name])return [effect(name,previewBuffValues(name,p,input))];
 const v={},on=input.character?.params?.[input.character.name]?.on_field!==false;
 if(name==='QiqiTalent2StellarConduct')return [effect(name,{EnhanceStellarSuperconduct:.5,StellarSwirlBonus:.5})];
 if(name==='QiqiC6StellarConduct')return previewRecipientOnField(input)?[effect(name,{StellarConductFlat:6*p.atk,StellarSwirlFlat:6*p.atk})]:[];
 if(name==='SandroneTalent1')return [effect(name,{StellarConductBaseBonus:Math.min(p.atk*.00007,.14),StellarSwirlBaseBonus:Math.min(p.atk*.00007,.14)})];
 if(name==='SandroneC1')return [effect(name,{EnhanceStellarSuperconduct:.3,StellarSwirlBonus:.3})];
 if(name==='VesnaTalent1')return [effect(name,{StellarSwirlBaseBonus:Math.min(p.atk*.00007,.14)*p.coverage})];
 if(name==='BreezeborneRefrainSupport')return [effect(name,{EnhanceStellarSuperconduct:(.24+.06*(p.refine-1))*p.rate,StellarSwirlBonus:(.24+.06*(p.refine-1))*p.rate})];
 if(name.startsWith('Vodyanitsa')){
  const co=p.constellation;
  if(name==='VodyanitsaC1'&&co>=1)v.ATKFixed=p.hp*.008;
  if(name==='VodyanitsaC6'&&co>=6){v.BonusHydro=.6;v.BonusCryo=.6;v.StellarSwirlElevation=.25;}
  if(name==='VodyanitsaA1')v.ResMinusAnemo=.35;
  if(name==='VodyanitsaE'){const value=[.165,.18,.195,.21,.225,.24,.255,.27,.285,.3,.318,.336,.354,.372,.39][p.e_level-1];v.ResMinusHydro=value;v.ResMinusCryo=value;}
  if(name==='VodyanitsaA4'){if(p.ordinary_mode){if(p.on_field){v.ExtraDmgHydro=v.ExtraDmgCryo=Math.min(Math.max(p.hp-40000,0)*.14,3500);}}else{v.StellarSwirlFlat=Math.min(Math.max(p.hp-40000,0)*.26,6500);v.StellarConductFlatCryo=v.StellarSwirlFlat;}}
  if(name==='VodyanitsaC2'&&co>=2&&(p.on_field||co>=6)){if(p.ordinary_mode){v.CriticalDamageHydro=v.CriticalDamageCryo=.5;v.StellarConductCritDamageCryo=-.5;}else{v.StellarSwirlCritDamage=.6;v.StellarConductCritDamageCryo=.6;}}
  if(name==='VodyanitsaSignature'&&on&&p.on_field){const r=p.refine,c=.03+.01*r;v.ATKPercentage=p.stacks*Math.min(Math.max(p.hp-40000,0)*c/10000,2*c)*(p.boosted?1.75:1);}
  return [effect(name,v)];
 }
 let compiled=EXTENSION_BUFF_REGISTRY.compile(b,input);
 if(compiled===null)return [b];
 // These source descriptions grant both Stellar families; keep distinct slots.
 const dual={OdetteMarvelousSplendor:['StellarSwirlBonus','EnhanceStellarSuperconduct'],OdetteC4SnowSwanDream:['StellarSwirlBonus','EnhanceStellarSuperconduct'],OdetteC6MarvelousSplendor:['StellarSwirlElevation','StellarConductElevation'],DionaC6StellarConduct:['StellarSwirlBonus','EnhanceStellarSuperconduct'],EnhanceStellarGlimmerReaction:['StellarSwirlBonus','EnhanceStellarSuperconduct'],ElevateStellarGlimmerReaction:['StellarSwirlElevation','StellarConductElevation'],HeartOfTheFurnace4:['StellarSwirlBonus','EnhanceStellarSuperconduct']}[name];
 if(dual)for(const b of compiled){const values=b.config.ExtensionEffect.values;add(values,dual[1],values[dual[0]]||0);}
 if(name==='HeartOfTheFurnace4')for(const b of compiled)b.config.ExtensionEffect.values.HeartOfTheFurnaceTeamBonus=b.config.ExtensionEffect.values.StellarSwirlBonus||0;
 if(name==='OdetteTalent1'&&p.radiance_mode===1)compiled=[effect(name,{StellarConductBaseBonus:Math.min(p.atk*.000035,.07)})];
 return compiled;
}
export function preparePreviewInput(input){
 const name=input.character.name,p={...previewDefaults[name],...input.character.params?.[name]};
 const x={...input,character:{...input.character,params:{[name]:p}},buffs:[]};
 if(isLimitedWeapon(input.weapon))x.weapon=normalizeLimitedWeapon(input.weapon);
 if(isSignatureWeapon(input.weapon))x.weapon=normalizeSignatureWeapon(input.weapon);
 const source=prepareLunarEquipmentBuffs(input.buffs||[],input),seen=new Set(),repeat=new Set(['ExtensionEffect','CustomElementalBonus','EnhanceStellarGlimmerReaction','ElevateStellarGlimmerReaction','EnhanceMoonReaction']);
 // A selected shared Polestar buff owns the field count, preventing duplicate application.
 const field=source.find(b=>b.name==='ResonancePolestarField'&&!b.lock&&b.config?.ResonancePolestarField?.active!==false);
 if(name==='Mitya'&&field){p.polestar=true;p.field_hits=normalizeBuffParameters(field.name,field.config?.[field.name]||{}).stacks;}
 for(const b of source){if(name==='Mitya'&&b===field)continue;if(b.lock||b.config?.[b.name]?.active===false)continue;if(!repeat.has(b.name)&&seen.has(b.name))continue;seen.add(b.name);x.buffs.push(...compilePreviewBuff(b,x));}
 return x;
}
export function createPreview7201Facade(base,extension){const edict=createStarsealedEdictAdapter(base);return Object.fromEntries(Object.entries(base).map(([key,Class])=>[key,key==='TransformativeDamage'?Class:new Proxy(Class,{get(target,method){const fn=Reflect.get(target,method);if(typeof fn!=='function')return fn;return (...args)=>{
 const i=key==='DSLInterface'&&method==='run'?1:0;let input=args[i];
 if(input?.weapon?.name==='StarsealedEdict'){input=edict(input);args=[...args];args[i]=input;}
 if(!names.has(input?.character?.name)){
  if(input?.character&&(input.buffs||[]).some(b=>PREVIEW_BUFFS[b.name])){
   const seen=new Set();input={...input,buffs:input.buffs.flatMap(b=>{if(!PREVIEW_BUFFS[b.name])return [b];if(seen.has(b.name))return [];seen.add(b.name);return compilePreviewBuff(b,input).map(e=>{const values={...e.config.ExtensionEffect.values};for(const [scoped,plain]of [['StellarConductFlatElectro','StellarConductFlat'],['StellarConductCritDamageElectro','StellarConductCritDamage']])if(scoped in values){if(characterElements[input.character.name]==='Electro')add(values,plain,values[scoped]);delete values[scoped];}return {...e,config:{ExtensionEffect:{...e.config.ExtensionEffect,values}}};});})};args=[...args];args[i]=input;
  }
  return fn(...args);
 }
 const x=preparePreviewInput(input),forward=[...args];forward[i]=x;
 const result=extension[key][method](...forward);
 if(key==='CalculatorInterface'&&method==='get_damage_analysis'){
  if(input.character.name==='Mitya'&&[8,12,13,15].includes(input.skill.index)){
   result.direct_stellarconduct=result.normal;result.normal=null;
   result.reaction_availability={direct_stellarconduct:true};
   result.damage_scope='direct_stellarconduct';
  }
  return markReactionAvailability(result,['direct_stellarconduct']);
 }
 return result;
 };}})]));}

import {CHARACTER_EFFECT_RULES} from './character-effect-rules.mjs';
import {LUNAR_EQUIPMENT_RULES,prepareLunarEquipmentBuffs} from './lunar-equipment-rules.mjs';
import {REACTION_PARAMETER_RULES} from './reaction-parameter-rules.mjs';
import {createBuffRuleRegistry} from './buff-rule-registry.mjs';
import {SHARED_BUFF_RULES} from './shared-buff-rules.mjs';
// Character formulas are owned by CHARACTER_EFFECT_RULES; equipment remains separately scoped.
// Odette parameters: 7.1 release character description and published buff metadata.
// Each value is a native attribute, so candidate optimization evaluates the same formula.
const named=(name,config)=>({name,config:{[name]:config}});
const n=(p,key,def,min=0,max=100000,integer=false)=>{
 const x=p[key]??def;
 if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max||(integer&&!Number.isInteger(x)))throw Error('BUFF 参数无效：'+key);
 return x;
};
const rate=p=>n(p,'rate',1,0,1);
const ref=p=>n(p,'refine',1,1,5,true);
const elements=['Pyro','Hydro','Electro','Cryo','Anemo','Geo','Dendro','Physical'];
const star=(bonus=0,base=0,elevation=0)=>({star:{bonus,base,elevation}});
const recipes={
 ...LUNAR_EQUIPMENT_RULES,
 ...REACTION_PARAMETER_RULES,
 ...SHARED_BUFF_RULES,
 // Ordinary and Stellar Swirl multipliers are distinct named effects.
 IndependentDamageMultiplier:p=>({IndependentBaseMultiplier:n(p,'p',100,0,Number.MAX_VALUE)/100-1}),
 StellarSwirlDamageMultiplier:p=>({StellarSwirlIndependentBaseMultiplier:n(p,'p',100,0,Number.MAX_VALUE)/100-1}),
 AThousandFloatingDreams:p=>({ElementalMastery:40+2*(ref(p)-1)}),
 WanderingEvenstar:p=>({ATKFromSecondaryConversion:n(p,'em',900)*(.24+.06*(ref(p)-1))*.3}),
 ScrollOfTheHeroOfCinderCity4:p=>{
 const chosen=p.elements??[];
 if(!Array.isArray(chosen)||chosen.some(e=>!elements.includes(e)))throw Error('烬城 BUFF 元素无效');
 return Object.fromEntries([...new Set(chosen)].map(e=>['Bonus'+e,.12*n(p,'rate1',1,0,1)+.28*n(p,'rate2',1,0,1)]));
 },
 SongOfDaysPast4:p=>({ExtraDmgBase:.08*Math.min(n(p,'regeneration',15000),15000)*rate(p)}),
 HeartOfTheFurnace4:p=>star(.5*rate(p)),
 CustomElementalBonus:p=>{if(!elements.includes(p.element))throw Error('BUFF 元素无效');return {['Bonus'+p.element]:n(p,'p',0,-100000)/100};},
 EnhanceStellarGlimmerReaction:p=>star(n(p,'p',0,-100000)/100),
 ElevateStellarGlimmerReaction:p=>star(0,0,n(p,'p',0,-100000)/100),
 // Shared Lunar attributes also apply to direct skill damage.
 EnhanceMoonReaction:p=>({EnhanceMoonReaction:n(p,'p',0,-100000)/100}),
};
export const EXTENSION_BUFF_REGISTRY=createBuffRuleRegistry({...recipes,...CHARACTER_EFFECT_RULES});
export const EXTENSION_BUFF_ADAPTERS=EXTENSION_BUFF_REGISTRY.names;
export function prepareExtensionBuffs(input){
 if(!['Vodyanitsa','Vesna'].includes(input?.character?.name))return input;
 const out={...input,buffs:[]},state={flat:0,base:0,bonus:0,crit_damage:0,elevation:0,anemo_res:0};
 const seen=new Set(),repeatable=new Set(['CustomElementalBonus','EnhanceStellarGlimmerReaction','ElevateStellarGlimmerReaction','EnhanceMoonReaction']);
 let hasStar=false;
 for(const b of prepareLunarEquipmentBuffs(input.buffs||[],input)){
  if(b.lock===true)continue;
  if(b.name==='VesnaSupport'){
   hasStar=true;for(const k of Object.keys(state)){const value=b.config?.VesnaSupport?.[k]??0;if(typeof value!=='number'||!Number.isFinite(value))throw Error('星扩散支持参数无效：'+k);state[k]+=value;}continue;
  }
  // A named source effect cannot stack with another copy of itself. Custom
  // numeric modifiers remain independently composable, as in the published core.
  if(EXTENSION_BUFF_REGISTRY.has(b.name)&&!repeatable.has(b.name)){
   if(seen.has(b.name))continue;
   if(b.config?.[b.name]?.active!==false)seen.add(b.name);
  }
  const effects=EXTENSION_BUFF_REGISTRY.compile(b,input);
  out.buffs.push(...(effects===null?[b]:effects));
 }
 if(hasStar)out.buffs.push(named('VesnaSupport',state));
 return out;
}

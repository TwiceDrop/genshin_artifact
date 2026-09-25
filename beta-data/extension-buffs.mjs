// Calibrated native-extension adapters. Legacy characters retain their published buffs.
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
 OdetteTalent1:p=>star(0,n(p,'radiance_mode',1,0,2,true)===2?Math.min(n(p,'atk',2000)*.00007,.14):0),
 OdetteMarvelousSplendor:p=>star(.15*n(p,'stacks',4,0,6,true)),
 OdetteC2MarvelousSplendor:p=>({ATKPercentage:.07*n(p,'stacks',4,0,6,true)}),
 OdetteC2SoloDance:p=>{const m=n(p,'radiance_mode',1,0,2,true);return m?{ResMinusCryo:.2,[m===2?'ResMinusAnemo':'ResMinusElectro']:.2}:{};},
 OdetteC4SnowSwanDream:p=>star(.05+.02*n(p,'burst_level',10,1,15,true)),
 OdetteC6MarvelousSplendor:()=>star(0,0,.25),
 AlbedoC4:p=>({BonusPlungingAttack:.3*n(p,'rate_plunging',1,0,1),BonusPlungingImpact:.3*n(p,'rate_impact',0,0,1)}),
 KleeC6:p=>({BonusPyro:p.is_self===true?.5:.1}),
 MonaC1:p=>{const a=p.off_field===true?.24:.15;return {EnhanceElectroCharged:a,EnhanceVaporize:a,EnhanceSwirlHydro:a};},
 DionaC6StellarConduct:()=>({EnhanceSuperconduct:.4,EnhanceSwirlCryo:.4,...star(.4)}),
 EscoffierTalent3:p=>{const a=[.05,.1,.15,.55][n(p,'hydro_cryo_count',1,0,3,true)];return {ResMinusHydro:a,ResMinusCryo:a};},
 EscoffierC1:()=>({CriticalDamageCryo:.6}),
 EscoffierC2:p=>({ExtraDmgCryo:2.4*n(p,'atk',3000)*rate(p)}),
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
 // Existing reaction previews remain uncalibrated; these ordinary native attributes
 // can nevertheless be configured without rejecting the whole character.
 EnhanceMoonReaction:p=>({EnhanceMoonReaction:n(p,'p',0,-100000)/100}),
 AmberC6:()=>({ATKPercentage:.15}),
 SethosC4:()=>({ElementalMastery:80}),
};
export const EXTENSION_BUFF_ADAPTERS=Object.freeze(Object.keys(recipes));
export function prepareExtensionBuffs(input){
 if(!['Vodyanitsa','Vesna'].includes(input?.character?.name))return input;
 const out={...input,buffs:[]},state={flat:0,base:0,bonus:0,crit_damage:0,elevation:0,anemo_res:0};
 let hasStar=false;
 for(const b of input.buffs||[]){
  if(b.name==='VesnaSupport'){
   hasStar=true;for(const k of Object.keys(state))state[k]+=Number(b.config?.VesnaSupport?.[k]||0);continue;
  }
  const fn=recipes[b.name];
  if(!fn){out.buffs.push(b);continue;}
  const p=b.config?.[b.name]||{};
  if(p.active===false)continue;
  const {star:stellar,...values}=fn(p);
  if(stellar){hasStar=true;for(const k of Object.keys(stellar))state[k]+=stellar[k];}
  if(Object.keys(values).length)out.buffs.push(named('ExtensionEffect',{label:'BUFF: '+b.name,values}));
 }
 if(hasStar)out.buffs.push(named('VesnaSupport',state));
 return out;
}

// Shared, declarative support effects. Values use native AttributeName units.
// Rule inputs are the published BUFF config plus the beneficiary calculation input.
// Manually enabling a BUFF declares its source/trigger prerequisites satisfied;
// explicit recipient flags still restrict eligibility. See docs/shared-buff-rules.md.
const number=(p,key,fallback,min=0,max=100000,integer=false)=>{
 const value=p[key]??fallback;
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw Error('BUFF 参数无效：'+key);
 return value;
};
const flag=(p,key,fallback=false)=>{
 const value=p[key]??fallback;
 if(typeof value!=='boolean')throw Error('BUFF 开关无效：'+key);
 return value;
};
const rate=(p,key='rate',fallback=1)=>number(p,key,fallback,0,1);
const refine=p=>number(p,'refine',1,1,5,true);
const elements=['Pyro','Hydro','Electro','Cryo','Anemo','Geo','Dendro','Physical'];
const elemental=elements.filter(x=>x!=='Physical');
const elementList=(p,key,fallback=elemental)=>{
 const list=p[key]??fallback;
 if(!Array.isArray(list)||list.some(x=>!elements.includes(x)))throw Error('BUFF 元素列表无效：'+key);
 return [...new Set(list)];
};
const skillBonuses=value=>Object.fromEntries(['NormalAttack','ChargedAttack','PlungingAttack','ElementalSkill','ElementalBurst'].map(s=>['Bonus'+s,value]));
const skillFlatDamage=value=>Object.fromEntries(['NormalAttack','ChargedAttack','PlungingAttack','ElementalSkill','ElementalBurst'].map(s=>['ExtraDmg'+s,value]));
const recipientName=input=>input?.character?.name;
const onField=(p,input,selfName)=>{
 if(selfName&&recipientName(input)===selfName)return true;
 const name=recipientName(input);
 const value=p.recipient_on_field??input?.team_effects?.recipient_on_field??input?.team_effects?.on_field??input?.character?.params?.[name]?.on_field??true;
 if(typeof value!=='boolean')throw Error('BUFF 受益者前后台参数无效');
 return value;
};
const magus=p=>flag(p,'recipient_is_magus',true);
// Element membership generated from src/assets/_gen_character.js (7.1.06 catalog).
// No imported browser metadata or runtime IO is needed in workers/Node.
const pyroElectro=new Set('AetherPyro,Amber,Bennett,Dehya,Diluc,Durin,HuTao,Klee,Lyney,Thoma,ManekinaPyro,Xiangling,Xinyan,Yanfei,Yoimiya,Chevreuse,Gaming,Arlecchino,Mavuika,Nicole,AetherElectro,Beidou,Cyno,Dori,Fischl,Keqing,KujouSara,KukiShinobu,Lisa,RaidenShogun,Razor,ManekinaElectro,YaeMiko,Clorinde,Sethos,Ororon,Iansan,Varesa,Ineffa,Flins,Alyosha'.split(','));
const hydroGeo=new Set('AetherHydro,Barbara,Candace,Furina,KamisatoAyato,Mona,Neuvillette,Nilou,SangonomiyaKokomi,Tartaglia,ManekinaHydro,Xingqiu,Yelan,Sigewinne,Mualani,Aino,Dahlia,Columbina,Vodyanitsa,AetherGeo,Albedo,AratakiItto,Gorou,Ningguang,Noelle,ManekinaGeo,Yunjin,Zhongli,Navia,Chiori,Kachina,Xilonen,Zibai,Linnea,Illuga'.split(','));
const eligibleElement=(p,input,allowed,names)=>{
 const element=p.recipient_element??input?.character?.element;
 if(element!==undefined){if(!elements.includes(element))throw Error('BUFF 受益者元素无效');return allowed.includes(element);}
 const name=recipientName(input);
 if(!name)throw Error('此 BUFF 需要指定受益角色');
 return names.has(name);
};
export const SHARED_BUFF_RULES=Object.freeze({
 // Original WASM f1260/f1266, independently recovered in kernel-recovery-lab.
 OroronC6:(p,input)=>onField(p,input)?{ATKPercentage:.1*number(p,'stack',0,0,3,true)}:{},
 LaylaC4:p=>{const value=.05*number(p,'hp',30000,0,60000)*rate(p);return {ExtraDmgNormalAttack:value,ExtraDmgChargedAttack:value};},
 EmilieC2:p=>({ResMinusDendro:.3*rate(p)}),
 ChevreuseTalent1:()=>({ResMinusPyro:.4,ResMinusElectro:.4}),
 ChevreuseTalent2:(p,input)=>eligibleElement(p,input,['Pyro','Electro'],pyroElectro)?{ATKPercentage:Math.min(Math.floor(number(p,'hp',40000)/1000)*.01,.4)}:{},
 ChevreuseC6:p=>{const value=.2*number(p,'stack',3,0,3,true);return {BonusPyro:value,BonusElectro:value};},
 MonaC2:()=>({ElementalMastery:80}),
 // f2329: per-stack vaporize enhancement, consumed by the configured hit.
 MonaMagusGlow:(p,input)=>recipientName(input)==='Mona'?{}:{EnhanceVaporize:.05*number(p,'stack',3,0,3)},
 // Published WASM f2564/f2567 use the ordinary additive BonusBase slot.
 SucroseTalentMagusE:()=>({BonusBase:.0571428}),
 SucroseTalentMagusQ:p=>magus(p)?{BonusBase:.0714285}:{},
 VentiSongOfTime:(p,input)=>onField(p,input)?{BonusBase:.5*rate(p)}:{},
 VentiTalentFreedom:(p,input)=>onField(p,input,'Venti')?{BonusAnemo:.25}:{},
 MavuikaTalent2:(p,input)=>onField(p,input)?{BonusBase:Math.min(number(p,'fighting_spirit',200,0,200)*.002,.4)+(flag(p,'c4_enabled')?.1:0)}:{},
 MavuikaC6:()=>({DefMinus:.2}),
 AlbedoWitchEve:p=>{
  const defense=number(p,'def',3000);
  if(defense===0&&(rate(p,'isotoma_team_rate',0)>0||rate(p,'fumo_team_rate',0)>0))throw Error('阿贝多魔女 BUFF 请填写来源防御；防御为0的动态转换尚未接入共享规则。');
  const value=Math.min(defense*.00004,.12)*rate(p,'isotoma_team_rate',0)+(magus(p)?Math.min(defense*.0001,.3)*rate(p,'fumo_team_rate',0):0);
  return skillBonuses(value);
 },
 // f889/f897 multiply BOTH effects by (1 + coordinated_attack_rate).
 FischlWitchEve:(p,input)=>{
  if(!flag(p,'is_magical_secret_rite_active',true)||!onField(p,input,'Fischl'))return {};
  const multiplier=1+rate(p,'coordinated_attack_rate',0);
  return {ATKPercentage:.225*rate(p,'overload_rate',0)*multiplier,ElementalMastery:90*rate(p,'electro_charged_rate',0)*multiplier};
 },
 // f2380 writes ElementalMasteryExtra: do not feed the converted EM back into conversions.
 YumemizukiMizukiEnhancedEM:p=>({ElementalMasteryExtra:number(p,'em',1000,0,10000)*.1}),
 // A stellar trigger can still grant ordinary EM/resistance effects.
 BeidouC6StellarConduct:(p,input)=>({ResMinusCryo:.15,...(onField(p,input)?{ElementalMastery:200}:{})}),
 CynoC1StellarConduct:(p,input)=>onField(p,input)?{ElementalMastery:200}:{},
 AinoC1:(p,input)=>onField(p,input,'Aino')?{ElementalMastery:80}:{},
 // f2336 writes converted EM; f2339 (LinneaTalent3) deliberately writes ordinary EM.
 IneffaTalent3:p=>({ElementalMasteryExtra:number(p,'atk',2000,0,10000)*.06}),
 YaeMikoC2:(p,input)=>onField(p,input,'YaeMiko')?{ElementalMastery:[0,60,90,120,200][number(p,'sakura_level',4,1,4,true)]}:{},
 AetherCryoC2:(p,input)=>onField(p,input)?{ElementalMastery:flag(p,'stellar_triggered',true)?120:60}:{},
 DurinC1:(p,input)=>recipientName(input)==='Durin'?{}:{ExtraDmgBase:.6*number(p,'atk',3000,0,20000)*rate(p,'ratio')},
 DurinC6:()=>({DefMinus:.3}),
 LinneaTalent2:p=>({ResMinusGeo:[0,.15,.3][number(p,'mode',2,0,2,true)]}),
 LinneaTalent3:p=>({ElementalMastery:number(p,'def',2000,0,10000)*.05}),
 LinneaC2:(p,input)=>flag(p,'is_hydro_or_geo',true)&&eligibleElement(p,input,['Hydro','Geo'],hydroGeo)?{CriticalDamageBase:.4}:{},
 JahodaTalent2:()=>({ElementalMastery:100}),
 JahodaC6:()=>({CriticalBase:.05,CriticalDamageBase:.4}),
 // Geo-scoped CRIT is not universal reaction CRIT; full-moon EM is ordinary EM.
 IllugaP2:p=>{const c6=flag(p,'is_c6');return {CriticalGeo:c6?.10:.05,CriticalDamageGeo:c6?.30:.10,ElementalMastery:flag(p,'full_moon')?(c6?80:50):0};},
 IllugaC4:(p,input)=>onField(p,input)?{DEFFixed:200}:{},
 PruneTalent1:p=>magus(p)?{ATKPercentage:.3*rate(p)}:{},
 // f1955/f1956 write ordinary additive BonusBase (slot 66), not an independent multiplier.
 PruneTalent2:p=>({BonusBase:Math.min(Math.max(number(p,'prune_atk',4000,0,4000)-2000,0)*.00025,.5)*rate(p)}),
 PruneC6:p=>({ATKFixed:350*rate(p)}),
 LohenTalent2:p=>({ATKPercentage:.15*rate(p)}),
 LohenC2:(p,input)=>recipientName(input)==='Lohen'?{}:{ElementalMastery:200*rate(p)},
 NicoleC2:p=>Object.fromEntries(elementList(p,'elements').map(e=>['ResMinus'+e,.25])),
 NicoleC4:p=>skillFlatDamage(.7*number(p,'nicole_atk',4000,0,15000)*rate(p)),
 NicoleC6:p=>({DefPenetration:.4*rate(p)}),
 AthameArtis:(p,input)=>onField(p,input)&&!flag(p,'recipient_is_wielder')?{ATKPercentage:(.12+.04*refine(p))*(flag(p,'magus')?1.75:1)}:{},
 StarcallersWatch:(p,input)=>onField(p,input)?{BonusBase:(.21+.07*refine(p))*rate(p)}:{},
 CranesEchoingCall:p=>({BonusPlungingAttack:(.15+.13*refine(p))*rate(p)}),
 AngelosHeptades:(p,input)=>{
  const offField=flag(p,'secret_arts_offfield');
  if(offField?!magus(p):!onField(p,input))return {};
  const r=refine(p),value=Math.min(number(p,'atk',2700)/1000*(.07+.03*r),.18+.08*r);
  return {BonusBase:value*(offField?.5:1)};
 },
 SymphonistOfScents:p=>({ATKPercentage:(.24+.08*refine(p))*rate(p)}),
 HeavensGift4:p=>{
  const upgraded=flag(p,'is_secret_arts',true);
  const selected=[...new Set([...elementList(p,'elements1'),...(upgraded?elementList(p,'elements2'):[])])];
  return Object.fromEntries(selected.map(e=>['Bonus'+e,(upgraded?.4:.2)*rate(p)]));
 },
});

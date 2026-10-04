// Equipment support rules. Character rules moved to character-effect-rules.mjs.
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
export const SHARED_BUFF_RULES=Object.freeze({
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

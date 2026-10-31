import {previewDefaults} from './preview-7201-config.mjs';
export const PREVIEW_BUFFS={"MityaSupport":{"label":"米提亚·侦测炉心与星耀祝礼","fields":[{"name":"em","title":3763,"type":"floatInput","min":0,"max":10000,"default":500},{"name":"constellation","title":743,"type":"int","min":0,"max":6,"default":0},{"name":"ascension","title":3764,"type":"int","min":0,"max":6,"default":6},{"name":"core_mode","title":3732,"type":"option","options":["无","稳态","过载"],"default":2,"optionCount":3},{"name":"beacons","title":3733,"type":"int","min":0,"max":5,"default":4},{"name":"polestar","title":3736,"type":"bool","default":true},{"name":"recipient_on_field","title":3765,"type":"bool","default":true}]},"ValeriyDirective":{"label":"瓦列里·攻斥指令","fields":[{"name":"atk","title":3767,"type":"floatInput","min":0,"max":10000,"default":2000},{"name":"talent_level","title":3768,"type":"int","min":1,"max":15,"default":10},{"name":"ascended","title":3769,"type":"bool","default":true},{"name":"momentum","title":3739,"type":"int","min":0,"max":130,"default":40},{"name":"radiance","title":3056,"type":"bool","default":true},{"name":"recipient_on_field","title":3765,"type":"bool","default":true},{"name":"active","title":3738,"type":"bool","default":true}]},"ValeriyC2":{"label":"瓦列里·伴随冲阵的队型","fields":[{"name":"active","title":3741,"type":"bool","default":true}]},"ValeriyC6":{"label":"瓦列里·穿透敌阵的威能","fields":[{"name":"active","title":3742,"type":"bool","default":true}]}};
export const MITYA_BUFF_PARTS={
 MityaA1:{label:'米提亚·基准承压测验',fields:['constellation','ascension','core_mode','beacons']},
 MityaStellarBlessing:{label:'米提亚·星耀祝礼·极密协议',fields:['em']},
 MityaC1:{label:'米提亚·缺位寻踪的观察者',fields:['constellation','core_mode','recipient_on_field']},
 MityaC2:{label:'米提亚·惰性之外的沉寂物',fields:['constellation','core_mode','polestar','recipient_on_field']},
 MityaC6:{label:'米提亚·元素阶跃的理之门',fields:['constellation']},
};
for(const [name,part] of Object.entries(MITYA_BUFF_PARTS))PREVIEW_BUFFS[name]={label:part.label,fields:part.fields.map(key=>PREVIEW_BUFFS.MityaSupport.fields.find(field=>field.name===key))};
// Existing combined entries and automatic team sources use the same individual
// effects as the selector. An explicitly selected part owns its on/off state.
export function expandMityaBuffs(buffs){
 const selected=new Set(buffs.filter(b=>MITYA_BUFF_PARTS[b.name]).map(b=>b.name));
 return buffs.flatMap(buff=>{
  if(buff.name!=='MityaSupport')return [buff];
  const source={...Object.fromEntries(PREVIEW_BUFFS.MityaSupport.fields.map(f=>[f.name,f.default])),...buff.config?.MityaSupport};
  return Object.entries(MITYA_BUFF_PARTS).filter(([name])=>!selected.has(name)).map(([name,part])=>({...buff,name,config:{[name]:{...Object.fromEntries(part.fields.map(key=>[key,source[key]])),...(source.active===undefined?{}:{active:source.active})}}}));
 });
}
// Front-only support requires both the recipient state and the selected support condition.
export function previewRecipientOnField(input,p={}){
 return input.team_effects?.recipient_on_field!==false
  && input.team_effects?.on_field!==false
  && input.character?.params?.[input.character.name]?.on_field!==false
  && p.recipient_on_field!==false;
}
export function previewBuffValues(name,p,input){
 const on=previewRecipientOnField(input,p);
 if(p.active===false)return {};
 if(name==='MityaSupport'){
  const values={};for(const part of Object.keys(MITYA_BUFF_PARTS))for(const [key,value]of Object.entries(previewBuffValues(part,p,input)))values[key]=(values[key]||0)+value;return values;
 }
 if(MITYA_BUFF_PARTS[name]){
  if(input.character?.name==='Mitya')return {};
  if(name==='MityaStellarBlessing')return {StellarConductBaseBonus:Math.min(p.em*.00028,.14)};
  if(name==='MityaA1')return p.ascension>=1&&p.core_mode===1?{ElementalMastery:30*Math.min(p.beacons,p.constellation>=1?5:4)}:{};
  if(name==='MityaC1')return p.constellation>=1&&p.core_mode>0&&on?{CriticalDamageBase:.4}:{};
  if(name==='MityaC2')return p.constellation>=2&&p.core_mode>0?{ElementalMastery:p.core_mode===1?123:on?234:0,...(p.polestar?{ResMinusElectro:.2,ResMinusCryo:.2}:{})}:{};
  if(name==='MityaC6')return p.constellation>=6?{StellarConductElevation:.2}:{};
 }
 if(name==='ValeriyC2')return input.character?.name==='Valeriy'?{}:{ElementalMastery:100};
 if(name==='ValeriyC6')return input.character?.name==='Valeriy'?{}:{CriticalElectro:.1,StellarConductCritDamageElectro:.4};
 if(name==='ValeriyDirective'){
  if(!on||input.character?.name==='Valeriy')return {};
  const ordinary=[0.2432,0.26144,0.27968,0.304,0.32224,0.34048,0.3648,0.38912,0.41344,0.43776,0.46208,0.4864,0.5168,0.5472,0.5776];
  const ratio=ordinary[p.talent_level-1]+(p.ascended?.003*p.momentum:0);
  return {[p.radiance?'StellarConductFlatElectro':'ExtraDmgElectro']:p.atk*ratio*(p.radiance?3:1)};
 }
}

import data from './starsealed-edict-v4.mjs';
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0);
export function createStarsealedEdictAdapter(base){
 const cache=new Map();
 return function prepare(input){
  const w=input?.weapon;if(w?.name!=='StarsealedEdict')return input;
  const p={skill_active:false,stacks:0,radiance:false,...w.params?.StarsealedEdict};
  const levels=[20,40,50,60,70,80];const promotion=levels.filter(v=>w.level>v||w.level===v&&w.ascend).length;
  const value=id=>{const a=data.attributes.find(x=>x.attribute_id===id);return a.value*data.curves[a.curve_id].values[w.level-1]+(data.promotions[promotion].stat_additions.find(x=>x.stat_id===id)?.value||0);};
  const carrier={...w,name:'TheWidsith',params:{TheWidsith:{t1_rate:0,t2_rate:0,t3_rate:0}}},key=w.level+':'+w.ascend;
  if(!cache.has(key)){const panel=base.CommonInterface.get_attribute({character:{name:'Lisa',level:1,ascend:false,constellation:0,skill1:0,skill2:0,skill3:0,params:'NoConfig'},weapon:carrier,artifacts:[],artifact_config:null,buffs:[]});cache.set(key,{attack:panel.atk['武器基础攻击'],cd:panel.critical_damage['武器副词条']});}
  const old=cache.get(key),r=w.refine,coef=data.refinements[r-1].parameters,stacks=p.skill_active?p.stacks:0;
  const values={ATKBase:Math.round(value(4))-old.attack,CriticalDamageBase:Math.round(value(22)*1e4)/1e4-old.cd+.18+.06*r,ElementalMastery:p.skill_active?coef[0]+coef[1]*stacks:0,StellarConductCritDamage:p.radiance?coef[2]*stacks:0};
  return {...input,weapon:carrier,buffs:[...(input.buffs||[]),{name:'ExtensionEffect',config:{ExtensionEffect:{label:'秘星典谕',values}}}]};
 };
}

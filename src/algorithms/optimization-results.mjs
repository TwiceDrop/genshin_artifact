import {visibleDamageReactionKeys} from './reaction-labels.mjs'
const sum=x=>Object.values(x||{}).reduce((a,b)=>a+b,0)
const stats=[['hp','生命值','HPFixed',{value:100}],['atk','攻击力','ATKFixed',{value:10}],['def','防御力','DEFFixed',{value:10}],['elemental_mastery','元素精通','ElementalMastery',{value:20}],['recharge','元素充能效率','Recharge',{p:10}],['critical','暴击率','Critical',{p:-10}],['critical_damage','暴击伤害','CriticalDamage',{p:10}]]
export function resultDamagePreview(mona,input,artifacts,infusion){
 const x={...input,artifacts},element=infusion==='None'?null:infusion,analysis=mona.CalculatorInterface.get_damage_analysis(x,element),keys=visibleDamageReactionKeys(analysis),panel=mona.CommonInterface.get_attribute(x)
 const changes=(other)=>keys.some(k=>['expectation','critical','non_critical'].some(f=>Math.abs(other[k]?.[f]-analysis[k][f])>1e-7*Math.max(1,Math.abs(analysis[k][f]))))
 const attributes=[]
 for(const [key,label,name,params]of stats){
  const changed=mona.CalculatorInterface.get_damage_analysis({...x,buffs:[...(x.buffs||[]),{name,config:{[name]:params}}]},element)
  const critRelevant=['critical','critical_damage'].includes(key)&&keys.some(k=>analysis[k].critical!==analysis[k].non_critical)
  if(changes(changed)||critRelevant)attributes.push({key,label,value:sum(panel[key]),percent:['recharge','critical','critical_damage'].includes(key)})
 }
 return {analysis,attributes}
}
export function formatComputeTime(ms){if(ms===null||ms===undefined||!Number.isFinite(ms))return '估算中';const n=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}

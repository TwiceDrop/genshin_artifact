const fields=['scaling','ratio','extra_base','independent','base_multiplier','base_bonus','bonus','flat','critical','critical_damage','reaction_critical','reaction_critical_damage','res_minus','elevation','universal_elevation','final_multiplier'];
export const STELLAR_DETAIL_KEYS=['direct_stellarconduct','direct_stellarswirl'];
export function stellarDetail(analysis,key,characterName){
 if(!analysis[key])return null;
 if(analysis.stellar_detail)return analysis.stellar_detail;
 const family=key==='direct_stellarconduct'?'stellarconduct':'stellarswirl',em=characterName==='YumemizukiMizuki';
 return {element:analysis.element,scaling_name:em?'元素精通':'攻击力',active:true,
  scaling:em?analysis.em:analysis.atk,ratio:analysis[key+'_ratio'],extra_base:analysis[key+'_extra_damage'],independent:{},
  base_multiplier:{'基础倍率':analysis[key+'_base_multiplier']},base_bonus:analysis[key+'_base_compose'],bonus:analysis[key+'_compose'],flat:analysis[key+'_extra_fixed'],
  critical:analysis.critical,critical_damage:analysis.critical_damage,reaction_critical:analysis['critical_'+family],reaction_critical_damage:analysis['critical_damage_'+family],
  res_minus:analysis.res_minus,elevation:analysis['elevate_'+family+'_compose'],universal_elevation:analysis.elevate_stellar_glimmer_reaction_compose,final_multiplier:analysis.stellar_glimmer_reaction_damage_multiplier};
}
export function stellarDetailState(detail){return {...detail,...Object.fromEntries(fields.map(key=>[key,Object.entries(detail[key]||{}).map(([name,value])=>({name,value,checked:true}))]))};}
const sum=rows=>rows.reduce((s,item)=>s+(item.checked?Number(item.value):0),0);
export function stellarDetailResult(state,enemy){
 const value=key=>sum(state[key]);const base=(value('scaling')*value('ratio')+value('extra_base'))*(1+value('independent'))*value('base_multiplier')*(1+value('base_bonus'))*(1+value('bonus'));
 const resistance=enemy[state.element.toLowerCase()+'_res']-value('res_minus'),res=resistance<0?1-resistance/2:resistance>.75?1/(1+4*resistance):1-resistance;
 const n=state.active?(base+value('flat'))*res*(1+value('elevation')+value('universal_elevation'))*(1+value('final_multiplier')):0;
 const cr=Math.max(0,Math.min(1,value('critical')+value('reaction_critical'))),cd=value('critical_damage')+value('reaction_critical_damage');
 return {non_critical:n,critical:n*(1+cd),expectation:n*(1+cr*cd)};
}

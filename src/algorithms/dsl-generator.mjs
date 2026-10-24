import {DAMAGE_REACTION_LABELS,damageReactionOptions} from './reaction-labels.mjs';
export const DSL_VALUES=[{key:'e',label:'期望'},{key:'c',label:'暴击'},{key:'n',label:'非暴击'}];
export const DSL_DAMAGE_TYPES=Object.entries(DAMAGE_REACTION_LABELS).map(([key,label])=>({key,label}));
export function skillRows(character,names){return [1,2,3].flatMap(group=>character['skillMap'+group].map(skill=>({...skill,group,title:character['skillName'+group],token:names[skill.index]})));}
export function availableDamageTypes(mona,input,skill,config,infusion){return damageReactionOptions(mona.CalculatorInterface.get_damage_analysis({...input,skill:{index:skill.index,config}},infusion==='None'?null:infusion));}
export function generateDsl(state){
 if(!state.entries.length)return 'result = 0';
 const declarations=[],terms=[];
 state.entries.forEach((entry,index)=>{const name='hit'+(index+1),params={...entry.params};if(entry.infusion!=='None')params.fumo=entry.infusion;
  const config=Object.entries(params).map(([key,value])=>key+': '+JSON.stringify(value)).join(', ');
  declarations.push(`dmg ${name} = ${state.character}.${entry.token}${config?'({ '+config+' })':''}`);
  terms.push(`${name}.${entry.reaction}.${entry.value} * ${entry.count} * ${entry.weight}`);
 });
 return declarations.join('\n')+'\nresult = '+terms.join(' + ');
}

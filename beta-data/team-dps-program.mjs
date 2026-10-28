import {createNumericProgram,compactNumericProgram} from './team-dps-numeric-program.mjs';
import {createPortableNativeQuery} from './team-dps-native-query.mjs';
import {createTeamDpsEvaluator} from './team-dps-evaluator.mjs';
import {teamDpsArtifactAvailable} from './team-dps-equipment-support.mjs';

export const TEAM_PROGRAM_STATS=['HPFixed','ATKFixed','DEFFixed','HPPercentage','ATKPercentage','DEFPercentage','ElementalMastery','Recharge','CriticalRate','CriticalDamage','HealingBonus','PyroBonus','HydroBonus','CryoBonus','ElectroBonus','AnemoBonus','GeoBonus','DendroBonus','PhysicalBonus'];
export const TEAM_PROGRAM_PANELS=['hp','atk','def','elemental_mastery','recharge','critical','critical_damage','healing_bonus','shield_strength','bonus_pyro','bonus_hydro','bonus_cryo','bonus_electro','bonus_anemo','bonus_geo','bonus_dendro','bonus_physical'];
const totals=['expectation','critical','non_critical','fanfare','furina_overflow'],damage=['expectation','critical','non_critical'];

export function compileTeamDpsProgram(api,input,artifacts,resources,evaluatorFactory=createTeamDpsEvaluator){
 const candidates=artifacts.filter(a=>!a.omit&&a.level>=(input.team_dps.minimum_artifact_level??0)&&teamDpsArtifactAvailable(a.set_name));
 const sets=[...new Set(candidates.map(a=>a.set_name))].filter(name=>name!=='Empty'&&new Set(candidates.filter(a=>a.set_name===name).map(a=>a.slot)).size>=2),stride=TEAM_PROGRAM_STATS.length+sets.length,builder=createNumericProgram();
 const setCount=(role,name)=>sets.includes(name)?builder.input(role*stride+TEAM_PROGRAM_STATS.length+sets.indexOf(name)):0;
 const stats=(role,name)=>builder.input(role*stride+TEAM_PROGRAM_STATS.indexOf(name));
 const query=createPortableNativeQuery({...resources,api,builder,sets,setCount,stats});
 const evaluator=evaluatorFactory(api,input,{math:query.math,query:query.query,setCount});
 const result=evaluator.evaluate([[],[],[],[]]),sum=values=>Object.values(values).reduce((a,b)=>query.math.add(a,b),0);
 const outputs=[...totals.map(k=>result[k]),...result.character_damage.flatMap(row=>damage.map(k=>row[k])),...result.panels.flatMap(panel=>TEAM_PROGRAM_PANELS.map(k=>sum(panel[k])))];
 const program=compactNumericProgram(builder.finish(outputs));
 return {program,sets,stride,profiles:result.profiles,duration:result.duration};
}

export function createTeamProgramCodec(model,artifacts){
 const {sets,stride}=model,catalog=new Map(artifacts.map(artifact=>{
  const row=new Float64Array(stride);
  for(const [name,value]of [artifact.main_stat,...artifact.sub_stats])row[TEAM_PROGRAM_STATS.indexOf(name)]+=value;
  if(sets.includes(artifact.set_name))row[TEAM_PROGRAM_STATS.length+sets.indexOf(artifact.set_name)]=1;
  return [artifact.id,row];
 }));
 function encode(teams){
  const result=new Float64Array(teams.length*4*stride);
  teams.forEach((team,j)=>team.forEach((ids,r)=>ids.forEach(id=>{const values=catalog.get(id),offset=(j*4+r)*stride;for(let i=0;i<stride;i++)result[offset+i]+=values[i];})));
  return result;
 }
 function decode(values,count){
  let i=0;return Array.from({length:count},()=>{
   const row=Object.fromEntries(totals.map(key=>[key,values[i++]]));
   row.character_damage=Array.from({length:4},()=>Object.fromEntries(damage.map(key=>[key,values[i++]])));
   row.panels=Array.from({length:4},()=>Object.fromEntries(TEAM_PROGRAM_PANELS.map(key=>[key,{compiled:values[i++]}])));
   return {...row,total_damage:row.expectation,dps:row.expectation/model.duration,duration:model.duration,profiles:model.profiles};
  });
 }
 return {encode,decode};
}

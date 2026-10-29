import {createNumericProgram,compactNumericProgram} from './team-dps-numeric-program.mjs';
import {createPortableNativeQuery} from './team-dps-native-query.mjs';
import {createTeamDpsEvaluator} from './team-dps-evaluator.mjs';
import {teamDpsArtifactAvailable} from './team-dps-equipment-support.mjs';
import {TEAM_STAT_FIELDS as TEAM_PROGRAM_PANELS} from './team-engine/stat-contract.mjs';
import {lowerExpectedProgram} from './team-dps-expectation-program.mjs';
import {artifactProgramRow,teamProgramInputBounds} from './team-dps-program-inputs.mjs';
import {compileEventTrace} from './team-dps-event-trace.mjs';

export const TEAM_PROGRAM_STATS=['HPFixed','ATKFixed','DEFFixed','HPPercentage','ATKPercentage','DEFPercentage','ElementalMastery','Recharge','CriticalRate','CriticalDamage','HealingBonus','PyroBonus','HydroBonus','CryoBonus','ElectroBonus','AnemoBonus','GeoBonus','DendroBonus','PhysicalBonus'];
export {TEAM_PROGRAM_PANELS};
const totals=['expectation','critical','non_critical','fanfare','furina_overflow'],damage=['expectation','critical','non_critical'];

export function compileTeamDpsExpression(api,input,artifacts,resources,evaluatorFactory=createTeamDpsEvaluator,{trace=false}={}){
 const baselineIds=new Set(input.team_dps.initial_ids?.flat()??[]);
 const candidates=artifacts.filter(a=>teamDpsArtifactAvailable(a.set_name)&&(baselineIds.has(a.id)||!a.omit&&a.level>=(input.team_dps.minimum_artifact_level??0)));
 const sets=[...new Set(candidates.map(a=>a.set_name))].filter(name=>name!=='Empty'&&new Set(candidates.filter(a=>a.set_name===name).map(a=>a.slot)).size>=2),stride=TEAM_PROGRAM_STATS.length+sets.length,builder=createNumericProgram();
 const setCount=(role,name)=>sets.includes(name)?builder.input(role*stride+TEAM_PROGRAM_STATS.length+sets.indexOf(name)):0;
 const stats=(role,name)=>builder.input(role*stride+TEAM_PROGRAM_STATS.indexOf(name));
 const query=createPortableNativeQuery({...resources,api,builder,sets,setCount,stats});
 const evaluator=evaluatorFactory(api,input,{math:query.math,query:query.query,setCount,random:builder.bernoulli});
 const result=evaluator.evaluate([[],[],[],[]],trace),sum=values=>Object.values(values).reduce((a,b)=>query.math.add(a,b),0);
 const outputs=[...totals.map(k=>result[k]),...result.character_damage.flatMap(row=>damage.map(k=>row[k])),...result.panels.flatMap(panel=>TEAM_PROGRAM_PANELS.map(k=>sum(panel[k]))),result.duration,result.dps];
 const inputBounds=teamProgramInputBounds(candidates,TEAM_PROGRAM_STATS,sets,input.single_interfaces.length);
 const eventTrace=trace?compileEventTrace(result,query.math):undefined;
 return {program:builder.finish(outputs),sets,stride,profiles:result.profiles,inputBounds,...(eventTrace?{eventTrace}:{})};
}

export function compileTeamDpsProgram(api,input,artifacts,resources,evaluatorFactory=createTeamDpsEvaluator){
 const expression=compileTeamDpsExpression(api,input,artifacts,resources,evaluatorFactory),count=expression.program.outputs.length;
 const lowered=lowerExpectedProgram(expression.program,{inputBounds:expression.inputBounds,ratios:[{output:count-1,numerator:0,denominator:count-2}]});
 return {...expression,program:lowered.program,expectationStats:lowered.stats};
}

// A projection of the already compiled expression, not a second combat run.
// Preserve operation order and stochastic identities; discard only nodes that
// cannot affect a ranking output. Observation templates stay on the full model.
export function createTeamDpsScoreModel({eventTrace,...model}){
 return {...model,program:compactNumericProgram(model.program)};
}

export function createTeamProgramCodec(model,artifacts){
 const {sets,stride}=model,catalog=new Map(artifacts.map(artifact=>{
  const row=artifactProgramRow(artifact,TEAM_PROGRAM_STATS,sets);
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
   return {...row,total_damage:row.expectation,duration:values[i++],dps:values[i++],profiles:model.profiles};
  });
 }
 return {encode,decode};
}

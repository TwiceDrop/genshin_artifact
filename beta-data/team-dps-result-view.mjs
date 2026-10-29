export const TEAM_DPS_RESULT_VERSION='team-dps-result/1';
export const TEAM_EVENT_CHANNELS=[['hits','伤害'],['health','生命'],['heals','治疗'],['effects','效果'],['resources','资源'],['bonds','生命之契']];
export const teamProbabilityText=value=>typeof value==='number'?(value>0&&value<.0001?(value*100).toExponential(2):(value*100).toLocaleString('zh-CN',{maximumFractionDigits:2}))+'%':'—';

// Only damage contributions are averaged here. State fields remain joint values
// for a particular event; they never become an invented average combat path.
export function teamEventRows(trace){
 return trace.events.map(event=>{
  const first=event.states[0].value;
  let from=Infinity,to=-Infinity;
  for(const state of event.states){from=Math.min(from,state.value.time);to=Math.max(to,state.value.time);}
  const contributions=event.channel==='hits'?Object.fromEntries(['expectation','critical','non_critical'].map(key=>[key,event.states.reduce((sum,state)=>sum+state.probability*state.value[key],0)])):null;
  return {event,from,to,role:first.role,label:first.label??first.effectId??first.resource??first.kind??'',contributions};
 });
}
export const canRestoreTeamDpsResult=(saved,axis,engineRulesVersion)=>saved?.resultVersion===TEAM_DPS_RESULT_VERSION&&saved.engineRulesVersion===engineRulesVersion&&JSON.stringify(saved.axis)===JSON.stringify(axis);
export const teamDamageAnalysis=analysis=>Object.fromEntries(Object.entries(analysis).map(([field,values])=>[
 field,values&&typeof values==='object'&&!Array.isArray(values)&&Object.hasOwn(values,'compiled')?Object.fromEntries(Object.entries(values).map(([key,value])=>[key==='compiled'?'未分项合计':key,value])):values,
]));

// Saved tasks also support JSON-backed storage. Preserve IEEE sentinel values
// in results; all ordinary parameters retain their existing representation.
export function packTeamDpsResult(result){
 return copyResult(result,value=>typeof value==='number'&&(!Number.isFinite(value)||Object.is(value,-0))?{$teamNumber:Object.is(value,-0)?'-0':String(value)}:value);
}
export function unpackTeamDpsResult(result){
 return copyResult(result,value=>value&&typeof value==='object'&&Object.keys(value).length===1&&['NaN','Infinity','-Infinity','-0'].includes(value.$teamNumber)?Number(value.$teamNumber):value);
}
function copyResult(result,convert){
 const copies=new WeakMap();
 function copy(value){
  const converted=convert(value);if(converted!==value)return converted;
  if(value===null||typeof value!=='object')return value;
  if(copies.has(value))return copies.get(value);
  const out=Array.isArray(value)?[]:{};copies.set(value,out);
  if(Array.isArray(value))for(const item of value)out.push(item===undefined?null:copy(item));
  else for(const key of Object.keys(value))if(value[key]!==undefined)out[key]=copy(value[key]);
  return out;
 }
 return copy(result);
}
export function createTeamDpsResultPacker(){
 const packed=new WeakMap();
 return result=>{if(result===null)return null;if(!packed.has(result))packed.set(result,packTeamDpsResult(result));return packed.get(result);};
}

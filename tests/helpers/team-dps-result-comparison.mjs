import assert from 'node:assert/strict';
import {compileEventTrace,decodeEventTrace} from '../../beta-data/team-dps-event-trace.mjs';
import {scalarMath} from '../../beta-data/team-dps-numeric-rules.mjs';
// Numeric comparisons allow WASM accumulation roundoff; IDs/order stay exact.
export function compareTeamResults(actual,expected){
 assert.deepEqual(actual.artifacts,expected.artifacts);
 function visit(a,b,path){
  if(a===b)return;
  if(typeof a==='number'&&typeof b==='number'){
   assert.ok(Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(b)),`${path}: ${a} != ${b}`);
  }else if(a&&b&&typeof a==='object'&&typeof b==='object'){
   assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);
   for(const k of Object.keys(a))if(k!=='elapsed_ms'&&k!=='compile_ms')visit(a[k],b[k],path+'.'+k);
  }else assert.equal(a,b,path);
 }
 visit(actual,expected,'result');
}

const sum=values=>Object.values(values).reduce((a,b)=>a+b,0);
const close=(a,b)=>Object.is(a,b)||typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(a),Math.abs(b));
function equal(a,b){if(close(a,b))return true;if(a&&b&&typeof a==='object'&&typeof b==='object'){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));}return false;}
export function nativeEventTrace(result){
 const plan=compileEventTrace(result,scalarMath);
 assert.ok(plan.groups.every(group=>group.nodes.length===0&&group.mass.node===undefined),'native reference must contain concrete states');
 return decodeEventTrace(plan,plan.groups.map(group=>group.mass.constant?[{values:[],probability:group.mass.constant}]:[]));
}
function stateProjection(channel,row){
 const fields={hits:['time','role','expectation','critical','non_critical','fanfare','furina_overflow','hp_ratios','atk','hp','crit','crit_damage','bonus','flat','def','res'],health:['time','ratios','hp','maxHP','fanfare','overflow','active','consumedRoles'],heals:['time','role','amount','amounts','rawAmounts','overheals','absorbedAmounts','hpRecipients','healedRecipients'],bonds:['time','role','amount','ratio'],effects:['time','generation','stacks','stackExpiries','stackCaptures','used','before','after','expires','captures'],resources:['time','role','before','after','amount']};
 const value=Object.fromEntries(fields[channel].filter(k=>row[k]!==undefined).map(k=>[k,k==='active'?Number(row[k]):row[k]]));
 if(channel==='hits')value.analysis=Object.fromEntries(Object.entries(row.analysis).filter(([,v])=>v&&typeof v==='object').map(([k,v])=>[k,k==='normal'?v:sum(v)]));
 return value;
}
export function compareEventValues(actual,expected){
 const groups=trace=>{const map=new Map();for(const event of trace.events){const first=event.states[0].value,key=event.channel+'/'+event.eventId+'/'+(first.effectId??'')+'/'+(first.kind??'');if(!map.has(key))map.set(key,[]);const rows=map.get(key);for(const state of event.states){const value=stateProjection(event.channel,state.value),found=rows.find(row=>equal(row.value,value));if(found)found.probability+=state.probability;else rows.push({probability:state.probability,value});}}return map;};
 const left=groups(actual),right=groups(expected);assert.deepEqual([...left.keys()].sort(),[...right.keys()].sort());
 for(const [key,rows]of left){const other=right.get(key);assert.equal(rows.length,other.length,key+' state count');for(const row of rows){const found=other.find(v=>equal(row.value,v.value));assert.ok(found,key+' joint values');assert.ok(close(row.probability,found.probability),key+' probability');}}
}
// Native diagnostics have named stat contributions and legacy branch arrays.
// Compiled diagnostics expose joint event states and aggregate native terms.
// Compare their numerical contract explicitly; same-format comparisons above
// remain full-tree checks, including every event field and its identity.
export function compareNativeTeamResults(actual,expected){
 const row=value=>value===null?null:Object.fromEntries(['expectation','critical','non_critical','total_damage','fanfare','furina_overflow','duration','dps','character_damage','profiles','artifacts','panels'].filter(k=>Object.hasOwn(value,k)).map(k=>[k,k==='panels'?value.panels.map(panel=>Object.fromEntries(Object.entries(panel).map(([s,v])=>[s,sum(v)]))):value[k]]));
 const normalize=value=>{const out={...value,baseline:row(value.baseline),results:value.results.map(row)};delete out.compile_ms;delete out.compute_backend;return out;};
 compareTeamResults(normalize(actual),normalize(expected));
 for(const [a,b]of [[actual.baseline,expected.baseline],...actual.results.map((v,i)=>[v,expected.results[i]])])if(b&&Object.hasOwn(b,'hits')){assert.ok(a.eventTrace,'compiled details required');compareEventValues(a.eventTrace,nativeEventTrace(b));}
}

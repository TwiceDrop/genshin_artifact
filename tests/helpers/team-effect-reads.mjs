import {createEffectState} from '../../beta-data/team-engine/effect-state.mjs';
import {createEffectResolver} from '../../beta-data/team-engine/effect-resolver.mjs';
export const readEvent=(time,kind='hit',extra={})=>({eventId:kind+'/'+time,time,rootOrder:0,order:0,kind,role:0,action:'skill',category:'normal',element:'Cryo',...extra});
export const snapshotDefinition={id:'test.snapshot',label:'测试快照',stage:'damage',target:'team',trigger:{kind:'cast',action:'skill'},duration:10,reads:{attack:{stat:'atk',stage:'attack',timing:'activation'}},value:({read})=>({ExtraDmgBase:read('attack')})};
export const readPlan=definition=>({sources:[{definition,role:0,key:definition.id+'/source',actorId:'source'}],schedule:[],settings:{damage_scope:'all',enemy_count:1},rotation:{model:'actions',activeRole:()=>0}});
export const readValue=(resolver,e,read=()=>{throw Error('激活快照不应在查询时读取属性');})=>resolver.resolve('damage',0,e,read).reduce((n,b)=>n+b.config.ExtensionEffect.values.ExtraDmgBase,0);
export function snapshotOutputs(m,inputs){
 const plan=readPlan(snapshotDefinition),state=createEffectState(plan,{math:m,events:[],enabled:()=>1,read:(_role,_dependency,e)=>e.time===0?inputs[0]:inputs[2]});
 const resolver=createEffectResolver(plan,state,m),value=e=>resolver.resolve('damage',0,e).reduce((n,b)=>m.add(n,b.config.ExtensionEffect.values.ExtraDmgBase),0);
 state.publish(readEvent(0,'cast',{enabled:inputs[1]}));state.publish(readEvent(2,'cast',{enabled:inputs[3]}));
 return [value(readEvent(1)),value(readEvent(3)),value(readEvent(11)),value(readEvent(12)),state.at(plan.sources[0],readEvent(-1)).captures.attack];
}

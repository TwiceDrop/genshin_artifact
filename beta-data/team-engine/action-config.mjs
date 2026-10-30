import {TEAM_ACTION_CATALOG} from './action-catalog.mjs';
import {compileActionAxis} from './timeline.mjs';
export {TEAM_ACTION_CATALOG};
export {actionAxisTimeline} from './action-timing.mjs';
export const TEAM_ACTION_RULES_VERSION='mona-team-engine/31';
export function createActionAxis(id,characters){
 const members=characters.map((character,i)=>({slot:'member'+(i+1),character}));
 return {format:'mona-action-axis',formatVersion:1,rulesVersion:TEAM_ACTION_RULES_VERSION,id,title:'新动作轴',endHit:'include',initialActiveSlot:members[0].slot,members,timeline:[]};
}
export function actionAxisDurationMs(c,profiles){
 const members=profiles??c.members.map(m=>({character:{name:m.character,level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9},weapon:{name:''}}));
 return compileActionAxis(c,members).duration*1000;
}
// The action format has its own data contract; legacy coverage is not migrated.
export function validateActionAxis(c){
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 if(c.formatVersion!==1)throw Error('不支持的计算配置格式或版本');
 if(typeof c.id!=='string'||!c.id||typeof c.title!=='string'||!c.title)throw Error('计算配置缺少ID或名称');
 if(!['include','exclude'].includes(c.endHit))throw Error('轴尾命中设置无效');
 if(!Array.isArray(c.members)||c.members.length!==4||c.members.some(m=>!TEAM_ACTION_CATALOG[m.character]||typeof m.slot!=='string')||new Set(c.members.map(m=>m.slot)).size!==4||new Set(c.members.map(m=>m.character)).size!==4)throw Error('需要4位已登记动作规则的不同角色');
 const slots=c.members.map(m=>m.slot),ids=new Set();
 if(!slots.includes(c.initialActiveSlot)||!Array.isArray(c.timeline))throw Error('缺少初始前台或事件列表');
 for(const e of c.timeline){
  if(typeof e.id!=='string'||ids.has(e.id)||!finite(e.timeMs)||e.timeMs<0||!slots.includes(e.actor))throw Error('事件ID、时间或角色位无效：'+e.id);
  ids.add(e.id);
  if(!['switch','action'].includes(e.kind))throw Error('未实现的事件类型：'+e.kind);
  const name=c.members[slots.indexOf(e.actor)].character,entry=TEAM_ACTION_CATALOG[name].find(a=>a.id===e.action);
  if(e.kind==='action'&&!entry)throw Error('未实现或角色不符的动作：'+name+'/'+e.action);
  if(e.when&&((e.when.slot!==undefined&&!slots.includes(e.when.slot))||!Number.isInteger(e.when.constellationAtLeast)||e.when.constellationAtLeast<0||e.when.constellationAtLeast>6))throw Error('命座条件无效：'+e.id);
  const known=Object.values(TEAM_ACTION_CATALOG).flatMap(actions=>actions.flatMap(a=>a.parameters||[]));
  for(const field of known){
   const value=e.params?.[field.key];
   if(value!==undefined&&(!entry?.parameters?.some(p=>p.key===field.key)||!finite(value)||field.integer&&!Number.isInteger(value)||value<field.min||value>field.max))throw Error(field.error+'：'+e.id);
  }
 }
 return c;
}

import {validateActionAxis} from './team-engine/action-config.mjs';
// Mechanics metadata only: no default rotation is installed or loaded here.
export const TEAM_DPS_ROLES=['Skirk','Furina','Escoffier','Vodyanitsa'];
export const TEAM_DPS_SLOTS=['Flower','Feather','Sand','Goblet','Head'];
export const TEAM_DPS_MECHANICS='skirk-hydro-cryo/1';
export const TEAM_DPS_CHARACTER_CAPABILITIES={
 Skirk:{energy:0,shield:false,nightsoul:false,arkhe:false},Furina:{energy:60,shield:false,nightsoul:false,arkhe:true},
 Escoffier:{energy:70,shield:false,nightsoul:false,arkhe:true},Vodyanitsa:{energy:60,shield:false,nightsoul:false,arkhe:false},
 Mona:{energy:60,shield:false,nightsoul:false,arkhe:false},
 Mavuika:{energy:0,shield:false,nightsoul:true,arkhe:false},
 Amber:{energy:40,shield:false,nightsoul:false,arkhe:false},Noelle:{energy:60,shield:true,nightsoul:false,arkhe:false},
 Kirara:{energy:60,shield:true,nightsoul:false,arkhe:false},
};
export const TEAM_DPS_REACTIONS={Frozen:['Cryo','Hydro'],Melt:['Cryo','Pyro'],Vaporize:['Hydro','Pyro'],Superconduct:['Cryo','Electro'],ElectroCharged:['Hydro','Electro'],Overloaded:['Pyro','Electro'],Bloom:['Hydro','Dendro'],Quicken:['Dendro','Electro'],Aggravate:['Dendro','Electro'],Spread:['Dendro'],Hyperbloom:['Dendro','Electro'],Burgeon:['Dendro','Pyro'],Burning:['Dendro','Pyro']};
export const TEAM_DPS_ACTIONS={
 'furina.skill':{role:1,index:9,category:'skill',parts:1},
 'furina.burst':{role:1,index:14,category:'burst',parts:1},
 'furina.salon.madame':{role:1,index:11,category:'skill',parts:1,hpDrain:.016},
 'furina.salon.usher':{role:1,index:10,category:'skill',parts:1,hpDrain:.024},
 'furina.salon.crab':{role:1,index:12,category:'skill',parts:1,hpDrain:.036},
 'furina.c6.normal':{role:1,index:0,category:'normal',parts:1},
 'furina.normal.1':{role:1,index:0,category:'normal',parts:1},
 'furina.charged':{role:1,index:4,category:'charged',parts:1},
 'furina.plunge':{role:1,index:7,category:'plunge',parts:1},
 'escoffier.skill':{role:2,index:8,category:'skill',parts:1},
 'escoffier.burst':{role:2,index:9,category:'burst',parts:1},
 'escoffier.c6':{role:2,index:8,category:'skill',parts:1,ratio:5},
 'escoffier.normal.1':{role:2,index:0,category:'normal',parts:1,element:'Physical'},
 'escoffier.charged':{role:2,index:3,category:'charged',parts:1,element:'Physical'},
 'escoffier.plunge':{role:2,index:6,category:'plunge',parts:1,element:'Physical'},
 'vodyanitsa.skill':{role:3,index:8,category:'skill',parts:1},
 'vodyanitsa.horn':{role:3,index:9,category:'skill',parts:1},
 'vodyanitsa.normal.1':{role:3,index:0,category:'normal',parts:1},
 'vodyanitsa.charged':{role:3,index:4,category:'charged',parts:1},
 'vodyanitsa.plunge':{role:3,index:7,category:'plunge',parts:1},
 'skirk.normal.1':{role:0,index:9,category:'normal',parts:1,element:'Cryo'},
 'skirk.normal.2':{role:0,index:10,category:'normal',parts:1,element:'Cryo'},
 'skirk.normal.3':{role:0,index:11,category:'normal',parts:2,element:'Cryo'},
 'skirk.normal.4':{role:0,index:12,category:'normal',parts:2,element:'Cryo'},
 'skirk.normal.5':{role:0,index:13,category:'normal',parts:1,element:'Cryo'},
 'skirk.charged':{role:0,index:14,category:'charged',parts:3,element:'Cryo'},
 'skirk.c1':{role:0,index:14,category:'charged',parts:1,ratio:5,element:'Cryo'},
 'skirk.c6':{role:0,index:9,category:'normal',parts:1,hits:3,ratio:1.8,c6:true,element:'Cryo'},
};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function parseTeamDpsConfiguration(text){return validateTeamDpsConfiguration(JSON.parse(text));}
export function validateTeamDpsConfiguration(c){
 if(c?.format==='mona-action-axis')return validateActionAxis(c);
 if(c?.format!=='mona-team-axis'||c.formatVersion!==1)throw Error('不支持的计算配置格式或版本');
 if(c.mechanics!==TEAM_DPS_MECHANICS)throw Error('未实现的机制适配：'+c.mechanics);
 if(typeof c.id!=='string'||!c.id||typeof c.title!=='string'||!c.title||!Number.isInteger(c.revision)||c.revision<1)throw Error('计算配置缺少ID、名称或修订号');
 if(!finite(c.durationMs)||c.durationMs<=0||!['include','exclude'].includes(c.endHit))throw Error('轴长或轴尾命中设置无效');
 if(!Array.isArray(c.members)||c.members.length!==4||c.members.some((m,r)=>m.character!==TEAM_DPS_ROLES[r]||typeof m.slot!=='string')||new Set(c.members.map(m=>m.slot)).size!==4)throw Error('当前机制适配需要丝柯克、芙宁娜、爱可菲、沃雅妮莎四个角色位');
 const slots=c.members.map(m=>m.slot),validTime=t=>finite(t)&&t>=0&&t<=c.durationMs;
 if(!slots.includes(c.initialActiveSlot)||!Array.isArray(c.timeline))throw Error('缺少初始前台或事件列表');
 const ids=new Set();
 for(const e of c.timeline){
  if(typeof e.id!=='string'||ids.has(e.id)||!validTime(e.timeMs)||!slots.includes(e.actor))throw Error('事件ID、时间或角色位无效：'+e.id);ids.add(e.id);
  if(!['switch','cast','hit','heal','reaction','hp_change','state','sprint','aim','pickup'].includes(e.kind))throw Error('未实现的事件类型：'+e.kind);
  if(e.kind==='cast'&&!['skill','burst'].includes(e.action))throw Error('未实现的施放类型：'+e.action);
  if(e.kind==='hit'&&(!TEAM_DPS_ACTIONS[e.action]||TEAM_DPS_ACTIONS[e.action].role!==slots.indexOf(e.actor)))throw Error('未实现或角色不符的命中：'+e.action);
  if(e.kind==='heal'&&!['team','active'].includes(e.recipients))throw Error('未实现的治疗对象：'+e.recipients);
  if(e.kind==='reaction'&&!TEAM_DPS_REACTIONS[e.reaction])throw Error('未实现的反应：'+e.reaction);
  if(e.kind==='hp_change'&&!['increase','decrease','damage'].includes(e.change))throw Error('未实现的生命变化：'+e.change);
  if(e.kind==='state'&&(!['nightsoul','shield','cryo_aura','frozen'].includes(e.state)||!finite(e.durationMs)||e.durationMs<=0))throw Error('未实现的状态或持续时间：'+e.state);
  if(e.repeat&&(!Number.isInteger(e.repeat.count)||e.repeat.count<1||!finite(e.repeat.intervalMs)||e.repeat.intervalMs<0))throw Error('重复事件次数或间隔无效：'+e.id);
  if(e.when&&(!slots.includes(e.when.slot)||!Number.isInteger(e.when.constellationAtLeast)||e.when.constellationAtLeast<0||e.when.constellationAtLeast>6))throw Error('命座条件无效：'+e.id);
 }
 for(const role of [0,1,2,3])if(!c.timeline.some(e=>e.kind==='cast'&&e.action==='skill'&&e.actor===slots[role]))throw Error('缺少战技施放时间：'+slots[role]);
 for(const role of [0,1,2])if(!c.timeline.some(e=>e.kind==='cast'&&e.action==='burst'&&e.actor===slots[role]))throw Error('缺少爆发施放时间：'+slots[role]);
 for(const key of ['fanfare','skirkC2','vodyFlat','escoFlat']){
  const w=c.coverage?.[key];if(!w||!finite(w.startMs)||!finite(w.endMs)||w.startMs<0||w.endMs<=w.startMs)throw Error('覆盖区间无效：'+key);
 }
 for(const [obj,keys]of [[c.coverage.vodyFlat,['frontUses','backUses']],[c.coverage.escoFlat,['uses']],[c.coverage.deathCrossing,['startNormal','uses']]])
  for(const k of keys)if(!Number.isInteger(obj?.[k])||obj[k]<0)throw Error('有限次数设置无效：'+k);
 return c;
}

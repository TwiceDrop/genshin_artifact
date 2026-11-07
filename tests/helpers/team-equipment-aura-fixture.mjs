import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
import {compareEvents} from '../../beta-data/team-engine/event-order.mjs';
import {originalCryoInput} from './team-original-cryo-fixture.mjs';
export function stellarEquipmentInput(){const input=originalCryoInput(true);input.single_interfaces[2].artifacts.forEach(a=>a.set_name='DisenchantmentInDeepShadow');return input;}
export function stellarEquipmentTeams(input){const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);b.forEach(build=>build.forEach(a=>a.id+=10000));b[2].slice(2).forEach(a=>a.set_name='Empty');return [a,b,a];}
export function equipmentAuraInput(){
 const names=['Qiqi','YaeMiko','Furina','Escoffier'],profiles=names.map((name,r)=>{const p=fixture(name);p.character.constellation=r===0?2:0;if(r===0){p.character.level=20;p.character.ascend=false;}p.weapon=weapon(r===0?'CoolSteel':r===1?'MagicGuide':characterPackages[name].previewWeapon);p.artifacts=p.artifacts.map((a,i)=>({...a,id:r*100+i+1,set_name:['BlizzardStrayer','Thundersoother','Instructor','GildedDreams'][r],main_stat:['HPFixed',0],sub_stats:[]}));return p;});
 const axis=createActionAxis('equipment-target-aura',names),a=(id,r,action,timeMs)=>({id,actor:'member'+(r+1),kind:'action',action,timeMs});
 axis.timeline=[a('n0',0,'normal.1',0),a('eq',3,'burst',100),a('n1',0,'normal.1',200),a('fe',2,'skill',300),a('n2',0,'normal.1',700),a('yn1',1,'normal.1',800),a('n3',0,'normal.1',1500),a('yn2',1,'normal.2',1600),{id:'end',actor:'member1',kind:'switch',timeMs:2000}];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:2,damage_scope:'all',initial_hp:[1,1,1,1],frozen:true}};
}
export function equipmentAuraTeams(input){const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);b.forEach(build=>build.forEach(a=>{a.id+=10000;}));b[2].forEach(a=>a.set_name='Empty');b[1].forEach(a=>a.set_name='DisenchantmentInDeepShadow');return [a,b,a];}
export function equipmentAuraEvaluator(api,input,execution={}){return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{
 const p=compileActionAxis(...args),role=name=>input.single_interfaces.findIndex(p=>p.character.name===name);
 for(const e of p.events){
  if(e.role===role('Escoffier')||e.role===role('Furina'))e.targetIds=[0];
  if(e.role===role('Furina'))e.enabled=execution.setCount?execution.math.ge(execution.setCount(e.role,'Instructor'),4):input.testHydro??1;
  if(e.eventId.startsWith('n2/'))e.statSnapshot={time:0,rootOrder:-1,order:-1,onField:true};
 }
 for(const [id,extra]of [['physical',{}],['fixed',{fixed:1000,noCrit:true,ignoreDefense:true}]])p.events.push({kind:'hit',eventId:'equipment/'+id,damageModel:'equipment.physical',role:role('Qiqi'),time:1.4,rootOrder:600,order:0,category:'equipment',element:'Physical',stat:'atk',ratio:1,label:'合成装备·'+id,...extra});
 p.events.sort(compareEvents);
 return p;
}});}

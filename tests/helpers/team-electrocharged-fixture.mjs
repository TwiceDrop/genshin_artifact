import {fixture,weapon} from '../../beta-tools/interface-audit-7108.mjs';
import {createActionAxis} from '../../beta-data/team-engine/action-config.mjs';
import {characterPackages} from '../../beta-data/team-engine/character-packages.mjs';
import {normalizeEnemy} from '../../beta-data/enemy-interface.mjs';
import {createTeamDpsEvaluator} from '../../beta-data/team-dps-evaluator.mjs';
import {compileActionAxis} from '../../beta-data/team-engine/timeline.mjs';
export function electrochargedInput(){
 const names=['Furina','YaeMiko','Qiqi','Mona'],axis=createActionAxis('electrocharged-real-party',names);
 const profiles=names.map((name,r)=>{const p=fixture(name);p.character.constellation=0;p.weapon=weapon(characterPackages[name].previewWeapon);p.artifacts=p.artifacts.map((a,i)=>({...a,id:r*100+i+1,set_name:'Empty',main_stat:['HPFixed',0],sub_stats:[]}));return p;});
 axis.timeline=[{id:'fq',actor:'member1',kind:'action',action:'burst',timeMs:0},{id:'yn',actor:'member2',kind:'action',action:'normal.1',timeMs:2100},{id:'fe',actor:'member1',kind:'action',action:'skill',timeMs:2900},{id:'end',actor:'member1',kind:'switch',timeMs:4000}];
 return {single_interfaces:profiles,team_dps:{axis,enemy:normalizeEnemy({level:100}),enemy_count:2,damage_scope:'all',initial_hp:[1,1,1,1]}};
}
export function electrochargedTeams(input){const a=input.single_interfaces.map(p=>p.artifacts),b=structuredClone(a);a[1].forEach(a=>{a.set_name='GladiatorsFinale';});b.forEach(build=>build.forEach(a=>{a.id+=10000;}));b[1][0].sub_stats=[['ElementalMastery',500]];return [a,b,a];}
export function gatedElectrochargedEvaluator(api,input,execution={}){return createTeamDpsEvaluator(api,input,{...execution,compileRotation:(...args)=>{const plan=compileActionAxis(...args);for(const e of plan.events)if(e.eventId.startsWith('yn/'))e.enabled=execution.setCount?execution.math.ge(execution.setCount(e.role,'GladiatorsFinale'),4):input.testElectroEnabled??1;return plan;}});}
// The application snapshots before the ensuing reaction activates these
// effects. A later Hydro application captures their new source values.
export function installElectrochargedEffects(){
 const owner=characterPackages.YaeMiko,old=owner.effects;
 owner.effects=(...args)=>[...(old?.(...args)??[]),{id:'test.ec.em',label:'感电事实后的精通',stage:'attack',target:'team',trigger:{kind:'reaction',reactionType:'ElectroCharged'},duration:8,reads:{},value:()=>({ElementalMastery:500})},
 {id:'test.ec.bonus',label:'感电事实后的反应增益',stage:'damage',target:'team',trigger:{kind:'reaction',reactionType:'ElectroCharged'},duration:8,reads:{},value:()=>({EnhanceElectroCharged:.5})}];
 return ()=>{if(old)owner.effects=old;else delete owner.effects;};
}

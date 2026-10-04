import fs from 'node:fs';
import {api,read} from './runtime-7106.mjs';
import {defaultDamageReaction,visibleDamageReactionKeys} from '../src/algorithms/reaction-labels.mjs';
import {createDamageEvaluator} from '../src/algorithms/stat-gain/curve.mjs';
export const chars=read('src/assets/_gen_character.js'),targets=read('src/assets/_gen_tf.js'),weapons=read('src/assets/_gen_weapon.js'),buffs=read('src/assets/_gen_buff.js'),sets=read('src/assets/_gen_artifact.js');
export const config=(name,rows)=>rows?.length?{[name]:Object.fromEntries(rows.map(c=>[c.name,c.default]))}:'NoConfig';
export const gear=['Flower','Feather','Sand','Goblet','Head'].map((slot,i)=>({id:i+1,set_name:'GladiatorsFinale',slot,level:20,star:5,main_stat:[i===0?'HPFixed':i===1?'ATKFixed':'ATKPercentage',i===0?4780:i===1?311:.466],sub_stats:[['Recharge',.2],['ElementalMastery',20]]}));
export function fixture(name='Kaeya',targetName){const c=chars[name],t=targets[targetName]||Object.values(targets).find(t=>t.for===name)||targets.MaxATK;return {character:{name,level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:config(name,c.config)},weapon:{name:{Sword:'DullBlade',Claymore:'WasterGreatsword',Polearm:'BeginnersProtector',Bow:'HuntersBow',Catalyst:'ApprenticesNotes'}[c.weapon],level:90,ascend:false,refine:1,params:'NoConfig'},skill:{index:0,config:config(name,c.configSkill)},artifacts:structuredClone(gear),target_function:{name:t.name,params:config(t.name,t.config),use_dsl:false,dsl_source:''},constraint:{set_mode:'Any'},enemy:null,buffs:[],artifact_config:null,algorithm:'Naive'};}
export function optimizer(x){const {skill,artifacts,...out}=x;return out;}
export function namedBuff(name){return {name,config:config(name,buffs[name].config)};}
export function weapon(name){return {name,level:90,ascend:false,refine:1,params:config(name,weapons[name].configs)};}
function finiteDamage(r){for(const [k,v]of Object.entries(r))if(v&&typeof v==='object'&&'expectation' in v&&!Number.isFinite(v.expectation))throw Error('nonfinite '+k);}
export function runInterfaceAudit(){const report={counts:{},failures:[],observations:[]};const log=console.log;console.log=()=>{};
function check(group,label,fn){report.counts[group]=(report.counts[group]||0)+1;try{fn()}catch(e){report.failures.push({group,label,error:e.message})}}
for(const name of Object.keys(chars)){
 const x=fixture(name);check('character.attribute',name,()=>api.CommonInterface.get_attribute(x));check('character.transformative',name,()=>api.CalculatorInterface.get_transformative_damage(x));
 check('character.bonus',name,()=>api.BonusPerStat.bonus_per_stat({...x,tf:x.target_function,artifacts_config:x.artifact_config}));
 check('character.rank',name,()=>api.CommonInterface.get_artifacts_rank_by_character(x.character,x.weapon,x.target_function,x.artifacts));
 check('character.dsl',name,()=>{const r=api.DSLInterface.run('print(1)',x,x.artifacts);if(r.is_error)throw Error(r.error_msg)});
 for(const index of new Set([...(chars[name].skillMap1||[]),...(chars[name].skillMap2||[]),...(chars[name].skillMap3||[])].map(s=>s.index))){x.skill.index=index;check('skill.display',name+'/'+index,()=>{const r=api.CalculatorInterface.get_damage_analysis(x,null);finiteDamage(r);const shown=visibleDamageReactionKeys(r),selected=defaultDamageReaction(r);if(selected&&!shown.includes(selected))report.observations.push({group:'wrongDefault',name,index,shown,selected});});}
}
for(const [name,w]of Object.entries(weapons)){
 const roles={Sword:'Kaeya',Claymore:'Diluc',Bow:'Amber',Catalyst:'Lisa',Polearm:'Xiangling'};const x=fixture(roles[w.type]);x.weapon=weapon(name);
 check('weapon.damage',name,()=>finiteDamage(api.CalculatorInterface.get_damage_analysis(x,null)));
 check('weapon.optimize',name,()=>{if(!api.OptimizeSingleWasm.optimize(optimizer(x),gear).length)throw Error('empty')});
 if(['NightweaversLookingGlass','ReliquaryOfTruth'].includes(name))check('weapon.panel',name,()=>{const p=createDamageEvaluator(api,x,'normal',null,['ATKPercentage'],'average').panel({ATKPercentage:0});const invalid=Object.entries(p).filter(([k,v])=>typeof v!=='number'||!Number.isFinite(v));if(invalid.length)throw Error(JSON.stringify(invalid))});
}
for(const name of Object.values(sets).map(s=>s.name2))for(const role of ['Kaeya','Vodyanitsa','Vesna']){const x=fixture(role);x.artifacts=gear.map(a=>({...a,set_name:name}));check('set.damage',role+'/'+name,()=>finiteDamage(api.CalculatorInterface.get_damage_analysis(x,null)));check('set.optimize',role+'/'+name,()=>api.OptimizeSingleWasm.optimize(optimizer(x),x.artifacts));}
for(const name of Object.keys(buffs))for(const role of ['Kaeya','Vodyanitsa','Vesna']){const x=fixture(role);x.buffs=[namedBuff(name)];check('buff.damage',role+'/'+name,()=>finiteDamage(api.CalculatorInterface.get_damage_analysis(x,null)));check('buff.optimize',role+'/'+name,()=>api.OptimizeSingleWasm.optimize(optimizer(x),x.artifacts));if(role==='Kaeya')check('buff.dsl',name,()=>{const r=api.DSLInterface.run('prop p = Kaeya.atk\nprint(p)',x,x.artifacts);if(r.is_error)throw Error(r.error_msg);const expected=Object.values(api.CommonInterface.get_attribute(x).atk).reduce((a,b)=>a+b,0);if(Math.abs(Number(r.output.trim())-expected)>.01)throw Error('ATK mismatch '+r.output.trim()+' vs '+expected)});}
const pf=read('src/assets/_gen_pf.js').ArtifactEff;check('potential','ArtifactEff',()=>api.PotentialInterface.get_potential(gear,{name:pf.name,config:config(pf.name,pf.config)}));
console.log=log;fs.writeFileSync('.build-target/interface-audit/report.json',JSON.stringify(report,null,2));return report;}
if(process.argv.includes('--run')){const r=runInterfaceAudit();console.log(JSON.stringify({counts:r.counts,failures:r.failures,observations:r.observations},null,2));}

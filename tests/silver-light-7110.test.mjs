import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import source from '../beta-data/silver-light-release-71.json' with {type:'json'};
import {expandedWeaponStats,expandedWeaponEffects,normalizeExpandedWeapon} from '../beta-data/expanded-weapons.mjs';
import {api,sum,vesna} from '../beta-tools/runtime-7106.mjs';
import {fixture,optimizer,gear} from '../beta-tools/interface-audit-7108.mjs';
import {scoreBuild,panelScoreAttributes} from '../src/algorithms/artifact-score/score.mjs';
const near=(a,b,label='')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
const weapon=(level=90,ascend=false,refine=5,stacks=2)=>({name:'SilverLight',level,ascend,refine,params:{SilverLight:{stacks}}});
const report={sources:source.sources,revision:source.revision,checks:[]};
function quiet(fn){const log=console.log;console.log=()=>{};try{return fn()}finally{console.log=log}}
function gain(x){return api.BonusPerStat.bonus_per_stat({...x,tf:x.target_function,artifacts_config:x.artifact_config});}
function sameNumbers(a,b){for(const [key,value]of Object.entries(b)){if(typeof value==='number')near(a[key],value,key);else if(value&&typeof value==='object')sameNumbers(a[key],value);else assert.equal(a[key],value,key);}}

test('Silver Light release stats, refinements, effective stacks and selector defaults',()=>quiet(()=>{
 assert.equal(source.revision.branch,'release');assert.equal(source.revision.version,'7.1.0');assert.equal(source.id,11438);
 assert.equal(source.levels.length,96);assert.deepEqual(source.refinements,[[52,12,2],[65,12,2],[78,12,2],[91,12,2],[104,12,2]]);
 assert.deepEqual(normalizeExpandedWeapon({...weapon(),params:'NoConfig'}).params.SilverLight,{stacks:0});
 for(const [refine,stacks,expected]of [[1,0,0],[1,1,52],[1,2,104],[5,2,208]])near(expandedWeaponEffects(weapon(90,false,refine,stacks)).elementalMastery,expected);
 const rows=[[1,false,42,.09],[20,false,109,.159],[20,true,135,.159],[90,false,510,.4135]];
 const x=fixture();x.artifacts=[];
 const bare=api.CommonInterface.get_attribute({...x,weapon:{name:'DullBlade',level:1,ascend:false,refine:1,params:'NoConfig'}});
 const characterAttack=sum(bare.atk)-23;
 for(const [level,ascend,attack,subStat]of rows){
  const stats=expandedWeaponStats(weapon(level,ascend));assert.equal(stats.attack,attack);assert.equal(stats.subStat,subStat);
  const panel=api.CommonInterface.get_attribute({...x,weapon:weapon(level,ascend)});
  near(sum(panel.atk),(characterAttack+attack)*(1+subStat),level+'/'+ascend+' ATK');near(sum(panel.elemental_mastery),208);
 }
 const raw=fs.readFileSync(new URL('../src/assets/_gen_weapon.js',import.meta.url),'utf8'),catalog=JSON.parse(raw.slice(raw.indexOf('{')));
 const zh=JSON.parse(fs.readFileSync(new URL('../src/i18n/generated/zh-cn.json',import.meta.url),'utf8')),en=JSON.parse(fs.readFileSync(new URL('../src/i18n/generated/en.json',import.meta.url),'utf8'));
 assert.equal(catalog.SilverLight.type,'Sword');assert.equal(catalog.SilverLight.star,4);assert.equal(zh[catalog.SilverLight.nameLocale],'银釭');assert.equal(en[catalog.SilverLight.nameLocale],'Silver Light');
 assert.deepEqual(catalog.SilverLight.configs,[{default:0,max:2,min:0,name:'stacks',title:1152,type:'int'}]);
 assert.ok(zh[catalog.SilverLight.effect].includes('52-65-78-91-104'));
 assert.equal(catalog.SilverLight.url,'/weapons/silver-light.png');
 assert.ok(fs.statSync(new URL('../public'+catalog.SilverLight.url,import.meta.url)).size>0);
 report.checks.push({name:'release formula/levels',refinements:source.refinements,rows:rows.map(([level,ascend,attack,subStat])=>({level,ascend,attack,subStat}))});
}));

test('Silver Light shares real legacy and extension damage, optimization, stat-gain, DSL and score consumers',()=>quiet(()=>{
 const candidates=[...gear,{...gear[3],id:6,main_stat:['ElementalMastery',187]}];
 const results=[];
 for(const role of ['Kaeya','Vesna']){
  const x=role==='Vesna'?{...fixture('Vesna','VesnaDefault'),character:structuredClone(vesna.character),skill:structuredClone(vesna.skill)}:fixture('Kaeya');
  x.weapon=weapon();x.enemy={level:100,cryo_res:.3,anemo_res:.1,physical_res:.2};
  if(role==='Kaeya'){x.skill.index=10;x.target_function={...x.target_function,use_dsl:true,dsl_source:'dmg hit = Kaeya.E1\nresult = hit.melt.e'};}
  const key=role==='Kaeya'?'melt':'direct_stellarswirl';
  const damage=y=>api.CalculatorInterface.get_damage_analysis(y,null)[key].expectation;
  const choices=[4,6].map(id=>{const artifacts=x.artifacts.map(a=>a.slot==='Goblet'?candidates.find(b=>b.id===id):a);return {id,value:damage({...x,artifacts})}}).sort((a,b)=>b.value-a.value);
  const original=structuredClone(x),panel=api.CommonInterface.get_attribute(x);
  const before=damage(x),zero=damage({...x,weapon:weapon(90,false,5,0)});assert.ok(before>zero,role+' EM passive must affect skill');
  for(const algorithm of ['Naive','AStar']){const result=api.OptimizeSingleWasm.optimize({...optimizer(x),algorithm},candidates)[0];assert.equal(result.goblet,choices[0].id);near(result.value,choices[0].value,role+'/'+algorithm);}
  const improved=structuredClone(x);improved.artifacts[0].sub_stats.push(['ElementalMastery',23]);near(gain(x).elemental_mastery[0],damage(improved)/before-1,role+' EM gain');
  const dsl=api.DSLInterface.run(`prop p = ${role}.em\nprint(p)`,x,x.artifacts);assert.equal(dsl.is_error,false,dsl.error_msg);near(Number(dsl.output.trim().replace(/^MONA: /,'')),sum(panel.elemental_mastery),role+' DSL');
  // Equivalent ordinary-EM BUFF confirms both kernels consume the effect once.
  const reference={...x,weapon:{name:'TheFlute',level:90,ascend:false,refine:5,params:'NoConfig'},buffs:[{name:'ElementalMastery',config:{ElementalMastery:{value:208}}},{name:'ATKPercentage',config:{ATKPercentage:{p:.05}}}]};
  near(damage(reference),before,role+' carrier parity');sameNumbers(gain(x),gain(reference));
  assert.deepEqual(x,original);results.push({role,expectation:before,withoutPassive:zero,em:sum(panel.elemental_mastery),selectedGoblet:choices[0].id});
 }
 const a={position:'flower',mainTag:{name:'lifeStatic',value:4780},normalTags:[{name:'attackPercentage',value:.058},{name:'recharge',value:.11}],setName:'GladiatorsFinale'};
 const kaeya=fixture();kaeya.weapon=weapon();
 const score=scoreBuild([a],{name:'凯亚',options:{weaponName:'银釭',weaponAffix:5,elem:'cryo',charAttrs:panelScoreAttributes(api.CommonInterface.get_attribute(kaeya))}});
 assert.equal(score.supported,true);assert.ok(Number.isFinite(score.total)&&score.total>0);
 report.checks.push({name:'actual public consumers',results,miaoScore:score.total});
 fs.mkdirSync('.build-target/silver-light-7110',{recursive:true});fs.writeFileSync('.build-target/silver-light-7110/evidence.json',JSON.stringify(report,null,2)+'\n');
}));

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {sample,builds,gear} from '../beta-tools/team-dps-full-audit.mjs';
import {weapon,weapons,chars} from '../beta-tools/interface-audit-7108.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {createTeamConstraintBounds} from '../beta-data/team-dps-constraint-bounds.mjs';
import {optimizeTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {nodeTeamDps} from './helpers/team-dps-node-pool.mjs';
import {compareTeamResults} from './helpers/team-dps-result-comparison.mjs';
const fields=[['recharge','recharge_min'],['critical','crit_min'],['critical_damage','crit_damage_min'],['elemental_mastery','em_min']];
const slots=['Flower','Feather','Sand','Goblet','Head'];
const poolsOf=x=>x.single_interfaces.map(p=>slots.map((slot,k)=>builds(x).flat().filter(a=>a.slot===slot&&(k<2||p.filter[['sand_main_stat','goblet_main_stat','head_main_stat'][k-2]].includes(a.main_stat[0])))));
const save=(name,value)=>fs.writeFileSync('.build-target/team-dps-gpu-kernel-20261027/'+name+'.json',JSON.stringify(value,null,2));

export function constrainedSample(){
 const x=sample(),mains=[['ATKPercentage','HPPercentage','Recharge','ElementalMastery'],['CryoBonus','HydroBonus','ATKPercentage','HPPercentage'],['CriticalRate','CriticalDamage','HealingBonus','HPPercentage']];
 for(let r=0;r<4;r++){
  const p=x.single_interfaces[r];p.artifacts=gear(r,['GladiatorsFinale','EmblemOfSeveredFate','OceanHuedClam','SongOfDaysPast'][r]);
  p.weapon=weapon(['ToukabouShigure','XiphosMoonlight','CrescentPike','FlowingPurity'][r]);
  for(let k=2;k<5;k++)p.artifacts[k].main_stat=[mains[k-2][r],.2];
  p.artifacts[0].sub_stats.push(['ElementalMastery',r*100]);
  p.filter=Object.fromEntries(['sand_main_stat','goblet_main_stat','head_main_stat'].map((key,k)=>[key,[mains[k][r]]]));
 }
 x.single_interfaces[2].character.constellation=1;x.single_interfaces[2].constraint.set_mode={Set4:'OceanHuedClam'};
 const out=createTeamDpsEvaluator(api,x).evaluate(builds(x));x.single_interfaces[2].constraint.recharge_min=sum(out.panels[2].recharge)+.005;
 Object.assign(x.team_dps,{initial_ids:builds(x).map(b=>b.map(a=>a.id)),max_evaluations:65536,result_count:5,enemy_count:3,damage_scope:'all'});
 return x;
}
function* permutations(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*permutations(a.filter((_,j)=>i!==j),[...p,a[i]]);}

test('bounds: complete assignments, exact thresholds, conversion and top K match unpruned oracle',async()=>{
 const x=constrainedSample(),inventory=builds(x).flat(),pools=poolsOf(x),bound=createTeamConstraintBounds(api,x,pools),ev=createTeamDpsEvaluator(api,x),legal=[];
 let total=0;const root=bound.upper(pools);
 for(const f of permutations(inventory.filter(a=>a.slot==='Flower')))for(const g of permutations(inventory.filter(a=>a.slot==='Feather'))){
  const team=builds(x).map((b,r)=>[f[r],g[r],...b.slice(2)]),panels=team.map((_,r)=>ev.constraints(r,team));total++;
  for(let r=0;r<4;r++)for(const [key]of fields)assert.ok(root[r][key]>=sum(panels[r][key]),'root '+r+'/'+key);
  if(team[2].filter(a=>a.set_name==='OceanHuedClam').length<4||sum(panels[2].recharge)<x.single_interfaces[2].constraint.recharge_min)continue;
  assert.ok(bound.feasible(team.map(b=>b.map(a=>[a]))));
  legal.push({...ev.evaluate(team),key:team.flat().map(a=>a.id).join(',')});
 }
 assert.equal(total,576);assert.equal(legal.length,12);
 const outputs=[];
 for(const metric of ['expectation','critical','non_critical']){
  x.team_dps.metric=metric;const out=optimizeTeamDps(api,x,inventory),expected=legal.slice().sort((a,b)=>Number(b[metric].toPrecision(12))-Number(a[metric].toPrecision(12))||a.key.localeCompare(b.key)).slice(0,5);
  assert.equal(out.search_complete,true);assert.equal(out.evaluated_teams,13);
  assert.equal(out.feasible_teams,12);assert.equal(out.legal_teams,12);
  assert.deepEqual(out.results.map(row=>row.artifacts.flatMap(a=>slots.map(s=>a[s.toLowerCase()])).join(',')),expected.map(r=>r.key));
  for(let i=0;i<5;i++)assert.ok(Math.abs(out.results[i][metric]-expected[i][metric])<1e-7);
  outputs.push({metric,evaluated:out.evaluated_teams,...out.search_stats});
 }
 const serial=optimizeTeamDps(api,x,inventory),parallel=await nodeTeamDps(x,inventory,{threads:4});compareTeamResults(parallel,serial);
 const exact=structuredClone(x),exactTeam=builds(exact),exactPanels=exactTeam.map((_,r)=>createTeamDpsEvaluator(api,exact).constraints(r,exactTeam));
 exact.single_interfaces.forEach((p,r)=>{p.constraint.set_mode='Any';for(const [key,field]of fields)p.constraint[field]=sum(exactPanels[r][key]);});
 assert.ok(createTeamConstraintBounds(api,exact,poolsOf(exact)).feasible(exactTeam.map(b=>b.map(a=>[a]))));
 save('V2-bounds',{total,legal:legal.length,outputs,parallel:true,exactThreshold:true});
});

test('bounds: finite budgets retain the automatic search candidate sequence',async()=>{
 for(const budget of [24,96]){
  const input=sample();Object.assign(input.team_dps,{max_evaluations:budget,result_count:5});
  const inventory=builds(input).flat(),automatic=await nodeTeamDps(input,inventory,{threads:4});
  input.team_dps.search_algorithm='branch_bound';
  const pruned=await nodeTeamDps(input,inventory,{threads:4});
  assert.equal(pruned.evaluated_teams,automatic.evaluated_teams);assert.equal(pruned.search_complete,false);
  assert.deepEqual(pruned.artifacts,automatic.artifacts);
  for(let i=0;i<5;i++)assert.ok(Math.abs(pruned.results[i].expectation-automatic.results[i].expectation)<1e-7);
 }
});

test('bounds: current four-role legal weapons keep each initial attribute below its relaxed bound',()=>{
 const reports=[];
 for(let r=0;r<4;r++)for(const w of Object.values(weapons).filter(w=>w.type===chars[sample().single_interfaces[r].character.name].weapon)){
  const x=sample();x.single_interfaces[r].weapon=weapon(w.name);if(w.star<3)x.single_interfaces[r].weapon.level=70;
  x.single_interfaces[0].constraint.recharge_min=1;
  x.single_interfaces.forEach((p,j)=>{p.artifacts=gear(j,['Berserker','Instructor','TheExile','WanderersTroupe'][j]);});
  const inventory=builds(x).flat(),pools=x.single_interfaces.map(()=>slots.map(slot=>inventory.filter(a=>a.slot===slot)));
  const upper=createTeamConstraintBounds(api,x,pools).upper(pools),ev=createTeamDpsEvaluator(api,x);
  for(let j=0;j<4;j++)for(const [key]of fields){const actual=sum(ev.constraints(j,builds(x))[key]);assert.ok(upper[j][key]>=actual,`${r}/${w.name}/${j}/${key}: ${upper[j][key]} < ${actual}`);}
  reports.push({role:r,weapon:w.name});
 }
 save('V2-weapon-bounds',{cases:reports.length,passed:true});
});

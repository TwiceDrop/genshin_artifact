import fs from 'node:fs';
import assert from 'node:assert/strict';
import {api,read} from './runtime-7106.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-axis.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {parseTeamDpsConfiguration} from '../beta-data/team-dps-config.mjs';
const axis=parseTeamDpsConfiguration(fs.readFileSync(process.argv[4],'utf8'));
const pack=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),sets=read('src/assets/_gen_artifact.js');
const slots={flower:'Flower',feather:'Feather',sand:'Sand',cup:'Goblet',head:'Head'};
const names={lifeStatic:'HPFixed',lifePercentage:'HPPercentage',attackStatic:'ATKFixed',attackPercentage:'ATKPercentage',defendStatic:'DEFFixed',defendPercentage:'DEFPercentage',critical:'CriticalRate',criticalDamage:'CriticalDamage',elementalMastery:'ElementalMastery',recharge:'Recharge',cureEffect:'HealingBonus',waterBonus:'HydroBonus',iceBonus:'CryoBonus',windBonus:'AnemoBonus',fireBonus:'PyroBonus',thunderBonus:'ElectroBonus',rockBonus:'GeoBonus',physicalBonus:'PhysicalBonus',dendroBonus:'DendroBonus'};
const convertTag=t=>[names[t.name],t.value];
const artifacts=pack.artifacts.map(a=>({id:a.id,set_name:sets[a.setName]?.name2||a.setName,slot:slots[a.position],level:a.level,star:a.star,main_stat:convertTag(a.mainTag),sub_stats:a.normalTags.map(convertTag),omit:a.omit}));
const records=TEAM_DPS_ROLES.map(name=>pack.characters.find(row=>row.preset?.character?.name===name));
const profiles=records.map(row=>({character:row.preset.character,weapon:row.preset.weapon,buffs:row.preset.buffs||[],artifact_config:row.preset.artifactEffectMode==='custom'?row.preset.artifactConfig:null,constraint:{set_mode:'Any',recharge_min:1},filter:{}}));
const input={single_interfaces:profiles,team_dps:{axis,enemy:{level:100,hydro_res:.1,cryo_res:.1},initial_ids:records.map(row=>row.preset.artifactIds),metric:'expectation',fanfare:profiles[1].character.params?.Furina?.q_fanfare??300,furina_overflow:profiles[1].character.params?.Furina?.c2_overflow??0,result_count:100,max_evaluations:Number(process.argv[3]||600)}};
const before=JSON.stringify(pack),catalog=new Map(artifacts.map(a=>[a.id,a])),builds=input.team_dps.initial_ids.map(ids=>ids.map(id=>catalog.get(id)));
const baseline=createTeamDpsEvaluator(api,input).evaluate(builds,true);
assert.ok(Number.isFinite(baseline.total_damage));assert.equal(baseline.hits.length,83);
const report={inventory:artifacts.length,evaluations:input.team_dps.max_evaluations,baseline:{expectation:baseline.expectation,critical:baseline.critical,non_critical:baseline.non_critical,dps:baseline.dps,counts:profiles.map((_,r)=>baseline.hits.filter(h=>h.role===r).length)},benchmarks:[]};
for(const k of [10,100,300]){
 input.team_dps.result_count=k;const start=performance.now();const result=optimizeTeamDps(api,input,artifacts);
 for(const row of result.results){assert.equal(new Set(row.artifacts.flatMap(Object.values)).size,20);assert.ok(Number.isFinite(row.expectation));}
 const row={requested:k,retained:result.results.length,evaluated:result.evaluated_teams,elapsed_ms:performance.now()-start,best:result.results[0].expectation,search_complete:result.search_complete};report.benchmarks.push(row);console.log(JSON.stringify(row));
}
assert.equal(JSON.stringify(pack),before);
fs.writeFileSync(new URL('../.build-target/team-dps-real-benchmark.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({baseline:report.baseline,inventory:report.inventory,source_unchanged:true}));

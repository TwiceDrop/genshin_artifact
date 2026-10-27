import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {sample,gear,builds,sum,close} from './team-dps-full-audit.mjs';
import {weapon} from './interface-audit-7108.mjs';
import {api} from './runtime-7106.mjs';
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps} from '../beta-data/team-dps-optimizer.mjs';
const dir='.build-target/team-dps-full-audit',results=[];
const eq=(a,b)=>assert.ok(close(a,b),`${a} / ${b}`);
const main=JSON.parse(fs.readFileSync('src/import/data/good-main-stat.json','utf8'));
const x=sample(),setNames=['EchoesOfAnOffering','EmblemOfSeveredFate','OceanHuedClam','TenacityOfTheMillelith'];
const mains=[['ATKPercentage','HPPercentage','Recharge','ElementalMastery'],['CryoBonus','HydroBonus','ATKPercentage','HPPercentage'],['CriticalRate','CriticalDamage','HealingBonus','HPPercentage']];
const good={ATKPercentage:'atk_',HPPercentage:'hp_',Recharge:'enerRech_',ElementalMastery:'eleMas',CryoBonus:'cryo_dmg_',HydroBonus:'hydro_dmg_',CriticalRate:'critRate_',CriticalDamage:'critDMG_',HealingBonus:'heal_'};
for(let r=0;r<4;r++){
 const p=x.single_interfaces[r];p.artifacts=gear(r,setNames[r]);p.weapon=weapon(['RoyalLongsword','XiphosMoonlight','SymphonistOfScents','WanderingEvenstar'][r]);
 for(let k=2;k<5;k++){const name=mains[k-2][r];p.artifacts[k].main_stat=[name,main[5][good[name]][20]];p.artifacts[k].sub_stats=p.artifacts[k].sub_stats.filter(([n])=>n!==name);}
 p.filter=Object.fromEntries(['sand_main_stat','goblet_main_stat','head_main_stat'].map((key,k)=>[key,[mains[k][r]]]));
}
x.single_interfaces[0].constraint.recharge_min=1.5;
x.single_interfaces[2].constraint.set_mode={Set4:'OceanHuedClam'};
x.team_dps.initial_ids=builds(x).map(b=>b.map(a=>a.id));x.team_dps.max_evaluations=65536;x.team_dps.result_count=11;
const inventory=builds(x).flat(),original=JSON.stringify({x,inventory}),ev=createTeamDpsEvaluator(api,x),oracle=[];
if(!process.argv.includes('--author-only')){
function* perm(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*perm(a.filter((_,j)=>j!==i),[...p,a[i]]);}
for(const f of perm(inventory.filter(a=>a.slot==='Flower')))for(const g of perm(inventory.filter(a=>a.slot==='Feather'))){
 const b=builds(x).map((a,r)=>[f[r],g[r],...a.slice(2)]),out=ev.evaluate(b),legal=b[2].filter(a=>a.set_name==='OceanHuedClam').length>=4&&sum(ev.constraints(0,b).recharge)>=1.5;
 if(legal)oracle.push({key:b.flat().map(a=>a.id).join(','),...out});
}
console.log(JSON.stringify({oracleLegal:oracle.length,evaluated:576}));
fs.writeFileSync(`${dir}/search-oracle.json`,JSON.stringify(oracle));
for(const metric of ['expectation','critical','non_critical']){
 x.team_dps.metric=metric;const out=optimizeTeamDps(api,x,inventory),expected=oracle.slice().sort((a,b)=>b[metric]-a[metric]||a.key.localeCompare(b.key)).slice(0,11);
 assert.equal(out.evaluated_teams,576);assert.equal(out.search_complete,true);assert.equal(out.results.length,11);
 const tieOrderDifferences=[];
 for(let i=0;i<11;i++){const row=out.results[i],key=row.artifacts.flatMap(b=>['flower','feather','sand','goblet','head'].map(k=>b[k])).join(',');eq(row[metric],expected[i][metric]);assert.ok(oracle.some(o=>o.key===key&&close(o[metric],row[metric])));assert.equal(new Set(row.artifacts.flatMap(Object.values)).size,20);if(key!==expected[i].key)tieOrderDifferences.push({rank:i+1,delta:row[metric]-expected[i][metric]});}
 const summary={metric,evaluated:out.evaluated_teams,legal:oracle.length,retained:out.results.length,best:out.results[0][metric],tieOrderDifferences};results.push(summary);console.log(JSON.stringify(summary));
}
x.team_dps.metric='expectation';assert.equal(JSON.stringify({x,inventory}),original);
}
// Use the author's public formula unchanged, isolated in a VM with only window.
const context={window:{}};vm.runInNewContext(fs.readFileSync('.build-target/author-reference/core/formula.js','utf8'),context);
const formula=context.window.GensriFormula,samples=JSON.parse(fs.readFileSync(`${dir}/numerical-samples.json`,'utf8'));let compared=0;const authorFailures=[];
for(const row of samples.filter(r=>!r.error)){
 const d=row.analysis,panel={atk:sum(d.atk),other:sum(d.hp)*sum(d.hp_ratio)+sum(d.def)*sum(d.def_ratio)+sum(d.em)*sum(d.em_ratio),dmgBonus:sum(d.bonus)*100,critRate:sum(d.critical)*100,critDmg:sum(d.critical_damage)*100};
 const ctx={panel,charLevel:90,enemy:{level:100,res:(d.element==='Physical'?.3:.1)*100},offPanel:{resShred:sum(d.res_minus)*100,defShred:sum(d.def_minus)*100,defIgnore:sum(d.def_penetration)*100}};
 const spec={scaling:'atk',mult:sum(d.atk_ratio)*100,extraScaling:'other',extraMult:100,independent:(1+sum(d.independent_damage_multiplier))*100,flat:sum(d.extra_damage)+sum(d.atk)*sum(d.atk_additive_ratio)};
 for(const metric of ['expectation','critical','non_critical']){const c=structuredClone(ctx);c.critMode=metric==='critical'?'absolute':'expected';if(metric==='non_critical')c.panel.critRate=0;const actual=formula.computeDamage(c,spec).dmg;compared++;if(!close(actual,row[metric]))authorFailures.push({role:row.role,weapon:row.weapon,set:row.set,metric,actual,expected:row[metric]});}
}
fs.writeFileSync(`${dir}/search-and-author.json`,JSON.stringify({search:results,author:{samples:compared,failures:authorFailures}},null,2));console.log(JSON.stringify({search:results,author:{samples:compared,failures:authorFailures}}));if(authorFailures.length)process.exitCode=1;

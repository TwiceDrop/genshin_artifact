import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES,TEAM_DPS_SLOTS} from '../beta-data/team-dps-axis.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps} from '../beta-data/team-dps-optimizer.mjs';
function sample(){const profiles=TEAM_DPS_ROLES.map((n,r)=>{const p=fixture(n);p.artifacts=p.artifacts.map(a=>({...a,id:a.id+100*r}));p.constraint={set_mode:'Any',recharge_min:1};return p;});return {profiles,input:{single_interfaces:profiles,team_dps:{axis:importedAxis(),enemy:{level:100,hydro_res:.1,cryo_res:.1},fanfare:300,furina_overflow:0,result_count:10,max_evaluations:100,metric:'expectation',initial_ids:profiles.map(p=>p.artifacts.map(a=>a.id))}}};}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('fixed axis: actual hit counts, finite charges, timed TTDS, shared Tenacity and native formula',()=>{
 const {profiles,input}=sample(),before=structuredClone(input),builds=profiles.map(p=>p.artifacts),ev=createTeamDpsEvaluator(api,input),out=ev.evaluate(builds,true);
 assert.deepEqual(profiles.map((_,r)=>out.hits.filter(h=>h.role===r).length),[33,26,19,5]);
 assert.equal(out.hits.filter(h=>h.role===0&&h.qBonus).length,10);
 assert.equal(out.hits.filter(h=>h.onField&&h.vodyFlat).length,25);
 assert.equal(out.hits.filter(h=>h.role===0&&h.vodyFlat).length,24);
 assert.equal(out.hits.filter(h=>!h.onField&&h.vodyFlat).length,10);
 assert.deepEqual(input,before);
 const x=structuredClone(profiles[1]);x.character.skill2++;x.buffs=[{name:'ExtensionEffect',config:{ExtensionEffect:{values:{HPPercentage:.25}}}}];x.enemy=input.team_dps.enemy;x.skill={index:9,config:{Furina:{hp_above50_count:4,c6_after_e:false,c6_pneuma:false}}};near(out.hits[0].expectation,api.CalculatorInterface.get_damage_analysis(x,null).normal.expectation);
 profiles[3].weapon=weapon('ThrillingTalesOfDragonSlayers');profiles[3].weapon.refine=5;
 const withBook=createTeamDpsEvaluator(api,input).evaluate(builds,true);
 const hit=(o,t)=>o.hits.find(h=>h.role===0&&h.time===t);
 assert.ok(hit(withBook,16.5).atk>hit(out,16.5).atk);near(hit(withBook,17.5).atk,hit(out,17.5).atk);
 const first=builds.map(b=>b.map(a=>({...a})));first[3]=first[3].map(a=>({...a,set_name:'TenacityOfTheMillelith'}));
 const one=createTeamDpsEvaluator(api,input).evaluate(first,true);first[2]=first[2].map(a=>({...a,set_name:'TenacityOfTheMillelith'}));const two=createTeamDpsEvaluator(api,input).evaluate(first,true);
 near(hit(one,16.5).atk,hit(two,16.5).atk);
 for(const p of profiles)p.character.constellation=6;
 const high=createTeamDpsEvaluator(api,input).evaluate(builds,true);assert.ok(Number.isFinite(high.expectation));assert.ok(high.hits.length>out.hits.length);
});
test('joint search: complete small allocation agrees with independent permutation oracle, constraints and no shared gear',()=>{
 const {profiles,input}=sample();const sand=['ATKPercentage','HPPercentage','Recharge','ElementalMastery'],cup=['ATKPercentage','HPPercentage','CryoBonus','HydroBonus'],head=['CriticalRate','CriticalDamage','HPPercentage','DE FPercentage'.replace(' ','')];
 const inventory=profiles.flatMap((p,r)=>p.artifacts.map((a,k)=>({...a,main_stat:k<2?a.main_stat:[[sand,cup,head][k-2][r],k===4?.311:.466]})));
 profiles.forEach((p,r)=>{p.artifacts=inventory.slice(r*5,r*5+5);p.filter={sand_main_stat:[sand[r]],goblet_main_stat:[cup[r]],head_main_stat:[head[r]]};});
 input.team_dps.initial_ids=profiles.map(p=>p.artifacts.map(a=>a.id));input.team_dps.max_evaluations=65536;input.team_dps.result_count=10;
 const out=optimizeTeamDps(api,input,inventory),ev=createTeamDpsEvaluator(api,input);
 function* perm(a,p=[]){if(!a.length){yield p;return;}for(let i=0;i<a.length;i++)yield*perm(a.filter((_,j)=>j!==i),[...p,a[i]]);}
 const flowers=inventory.filter(a=>a.slot==='Flower'),feathers=inventory.filter(a=>a.slot==='Feather');let best=-Infinity;
 for(const f of perm(flowers))for(const g of perm(feathers)){const team=profiles.map((p,r)=>[f[r],g[r],...p.artifacts.slice(2)]);best=Math.max(best,ev.evaluate(team).expectation);}
 assert.equal(out.search_complete,true);assert.equal(out.evaluated_teams,576);near(out.results[0].expectation,best);
 for(const row of out.results)assert.equal(new Set(row.artifacts.flatMap(Object.values)).size,20);
 input.single_interfaces[0].constraint.recharge_min=50;input.team_dps.max_evaluations=20;
 assert.throws(()=>optimizeTeamDps(api,input,inventory),/未找到满足四人配装限制/);
});

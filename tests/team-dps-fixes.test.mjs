import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../beta-tools/runtime-7106.mjs';
import {fixture,weapon} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-axis.mjs';
import {createTeamDpsEvaluator,sum} from '../beta-data/team-dps-evaluator.mjs';
import {optimizeTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {hymnAttackBonus} from '../beta-data/weapon-effects.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
function sample(){
 const profiles=TEAM_DPS_ROLES.map((name,r)=>{const p=fixture(name);p.artifacts=p.artifacts.map(a=>({...a,id:a.id+100*r}));p.constraint={set_mode:'Any',recharge_min:1};return p;});
 return {profiles,builds:profiles.map(p=>p.artifacts),input:{single_interfaces:profiles,team_dps:{axis:importedAxis(),enemy:{level:100,hydro_res:.1,cryo_res:.1},fanfare:300,furina_overflow:0,result_count:10,max_evaluations:100,metric:'expectation',initial_ids:profiles.map(p=>p.artifacts.map(a=>a.id))}}};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const hit=(out,t,r=0)=>out.hits.find(h=>h.role===r&&h.time===t);
const values=x=>x.buffs.reduce((out,b)=>{for(const [key,value]of Object.entries(b.config?.ExtensionEffect?.values||{}))out[key]=(out[key]||0)+value;return out;},{});
function capture(input,builds){const calls=[],attributes=[];const wrapped={...api,CalculatorInterface:{get_damage_analysis(x,...args){const d=api.CalculatorInterface.get_damage_analysis(x,...args);calls.push({x,d});return d;}},CommonInterface:{get_attribute(x){const p=api.CommonInterface.get_attribute(x);attributes.push({x,p});return p;}}};return {out:createTeamDpsEvaluator(wrapped,input).evaluate(builds,true),calls,attributes};}

test('repair 1: published WASM formula, per-hit additions and candidate-dependent support panels',()=>{
 for(const refine of [1,5])for(const hp of [38000,40000,50000,60000,80000])for(const boosted of [false,true])
  near(hymnAttackBonus(hp,refine,3,boosted),Math.min(Math.max(hp-40000,0)*(.000003+.000001*refine),.06+.02*refine)*3*(boosted?1.75:1));
 {
  const {input,profiles,builds}=sample();profiles[3].weapon=weapon('HymnOfTheMaelstrom');
  for(const refine of [1,5])for(const hpBonus of [0,.5]){
   profiles[3].weapon.refine=refine;builds[3][0].sub_stats=[['HPPercentage',hpBonus]];
   const c=capture(input,builds),x=c.calls.find(c=>c.x.character.name==='Skirk').x;
   const src=c.attributes.find(c=>c.x.character.name==='Vodyanitsa'&&c.x.weapon.params.HymnOfTheMaelstrom.stacks===1&&!c.x.weapon.params.HymnOfTheMaelstrom.on_field);
   near(values(x).ATKPercentage,hymnAttackBonus(sum(src.p.hp),refine,1,true));
  }
 }
 {
  const {input,profiles,builds}=sample();builds[0].forEach(a=>a.set_name='EchoesOfAnOffering');
  for(const constellation of [0,6]){
   profiles[0].character.constellation=constellation;
   profiles[0].artifact_config={config_echoes_of_an_offering:{rate:0}};const off=createTeamDpsEvaluator(api,input).evaluate(builds,true);
   profiles[0].artifact_config.config_echoes_of_an_offering.rate=1;const on=capture(input,builds);
   near(on.out.hits[0].expectation,on.calls[0].d.normal.expectation);
   assert.equal(on.calls.find(c=>c.x.character.name==='Skirk').d.atk_ratio['来歆余响4'],.7);
   for(let i=0;i<off.hits.length;i++){
    const h=on.out.hits[i];if(h.role!==0||h.category!=='normal')continue;
    near(h.expectation-off.hits[i].expectation,h.atk*.7*(1+h.bonus)*h.def*h.res*(1+h.crit*h.crit_damage));
   }
  }
  profiles[0].weapon=weapon('LightOfFoliarIncision');profiles[0].weapon.params.LightOfFoliarIncision.rate=1;
  const c=capture(input,builds),d=c.calls.find(c=>c.x.character.name==='Skirk'&&c.x.skill.index===11).d;
  assert.ok(sum(d.extra_damage)>0);near(hit(c.out,9.5).flat,sum(d.extra_damage));
 }
 {
  const {input,profiles,builds}=sample();profiles[2].character.constellation=2;builds[3].forEach(a=>a.set_name='TenacityOfTheMillelith');
  const ev=createTeamDpsEvaluator(api,input),a=ev.evaluate(builds,true);near(hit(a,7.75).flat,2.4*hit(a,8,2).atk);
  const changed=structuredClone(builds);changed[2][2]={...changed[2][2],id:9999,main_stat:['ATKPercentage',.966]};
  const b=ev.evaluate(changed,true),fresh=createTeamDpsEvaluator(api,input).evaluate(changed,true);
  assert.ok(hit(b,7.75).flat>hit(a,7.75).flat);near(b.expectation,fresh.expectation);near(hit(b,7.75).flat,2.4*hit(b,8,2).atk);
 }
});

test('repair 2: charge ownership, ordered refresh and weapon/constellation timing',()=>{
 const {input,profiles,builds}=sample();for(const a of builds[3])a.sub_stats.push(['HPPercentage',.5]);
 const plain=createTeamDpsEvaluator(api,input).evaluate(builds,true);
 assert.deepEqual(profiles.map((_,r)=>plain.hits.filter(h=>h.role===r).length),[33,26,19,5]);
 assert.equal(plain.hits.filter(h=>h.onField&&h.vodyFlat).length,25);assert.equal(plain.hits.filter(h=>!h.onField&&h.vodyFlat).length,10);
 assert.ok(hit(plain,9.5,3).vodyFlat);near(hit(plain,9.5,3).flat,Math.min(3500,(hit(plain,9.5,3).hp-40000)*.14));
 assert.equal(plain.hits.filter(h=>h.qBonus).length,10);assert.equal(plain.hits.filter(h=>h.escoFlat).length,5);
 profiles[2].character.constellation=6;
 assert.deepEqual(createTeamDpsEvaluator(api,input).evaluate(builds,true).hits.filter(h=>h.role===2&&h.ratio===5).map(h=>h.time),[7.75,8.5,9,9.5,10,10.5]);
 profiles[2].character.constellation=0;profiles[3].weapon=weapon('ThrillingTalesOfDragonSlayers');profiles[3].weapon.refine=5;
 const book=createTeamDpsEvaluator(api,input).evaluate(builds,true);assert.ok(hit(book,16.5).atk>hit(plain,16.5).atk);near(hit(book,17.5).atk,hit(plain,17.5).atk);
 builds[3].forEach(a=>a.set_name='TenacityOfTheMillelith');const one=createTeamDpsEvaluator(api,input).evaluate(builds,true);
 builds[2].forEach(a=>a.set_name='TenacityOfTheMillelith');const two=createTeamDpsEvaluator(api,input).evaluate(builds,true);
 for(const t of [9,9.5,17.5,18.5]){assert.ok(hit(one,t).atk>hit(book,t).atk);near(hit(one,t).atk,hit(two,t).atk);}
 {
  const {input,profiles,builds}=sample();profiles[2].weapon=weapon('SymphonistOfScents');
  const zero=createTeamDpsEvaluator(api,input).evaluate(builds,true);near(hit(zero,17.5).atk,hit(zero,20.5).atk);assert.ok(hit(zero,16.5).atk>hit(zero,17.5).atk);
  assert.ok(hit(zero,17,2).atk>hit(zero,18,2).atk);
  profiles[2].character.constellation=4;const four=createTeamDpsEvaluator(api,input).evaluate(builds,true);assert.ok(hit(four,20.5).atk>hit(zero,20.5).atk);
  profiles[0].weapon=weapon('Azurelight');const azure=capture(input,builds);
  assert.ok(azure.calls.filter(c=>c.x.character.name==='Skirk').every(c=>c.x.weapon.params.Azurelight.zero_energy));near(hit(azure.out,7.75).crit_damage,hit(azure.out,8).crit_damage);
  profiles[1].weapon=weapon('MistsplitterReforged');const mist=capture(input,builds);
  const stacks=mist.calls.filter(c=>c.x.character.name==='Furina').map(c=>c.x.weapon.params.MistsplitterReforged.emblem_level);
  assert.equal(stacks[0],0);assert.ok(stacks.includes(2)&&stacks.includes(1));assert.ok(!stacks.includes(3));
 }
});

test('repair 3: candidate filtering, matching and feasible beam paths',()=>{
 {
  const {input,builds}=sample(),inventory=builds.flat();inventory[0].omit=true;inventory[1].level=0;
  inventory.push({...inventory[0],id:9000,omit:false},{...inventory[1],id:9001,level:20});
  input.team_dps.max_evaluations=1;input.team_dps.minimum_artifact_level=20;
  const result=optimizeTeamDps(api,input,inventory),used=new Set(result.results[0].artifacts.flatMap(Object.values));
  assert.equal(used.size,20);assert.ok(!used.has(inventory[0].id)&&!used.has(inventory[1].id));
  assert.equal(result.baseline.hits.length,83);assert.equal(result.evaluated_teams,1);
 }
 {
  const {input,profiles,builds}=sample(),types=['ATKPercentage','HPPercentage','ElementalMastery','Recharge'];
  for(let r=0;r<4;r++)builds[r][2].main_stat=[types[r],r===2?187:.466];
  input.team_dps.initial_ids=[[],[],[],[]];input.team_dps.max_evaluations=1;
  profiles[1].filter={sand_main_stat:[types[0]]};profiles[2].filter={sand_main_stat:[types[1]]};profiles[3].filter={sand_main_stat:[types[2]]};
  const result=optimizeTeamDps(api,input,builds.flat());assert.equal(result.results[0].artifacts[0].sand,builds[3][2].id);assert.equal(result.baseline,null);
 }
 {
  const {input,profiles,builds}=sample();for(const b of builds)for(const a of b.slice(0,2))a.sub_stats=[['ATKPercentage',.2],['Recharge',.2]];
  const extra=builds[0].slice(0,2).map((a,k)=>({...a,id:9000+k,sub_stats:[['Recharge',1]]}));
  profiles[0].constraint.recharge_min=3.5;input.team_dps.max_evaluations=2000;
  const result=optimizeTeamDps(api,input,[...builds.flat(),...extra]);
  assert.ok(result.results.length>0);assert.equal(result.search_complete,false);assert.ok(result.evaluated_teams<=2000);
  for(const row of result.results){assert.ok(sum(row.panels[0].recharge)>=3.5);assert.equal(new Set(row.artifacts.flatMap(Object.values)).size,20);}
  assert.equal(new Set(result.results.map(r=>JSON.stringify(r.artifacts))).size,result.results.length);
 }
});

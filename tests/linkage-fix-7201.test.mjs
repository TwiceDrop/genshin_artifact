import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {api,read,sum} from '../beta-tools/runtime-7106.mjs';
import {fixture,config,buffs} from '../beta-tools/interface-audit-7108.mjs';
import {input,named} from '../beta-tools/preview-7201-fixtures.mjs';
import {generateDsl} from '../src/algorithms/dsl-generator.mjs';
import {createTeamContextSource,deriveSingleTeamContext} from '../src/algorithms/single-team-context.mjs';
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const hit=(x,infusion=null)=>api.CalculatorInterface.get_damage_analysis(x,infusion);
const support=(name,p={})=>named(name,{...Object.fromEntries((buffs[name].config||[]).map(c=>[c.name,c.default])),...p});
const records=[];
function unchanged(x,fn){const before=JSON.stringify(x);const result=fn();assert.equal(JSON.stringify(x),before);return result;}
function linked(sourceRole,x,front){const s=fixture(sourceRole);s.character.constellation=6;if(sourceRole==='Valeriy')s.character.params.Valeriy.directive=true;const presets={sample:{item:{...s,artifactIds:s.artifacts.map(a=>a.id)}}},ctx=createTeamContextSource('sample',presets.sample);ctx.triggers.recipientOnField=front;ctx.triggers.qiqiC6=true;const gear=new Map(s.artifacts.map(a=>[a.id,a]));return unchanged({presets,ctx},()=>{const r=deriveSingleTeamContext(api,x,[ctx],presets,id=>gear.get(id),a=>a);assert.deepEqual(r.issues,[]);return r.buffs;});}
function interfaces(x,key){const role=x.character.name,y={...structuredClone(x),artifacts:fixture(role).artifacts},params=y.skill.config==='NoConfig'?{}:y.skill.config[role],source=generateDsl({character:role,entries:[{token:read('beta-data/dsl-skill-names.json')[role][y.skill.index],params,infusion:'None',reaction:key,value:'e',count:1,weight:1}]}),tf={name:role+'Default',params:'NoConfig',use_dsl:true,dsl_source:source};
 unchanged(y,()=>{const baseline=hit(y)[key].expectation;const d=api.DSLInterface.run(source+'\nprint(result)',y,y.artifacts);assert.equal(d.is_error,false,d.error_msg);near(Number(d.output.trim().replace(/^MONA: /,'')),baseline);
 const alt={...structuredClone(y.artifacts[2]),id:9001,main_stat:['ElementalMastery',287]},b=hit({...y,artifacts:y.artifacts.map(a=>a.slot==='Sand'?alt:a)})[key].expectation;
 for(const algorithm of ['Naive','AStar']){const result=api.OptimizeSingleWasm.optimize({...y,target_function:tf,algorithm,constraint:{set_mode:'Any'},filter:null},[...y.artifacts,alt]);near(result[0].value,Math.max(baseline,b));}
 const gain=api.BonusPerStat.bonus_per_stat({...y,tf,artifacts_config:y.artifact_config});const increased=hit({...y,buffs:[...y.buffs,named('ElementalMastery',{value:23})]})[key].expectation;near(gain.elemental_mastery[0],increased/baseline-1);
 });}
test('Vodyanitsa C6: isolate stellarconduct, retain stellar-swirl and Hydro/Cryo bonuses',()=>{
 const x=input(),base=hit(x).direct_stellarconduct.expectation;x.buffs=[support('VodyanitsaC6',{constellation:6})];near(hit(x).direct_stellarconduct.expectation,base);interfaces(x,'direct_stellarconduct');records.push({id:'vody-c6',expected:base,actual:hit(x).direct_stellarconduct.expectation});
 const v=fixture('Vesna');v.character.params.Vesna.radiance=true;v.skill.index=17;const before=hit(v).direct_stellarswirl.non_critical;v.buffs=x.buffs;near(hit(v).direct_stellarswirl.non_critical,before*1.25);
 for(const element of ['Hydro','Cryo']){const y=input('Valeriy');y.skill.index=0;const before=hit(y,element).normal.non_critical;y.buffs=x.buffs;near(hit(y,element).normal.non_critical,before*1.6);}
});
test('Qiqi C6: front-only flat damage, manual and saved-teammate routes',()=>{
 for(const front of [false,true]){const x=input();Object.assign(x.character.params.Mitya,{on_field:front,core_mode:1});x.skill.index=12;const before=hit(x).direct_stellarconduct;x.buffs=[support('QiqiC6StellarConduct',{atk:2000})];const after=hit(x).direct_stellarconduct;near(after.non_critical-before.non_critical,front?10800:0);interfaces(x,'direct_stellarconduct');if(!front)records.push({id:'qiqi-back',expected:before.expectation,actual:after.expectation});}
 for(const front of [false,true]){const x=input();x.skill.index=12;x.character.params.Mitya.core_mode=1;const before=hit(x).direct_stellarconduct.expectation;x.buffs=linked('Qiqi',x,front);const actual=hit(x).direct_stellarconduct.expectation;if(front)assert.ok(actual>before);else near(actual,before);}
});
test('Shared recipient conditions: any explicit background disables front-only effects; saved inputs unchanged',()=>{
 for(const front of [false,true])for(const own of [false,true])for(const radiance of [false,true]){const x=input();x.character.params.Mitya.on_field=own;x.skill.index=radiance?8:14;const key=radiance?'direct_stellarconduct':'normal',before=hit(x)[key].expectation;x.buffs=[support('ValeriyDirective',{recipient_on_field:front,radiance})];const actual=hit(x)[key].expectation;if(front&&own)assert.ok(actual>before);else near(actual,before);if(radiance)interfaces(x,key);}
 for(const field of ['on_field','recipient_on_field']){const x=input();x.team_effects={[field]:false};const before=hit(x).direct_stellarconduct.expectation;x.buffs=[support('ValeriyDirective')];near(hit(x).direct_stellarconduct.expectation,before);}
 for(const front of [false,true]){const x=input(),before=hit(x).direct_stellarconduct.expectation;x.buffs=linked('Valeriy',x,front);const actual=hit(x).direct_stellarconduct.expectation;if(front)assert.ok(actual>before);else{near(actual,before);records.push({id:'linked-val-back',expected:before,actual});}}
 // Shared predicate must not discard team-wide steady-core EM or C6 elevation.
 for(const mode of [1,2]){const x=input('Valeriy'),p0=api.CommonInterface.get_attribute(x);x.buffs=[support('MityaSupport',{constellation:6,core_mode:mode,beacons:5,recipient_on_field:false})];const p=api.CommonInterface.get_attribute(x);near(sum(p.critical_damage),sum(p0.critical_damage));near(sum(p.elemental_mastery)-sum(p0.elemental_mastery),mode===1?273:0);}
 // Original four audit inputs still retain their exact stored representation.
 for(const row of read('.build-target/full-audit-7201-20261024/contracts.json').observations){unchanged(row.input,()=>near(hit(row.input)[row.key].expectation,row.expected));}
 fs.writeFileSync('.build-target/linkage-fix-7201-20261024/regression.json',JSON.stringify({records,originalAuditInputs:4,presetsAndInputsUnchanged:true},null,2));
});

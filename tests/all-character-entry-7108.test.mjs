import test from 'node:test';
import assert from 'node:assert/strict';
import {markReactionAvailability} from '../beta-data/reaction-availability.mjs';
import {damageReactionOptions,stellarDamageResults,visibleDamageReactionKeys} from '../src/algorithms/reaction-labels.mjs';
import {api,read} from '../beta-tools/runtime-7106.mjs';
const chars=read('src/assets/_gen_character.js'),targets=read('src/assets/_gen_tf.js');
const weapons={Sword:'DullBlade',Claymore:'WasterGreatsword',Polearm:'BeginnersProtector',Bow:'HuntersBow',Catalyst:'ApprenticesNotes'};
const config=(name,rows)=>rows?.length?{[name]:Object.fromEntries(rows.map(c=>[c.name,c.default]))}:'NoConfig';
export const gear=['Flower','Feather','Sand','Goblet','Head'].map((slot,i)=>({id:i+1,set_name:'GladiatorsFinale',slot,level:20,star:5,main_stat:[i===0?'HPFixed':i===1?'ATKFixed':'ATKPercentage',i===0?4780:i===1?311:.466],sub_stats:[['Recharge',.2],['ElementalMastery',20]]}));
export function input(name,target){const c=chars[name],t=targets[target]||Object.values(targets).find(t=>t.for===name)||targets.MaxATK;return {character:{name,level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:config(name,c.config)},weapon:{name:weapons[c.weapon],level:90,ascend:false,refine:1,params:'NoConfig'},target_function:{name:t.name,params:config(t.name,t.config),use_dsl:false,dsl_source:''},constraint:{set_mode:'Any'},enemy:null,buffs:[],artifact_config:null,algorithm:'AStar'};}
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const quiet=fn=>{const old=console.log;console.log=()=>{};try{return fn()}finally{console.log=old}};

test('All catalog characters and target presets: real optimizer shape, C0/C6, AStar/Naive',()=>quiet(()=>{
 let count=0;const failures=[];
 for(const name of Object.keys(chars)){
  const list=Object.values(targets).filter(t=>t.for===name);if(!list.length)list.push(targets.MaxATK);
  for(const t of list)for(const constellation of [0,6])for(const algorithm of ['AStar','Naive']){
   const x=input(name,t.name);x.character.constellation=constellation;x.algorithm=algorithm;
   assert.equal('artifacts' in x,false);assert.equal('skill' in x,false);
   try{const rows=api.OptimizeSingleWasm.optimize(x,gear);assert.ok(rows.length>0);assert.ok(Number.isFinite(rows[0].value));count++;}
   catch(e){failures.push(`${name}/${t.name}/C${constellation}/${algorithm}: ${e.message}`);}
  }
 }
 assert.deepEqual(failures,[]);process.stdout.write(`catalog optimizer: ${Object.keys(chars).length} characters, ${count} combinations\n`);
}));

test('All catalog single-hit skills use each character default skill config, C0/C6',()=>quiet(()=>{
 let count=0;const failures=[];
 for(const [name,c] of Object.entries(chars))for(const constellation of [0,6]){
  const {target_function,constraint,algorithm,...base}=input(name);base.character.constellation=constellation;
  for(const index of new Set([...(c.skillMap1||[]),...(c.skillMap2||[]),...(c.skillMap3||[])].map(s=>s.index))){
   try{const r=api.CalculatorInterface.get_damage_analysis({...base,artifacts:gear,skill:{index,config:config(name,c.configSkill)}},null);assert.ok(r.normal);for(const v of Object.values(r))if(v&&typeof v==='object'&&'expectation' in v)assert.ok(Number.isFinite(v.expectation));count++;}
   catch(e){failures.push(`${name}/C${constellation}/skill${index}: ${e.message}`);}
  }
 }
 assert.deepEqual(failures,[]);process.stdout.write(`catalog single-hit: ${count} skill configurations\n`);
}));

test('Synthetic Stellar targets score changing candidates identically to single-hit damage; explicit weapon limit',()=>quiet(()=>{
 const alt={...gear[2],id:6,main_stat:['ElementalMastery',187]};
 for(const constellation of [0,6]){
  const x=input('Sandrone','SandroneStellarSwirl');x.character.constellation=constellation;x.algorithm='Naive';
  const rows=api.OptimizeSingleWasm.optimize(x,[...gear,alt]);
  const {target_function,...base}=x;
  const scores=[gear,gear.map(a=>a.slot==='Sand'?alt:a)].map(artifacts=>api.CalculatorInterface.get_damage_analysis({...base,artifacts,skill:{index:18,config:config('Sandrone',chars.Sandrone.configSkill)}},null).direct_stellarswirl.expectation);
  assert.notEqual(scores[0],scores[1]);near(rows[0].value,Math.max(...scores));
 }
 const x=input('Lisa');x.weapon={name:'HymnOfTheMaelstrom',level:90,ascend:false,refine:1,params:{HymnOfTheMaelstrom:{stacks:3,on_field:true,hp:0}}};
 assert.throws(()=>api.OptimizeSingleWasm.optimize(x,gear),/每套候选/);
 x.weapon.params.HymnOfTheMaelstrom.hp=60000;
 assert.ok(api.OptimizeSingleWasm.optimize(x,gear).length);
}));


test('Published character reaction branches survive support buffs; unsupported Swirl remains explicit',()=>quiet(()=>{
 const p={hp:60000,constellation:0,e_level:10,ordinary_mode:false,on_field:true};
 const buff=(name,extra={})=>({name,config:{[name]:{...p,...extra}}});
 const native={name:'ExtensionEffect',config:{ExtensionEffect:{label:'synthetic resistance reference',values:{ResMinusCryo:.3,ResMinusHydro:.3,ResMinusAnemo:.35}}}};
 let count=0;
 for(const [name,c] of Object.entries(chars)){
  if(['Vodyanitsa','Vesna'].includes(name))continue;
  const {target_function,...base}=input(name);
  for(const index of new Set([...(c.skillMap1||[]),...(c.skillMap2||[]),...(c.skillMap3||[])].map(s=>s.index))){
   const x={...base,artifacts:gear,skill:{index,config:config(name,c.configSkill)}};
   const before=api.CalculatorInterface.get_damage_analysis({...x,buffs:[native]},null);
   const after=api.CalculatorInterface.get_damage_analysis({...x,buffs:[buff('VodyanitsaE'),buff('VodyanitsaA1')]},null);
   for(const [key,value] of Object.entries(before))if(value&&typeof value==='object'&&Number.isFinite(value.expectation)){
    assert.ok(after[key],`${name}/${index} lost ${key}`);near(after[key].expectation,value.expectation);
   }
   count++;
  }
 }
 const {target_function,...base}=input('Sandrone');const x={...base,artifacts:gear,skill:{index:5,config:config('Sandrone',chars.Sandrone.configSkill)}};
 const noBuff=api.CalculatorInterface.get_damage_analysis(x,null);
 const enabled=api.CalculatorInterface.get_damage_analysis({...x,buffs:[buff('VodyanitsaE')]},null);
 assert.ok(enabled.direct_stellarconduct.expectation>noBuff.direct_stellarconduct.expectation);
 assert.deepEqual(visibleDamageReactionKeys(enabled),['direct_stellarconduct']);
 assert.deepEqual(visibleDamageReactionKeys({...enabled,moonfall:undefined,mooncrystallize:undefined}),['direct_stellarconduct']);
 near(enabled.direct_stellarconduct.expectation/noBuff.direct_stellarconduct.expectation,1.1/.9);
 const unsupported=api.CalculatorInterface.get_damage_analysis({...x,buffs:[buff('VodyanitsaA4')]},null);
 assert.ok(unsupported.direct_stellarconduct);assert.equal(unsupported.direct_stellarswirl,noBuff.direct_stellarswirl);
 assert.ok(Number.isFinite(unsupported.stellarswirl_anemo.expectation));
 assert.equal(unsupported.reaction_availability.direct_stellarswirl.status,'uncalibrated');
 const preview=markReactionAvailability({direct_stellarconduct:{expectation:123},direct_stellarswirl:{expectation:0}});
 assert.equal(preview.direct_stellarconduct.expectation,123);assert.equal(preview.direct_stellarswirl.expectation,0);
 assert.deepEqual(visibleDamageReactionKeys(preview),['direct_stellarconduct','direct_stellarswirl']);
 assert.deepEqual(visibleDamageReactionKeys({normal:{expectation:0},direct_moonbloom:undefined}),['normal']);
 assert.equal(damageReactionOptions(preview).length,0);assert.equal(stellarDamageResults(preview).length,2);
 assert.ok(stellarDamageResults(preview).every(x=>x.label.includes('未校准')));
 process.stdout.write(`support branch preservation: ${count} skill configurations\n`);
}));

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import data from '../beta-data/weapons-expanded-release-71.json' with {type:'json'};
import {
  createExpandedWeaponsFacade,
  expandedWeaponCatalog,
  expandedWeaponEffects,
  expandedWeaponStats,
  normalizeExpandedWeapon,
} from '../beta-data/expanded-weapons.mjs';

const weapon=(name,params={},level=90,ascend=false,refine=1)=>({name,level,ascend,refine,params:{[name]:params}});

test('all fifteen published sword and catalyst records cover legal level, promotion, and refinement states',()=>{
  assert.equal(expandedWeaponCatalog.length,15);
  assert.equal(new Set(expandedWeaponCatalog.map(w=>w.id)).size,15);
  assert.equal(data.weapons.filter(w=>w.weaponType==='Sword').length,7);
  assert.equal(data.weapons.filter(w=>w.weaponType==='Catalyst').length,8);
  for(const source of data.weapons){
    assert.equal(source.levels.length,96,source.name);
    assert.equal(source.refinements.length,source.name==='PrizedIsshinBlade'?1:5,source.name);
    assert.equal(source.refinementDetails.length,source.refinements.length,source.name);
    for(const row of source.levels){
      assert.deepEqual(expandedWeaponStats(weapon(source.name,{},row.level,row.ascend)),{
        attack:row.attack,secondaryStat:source.secondaryStat,subStat:row.subStat,
        attackRaw:row.attackRaw,subStatRaw:row.subStatRaw,
      },`${source.name} ${row.level}/${row.ascend}`);
    }
    for(let r=1;r<=source.refinements.length;r++){
      assert.equal(normalizeExpandedWeapon(weapon(source.name,{},90,false,r)).refine,r);
      assert.ok(Array.isArray(source.refinements[r-1]));
    }
    for(const level of [20,40,50,60,70,80]){
      const pre=expandedWeaponStats(weapon(source.name,{},level,false));
      const post=expandedWeaponStats(weapon(source.name,{},level,true));
      assert.ok(post.attack>pre.attack,`${source.name} promotion at ${level}`);
      assert.equal(post.subStat,pre.subStat,`${source.name} secondary stat at ${level}`);
    }
  }
});

test('quest sword has no invented refinements and invalid levels or promotion states fail',()=>{
  assert.equal(expandedWeaponCatalog.find(w=>w.name==='PrizedIsshinBlade').maxRefine,1);
  assert.throws(()=>normalizeExpandedWeapon(weapon('PrizedIsshinBlade',{},90,false,2)),/精炼/);
  assert.throws(()=>normalizeExpandedWeapon(weapon('AthameArtis',{},91)),/等级/);
  assert.throws(()=>normalizeExpandedWeapon(weapon('AthameArtis',{},89,true)),/突破/);
});

test('legacy condition keys normalize without dropping average coverage or resonance count',()=>{
  assert.deepEqual(normalizeExpandedWeapon(weapon('WhitelakeFrostfeather',{stack:3,rate:0.5})).params.WhitelakeFrostfeather,{stacks:3,rate:0.5});
  assert.deepEqual(normalizeExpandedWeapon(weapon('ExaiphanesBlade',{active:true,resonated_elements:7,rate:0.25})).params.ExaiphanesBlade,{hit_active:true,rate:0.25,resonated_elements:7});
  assert.deepEqual(normalizeExpandedWeapon(weapon('NocturnesCurtainCall',{sacred_wine_uptime:0.4})).params.NocturnesCurtainCall,{lunar_active:true,rate:0.4});
  assert.deepEqual(normalizeExpandedWeapon(weapon('MoonweaverDawn',{max_energy:60})).params.MoonweaverDawn,{energy_cost:60});
  assert.deepEqual(normalizeExpandedWeapon(weapon('NightweaversLookingGlass',{northernmost_runo_active:true,crescent_verse_active:true,skill_rate:0.2,lunar_rate:0.7})).params.NightweaversLookingGlass,{skill_active:true,lunar_bloom_active:true,skill_rate:0.2,lunar_rate:0.7});
  assert.throws(()=>normalizeExpandedWeapon(weapon('WhitelakeFrostfeather',{stack:4})),/叠层/);
  assert.throws(()=>normalizeExpandedWeapon(weapon('ExaiphanesBlade',{resonated_elements:8})),/共鸣元素/);
  assert.throws(()=>normalizeExpandedWeapon(weapon('NocturnesCurtainCall',{sacred_wine_uptime:1.1})),/覆盖率/);
});

test('new selector defaults require triggers while saved legacy conditions remain usable',()=>{
  const raw=readFileSync(new URL('../src/assets/_gen_weapon.js',import.meta.url),'utf8');
  const meta=JSON.parse(raw.slice(raw.indexOf('{')));
  const inactive={SerenitysCall:['rate'],LightbearingMoonshard:['extra_active'],WhitelakeFrostfeather:['stack'],
    ExaiphanesBlade:['active','resonated_elements'],NightweaversLookingGlass:['northernmost_runo_active','crescent_verse_active'],
    ReliquaryOfTruth:['false_secret_active','true_moon_active'],EtherlightSpindlelute:['rate'],
    NocturnesCurtainCall:['sacred_wine_uptime'],AngelosHeptades:['shield_rate']};
  for(const [name,keys] of Object.entries(inactive))for(const key of keys){
    const config=meta[name].configs.find(c=>c.name===key);
    assert.ok(config,`${name} ${key}`);
    assert.ok(config.default===false||config.default===0,`${name} ${key} default`);
  }
  assert.ok(meta.PrizedIsshinBlade.availability==='quest-only');
  assert.equal(meta.PrizedIsshinBlade.maxRefine,1);
  assert.ok(meta.MoonweaverDawn);
  assert.equal(meta.MoonweaversDawn,undefined);
});

test('refinement passives use released parameters and do not show conditional direct energy when inactive',()=>{
  const white=expandedWeaponEffects(weapon('WhitelakeFrostfeather',{stack:3,rate:0.5}),{characterName:'Vesna'});
  assert.equal(white.attackPercentage,0.12);
  assert.equal(white.stellarReactionCriticalDamage,0.25);
  assert.equal(white.directEnergy.amount,4);
  assert.equal(expandedWeaponEffects(weapon('WhitelakeFrostfeather',{stack:0})).directEnergy,null);
  const truth=expandedWeaponEffects(weapon('ReliquaryOfTruth',{false_secret_active:true,true_moon_active:true,skill_rate:0.8,lunar_rate:0.4}));
  assert.equal(truth.elementalMastery,80);
  assert.ok(Math.abs(truth.criticalDamage-0.144)<1e-12);
  assert.equal(truth.lunarReactionCriticalDamage,0);
  const star=expandedWeaponEffects(weapon('ExaiphanesBlade',{active:true,resonated_elements:7},90,false,5),{characterName:'AetherAnemo'});
  assert.equal(star.criticalDamage,0.42);
  assert.equal(star.attackPercentage,0.4);
  assert.equal(star.directEnergy.amount,5);
  assert.equal(expandedWeaponEffects(weapon('NocturnesCurtainCall',{sacred_wine_uptime:0})).directEnergy,null);
});

test('attack-scaled team effect requires a source panel and retains its formula',()=>{
  const w=weapon('AngelosHeptades',{shield_active:true,rate:0.5});
  const unknown=expandedWeaponEffects(w).teamEffects[0];
  assert.equal(unknown.amount,null);
  assert.deepEqual(unknown.formula,{sourceStat:'attack',per:1000,increment:0.1,cap:0.26,coverage:0.5});
  assert.equal(expandedWeaponEffects(w,{sourceAttack:3000}).teamEffects[0].amount,0.13);
  const base={CommonInterface:{get_attribute(){return {atk:{character:1000,weapon:2000}};}}};
  const panel=createExpandedWeaponsFacade(base,base,base).CommonInterface.get_attribute({character:{name:'Vodyanitsa'},weapon:w});
  assert.equal(panel.weapon_effects.teamEffects[0].amount,0.13);
});

test('facade routes native roles, blocks unverified old-role white values, and allows explicitly verified parity',()=>{
  const calls=[];
  const base={CommonInterface:{get_attribute(x){calls.push(['base',x]);return {atk:{base:1}};}}};
  const extension={CommonInterface:{get_attribute(x){calls.push(['extension',x]);return {atk:{base:2}};}}};
  const facade=createExpandedWeaponsFacade(base,base,extension);
  const native={character:{name:'Vesna'},weapon:weapon('AthameArtis',{burst_hit:true})};
  const result=facade.CommonInterface.get_attribute(native);
  assert.equal(calls.at(-1)[0],'base');
  assert.deepEqual(calls.at(-1)[1].weapon.params.AthameArtis,{burst_hit:true,secret_rite:false,rate:1});
  assert.equal(result.weapon_precision.levelCurve,'exact');
  assert.throws(()=>facade.CommonInterface.get_attribute({character:{name:'Kaeya'},weapon:weapon('AthameArtis')}),/一致性校验/);
  const verified=createExpandedWeaponsFacade(base,base,extension,{verifiedOldRoles:['Kaeya']});
  assert.equal(verified.CommonInterface.get_attribute({character:{name:'Kaeya'},weapon:weapon('AthameArtis')}).atk.base,2);
});

test('custom DSL bytecode survives weapon normalization unchanged',()=>{
  const bytecode=new Uint8Array([1,3,7]);
  const base={DSLInterface:{run(program,input){assert.strictEqual(program,bytecode);assert.equal(input.weapon.params.AmberBead.stacks,2);return 42;}}};
  const facade=createExpandedWeaponsFacade(base,base,base);
  assert.equal(facade.DSLInterface.run(bytecode,{character:{name:'Vodyanitsa'},weapon:weapon('AmberBead',{stack:2})}),42);
});

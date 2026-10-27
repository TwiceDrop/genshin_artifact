import test from 'node:test';
import assert from 'node:assert/strict';
import {api,original,rawOriginal,vody,vesna,named,sum} from '../beta-tools/runtime-7106.mjs';
import {expandedWeaponStats,knownOverlap} from '../beta-data/expanded-weapons.mjs';
import {bindReactionBuffs} from '../beta-data/reaction-parameter-rules.mjs';
import {calculateSingleHit} from '../beta-data/single-hit-damage.mjs';
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const weapon=(name,p={},level=90,ascend=false)=>({name,level,ascend,refine:1,params:{[name]:p}});
const x={...structuredClone(vody),character:{name:'Kaeya',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:'NoConfig'},weapon:{name:'DullBlade',level:90,ascend:false,refine:1,params:'NoConfig'},skill:{index:0,config:'NoConfig'},buffs:[]};
const gear=['Flower','Feather','Sand','Goblet','Head'].map((slot,i)=>({id:i+1,set_name:'GladiatorsFinale',slot,level:20,star:5,main_stat:[i===0?'HPFixed':i===1?'ATKFixed':'ATKPercentage',i===0?4780:i===1?311:.466],sub_stats:[]}));
const damage=input=>api.CalculatorInterface.get_damage_analysis(input);
const panel=input=>api.CommonInterface.get_attribute(input);

test('Weapon level correction preserves base ATK scaling and candidate optimization',()=>{
 for(const [level,ascend] of [[1,false],[20,false],[20,true],[80,true]]){
  const a={...x,weapon:weapon('LightbearingMoonshard',{},level,ascend),buffs:[named('ATKPercentage',{p:50})]};
  const b={...a,weapon:weapon('LightbearingMoonshard')};
  const da=expandedWeaponStats(a.weapon).attack-expandedWeaponStats(b.weapon).attack;
  near(sum(panel(a).atk)-sum(panel(b).atk),da*1.5);
  near(sum(panel(a).critical_damage)-sum(panel(b).critical_damage),expandedWeaponStats(a.weapon).subStat-expandedWeaponStats(b.weapon).subStat);
 }
 const prepared={...x,weapon:weapon('WhitelakeFrostfeather',{stack:3,rate:.5},20,true),artifacts:gear};
 const alt={...gear[2],id:6,main_stat:['ElementalMastery',187]};
 const opt={...prepared,target_function:{name:'GanyuDefault',params:'NoConfig',use_dsl:true,dsl_source:'dmg hit = Kaeya.Normal1\nresult = hit.normal.e'},algorithm:'Naive',constraint:{set_mode:'Any'},filter:null};
 const rows=api.OptimizeSingleWasm.optimize(opt,[...gear,alt]);assert.ok(rows.length);
 near(rows[0].value,Math.max(...[gear,[...gear.slice(0,2),alt,...gear.slice(3)]].map(artifacts=>damage({...prepared,artifacts}).normal.expectation)));
 const support=['VodyanitsaE','VodyanitsaA4','VodyanitsaC2'].map(n=>named(n,{hp:60000,constellation:2,e_level:10,ordinary_mode:true,on_field:true}));
 const scoped={...prepared,buffs:support,skill:{index:10,config:'NoConfig'}};
 const physical=damage({...scoped,skill:{index:0,config:'NoConfig'}});
 near(physical.normal.expectation,damage(prepared).normal.expectation);
 const cryo=damage(scoped);
 near(sum(cryo.extra_damage),2800);near(sum(cryo.res_minus),.3);
 const mixed={...opt,buffs:support,target_function:{name:'GanyuDefault',params:'NoConfig',use_dsl:true,dsl_source:'dmg a = Kaeya.Normal1\ndmg e = Kaeya.E1\nresult = a.normal.e + e.normal.e'}};
 const optimized=api.OptimizeSingleWasm.optimize(mixed,gear);assert.ok(optimized.length);
 near(optimized[0].value,physical.normal.expectation+cryo.normal.expectation);

});

test('Scoped moon and stellar weapon bonuses match native full-state anchors without cross-channel leakage',()=>{
 const base=original.CalculatorInterface.get_damage_analysis(x);
 const b=named('FracturedHalo',{refine:1,rate:1});
 const old=rawOriginal.CalculatorInterface.get_damage_analysis({...x,buffs:[b]});
 const compiled=original.CalculatorInterface.get_damage_analysis({...x,buffs:[b]});
 for(const key of ['direct_moonelectro_compose','direct_moonbloom_compose','direct_mooncrystallize_compose'])near(sum(compiled[key]),sum(old[key]));
 near(sum(compiled.direct_moonelectro_compose)-sum(base.direct_moonelectro_compose),.4);
 for(const [name,p,legacy,key] of [
  ['LightbearingMoonshard',{extra_active:true,rate:.5},{extra_active:true},'direct_mooncrystallize'],
  ['WhitelakeFrostfeather',{stack:3,rate:.5},{stack:3},'direct_stellarconduct']]){
   const half=damage({...x,weapon:weapon(name,p)});
   const full=rawOriginal.CalculatorInterface.get_damage_analysis({...x,weapon:weapon(name,legacy)});
   const off=damage({...x,weapon:weapon(name,{...p,rate:0})});
   // Attack scaling changes for WhiteLake; compare normalized critical/noncritical ratio.
   if(name==='WhitelakeFrostfeather')near(sum(half.critical_damage_stellarconduct),(sum(full.critical_damage_stellarconduct)+sum(off.critical_damage_stellarconduct))/2);
   else near(sum(half[key+'_compose'])-sum(off[key+'_compose']),.32);
 }
 const disabled=original.CalculatorInterface.get_damage_analysis({...x,buffs:[{...b,lock:true}]});
 near(sum(disabled.direct_moonelectro_compose),sum(base.direct_moonelectro_compose));
});

test('Explicit overlap works in both cores, validates bounds and deduplicates equipped/team Nightweaver',()=>{
 near(knownOverlap(.7,.6,.4),.4);assert.throws(()=>knownOverlap(.7,.6),/同时生效/);assert.throws(()=>knownOverlap(.7,.6,.1),/之间/);
 for(const input of [x,vody,vesna]){
  const off={...input,weapon:weapon('ReliquaryOfTruth')};
  const on={...input,weapon:weapon('ReliquaryOfTruth',{skill_active:true,lunar_bloom_hit:true,skill_rate:.7,lunar_rate:.6,overlap_rate:.4})};
  near(sum(panel(on).elemental_mastery)-sum(panel(off).elemental_mastery),72);
  near(sum(panel(on).critical_damage)-sum(panel(off).critical_damage),.192);
  const night={...input,weapon:weapon('NightweaversLookingGlass',{skill_active:true,lunar_bloom_active:true,skill_rate:.7,lunar_rate:.6,overlap_rate:.4})};
  const nightOff={...input,weapon:weapon('NightweaversLookingGlass')};
  near(sum(panel(night).elemental_mastery)-sum(panel(nightOff).elemental_mastery),78);
  const d=api.CalculatorInterface.get_transformative_damage(night);
  // Bloom scales with EM, so compare to manually added EM and precisely one team bonus.
  const expected=api.CalculatorInterface.get_transformative_damage({...nightOff,buffs:[named('ElementalMastery',{value:78}),named('NightweaversLookingGlass',{refine:1,overlap_rate:.4,northernmost_runo_active:true,crescent_verse_active:true})]});
  near(d.bloom,expected.bloom);
  const duplicate=api.CalculatorInterface.get_transformative_damage({...night,buffs:[named('NightweaversLookingGlass',{refine:1,overlap_rate:.4})]});
  near(duplicate.bloom,d.bloom);
  const locked=api.CalculatorInterface.get_transformative_damage({...night,buffs:[{...named('NightweaversLookingGlass',{refine:1,overlap_rate:1}),lock:true}]});
  near(locked.bloom,d.bloom);
 }
});


test('Explicit old-character stellar multiplier excludes flat addition and ordinary DEF reduction caps at 90%',()=>{
 const c={kind:'stellar-swirl',element:'Anemo',panelMode:'before-buffs',panel:{ATK:100,em:0,critRate:0,critDamage:0},skillMultiplier:2,flatBonus:30,resistanceBeforeBuffs:0};
 const b=[named('StellarSwirlDamageMultiplier',{p:150}),named('IndependentDamageMultiplier',{p:300})];
 const result=api.CalculatorInterface.get_damage_analysis({...x,single_hit_context:c,buffs:b});near(result.single_hit.non_critical,330);
 assert.throws(()=>api.OptimizeSingleWasm.optimize({...x,single_hit_context:c,buffs:b},gear),/仅支持单次/);
 const ordinary={...c,kind:'ordinary',character:x.character,defMinus:1};
 near(calculateSingleHit(ordinary).defenseMultiplier,1/1.1);
 const q={...structuredClone(vody),character:{...vody.character,skill3:9,params:{Vodyanitsa:{...vody.character.params.Vodyanitsa,song_active:true,ordinary_mode:false}}},buffs:[{name:'ExtensionEffect',config:{ExtensionEffect:{label:'synthetic scoped check',values:{BonusHydro:.5,ExtraDmgBase:300}}}}]};
 const on=damage(q),off=damage({...q,character:{...q.character,params:{Vodyanitsa:{...q.character.params.Vodyanitsa,song_active:false}}}});
 near(sum(on.hp_ratio)/sum(off.hp_ratio),1.864);
 near(sum(on.bonus),sum(off.bonus));
 near(sum(on.extra_damage),300);
 near(on.normal.non_critical,(sum(on.hp)*sum(off.hp_ratio)*1.864+300)*1.5*.45);
 const opt={...q,target_function:{name:'VodyanitsaDefault',params:'NoConfig'},algorithm:'Naive',constraint:{set_mode:'Any'},filter:null};
 const rows=api.OptimizeSingleWasm.optimize(opt,gear);assert.ok(rows.length);
 near(rows[0].value,damage({...q,artifacts:gear}).normal.expectation);

});


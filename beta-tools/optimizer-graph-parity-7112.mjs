import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {fixture,weapon,namedBuff} from './interface-audit-7108.mjs';
const {api}=await import(pathToFileURL(path.resolve(process.argv[2]||'beta-tools/runtime-7106.mjs')));
const rows=[];
for(const role of ['Kaeya','HuTao','RaidenShogun','Columbina']){
 const x=fixture(role);x.enemy={level:100,electro_res:.3,pyro_res:.2,cryo_res:-.1,hydro_res:.15,anemo_res:.1,geo_res:.25,dendro_res:.1,physical_res:.5};
 if(role==='HuTao'){x.weapon=weapon('StaffOfHoma');x.weapon.params.StaffOfHoma.be50_rate=1;}
 if(role==='RaidenShogun'){x.weapon=weapon('EngulfingLightning');x.weapon.params.EngulfingLightning.rate=1;}
 if(role==='Columbina'){x.character.constellation=2;Object.assign(x.character.params.Columbina,{p2_stacks:3,c2_active:true,gravity_type:3,has_verdant_dew:true});x.weapon=weapon('NocturnesCurtainCall');x.weapon.params.NocturnesCurtainCall.sacred_wine_uptime=1;Object.assign(x.target_function.params.ColumbinaDefault,{moonbloom_ratio:1,mooncrystallize_ratio:1});}
 // All three percent dependencies and multiple set counts are live; no account data.
 const mains=[['HPFixed',4780],['ATKFixed',311],['HPPercentage',.466],['ATKPercentage',.466],['DEFPercentage',.583]];
 const sets=role==='Columbina'?['AubadeOfMorningstarAndMoon','GildedDreams']:role==='RaidenShogun'?['EmblemOfSeveredFate','GladiatorsFinale']:['GladiatorsFinale','WanderersTroupe'];
 const arts=x.artifacts.flatMap((a,i)=>[0,1].map(k=>({...structuredClone(a),id:i*2+k+1,main_stat:mains[i],set_name:sets[k],sub_stats:[['Recharge',.15+k*.05],['ElementalMastery',35+i*4-k*3],['CriticalRate',.04+k*.01],['CriticalDamage',.1+i*.01],['HPFixed',200+k*100],['ATKFixed',15+i],['DEFFixed',20+i],['HPPercentage',.05+k*.01],['ATKPercentage',.04+i*.01],['DEFPercentage',.03+k*.01]]})));
 x.buffs=[namedBuff('CustomBonus')];x.artifacts=arts.filter((_,i)=>i%2===0);
 for(const algorithm of ['AStar','Naive']){
   const c={...structuredClone(x),algorithm,constraint:{set_mode:'Any',hp_min:15000,atk_min:400,def_min:100,em_min:100,recharge_min:1.2,crit_min:.1,crit_dmg_min:.5}};
   const before=JSON.stringify([c,arts]);const results=api.OptimizeSingleWasm.optimize(c,arts);assert.ok(results.length);assert.equal(JSON.stringify([c,arts]),before);
   rows.push({role,algorithm,results});
 }
 rows.push({role,damage:api.CalculatorInterface.get_damage_analysis(x,null),attributes:api.CommonInterface.get_attribute(x),bonus:api.BonusPerStat.bonus_per_stat({character:x.character,weapon:x.weapon,tf:x.target_function,artifacts:x.artifacts,buffs:x.buffs,enemy:x.enemy,artifact_config:x.artifact_config})});
}
const d=fixture('Kaeya');
// Check the actual DSL graph consumer independently of artifact search.
rows.push({role:'Kaeya',dsl:api.DSLInterface.run('prop p = Kaeya.atk\nprint(p)',d,d.artifacts)});
fs.writeFileSync(process.argv[3]||'.build-target/optimizer-graph-7112/parity-current.json',JSON.stringify(rows));
console.log(JSON.stringify({cases:rows.length,optimizations:rows.filter(r=>r.algorithm).length,finite:rows.filter(r=>r.algorithm).every(r=>r.results.every(x=>Number.isFinite(x.value)))}));

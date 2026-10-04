import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {chars,buffs,fixture,optimizer,gear,namedBuff} from '../beta-tools/interface-audit-7108.mjs';
import {normalizeEnemy} from '../beta-data/enemy-interface.mjs';
import {probeCompiledOptimizer} from '../beta-tools/compiled-worker-probe.mjs';
const near=(a,b,label='')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
function quiet(fn){const log=console.log,error=console.error;console.log=()=>{};console.error=()=>{};try{return fn()}finally{console.log=log;console.error=error}}
function tree(a,b,label=''){if(typeof b==='number')return near(a,b,label);if(b===null||typeof b!=='object')return assert.equal(a,b,label);assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),label);for(const k of Object.keys(b))tree(a[k],b[k],label+'/'+k);}
const enemy=normalizeEnemy({level:150,electro_res:-.4,pyro_res:0,hydro_res:.6,cryo_res:.75,anemo_res:1.2,geo_res:.8,dendro_res:.2,physical_res:.6});
const defense={name:'ExtensionEffect',config:{ExtensionEffect:{label:'合成减防与穿防',values:{DefMinus:.3,DefPenetration:.25,ResMinusBase:.2}}}};
function dslTarget(x,source){x.target_function={...x.target_function,use_dsl:true,dsl_source:source};return x;}
function gain(x){return api.BonusPerStat.bonus_per_stat({...x,tf:x.target_function,artifacts_config:x.artifact_config});}
const damage=(x,index=0,key='normal')=>{const {target_function,tf,algorithm,constraint,filter,...input}=x;return api.CalculatorInterface.get_damage_analysis({...input,skill:{...input.skill,index}},null)[key].expectation;};
const evidence={};

test('Default results and actual enemies: all 134 targets, eight elements, native and extension paths',()=>quiet(()=>{
 const before=JSON.parse(fs.readFileSync('.build-target/interface-audit-2/default-before.json','utf8'));
 // Ineffa now intentionally excludes independent reaction Lunar-Charged.
 for(const role of Object.keys(chars).filter(name=>name!=='Ineffa')){const x=fixture(role);tree(api.OptimizeSingleWasm.optimize(optimizer(x),gear),before[role].opt,role+'/opt');tree(gain(x),before[role].bonus,role+'/bonus');}
 const cases=[['Lisa','Normal1',0],['Diluc','E1({pyro: true})',9],['Mona','Normal1',0],['Kaeya','E1',10],['Sucrose','Normal1',0],['Ningguang','Normal',0],['Nahida','Normal1',0],['Kaeya','Normal1',0],['Vodyanitsa','EInitial',8],['RaidenShogun','Q1({under_e: true, resolve_stack: 60})',12]];
 for(const [role,skill,index]of cases)for(const debuff of [false,true]){
  const x=dslTarget(fixture(role),`dmg hit = ${role}.${skill}\nresult = hit.normal.e`);x.enemy=enemy;x.character.constellation=role==='RaidenShogun'?2:0;if(debuff)x.buffs=[defense];
  const expected=damage(x,index);const beforeInput=structuredClone(x);
  for(const algorithm of ['AStar','Naive'])near(api.OptimizeSingleWasm.optimize({...optimizer(x),algorithm},gear)[0].value,expected,role+'/'+algorithm+'/'+debuff);
  assert.deepEqual(x,beforeInput);
 }
 for(const [role,target,index,key]of [['Sandrone','SandroneStellarSwirl',18,'direct_stellarswirl'],['YumemizukiMizuki','YumemizukiMizukiStellarSwirl',14,'direct_stellarswirl'],['Vesna','VesnaDefault',17,'direct_stellarswirl']]){
  const x=fixture(role,target);x.enemy=enemy;if(role==='Vesna'){x.character.params.Vesna.radiance=true;x.character.params.Vesna.stance=true;}
  near(api.OptimizeSingleWasm.optimize(optimizer(x),gear)[0].value,damage(x,index,key),role);
 }
 const x=dslTarget(fixture(), 'dmg hit = Kaeya.Normal1\nresult = hit.normal.e');x.enemy={level:150,physical_res:.6};
 evidence.enemy={old:901.6518113437501,repaired:api.OptimizeSingleWasm.optimize(optimizer(x),gear)[0].value,singleHit:damage(x),defaultRoles:Object.keys(chars).length};
 for(const invalid of [{level:0},{level:90.5},{pyro_res:NaN},{hydro_res:Infinity}])assert.throws(()=>api.OptimizeSingleWasm.optimize({...optimizer(x),enemy:invalid},gear),/敌人/);
 near(api.OptimizeSingleWasm.optimize({...optimizer(x),enemy:null},gear)[0].value,901.6518113437501,'bridge reset');
}));

test('Mixed damage candidate ranking and stat gains use the actual enemy in every evaluation',()=>quiet(()=>{
 const x=dslTarget(fixture(),'dmg a = Kaeya.Normal1\ndmg e = Kaeya.E1\nresult = 6 * a.normal.e + e.melt.e');
 const candidates=[...gear,{...gear[3],id:6,main_stat:['PhysicalBonus',.583]},{...gear[3],id:7,main_stat:['CryoBonus',.466]}];
 const score=y=>6*damage(y,0)+damage(y,10,'melt');const records=[];
 for(const config of [normalizeEnemy({}),normalizeEnemy({level:150,physical_res:1.2,cryo_res:-.4})]){
  x.enemy=config;
  const choices=[4,6,7].map(id=>{const artifacts=gear.map(a=>a.slot==='Goblet'?candidates.find(b=>b.id===id):a);return {id,value:score({...x,artifacts})}}).sort((a,b)=>b.value-a.value);
  for(const algorithm of ['AStar','Naive']){const actual=api.OptimizeSingleWasm.optimize({...optimizer(x),algorithm},candidates)[0];assert.equal(actual.goblet,choices[0].id);near(actual.value,choices[0].value);}
  const before=score(x),improved=structuredClone(x);improved.artifacts[0].sub_stats.push(['ElementalMastery',23]);const actualGain=gain(x).elemental_mastery[0];near(actualGain,score(improved)/before-1,'mixed EM gain');
  records.push({enemy:config,goblet:choices[0].id,value:choices[0].value,emGain:actualGain});
 }
 assert.notEqual(records[0].goblet,records[1].goblet);assert.notEqual(records[0].emGain,records[1].emGain);evidence.mixed=records;
}));

test('Disabled BUFFs cannot alter any character path or trigger unsupported-effect guards; finite gains',()=>quiet(()=>{
 for(const role of ['Kaeya','Vodyanitsa','Vesna']){
  const x=fixture(role),panel=api.CommonInterface.get_attribute(x);
  for(const name of Object.keys(buffs)){const b=namedBuff(name);tree(api.CommonInterface.get_attribute({...x,buffs:[{...b,lock:true}]}),panel,role+'/'+name+'/locked');tree(api.CommonInterface.get_attribute({...x,buffs:[{...b,config:{[name]:{...(b.config?.[name]||{}),active:false}}}]}),panel,role+'/'+name+'/inactive');}
  const disabled=[{...namedBuff('Recharge'),lock:true},{...namedBuff('StellarSwirlDamageMultiplier'),lock:true}];
  tree(api.OptimizeSingleWasm.optimize({...optimizer(x),buffs:disabled},gear),api.OptimizeSingleWasm.optimize(optimizer(x),gear));tree(gain({...x,buffs:disabled}),gain(x));
  if(role!=='Vesna'){const out=api.DSLInterface.run(`prop p = ${role}.atk\nprint(p)`,{...x,buffs:disabled},gear);assert.equal(out.is_error,false);near(Number(out.output.trim().replace(/^MONA: /,'')),Object.values(panel.atk).reduce((a,b)=>a+b,0));}
 }
 const x=dslTarget(fixture(),'prop p = Kaeya.em\nresult = p');x.artifacts=[];
 assert.throws(()=>gain(x),/基准值为零/);
 x.target_function.dsl_source='result = 0';assert.ok(Object.values(gain(x)).every(values=>values.length===0));
 evidence.disabled={buffs:Object.keys(buffs).length,roles:3,states:['lock:true','active:false']};
}));

test('Built production worker shares custom-enemy and disabled-BUFF contracts',async()=>{
 const rows=[];
 for(const role of ['Kaeya','Vodyanitsa','Vesna']){
  const x=fixture(role);x.enemy=enemy;x.buffs=[{...namedBuff('Recharge'),lock:true}];
  if(role!=='Vesna')dslTarget(x,`dmg hit = ${role}.Normal1\nresult = hit.normal.e`);
  const expected=quiet(()=>api.OptimizeSingleWasm.optimize(optimizer(x),gear)[0].value);
  const result=await probeCompiledOptimizer('dist',optimizer(x),gear);assert.equal(result.type,'results',JSON.stringify(result));near(result.data.results[0].value,expected,role+' worker');rows.push({role,value:expected});
 }
 evidence.workers=rows;
 fs.writeFileSync('.build-target/interface-audit-2/evidence.json',JSON.stringify(evidence,null,2));
});

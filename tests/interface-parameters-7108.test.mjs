import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {api} from '../beta-tools/runtime.mjs';
import {chars,buffs,fixture,optimizer,gear,namedBuff} from '../beta-tools/interface-audit-7108.mjs';
import {normalizeEnemy} from '../beta-data/enemy-interface.mjs';
const near=(a,b,label='')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
function quiet(fn){const log=console.log,error=console.error;console.log=()=>{};console.error=()=>{};try{return fn()}finally{console.log=log;console.error=error}}
function tree(a,b,label=''){if(typeof b==='number')return near(a,b,label);if(b===null||typeof b!=='object')return assert.equal(a,b,label);assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),label);for(const k of Object.keys(b))tree(a[k],b[k],label+'/'+k);}
const enemy=normalizeEnemy({level:150,electro_res:-.4,pyro_res:0,hydro_res:.6,cryo_res:.75,anemo_res:1.2,geo_res:.8,dendro_res:.2,physical_res:.6});
const defense={name:'ExtensionEffect',config:{ExtensionEffect:{label:'合成减防与穿防',values:{DefMinus:.3,DefPenetration:.25,ResMinusBase:.2}}}};
function dslTarget(x,source){x.target_function={...x.target_function,use_dsl:true,dsl_source:source};return x;}
function gain(x){return api.BonusPerStat.bonus_per_stat({...x,tf:x.target_function,artifacts_config:x.artifact_config});}
const damage=(x,index=0,key='normal')=>{const {target_function,tf,algorithm,constraint,filter,...input}=x;return api.CalculatorInterface.get_damage_analysis({...input,skill:{...input.skill,index}},null)[key].expectation;};
const evidence={};

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

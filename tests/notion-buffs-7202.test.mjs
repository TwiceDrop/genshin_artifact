import test from 'node:test';
import assert from 'node:assert/strict';
import {api,sum,read} from '../beta-tools/runtime-7106.mjs';
import {input} from '../beta-tools/preview-7201-fixtures.mjs';
import {fixture,chars} from '../beta-tools/interface-audit-7108.mjs';
import {groupCharacterBuffs,availableCharacterBuffs,bindBuffConfig} from '../src/algorithms/buff-groups/index.mjs';
import {compilePreviewBuff} from '../beta-data/preview-7201-facade.mjs';
const buffs=read('src/assets/_gen_buff.js'),ownership=read('src/algorithms/buff-groups/ownership.json');
const named=(name,p={})=>({name,config:{[name]:{...Object.fromEntries(buffs[name].config.map(f=>[f.name,f.default])),...p}}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function sameNative(a,b,path=''){
 if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(a),Math.abs(b)),`${path}: ${a} != ${b}`);return;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);for(const key of Object.keys(a))sameNative(a[key],b[key],path+'.'+key);return;
 }
 assert.equal(a,b,path);
}

test('Mitya selector separates passives and constellation effects; each effect has independent native consumption',()=>{
 const parts=['MityaA1','MityaStellarBlessing','MityaC1','MityaC2','MityaC6'];
 const group=groupCharacterBuffs(Object.values(buffs),ownership).find(g=>g.character==='Mitya');
 assert.deepEqual(group.buffs.map(b=>b.name),parts);
 assert.deepEqual(availableCharacterBuffs(group.buffs,ownership,{constellation:0}).map(b=>b.name),parts.slice(0,2));
 assert.deepEqual(availableCharacterBuffs(group.buffs,ownership,{constellation:2}).map(b=>b.name),parts.slice(0,4));
 const p={em:500,constellation:6,ascension:6,core_mode:1,beacons:5,polestar:true,recipient_on_field:true};
 const expectations=[{ElementalMastery:150},{StellarConductBaseBonus:.14},{CriticalDamageBase:.4},{ElementalMastery:123,ResMinusElectro:.2,ResMinusCryo:.2},{StellarConductElevation:.2}];
 for(let i=0;i<parts.length;i++){
  const b=named(parts[i],p),values=compilePreviewBuff(b,input('Valeriy'))[0].config.ExtensionEffect.values;
  assert.deepEqual(Object.keys(values).sort(),Object.keys(expectations[i]).sort());
  for(const [k,v]of Object.entries(expectations[i]))near(values[k],v);
 }
 for(const receiver of [input('Valeriy'),fixture('Lisa')]){
  const base=api.CommonInterface.get_attribute(receiver),old=named('MityaSupport',p);
  const separated=parts.map(name=>named(name,p));
  const oldPanel=api.CommonInterface.get_attribute({...receiver,buffs:[old]});
  const newPanel=api.CommonInterface.get_attribute({...receiver,buffs:separated});
  assert.deepEqual(newPanel,oldPanel);
  near(sum(newPanel.elemental_mastery)-sum(base.elemental_mastery),273);
  near(sum(newPanel.critical_damage)-sum(base.critical_damage),.4);
  const locked=separated.map(b=>b.name==='MityaC1'?{...b,lock:true}:b);
  const panel=api.CommonInterface.get_attribute({...receiver,buffs:[old,...locked]});
  near(sum(panel.critical_damage),sum(base.critical_damage));
  near(sum(panel.elemental_mastery)-sum(base.elemental_mastery),273);
  assert.deepEqual(api.CommonInterface.get_attribute({...receiver,buffs:[old,...separated]}),newPanel);
 }
 const c0=bindBuffConfig(buffs.MityaC1,{constellation:0,skill1:10,skill2:10,skill3:10});
 assert.deepEqual(compilePreviewBuff({name:'MityaC1',config:c0},input('Valeriy'))[0].config.ExtensionEffect.values,{});
});

test('Vodyanitsa minimal configs and saved full configs give identical native results; A1 accepts NoConfig',()=>{
 const expected={VodyanitsaE:['e_level'],VodyanitsaA4:['hp','on_field','ordinary_mode'],VodyanitsaC1:['hp','constellation'],VodyanitsaC2:['constellation','on_field','ordinary_mode'],VodyanitsaC6:['constellation'],VodyanitsaA1:[],VodyanitsaSignature:['hp','on_field','refine','stacks','boosted']};
 for(const [name,keys]of Object.entries(expected))assert.deepEqual(buffs[name].config.map(f=>f.name),keys);
 for(const role of ['Jean','Vodyanitsa','Vesna','Valeriy'])for(const [name,keys]of Object.entries(expected)){
  const x=role==='Valeriy'?input(role):fixture(role);x.skill.index=chars[role].skillMap2[0].index;
  const p={hp:60000,constellation:6,e_level:13,on_field:true,ordinary_mode:true,refine:1,stacks:3,boosted:true};
  const old={...x,buffs:[{name,config:{[name]:p}}]};
  x.buffs=[{name,config:keys.length?{[name]:Object.fromEntries(keys.map(k=>[k,p[k]]))}:'NoConfig'}];
  sameNative(api.CalculatorInterface.get_damage_analysis(x,null),api.CalculatorInterface.get_damage_analysis(old,null),`${role}/${name}`);
  sameNative(api.CommonInterface.get_attribute(x),api.CommonInterface.get_attribute(old),`${role}/${name} panel`);
 }
 const x=fixture('Jean');x.buffs=[named('VodyanitsaC1',{constellation:1,hp:0})];
 assert.throws(()=>api.CommonInterface.get_attribute(x),/参数无效/);
 x.buffs=[named('VodyanitsaE',{e_level:16})];assert.throws(()=>api.CommonInterface.get_attribute(x),/参数 e_level 无效/);
});

test('Xianyun and Kachina coverage controls scale real native effects at 0%, 50%, 100%',()=>{
 for(const role of ['Jean','Vodyanitsa']){
  const x=fixture(role);x.skill.index=chars[role].skillMap1.at(-1).index;
  const base=api.CalculatorInterface.get_damage_analysis(x,null).normal.expectation;
  const damage=[0,.5,1].map(rate=>api.CalculatorInterface.get_damage_analysis({...x,buffs:[named('XianyunTalent2',{rate,c2:false,atk:2000})]},null).normal.expectation);
  near(damage[0],base);assert.ok(damage[2]>base);near(damage[1]-base,(damage[2]-base)/2);
  // Synthetic fixture: enemy default DEF multiplier 0.5, resistance 0.9,
  // default 5% CR / 50% CD. Jean plunge is physical and has no extra bonus.
  if(role==='Jean')near(damage[2]-base,4000*.5*.9*1.025);
  const panel=api.CommonInterface.get_attribute(x),baseDef=sum(panel.def);
  for(const rate of [0,.5,1]){
   const result=api.CommonInterface.get_attribute({...x,buffs:[named('KachinaC4',{rate,character_count:4})]});
   near(sum(result.def)-baseDef,baseDef*.2*rate);
  }
 }
});

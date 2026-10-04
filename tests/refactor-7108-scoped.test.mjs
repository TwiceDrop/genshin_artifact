import test from 'node:test';
import assert from 'node:assert/strict';
import {api,original,vody,named} from '../beta-tools/runtime-7106.mjs';
import {stellarSupportState} from '../beta-data/stellar-support-facade.mjs';
import {VODYANITSA_SUPPORT_RULES,STELLAR_SUPPORT_RULES} from '../beta-data/scoped-character-effect-rules.mjs';
import {CHARACTER_EFFECT_RULES,PENDING_CHARACTER_RULES} from '../beta-data/character-effect-rules.mjs';
import {evaluateEffectRule} from '../beta-data/effect-rule-engine.mjs';
import {BUFF_RULE_SCHEMA} from '../beta-data/buff-rule-schema.mjs';
import fs from 'node:fs';
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Scoped support: full catalogue accountability, elemental isolation and disable state',()=>{
 const text=fs.readFileSync(new URL('../src/assets/_gen_buff.js',import.meta.url),'utf8');const catalogue=JSON.parse(text.slice(text.indexOf('export default')+14));
 const rules={...CHARACTER_EFFECT_RULES,...PENDING_CHARACTER_RULES,...VODYANITSA_SUPPORT_RULES,...STELLAR_SUPPORT_RULES};
 for(const b of Object.values(catalogue).filter(b=>b.genre==='Character')){assert.ok(rules[b.name],b.name);assert.ok(BUFF_RULE_SCHEMA[b.name]);}
 const parameters={hp:60000,constellation:6,e_level:10,ordinary_mode:true,on_field:true};
 const buffs=Object.keys(VODYANITSA_SUPPORT_RULES).map(name=>named(name,parameters));
 const x={...structuredClone(vody),character:{name:'Kaeya',level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:'NoConfig'},weapon:{name:'DullBlade',level:90,ascend:false,refine:1,params:'NoConfig'},skill:{index:0,config:'NoConfig'},buffs};
 const values={};for(const rule of Object.values(VODYANITSA_SUPPORT_RULES))for(const[k,v]of Object.entries(evaluateEffectRule(rule,parameters,{...x,effect_element:'Cryo',damage_scope:true})))values[k]=(values[k]||0)+v;
 near(values.ATKFixed,480);near(values.ExtraDmgBase,2800);near(values.CriticalDamageBase,.5);near(values.BonusCryo,.6);
 const actual=api.CalculatorInterface.get_damage_analysis(x,'Cryo');
 const expected=original.CalculatorInterface.get_damage_analysis({...x,buffs:[{name:'ExtensionEffect',config:{ExtensionEffect:{label:'Expected',values}}}]},'Cryo');near(actual.normal.expectation,expected.normal.expectation);
 const disabled=api.CalculatorInterface.get_damage_analysis({...x,buffs:buffs.map(b=>({...b,lock:true}))},'Cryo');near(disabled.normal.expectation,api.CalculatorInterface.get_damage_analysis({...x,buffs:[]},'Cryo').normal.expectation);
 const s=stellarSupportState({character:{name:'Kaeya'},buffs:[named('SandroneC1',{}),named('VesnaTalent1',{atk:3000,coverage:.5}),{...named('QiqiTalent2StellarConduct',{}),lock:true}]});near(s.bonus,.3);near(s.base,.07);
 const wrongElement=evaluateEffectRule(VODYANITSA_SUPPORT_RULES.VodyanitsaA4,parameters,{effect_element:'Pyro',damage_scope:true});assert.deepEqual(wrongElement,{});
});

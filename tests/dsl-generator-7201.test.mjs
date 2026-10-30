import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';
import {api} from '../beta-tools/runtime-7106.mjs';import {chars,fixture} from '../beta-tools/interface-audit-7108.mjs';
import {generateDsl,skillRows,availableDamageTypes} from '../src/algorithms/dsl-generator.mjs';
const names=JSON.parse(fs.readFileSync('beta-data/dsl-skill-names.json','utf8'));
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('生成器名称覆盖与代码实际执行：普通/附魔/参数/星伤/荧',()=>{
 assert.equal(Object.keys(names).length,Object.keys(chars).length);for(const [name,c]of Object.entries(chars))for(const row of skillRows(c,names[name]))assert.match(row.token,/^[A-Za-z][A-Za-z0-9_]*$/);
 for(const [name,index,infusion]of [['Amber',7,'None'],['Kaeya',0,'Pyro'],['Mitya',8,'None'],['Sandrone',18,'None'],['LumineCryo',6,'None']]){
  const x=fixture(name),originalTarget=x.target_function;delete x.target_function;x.skill.index=index;if(name==='Sandrone')x.character.params.Sandrone.radiance=true;
  const row=skillRows(chars[name],names[name]).find(r=>r.index===index),choices=availableDamageTypes(api,x,row,x.skill.config,infusion);assert.ok(choices.length,name);const reaction=choices[0].key,params=x.skill.config==='NoConfig'?{}:x.skill.config[name];
  const state={character:name,entries:[{token:row.token,params,infusion,reaction,value:'e',count:2,weight:.5},{token:row.token,params,infusion,reaction,value:'n',count:1,weight:2}]},source=generateDsl(state);
  const r=api.DSLInterface.run(source+'\nprint(result)',x,x.artifacts);assert.equal(r.is_error,false,JSON.stringify(r));const d=api.CalculatorInterface.get_damage_analysis(x,infusion==='None'?null:infusion)[reaction];near(Number(r.output.trim().replace(/^MONA: /,'')),d.expectation+2*d.non_critical);
  const target={name:originalTarget.name,params:originalTarget.params,use_dsl:true,dsl_source:source},rows=api.OptimizeSingleWasm.optimize({...x,target_function:target,algorithm:'Naive',constraint:null,filter:null},x.artifacts);near(rows[0].value,d.expectation+2*d.non_critical);
  assert.equal(generateDsl(JSON.parse(JSON.stringify(state))),source);
 }
 assert.equal(generateDsl({character:'Amber',entries:[]}),'result = 0');
});

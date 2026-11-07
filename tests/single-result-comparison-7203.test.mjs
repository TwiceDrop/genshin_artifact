import test from 'node:test'
import assert from 'node:assert/strict'
import {sameHitBaseline,changedAffixes,percentChange} from '../src/algorithms/single-result-comparison.mjs'
import {compareEquipment} from '../src/composables/artifactComparison.mjs'

test('only the same skill branch, element and outcome kind provide a hit baseline',()=>{
 const physical={element:'Physical',normal:{expectation:100}},pyro={element:'Pyro',normal:{expectation:130},melt:{expectation:190}}
 assert.equal(sameHitBaseline(physical,physical,'normal'),100)
 assert.equal(sameHitBaseline(physical,pyro,'normal'),null)
 assert.equal(sameHitBaseline(physical,{...physical,is_heal:true},'normal'),null)
 assert.equal(sameHitBaseline(pyro,physical,'melt'),null)
 assert.equal(sameHitBaseline(physical,null,'normal'),null)
 assert.equal(percentChange(130,null),'')
 assert.equal(percentChange(130,0),'')
 assert.equal(percentChange(100,100),'0.00%')
 assert.equal(percentChange(99,100),'-1.00%')
})

test('old and new affixes align by identity, including replaced main, addition and removal',()=>{
 const stat=(name,value)=>({name,value})
 const a={id:1,position:'sand',setName:'gladiatorFinale',star:5,level:20,mainTag:stat('attackPercentage',.466),normalTags:[stat('critical',.031),stat('lifeStatic',508)]}
 const b={...a,id:2,mainTag:stat('recharge',.518),normalTags:[stat('defendStatic',19),stat('critical',.031)]}
 const rows=changedAffixes(a,b)
 assert.deepEqual(rows.map(r=>[r.kind,r.old?.name,r.now?.name]),[['主词条','attackPercentage','recharge'],['副词条','lifeStatic',undefined],['副词条',undefined,'defendStatic']])
 assert.equal(changedAffixes(a,{...a,normalTags:a.normalTags.slice().reverse()}).length,0)
 assert.equal(changedAffixes(null,b).length,3)
 assert.equal(changedAffixes(a,null).length,3)
 assert.deepEqual(compareEquipment([b,null,a],[a,a,null]),['已替换','已卸下','新增','',''])
 assert.equal(compareEquipment([a],[{...a,id:-1}])[0],'')
 assert.equal(compareEquipment([a],[{...a,id:77}])[0],'已替换')
})


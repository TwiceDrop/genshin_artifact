import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createMysConverter } from '../src/import/miyoushe.mjs'
import { availableCharacterBuffs, bindBuffConfig, characterBuffProfile, groupCharacterBuffs, groupSelectedBuffs } from '../src/algorithms/buff-groups/index.mjs'
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8').replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,'').trim().replace(/;$/,''))
const characters=read('../src/assets/_gen_character.js'),weapons=read('../src/assets/_gen_weapon.js'),artifacts=read('../src/assets/_gen_artifact.js'),targets=read('../src/assets/_gen_tf.js'),locale=read('../src/i18n/generated/zh-cn.json')
const converter=createMysConverter({characters,weapons,artifacts,targets,locale})
test('beta1 模拟米游社快照导入沃雅妮莎，显示天赋不重复叠加命座',()=>{
 const snapshot={base:{id:10000140,name:'沃雅妮莎',element:'Hydro',level:90,actived_constellation_num:3},weapon:{id:14524,name:'漩流颂歌',level:90,promote_level:6,affix_level:3},skills:[1,2,3].map((i,n)=>({skill_type:1,name:locale[characters.Vodyanitsa[`skillName${i}`]],level:[1,13,10][n]})),relics:[]}
 const before=structuredClone(snapshot),entry=converter.character(snapshot,'123456789')
 assert.deepEqual(snapshot,before)
 assert.equal(entry.preset.character.name,'Vodyanitsa');assert.equal(entry.preset.character.constellation,3)
 assert.deepEqual([entry.preset.character.skill1,entry.preset.character.skill2,entry.preset.character.skill3],[0,12,9])
 assert.equal(entry.preset.weapon.name,'HymnOfTheMaelstrom');assert.equal(entry.preset.weapon.refine,3)
 const profile=characterBuffProfile('Vodyanitsa','123456789',[{uid:'123456789',presetName:'test'}],{test:{item:entry.preset}})
 const buffs=read('../src/assets/_gen_buff.js'),rules=read('../src/algorithms/buff-groups/ownership.json')
 const list=groupCharacterBuffs(Object.values(buffs),rules).find(group=>group.character==='Vodyanitsa').buffs
 assert.equal(list.length,6)
 assert.deepEqual(availableCharacterBuffs(list,rules,profile).map(b=>b.name),['VodyanitsaE','VodyanitsaA4','VodyanitsaC1','VodyanitsaC2','VodyanitsaA1'])
 assert.equal(buffs.VodyanitsaSignature.genre,'Weapon')
 const savedWeaponBuff={id:1,name:'VodyanitsaSignature',config:{VodyanitsaSignature:{hp:50000,refine:5,stacks:3,boosted:true}},lock:false}
 assert.deepEqual(groupSelectedBuffs([savedWeaponBuff],buffs,rules),{characters:[],other:[savedWeaponBuff]})
 const config=bindBuffConfig(buffs.VodyanitsaE,profile).VodyanitsaE
 assert.equal(config.e_level,13);assert.equal(config.constellation,3)
 assert.equal(characterBuffProfile('Vodyanitsa','987654321',[],{}).imported,false)
})
test('beta2 薇斯纳和蝶变可以由实际角色元数据导入，天赋按名称恢复',()=>{
 const snapshot={base:{id:10000143,name:'薇斯纳',element:'Wind',level:90,actived_constellation_num:3},weapon:{id:11522,name:'蝶变',level:90,promote_level:6,affix_level:1},skills:[3,1,2].map(i=>({skill_type:1,name:locale[characters.Vesna[`skillName${i}`]],level:i===2?13:10})),relics:[]}
 const entry=converter.character(snapshot,'102233531');assert.equal(entry.preset.character.name,'Vesna');assert.deepEqual([entry.preset.character.skill1,entry.preset.character.skill2,entry.preset.character.skill3],[9,12,9]);assert.equal(entry.preset.weapon.name,'BeyondTheChrysalis');assert.equal(entry.preset.targetFunction.name,'VesnaDefault');assert.notEqual(entry.key,converter.character(snapshot,'282937500').key)
})

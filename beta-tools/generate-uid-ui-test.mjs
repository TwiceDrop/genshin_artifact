import fs from 'node:fs'
import { createMysConverter } from '../src/import/miyoushe.mjs'
import { exportUidPackage } from '../src/import/uid-package.mjs'
const meta = n => JSON.parse(fs.readFileSync(`src/assets/_gen_${n}.js`,'utf8').replace(/^.*\nexport default /,'').trim().replace(/;$/,''))
const catalog={characters:meta('character'),weapons:meta('weapon'),artifacts:meta('artifact'),targets:meta('tf'),locale:JSON.parse(fs.readFileSync('src/i18n/generated/zh-cn.json','utf8'))}
const converter=createMysConverter(catalog),snapshot=JSON.parse(fs.readFileSync('tests/fixtures/miyoushe-synthetic.json','utf8'))
snapshot.role.uid='111111111'
const data={entries:[],snapshots:{'111111111':snapshot}}, presets={}, inventory=new Map()
for(const raw of snapshot.characters){const c=converter.character(raw,'111111111'), ids=c.gear.map(a=>{const id=inventory.size+10;inventory.set(id,{...a,id});return id})
const item={...c.preset,artifactIds:ids,miyousheKey:c.key};presets[item.name]={name:item.name,item,version:3}
data.entries.push({key:c.key,uid:'111111111',label:c.label,artifactIds:ids,equippedArtifacts:c.gear,presetName:item.name})}
const first=data.entries[0];data.artifactComparison={enabled:true,mode:'history',history:[{id:'test-comparison',key:first.key,time:'2026-09-12T12:00:00Z',label:'伤害对比测试基准',items:first.artifactIds.map(id=>{const a=structuredClone(inventory.get(id));if(a.mainTag.name==='attackStatic')a.mainTag.value=100;return a})}]}
fs.writeFileSync('beta-data/ui-uid-test.json',JSON.stringify(exportUidPackage('111111111',data,presets,inventory)))
console.log('synthetic UI test package created; artifacts:',inventory.size)

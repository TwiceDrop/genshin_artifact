import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {bindings} from '../mona_wasm/pkg/bindings.js'
import * as bridge from '../mona_wasm/pkg/mona_wasm_bg.js'
import * as extension from '../mona_wasm/extension/mona_extension.js'
import {createFacade} from '../beta-data/facade.mjs'
import {createBeta2} from '../beta-data/vesna-facade.mjs'
import {withHybridTeamOptimization} from '../beta-data/hybrid-team-optimizer.mjs'

globalThis.module = {require:createRequire(import.meta.url)}
const read = path => JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8')
    .replace(/^(?:\s*\/\/[^\n]*\n)*\s*export default\s*/,''))
bindings.lI(new WebAssembly.Instance(new WebAssembly.Module(
    fs.readFileSync(new URL('../mona_wasm/pkg/mona_wasm_bg.wasm',import.meta.url))),
    {'./mona_wasm_bg.js':bridge}).exports)
extension.initSync(fs.readFileSync(new URL('../mona_wasm/extension/mona_extension_bg.wasm',import.meta.url)))
const old = {CommonInterface:bindings.Ps, CalculatorInterface:bindings.K2,
    OptimizeSingleWasm:bindings.E2, TeamOptimizationWasm:bindings.B8}
const support = read('../beta-data/extension-support.json')
const api = withHybridTeamOptimization(createBeta2(createFacade(old,extension,
    read('../beta-data/vodyanitsa.json'),support,read('../src/assets/_gen_character.js')),
    extension,support))
const skirk = read('../beta-data/skirk-fixture.json').input
const inventory = skirk.artifacts.flatMap((a,index) => [
    {...a,id:index*2+1},
    {...a,id:index*2+2,sub_stats:a.sub_stats.map(([name,value],i) =>
        i === 0 ? ['HPPercentage',0.1] : [name,value])},
])
const source = {
    character:{name:'Vodyanitsa',level:90,ascend:false,constellation:1,skill1:0,skill2:9,skill3:9,
        params:{Vodyanitsa:{e_active:false,song_active:false,ordinary_mode:true,
            c1_active:true,c2_active:false,c4_stacks:0,on_field:true}}},
    weapon:{name:'HymnOfTheMaelstrom',level:90,ascend:false,refine:1,
        params:{HymnOfTheMaelstrom:{stacks:0,boosted:false,on_field:true}}},
    target_function:{name:'VodyanitsaDefault',params:'NoConfig'},
    algorithm:'AStar',constraint:null,filter:null,buffs:[],artifact_config:null,
}
const recipient = {
    character:skirk.character,weapon:skirk.weapon,
    target_function:{name:'SkirkDefault',params:'NoConfig'},
    algorithm:'Naive',constraint:null,filter:null,buffs:[],artifact_config:null,
}
const result = api.TeamOptimizationWasm.optimize_team2({
    single_interfaces:[source,recipient],weights:[1,1],hyper_param:{count:5},
},inventory)
assert.ok(result.artifacts.length > 0)
assert.equal(result.search_complete,true)
for (const team of result.artifacts) {
    assert.equal(team.length,2)
    assert.equal(new Set(team.flatMap(x => Object.values(x))).size,10)
    assert.ok(team.every(x => ['flower','feather','sand','goblet','head'].every(k => Number.isInteger(x[k]))))
}
console.log(`hybrid team WASM smoke passed: ${result.artifacts.length} ranked teams, ${result.evaluated_teams} evaluated`)

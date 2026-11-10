import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'package.json'))
const ts = require('typescript'), vue = require('vue'), compiler = require('@vue/compiler-sfc')
Object.assign(globalThis, { ref: vue.ref, computed: vue.computed, watch: vue.watch })
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const meta = name => {
    const s = read('src/assets/_gen_' + name + '.js')
    return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1))
}
const artifacts = meta('artifact'), characters = meta('character')
const locale = JSON.parse(read('src/i18n/generated/zh-cn.json'))
const cache = new Map()
function load(file) {
    const absolute = path.resolve(root, file)
    if (cache.has(absolute)) return cache.get(absolute).exports
    const m = new Module(absolute)
    cache.set(absolute, m)
    m.filename = absolute
    m.require = spec => {
        if (spec === '@/assets/artifacts') return { artifactsData: artifacts }
        if (spec === '@/assets/character') return { characterData: characters }
        if (spec === '@/assets/_gen_artifact') return { __esModule: true, default: artifacts }
        if (spec === '@/i18n/i18n') return { useI18n: () => ({ ta: index => locale[index] }) }
        if (spec === '@/wasm') return {}
        if (!spec.startsWith('.') && !spec.startsWith('@/')) return require(spec)
        const base = spec.startsWith('@/') ? path.join(root, 'src', spec.slice(2)) : path.resolve(path.dirname(absolute), spec)
        const target = [base, base + '.ts', base + '.js', base + '.json'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
        if (!target) throw new Error('Unresolved import ' + spec)
        return target.endsWith('.json') ? JSON.parse(fs.readFileSync(target, 'utf8')) : load(target)
    }
    const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
    }).outputText
    m._compile(output, absolute)
    return m.exports
}

import {ROLLS,MAIN,MAINS,isFlat,displayValue,seedPiece,toArtifact,inferPiece,validatePiece,normalizeBuild,clone} from '../src/algorithms/artifact-score/rules.mjs'
import {latestRoundingBuild} from './fixtures/dynamic-score-rounding.mjs'
import {createMysConverter} from '../src/import/miyoushe.mjs'
const {convertGoodArtifacts}=load('src/import/good.ts')
const {convertArtifact,convertArtifactNameBack}=load('src/utils/converter.ts')
const publicAffixes=JSON.parse(read('tests/fixtures/dynamic-score-affix-source.json')).affixes
const props={HPFixed:2,HPPercentage:3,ATKFixed:5,ATKPercentage:6,DEFFixed:8,DEFPercentage:9,CriticalRate:20,CriticalDamage:22,Recharge:23,ElementalMastery:24}

test('all 40 five-star roll tiers agree with independent Enka affix efficiencies',()=>{
    for(const [key,tiers] of Object.entries(ROLLS))for(let t=0;t<4;t++){
        const affix=publicAffixes['501'+String(props[key]).padStart(2,'0')+(t+1)]
        assert.ok(affix,key);assert.ok(Math.abs(tiers[t]/tiers[3]-affix.efficiency)<1e-12,key)
    }
})

test('all sorted 1–6-roll histories, both initial counts and six importer precisions have legal witnesses',()=>{
    let count=0
    for(const [key,values] of Object.entries(ROLLS)) {
        const other=Object.keys(ROLLS).filter(k=>k!==key).slice(0,3)
        function visit(tiers,last) {
            if(tiers.length)for(const initial of [3,4])if(tiers.length<=initial+2) {
                const raw=tiers.reduce((n,t)=>n+values[t],0)
                const factor=isFlat(key)?100:10000,units=tiers.reduce((n,t)=>n+Math.round(values[t]*factor),0)
                const divisor=isFlat(key)?100:10,scale=isFlat(key)?1:1000
                const shown=Math.floor((units+divisor/2)/divisor)/scale
                const variants=[raw,shown,Math.fround(raw),tiers.reduce((n,t)=>Math.fround(n+Math.fround(values[t])),0),Math.fround(raw*100)/100,Math.fround(shown)]
                const piece={slot:'Goblet',set_name:'BlizzardStrayer',main_stat:['CryoBonus',.466],initial,
                    lines:[{key,tiers},...other.map((key,j)=>({key,tiers:Array(j===0?initial+3-tiers.length:1).fill(0)}))]}
                validatePiece(piece)
                for(const v of variants){
                    const a=toArtifact(piece);a.sub_stats[0][1]=v;const before=clone(a)
                    assert.doesNotThrow(()=>validatePiece(inferPiece(a)),`${key}/${tiers}/${v}/${initial}`)
                    assert.deepEqual(a,before);count++
                }
            }
            if(tiers.length===6)return
            for(let t=last;t<4;t++)visit([...tiers,t],t)
        }
        visit([],0)
    }
    assert.equal(count,20040)
})

test('all 26 legal slot/main combinations and 8/9-roll allocations; invalid rules remain rejected',()=>{
    let mains=0,allocations=0
    for(const [slot,keys] of Object.entries(MAINS))for(const key of keys){
        mains++
        for(const initial of [3,4])for(const mainValue of [MAIN[key],Math.fround(MAIN[key]),Math.fround(MAIN[key]*100)/100]){
            const p=seedPiece({slot,set_name:'BlizzardStrayer',main_stat:[key,mainValue]},0,initial)
            assert.doesNotThrow(()=>inferPiece(toArtifact(p)))
        }
        for(const initial of [3,4])for(let a=1;a<=initial+2;a++)for(let b=1;b<=initial+2;b++)for(let c=1;c<=initial+2;c++){
            const d=initial+5-a-b-c;if(d<1||d>initial+2)continue
            const p=seedPiece({slot,set_name:'BlizzardStrayer',main_stat:[key,MAIN[key]]},0,initial)
            p.lines.forEach((line,i)=>line.tiers=Array([a,b,c,d][i]).fill(i%4))
            assert.doesNotThrow(()=>inferPiece(toArtifact(validatePiece(p))));allocations++
        }
    }
    assert.equal(mains,26);assert.equal(allocations,2366)
    const original=latestRoundingBuild()[3]
    for(const corrupt of [
        a=>a.sub_stats[0][1]=.084,
        a=>a.sub_stats[0][1]=NaN,
        a=>a.sub_stats[0][0]=a.sub_stats[1][0],
        a=>a.sub_stats[0][0]='ATKPercentage',
        a=>a.main_stat[1]=.4661,
        a=>a.star=4,
        a=>a.level=19,
        a=>a.sub_stats.forEach(s=>s[1]=1),
    ]){const a=clone(original);corrupt(a);assert.throws(()=>inferPiece(a))}
    const build=latestRoundingBuild();assert.deepEqual(normalizeBuild(build),build)
})

test('real GOOD and Miyoushe import boundaries preserve displayed/raw inputs and feed legal scoring',()=>{
    const fixture=latestRoundingBuild(),setName=convertArtifactNameBack('BlizzardStrayer')
    const statKeys={HPFixed:'hp',ATKFixed:'atk',ATKPercentage:'atk_',CriticalRate:'critRate_',CriticalDamage:'critDMG_',DEFFixed:'def',DEFPercentage:'def_',HPPercentage:'hp_',ElementalMastery:'eleMas',Recharge:'enerRech_'}
    const slotKeys=['flower','plume','sands','goblet','circlet'],positions=['flower','feather','sand','cup','head']
    const good={format:'GOOD',version:3,artifacts:fixture.map((a,i)=>({setKey:'BlizzardStrayer',slotKey:slotKeys[i],mainStatKey:statKeys[a.main_stat[0]],rarity:5,level:20,
        substats:a.sub_stats.map(([k,v])=>({key:statKeys[k],value:isFlat(k)?v:v*100}))}))}
    // A raw float32 tail from an upstream exporter is retained by GOOD.
    good.artifacts[3].substats[0].value=Math.fround(8.55)
    const snapshot=clone(good),converted=convertGoodArtifacts(good)
    const fromGood=positions.map((p,i)=>convertArtifact({...converted[p][0],id:i+1}))
    assert.doesNotThrow(()=>normalizeBuild(fromGood));assert.deepEqual(good,snapshot)
    assert.equal(fromGood[3].sub_stats[0][1],Math.fround(8.55)/100)
    const converter=createMysConverter({characters,weapons:{},artifacts,targets:{},locale})
    const apiProps={...props,ElementalMastery:28}
    const fromMys=fixture.map((a,i)=>converter.artifact({pos:i+1,name:locale[artifacts[setName][positions[i]].text],rarity:5,level:20,
        main_property:{property_type:apiProps[a.main_stat[0]],value:String(isFlat(a.main_stat[0])?a.main_stat[1]:a.main_stat[1]*100)},
        sub_property_list:a.sub_stats.map(([k,v])=>({property_type:apiProps[k],value:isFlat(k)?String(v):(v*100).toFixed(1)+'%'}))}))
    assert.doesNotThrow(()=>normalizeBuild(fromMys.map((a,i)=>convertArtifact({...a,id:i+1}))))
})

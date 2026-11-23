import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {api} from '../beta-tools/runtime.mjs'
import {fixture, chars} from '../beta-tools/interface-audit-7108.mjs'
import {normalizeEnemy} from '../beta-data/enemy-interface.mjs'
import {parseTeamDpsConfiguration} from '../beta-data/team-dps-config.mjs'
import {createTeamDpsEvaluator} from '../beta-data/team-dps-evaluator.mjs'
import {teamDamageAnalysis} from '../beta-data/team-dps-result-view.mjs'
import * as lunar from '../src/algorithms/lunar-detail.mjs'
import * as stellar from '../src/algorithms/stellar-detail.mjs'
import * as reactions from '../src/algorithms/reaction-labels.mjs'

const code = fs.readFileSync(new URL('../src/components/display/DamageAnalysis/DamageAnalysis.vue', import.meta.url),'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'').replace('export default','globalThis.component =')
const env = {...lunar,...stellar,...reactions, DamageAnalysisUtil:{}, StellarDamageDetail:{}, LEVEL_MULTIPLIER:[]}
vm.runInNewContext(code,env)
function dialog(analysis,name,enemy) {
    const state = {...env.component.data(),characterName:name,enemyConfig:enemy}
    for (const [key,fn] of Object.entries(env.component.methods)) state[key] = fn.bind(state)
    for (const [key,fn] of Object.entries(env.component.computed)) Object.defineProperty(state,key,{get:()=>fn.call(state)})
    state.setValue(analysis)
    return state
}
function near(actual,expected,label) {
    assert.ok(Math.abs(actual-expected) < 1e-8 * Math.max(1,Math.abs(expected)), label+' '+actual+' vs '+expected)
}
function checkTriplet(state,raw,label) {
    assert.ok(state.selectedLunar,label)
    for (const key of ['expectation','critical','non_critical']) {
        near(state.selectedActualResult[key], raw[key], label+' '+key)
        if (state.lunarPreview.recomposed) near(state.lunarPreview.recomposed[key], raw[key], label+' breakdown '+key)
    }
}
const named=(name,p)=>({name,config:{[name]:p}})
test('all three direct lunar details recompose the actual native hits including C6 and support sources',()=>{
    const covered=new Set()
    for(const name of ['Flins','Ineffa','Columbina','Zibai','Linnea','Lauma','Nefer']) {
        const x=fixture(name)
        const indices=new Set([1,2,3].flatMap(n=>chars[name]['skillMap'+n]||[]).map(s=>s.index))
        for(const constellation of [0,6]){
            x.character.constellation=constellation
            x.enemy=normalizeEnemy({level:100,electro_res:.8,geo_res:-.15,dendro_res:.1})
            x.buffs=[named('LaumaBurst',{em:800,skill_level:10,constellation:2,full_moon:true}),named('CriticalMoonReaction',{p:20}),named('MoonReactionDamageMultiplier',{p:150})]
            for(const i of indices) {
                x.skill.index=i
                const a=api.CalculatorInterface.get_damage_analysis(x,null),key=reactions.defaultDamageReaction(a)
                if(!key?.startsWith('direct_moon'))continue
                covered.add(key)
                const state=dialog(a,name,x.enemy)
                checkTriplet(state,a[key],name+'/'+constellation+'/'+i)
                if(name==='Nefer'&&i===11){
                    const prayer=state.selectedLunar.groups.flat.rows.find(row=>row.name==='苍色祷歌')
                    assert.ok(prayer.value>0)
                    prayer.checked=false
                    near(a[key].non_critical-state.selectedActualResult.non_critical,prayer.value*state.lunarPreview.res*state.lunarPreview.elevation,'苍色祷歌')
                }
            }
        }
    }
    assert.equal(covered.size,3)
})
test('four-person direct hits and ranked harmony reproduce per-event totals through the dialog',()=>{
    const axis=parseTeamDpsConfiguration(fs.readFileSync(new URL('../examples/team-dps/zibai-lunar-crystallize.json',import.meta.url),'utf8'))
    const profiles=axis.members.map(({character},i)=>{const x=fixture(character);x.character.constellation=6;x.artifacts.forEach(a=>a.id+=100*i);return x})
    const enemy=normalizeEnemy({level:100}), input={single_interfaces:profiles,team_dps:{axis,enemy_count:2,damage_scope:'all',enemy}}
    const out=createTeamDpsEvaluator(api,input).evaluate(profiles.map(p=>p.artifacts),true)
    const models=new Set()
    for(const hit of out.hits.filter(h=>h.analysis?.damage_kind==='lunarCrystallize')){
        const a=teamDamageAnalysis(hit.analysis), state=dialog(a,profiles[hit.role].character.name,out.enemy)
        checkTriplet(state,hit,hit.label+'/'+hit.time)
        models.add(hit.damageModel)
        if(state.selectedLunar.harmony) {
            assert.ok(state.lunarPreview.contributions.length)
            const snapshot=structuredClone(hit.analysis)
            delete snapshot.lunar_event
            const archived=dialog(teamDamageAnalysis(snapshot),profiles[hit.role].character.name,out.enemy)
            assert.equal(archived.selectedLunar.archivedHarmony,true)
            checkTriplet(archived,hit,'archived harmony')
            state.selectedLunar.groups.level.rows[0].checked=false
            assert.ok(state.selectedActualResult.expectation<=hit.expectation+1e-7)
        } else if(hit.role===0 && hit.expectation>0) {
            const snapshot=structuredClone(hit.analysis)
            delete snapshot.lunar_event
            const archived=dialog(teamDamageAnalysis(snapshot,hit),'Zibai',out.enemy)
            checkTriplet(archived,hit,'archived direct')
            archived.selectedLunar.groups.ratio.rows.forEach(row=>{row.checked=false})
            assert.ok(archived.selectedActualResult.expectation<hit.expectation)
        }
    }
    assert.deepEqual(models,new Set(['direct.lunarCrystallize','reaction.lunarCrystallize']))
})

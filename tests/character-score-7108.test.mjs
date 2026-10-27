import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import {createRequire} from 'node:module'
import * as vue from 'vue'
import {renderToString} from '@vue/server-renderer'
import {parse,compileScript} from '@vue/compiler-sfc'
import {transformSync} from '@babel/core'
import * as score from '../src/algorithms/artifact-score/score.mjs'
import data,{createScoreEvaluator} from '../src/algorithms/artifact-score/vendor/miao.mjs'
import facts from '../src/algorithms/artifact-score/vendor/character-facts.mjs'
import {usefulAttr} from '../src/algorithms/artifact-score/vendor/weights.mjs'
import {sourceScore} from '../.build-target/character-score-20261002/oracle.mjs'
const root='.build-target/character-score-20261002'
const require=createRequire(import.meta.url)
const read=path=>fs.readFileSync(path,'utf8')
const metadata=path=>JSON.parse(read(path).split('export default ')[1])
const chars=metadata('src/assets/_gen_character.js'),sets=metadata('src/assets/_gen_artifact.js'),locale=JSON.parse(read('src/i18n/generated/zh-cn.json'))
const setName=Object.keys(sets).find(k=>sets[k].flower)
const piece=(position,mainName,mainValue,normalTags)=>({id:99,position,star:5,level:20,setName,mainTag:{name:mainName,value:mainValue},normalTags})
const hpSubs=[{name:'lifePercentage',value:.175},{name:'lifeStatic',value:508},{name:'recharge',value:.117},{name:'critical',value:.07}]
const atkSubs=[{name:'attackPercentage',value:.105},{name:'attackStatic',value:33},{name:'critical',value:.07},{name:'criticalDamage',value:.14}]
const healing=[piece('flower','lifeStatic',4780,[...hpSubs.filter(x=>x.name!=='lifeStatic'),{name:'attackStatic',value:16}]),piece('feather','attackStatic',311,hpSubs),piece('sand','lifePercentage',.466,[...hpSubs.filter(x=>x.name!=='lifePercentage'),{name:'elementalMastery',value:23}]),piece('cup','lifePercentage',.466,[...hpSubs.filter(x=>x.name!=='lifePercentage'),{name:'elementalMastery',value:23}]),piece('head','cureEffect',.359,hpSubs)]
const damage=[piece('flower','lifeStatic',4780,atkSubs),piece('feather','attackStatic',311,[...atkSubs.filter(x=>x.name!=='attackStatic'),{name:'elementalMastery',value:42}]),piece('sand','recharge',.518,atkSubs),piece('cup','windBonus',.466,atkSubs),piece('head','criticalDamage',.622,[...atkSubs.filter(x=>x.name!=='criticalDamage'),{name:'recharge',value:.117}])]
const round=x=>Math.round(x*10)/10
const report={date:'2026-10-02',sourceRevision:'fbabcc0c0952c01212c8491b0af9ec3b252a4ba2',scope:'Character artifact scores only',targetedChecks:5,items:[]}
const record=(name,detail)=>report.items.push({name,status:'pass',detail})
after(()=>fs.writeFileSync(root+'/report.json',JSON.stringify(report,null,2)))
function verifyNumerical(name,items,options={},fixedWeights) {
 const source=sourceScore(name,facts.baseAttrMap[name],items.map(score.toScoreArtifact),options,fixedWeights)
 const actual=score.scoreBuild(items,{name,options})
 assert.equal(actual.supported,true)
 assert.deepEqual(actual.artifacts.map(a=>a.score),source.scores.map(round))
 assert.equal(actual.total,round(source.scores.map(round).reduce((a,b)=>a+b,0)))
 for(const item of items) assert.equal(score.scoreDetails(item,{name,options},items).score,actual.artifacts.find(a=>a.pos===score.toScoreArtifact(item).pos).score)
 return {total:actual.total,pieces:actual.artifacts.map(a=>a.score)}
}
test('1 Vodyanitsa: original miao functions agree with build and detail scores',()=>{
 assert.deepEqual(facts.baseAttrMap['沃雅妮莎'],{hp:15870.71,atk:131.85,def:518.6})
 assert.deepEqual([usefulAttr['沃雅妮莎'].hp,usefulAttr['沃雅妮莎'].heal,usefulAttr['沃雅妮莎'].cpct],[100,75,0])
 const result=verifyNumerical('沃雅妮莎',healing,{elem:'hydro'})
 const details=score.scoreDetails(healing[0],{name:'沃雅妮莎',options:{elem:'hydro'}},healing)
 assert.ok(details.subs.find(s=>s.name==='lifePercentage').score>0)
 assert.equal(details.subs.find(s=>s.name==='critical').score,0)
 assert.ok(result.total>0)
 record('沃雅妮莎数值与有效词条',result)
})
test('2 Vesna: true base values, retained modes, replacement and unique rankings',()=>{
 assert.deepEqual(facts.baseAttrMap['薇斯纳'],{hp:14204.94,atk:433.63,def:782.02})
 const normal=verifyNumerical('薇斯纳',damage,{elem:'anemo',scoreMode:'normal'},score.VESNA_SCORE_TEMPLATES.normal)
 const stellar=verifyNumerical('薇斯纳',damage,{elem:'anemo',scoreMode:'stellar'},score.VESNA_SCORE_TEMPLATES.stellar)
 assert.notEqual(normal.total,stellar.total)
 const cup=piece('cup','elementalMastery',187,atkSubs)
 const context={name:'薇斯纳',options:{scoreMode:'stellar'}}
 const replaced=damage.map(a=>a.position==='cup'?cup:a)
 assert.equal(score.scoreDetails(cup,context,damage).score,score.scoreBuild(replaced,context).artifacts.find(a=>a.pos===3).score)
 const rank=score.scoreRanking(damage[3])
 assert.equal(new Set(rank.characters.map(r=>r.name)).size,rank.characters.length)
 for(const name of ['薇斯纳','薇斯纳·星扩散','沃雅妮莎']) {
  const row=rank.characters.find(r=>r.name===name);assert.ok(row)
  assert.equal(score.scoreDetails(damage[3],score.rankingContext(name)).score,row.score)
 }
 record('薇斯纳两种模式与排名',{normal,stellar,rankingDuplicates:0})
})
test('3 Changed upstream rules and two actual shared scoring contracts',()=>{
 for(const name of ['可莉','宵宫','枫原万叶','梦见月瑞希','甘雨','雷电将军','芙宁娜','行秋']) {
  const expected=read(root+`/upstream/resources/meta-gs/character/${name}/artis.js`).replaceAll('../../artifact/artis-mark.js','../weights.mjs')
  assert.equal(read(`src/algorithms/artifact-score/vendor/rules/${name}.mjs`),expected)
 }
 assert.ok(!read('src/algorithms/artifact-score/vendor/rules.mjs').includes('胡桃'))
 const xingqiu=verifyNumerical('行秋',damage,{elem:'hydro',charAttrs:{mastery:200}})
 const furina=verifyNumerical('芙宁娜',healing,{elem:'hydro',cons:4})
 assert.equal(createScoreEvaluator('行秋',[],{charAttrs:{mastery:200}}).weights.recharge,100)
 assert.equal(createScoreEvaluator('芙宁娜',[],{cons:4}).weights.recharge,75)
 const blizzard=Object.keys(sets).find(k=>locale[sets[k].nameLocale]==='冰风迷途的勇士')
 const ganyuItems=damage.map(a=>({...a,setName:blizzard}))
 const aliases=score.scoreSetNames(ganyuItems,sets,locale);assert.ok(aliases.includes('冰套'))
 assert.match(score.scoreBuild(ganyuItems,{name:'甘雨',options:{elem:'cryo',artisSets:aliases}}).title,/永冻/)
 const allHp=healing.map(a=>a.position==='head'?piece('head','lifePercentage',.466,a.normalTags.filter(s=>s.name!=='lifePercentage')):a)
 const dehya={name:'迪希雅',options:{charAttrs:{hp:45000,cpct:5,cdmg:50}}}
 assert.match(score.scoreBuild(allHp,dehya).title,/血牛/)
 assert.doesNotMatch(score.scoreBuild(allHp.map(a=>a.position==='cup'?damage[3]:a),dehya).title,/血牛/)
 record('上游变化与套装／多部位条件',{xingqiu,furina,changedRules:8,removedRule:'胡桃',blizzardAlias:true,multipleSlotCondition:true})
})
test('4 Bounded 134-row metadata coverage and source-default Manekina scoring',()=>{
 const missing=[]
 for(const [key,c] of Object.entries(chars)) {
  const name=/^(Aether|Lumine)/.test(key)?'旅行者':locale[c.nameLocale]
  if(!Object.hasOwn(data.usefulAttr,name)||!Object.hasOwn(facts.baseAttrMap,name)) missing.push({key,name})
 }
 assert.equal(Object.keys(chars).length,134);assert.deepEqual(missing,[])
 const female=JSON.parse(read(root+'/upstream/resources/meta-gs/character/奇偶·女性/data.json'))
 const male=JSON.parse(read(root+'/upstream/resources/meta-gs/character/奇偶·男性/data.json'))
 assert.deepEqual(female.baseAttr,male.baseAttr)
 const sourceDefault=sourceScore('奇偶·女性',female.baseAttr,damage.map(score.toScoreArtifact),{elem:'anemo'}).weights
 for(const elem of ['风','冰','草','雷','岩','水','火']) {
  assert.deepEqual(JSON.parse(JSON.stringify(data.usefulAttr['奇偶·'+elem])),JSON.parse(JSON.stringify(sourceDefault)))
  assert.deepEqual(facts.baseAttrMap['奇偶·'+elem],female.baseAttr)
 }
 const anemo=verifyNumerical('奇偶·风',damage,{elem:'anemo'})
 const pyroItems=damage.map(a=>a.position==='cup'?{...a,mainTag:{name:'fireBonus',value:.466}}:a)
 const pyro=verifyNumerical('奇偶·火',pyroItems,{elem:'pyro'})
 assert.equal(anemo.total,pyro.total)
 record('134 项评分目录静态核对',{rows:134,missing,sourceDefaultVariants:7,anemo,pyro,scope:'Metadata only for the roster; numeric samples limited to two Manekina elements'})
})
test('5 Actual score dialog renders computed numbers; inventory paths are unchanged',async()=>{
 const baselines=JSON.parse(read(root+'/untouched-baseline.json'))
 for(const b of baselines) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(b.file)).digest('hex'),b.sha256,b.file)
 const path='src/components/display/ArtifactScoreDialog.vue'
 const {descriptor,errors}=parse(read(path));assert.deepEqual(errors,[])
 const compiled=compileScript(descriptor,{id:'score-verification',inlineTemplate:true})
 const code=transformSync(compiled.content,{plugins:[require('@babel/plugin-transform-modules-commonjs')],configFile:false,babelrc:false}).code
 const exports={}
 const modules={vue,'@/utils/artifacts':{displayedTag:(name,value)=>`${name}: ${value}`},'@/assets/_gen_artifact':{default:sets},'@/assets/_gen_character':{default:chars},'@/i18n/generated/zh-cn.json':{default:locale},'@/algorithms/artifact-score/score.mjs':score}
 for(const m of Object.values(modules)) if(m.default) m.__esModule=true
 vm.runInNewContext(code,{exports,require:key=>{assert.ok(modules[key],key);return modules[key]}})
 const context={name:'沃雅妮莎',label:'沃雅妮莎',options:{elem:'hydro'}}
 const app=vue.createSSRApp({render:()=>vue.h(exports.default,{modelValue:true,item:healing[4],context,equipped:healing})})
 // Isolate UI-library wrappers while retaining the real component template and scoring computations.
 for(const name of ['el-dialog','el-button','el-input'])app.component(name,{setup(_p,{slots}){return()=>vue.h('div',{},[slots.default?.(),slots.footer?.()])}})
 const html=await renderToString(app)
 const build=score.scoreBuild(healing,context),detail=score.scoreDetails(healing[4],context,healing)
 assert.match(html,/沃雅妮莎 · 圣遗物总分/)
 assert.ok(html.includes(build.total.toFixed(1)),html)
 assert.ok(html.includes(detail.score.toFixed(1)),html)
 assert.doesNotMatch(html,/暂无该角色的评分规则|待适配/)
 fs.writeFileSync(root+'/dialog-preview.html','<!doctype html><meta charset="UTF-8">'+html)
 record('真实评分组件渲染与库存保护',{displayedTotal:build.total,displayedPiece:detail.score,unchangedFiles:baselines.map(b=>b.file),scope:'Isolated SSR with real template and score module; UI-library wrappers and stat text formatting substituted; no full-app browser claim'})
})
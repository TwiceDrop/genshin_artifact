<template>
<section class="result-workbench" aria-label="单人配装结果">
  <div class="result-sheet">
    <div class="result-hero">
      <div class="result-lead">
        <strong class="metric-label">{{ metricTitle }}</strong>
        <div class="summary-reading"><b class="result-number">{{ mainRate || formatted(mainValue) }}</b><span v-if="mainRate">相对基准</span><span v-else>当前值</span></div>
        <div class="compare-line"><template v-if="Number.isFinite(mainBefore)">基准 <b>{{ formatted(mainBefore) }}</b> → 当前 <b>{{ formatted(mainValue) }}</b></template>
          <span v-else>无同口径基准</span><button type="button" class="link baseline-toggle" :aria-expanded="baseOpen" @click="baseOpen=!baseOpen">{{ baselineLabel }} ▾</button></div>
        <div v-if="dsl" class="single-hit"><span>单段预览 · {{ hitTitle }}</span> <b>{{ number(value) }}</b><small v-if="rate">（{{ rate }}）</small></div>
        <p v-if="dsl?.error || metricError" class="metric-error" role="alert">{{ dsl?.error || metricError }}</p>
      </div>
      <div class="next-candidate">
        <template v-if="count"><span>{{ index ? '当前第 '+index+' 套' : '当前手动配装' }} / 共 {{ count }} 套</span>
          <button v-if="count>1" class="compare-candidates" @click="$emit('candidates')">比较候选 <span aria-hidden="true">›</span></button>
          <button v-else class="link" @click="$emit('candidates')">查看候选详情 ›</button></template>
        <div class="gear-summary" v-if="baseline"><b>配装对比</b> · {{ changed.length ? '变动 '+changed.length+' 件：'+changed.map(i=>slots[i]).join('、') : '五件装备一致' }}</div>
      </div>
    </div>
    <div v-if="baseOpen" class="baseline-controls"><slot name="baseline"/></div>
    <div class="result-panel"><strong>关键面板</strong><span v-for="[key,label] in stats" :key="key">{{ label }} <b>{{ pct(panelStat(key)) }}</b></span>
      <span v-if="rechargeMin>1" class="er-gate">充能要求 <b>≥ {{ pct(rechargeMin) }}</b></span>
      <button class="link" @click="$emit('panel')">全部属性 ›</button></div>
  </div>
  <div class="gear-sheet">
    <header><h3>圣遗物</h3><span>已穿戴 {{ items.filter(Boolean).length }} 件</span>
      <div class="push"><slot name="scoring"><button class="link" @click="$emit('dynamic')">动态伤害评分</button></slot></div>
      <button class="link" @click="$emit('analysis')">词条分析</button>
      <button class="link" @click="$emit('equipment')">套装操作 ›</button></header>
    <div class="gear-narrow-tabs"><button v-for="(slot,i) in slots" :key="slot" :aria-pressed="selected===i" @click="selected=i">{{ slot }}</button></div>
    <div class="gear-head gear-grid"><span>装备</span><span>主词条</span><span>副词条</span><span>{{ scoreLabel }}</span><span></span></div>
    <div v-for="(item,i) in items" :key="i" class="gear-block" :class="{'is-changed':!!changes[i],'is-slot':selected===i}" :data-slot="i">
      <div class="gear-row gear-grid">
        <div class="gear-id"><img v-if="item" :src="itemImage(item)" alt=""><div><b>{{ item ? ta(meta(item).text) : '未装备' }}</b>
          <small>{{ slots[i] }}<template v-if="item"> / +{{ item.level }}</template> <button v-if="changes[i]" class="change-mark" :aria-expanded="openSlots.includes(i)" @click="toggleDiff(i)">{{ changes[i] }}</button></small></div></div>
        <div class="main-stat" v-if="item"><small>{{ tag(item.mainTag)[0] }}</small><b>{{ tag(item.mainTag)[1] }}</b></div><span v-else>—</span>
        <div class="sub-stats"><span v-for="sub in item?.normalTags" :key="sub.name">{{ tag(sub)[0] }} <b>{{ tag(sub)[1] }}</b></span></div>
        <button class="link gear-score miao-score" :data-grade="score(i).split(' ').pop()" v-if="item" @click="$emit('score',i)">{{ score(i) }}</button><span v-else>—</span>
        <div class="row-actions"><button v-if="changes[i]" class="diff-trigger" :aria-label="slots[i]+'装备差异'" :aria-controls="'slot-diff-'+i" :aria-expanded="openSlots.includes(i)" @click="toggleDiff(i)">{{ openSlots.includes(i)?'收起差异':'查看差异' }} {{ openSlots.includes(i)?'▴':'▾' }}</button>
          <button class="link swap-link" :aria-label="(item?'更换':'选择')+slots[i]" @click="$emit('replace',i)">{{ item?'更换':'选择' }}</button></div>
      </div>
      <section v-if="changes[i] && openSlots.includes(i)" class="inline-diff" :id="'slot-diff-'+i">
        <table><caption>{{ slots[i] }} · 装备差异</caption><thead><tr><th>变动词条</th><th>旧件 · {{ pieceTitle(baseline?.[i]) }}</th><th>新件 · {{ pieceTitle(item) }}</th></tr></thead>
        <tbody><tr v-for="(d,n) in changedAffixes(baseline?.[i],item)" :key="n"><th>{{ d.kind }}<template v-if="d.kind==='副词条'"> · {{ tag(d.old||d.now)[0] }}</template></th>
          <td>{{ affixValue(d.old,d.kind) }}</td><td>{{ affixValue(d.now,d.kind) }}</td></tr>
          <tr v-if="!changedAffixes(baseline?.[i],item).length"><td colspan="3">装备不同，主副词条一致</td></tr></tbody></table>
      </section>
    </div>
    <footer><span>{{ totalLabel }} <b class="miao-score" :data-grade="total.split(' ').pop()">{{ total }}</b></span><slot name="score-basis" /></footer>
  </div>
  <nav class="further"><button class="link" @click="$emit('details')">详细伤害表 ›</button><button class="link" @click="$emit('curve')">最优收益曲线 ›</button><button class="link" @click="$emit('equipment')">装备设置 ›</button></nav>
</section>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {artifactsData} from '@/assets/artifacts'
import {displayedTag} from '@/utils/artifacts'
import {useI18n} from '@/i18n/i18n'
import {defaultDamageReaction,damageReactionLabel} from '@/algorithms/reaction-labels.mjs'
import {changedAffixes,displayScore,percentChange,sameHitBaseline} from '@/algorithms/single-result-comparison.mjs'
const props=defineProps({character:String,skill:String,analysis:Object,previous:Object,items:Array,baseline:Array,changes:Array,baselineLabel:String,panelData:Object,score:Function,total:String,count:Number,index:Number,rechargeMin:Number,dsl:Object,metricError:String,scoreLabel:{type:String,default:'喵喵评分'},totalLabel:{type:String,default:'喵喵总分'}})
defineEmits(['details','panel','equipment','analysis','score','replace','curve','candidates','dynamic'])
const {ta,t}=useI18n(),slots=['生之花','死之羽','时之沙','空之杯','理之冠'],stats=[['critical','暴击率'],['critical_damage','暴击伤害'],['recharge','充能效率']]
const changed=computed(()=>props.changes.flatMap((s,i)=>s?[i]:[])),selected=ref(0),baseOpen=ref(false)
watch(changed, v=>{if(v.length)selected.value=v[0]},{immediate:true})
const key=computed(()=>defaultDamageReaction(props.analysis||{}))
const typeLabel=computed(()=>!key.value?'当前技能':key.value==='normal'?(props.analysis.is_heal?'治疗':t('dmg',props.analysis.element)):damageReactionLabel(key.value))
const value=computed(()=>props.analysis?.[key.value]?.expectation),before=computed(()=>sameHitBaseline(props.analysis,props.previous,key.value))
const rate=computed(()=>percentChange(value.value,before.value))
const hitTitle=computed(()=>props.character+' · '+props.skill+' · '+(key.value==='normal'&&!props.analysis?.is_heal?typeLabel.value.replace(/伤害$/,'')+'期望伤害':typeLabel.value+'期望值'))
const metricTitle=computed(()=>props.dsl?props.character+' · DSL 组合优化目标值':hitTitle.value)
const mainValue=computed(()=>props.dsl?props.dsl.current:value.value),mainBefore=computed(()=>props.dsl?props.dsl.before:before.value)
const mainRate=computed(()=>percentChange(mainValue.value,mainBefore.value))
const formatted=v=>props.dsl?displayScore(v):number(v)
const openSlots=ref([])
function toggleDiff(i){openSlots.value=openSlots.value.includes(i)?openSlots.value.filter(k=>k!==i):[...openSlots.value,i]}
const pieceTitle=a=>a?ta(meta(a).text)+' +'+a.level:'未装备'
const affixValue=(s,kind)=>s?(kind==='主词条'?displayedTag(s.name,s.value):tag(s)[1]):'—'
const localArt=require.context('@/images/artifacts',false,/\.png$/)
const localFiles=new Set(localArt.keys())
function itemImage(a){const key='./'+artifactsData[a.setName].name2+'_'+(a.position==='cup'?'goblet':a.position)+'.png';return localFiles.has(key)?localArt(key):meta(a).url}
const number=v=>Number.isFinite(v)?Math.round(v).toLocaleString('zh-CN'):'—'
const pct=v=>Number.isFinite(v)?(v*100).toFixed(1)+'%':'—'
const panelStat=k=>props.panelData?.[k]?Object.values(props.panelData[k]).reduce((a,b)=>a+b,0):null
const meta=a=>artifactsData[a.setName][a.position]
const tag=s=>{const str=displayedTag(s.name,s.value),i=str.indexOf('+');return [str.slice(0,i),str.slice(i)]}
</script>
<style scoped src="./single-result-workbench.css"></style>
<style scoped>.gear-sheet footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}</style>

<style scoped src="../../styles/artifact-score.css"></style>

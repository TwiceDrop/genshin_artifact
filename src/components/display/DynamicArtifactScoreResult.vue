<template><div class="score-basis-content">
      <div class="readings">
        <div><span>{{ basis==='A'?'副词条参照增伤分':'整套参照增伤分' }}</span><strong>{{ number(result.score) }} <small>/ 350</small></strong></div>
        <div><span>单件替换效率合计</span><strong>{{ number(result.qualityTotal) }} <small>/ 350</small></strong></div>
        <div><span>到参照伤害的提升</span><strong>{{ percent(result.improvement) }}</strong></div>
      </div>
      <dl class="facts">
        <dt>参照状态</dt><dd>{{ result.reference.certified?'指定候选域已证明最优':'合法搜索参照 · 未证明全局最优' }}</dd>
        <dt>增伤分定义</dt><dd>350 ×（当前伤害 − 基线伤害）÷（参照伤害 − 基线伤害）</dd>
        <dt>基线</dt><dd>{{ basis==='A'?'保留当前主词条与套装，移除副词条':'无圣遗物' }} · {{ number(result.baselineDamage) }}</dd>
        <dt>当前 / 参照伤害</dt><dd>{{ number(result.currentDamage) }} / {{ number(result.referenceDamage) }}</dd>
        <dt>单件口径</dt><dd>固定其余四件的增伤效率；合计与整套增伤分分别计算。Shapley 增量伤害可加总。</dd>
        <dt>属性约束</dt><dd>当前{{ result.currentFeasible?'满足':'未满足' }} · 参照{{ result.referenceFeasible?'满足':'未满足' }}</dd>
      </dl>
      <div class="table-scroll"><table><thead><tr><th>部位</th><th>替换效率 / 70</th><th>单件替换提升</th><th>Shapley 增量伤害</th></tr></thead>
        <tbody><tr v-for="(row,i) in result.rows" :key="row.slot" :class="{selected:selectedSlot===i}"><th><button @click="emit('inspect',i)">{{ slotLabel[row.slot] }}</button></th><td>{{ number(row.score) }}</td><td>{{ percent(row.replacementPercent) }}{{ row.replacementFeasible?'':'（约束未满足）' }}</td><td>{{ number(row.shapleyDamage) }}</td></tr></tbody>
      </table></div>
      <details open><summary>合法参照装备与词条分配</summary><div class="table-scroll"><table><thead><tr><th>部位 / 套装</th><th>当前主词条</th><th>参照主词条</th><th>参照副词条 · 贡献次数</th></tr></thead>
        <tbody><tr v-for="(item,i) in result.reference.build" :key="item.slot"><th>{{ slotLabel[item.slot] }} · {{ setLabel(item.set_name) }}</th><td>{{ statText(result.conditions.input.artifacts.find(a=>a.slot===item.slot).main_stat) }}</td><td>{{ statText(item.main_stat) }}</td><td><div v-for="(tag,j) in item.sub_stats" :key="tag[0]">{{ statText(tag) }} · {{ result.reference.pieces[i].lines[j].tiers.length }} 次</div></td></tr></tbody>
      </table></div></details>
      <details><summary>当前与参照面板差距</summary><div class="table-scroll"><table><thead><tr><th>属性</th><th>当前</th><th>参照</th><th>差值</th></tr></thead><tbody><tr v-for="row in panelRows" :key="row.key"><th>{{ row.label }}</th><td>{{ row.current }}</td><td>{{ row.reference }}</td><td>{{ row.delta }}</td></tr></tbody></table></div></details>
      <details><summary>计算条件与结果 JSON</summary><dl class="facts"><dt>角色 / 武器</dt><dd>{{ characterLabel }} · {{ weaponLabel }} · 精炼 {{ input.weapon.refine }}</dd><dt>命座 / 天赋</dt><dd>{{ input.character.constellation }} 命 · {{ input.character.skill1+1 }}/{{ input.character.skill2+1 }}/{{ input.character.skill3+1 }}</dd><dt>技能</dt><dd>{{ skillLabel }}</dd><dt>评估次数 / 时间</dt><dd>{{ result.timing.evaluations }} 次 · {{ number(result.timing.totalMs) }} ms · {{ result.timing.resultCacheHit?'结果缓存命中':result.timing.referenceCacheHit?'参照缓存命中':'首次求解' }}</dd></dl><button type="button" @click="exportResult">导出评分 JSON</button><pre>{{ JSON.stringify(result.conditions,null,2) }}</pre></details>
</div></template>
<script setup>
import {computed} from 'vue'
import {convertArtifactStatNameBack} from '@/utils/converter'
import {displayedTag} from '@/utils/artifacts'
import sets from '@/assets/_gen_artifact'
import locale from '@/i18n/generated/zh-cn.json'
const props=defineProps({result:Object,characterLabel:String,weaponLabel:String,skillLabel:String,selectedSlot:Number})
const emit=defineEmits(['inspect'])
const basis=computed(()=>props.result.basis),input=computed(()=>props.result.conditions.input)
const slotLabel={Flower:'生之花',Feather:'死之羽',Sand:'时之沙',Goblet:'空之杯',Head:'理之冠'}
const setLabel=name=>{const item=Object.values(sets).find(s=>s.name2===name);return locale[item?.nameLocale]||name}
const statText=([key,value])=>displayedTag(convertArtifactStatNameBack(key),value)
const number=n=>Number.isFinite(n)?n.toLocaleString('zh-CN',{maximumFractionDigits:2}):'不可定义'
const percent=n=>Number.isFinite(n)?(n*100).toFixed(2)+'%':'不可定义'
const panelFields=[['atk','攻击力'],['hp','生命值'],['def','防御力'],['elemental_mastery','元素精通'],['critical','暴击率',true],['critical_damage','暴击伤害',true],['recharge','元素充能效率',true]]
const panelRows=computed(()=>props.result?panelFields.map(([key,label,pct])=>{const a=props.result.currentPanel[key],b=props.result.referencePanel[key],fmt=pct?percent:number;return {key,label,current:fmt(a),reference:fmt(b),delta:fmt(b-a)}}):[])
function exportResult(){const url=URL.createObjectURL(new Blob([JSON.stringify(props.result,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='动态伤害评分.json';a.click();URL.revokeObjectURL(url)}

</script>
<style scoped>
.score-basis-content{color:var(--el-text-color-primary)}
button{font:inherit;color:inherit;border:1px solid var(--el-border-color);background:var(--el-bg-color);border-radius:4px;padding:8px 12px;cursor:pointer}button:hover{color:var(--el-color-primary);border-color:var(--el-color-primary)}button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
.readings{display:flex;flex-wrap:wrap;gap:32px;margin:24px 0}.readings span{display:block;font-size:13px}.readings strong{display:block;font-size:28px;margin-top:8px}.readings small{font-size:14px;font-weight:400}.facts{display:grid;grid-template-columns:160px minmax(0,1fr);font-size:13px;gap:10px;line-height:1.7}.facts dt{color:var(--el-text-color-secondary)}.facts dd{margin:0;overflow-wrap:anywhere}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}th,td{padding:12px 10px;border-bottom:1px solid var(--el-border-color-lighter);line-height:1.7}th{font-weight:500}th button{padding:0;border:0}.selected{background:var(--el-color-primary-light-9)}details{margin-top:20px}summary{cursor:pointer;padding:8px 0}pre{max-height:300px;overflow:auto;font-size:12px}.readings small{white-space:nowrap}@media(max-width:600px){.facts{grid-template-columns:1fr;gap:4px}.facts dd{margin-bottom:8px}.readings{gap:16px}.readings strong{font-size:23px}table{min-width:600px}}
</style>

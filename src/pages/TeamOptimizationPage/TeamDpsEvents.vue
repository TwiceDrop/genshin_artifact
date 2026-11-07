<template>
 <section class="dps-events">
  <h3>战斗明细</h3>
  <el-tabs v-model="channel" @tab-change="resetSelection">
   <el-tab-pane v-for="[key,title] in channels" :key="key" :name="key" :label="title"/>
  </el-tabs>
  <el-table :data="visibleEvents" row-key="event.id" class="event-table" highlight-current-row @row-click="selectEvent" max-height="440">
   <el-table-column label="时间（秒）" width="130"><template #default="{row}">{{ number(row.from) }}<template v-if="row.to!==row.from">～{{ number(row.to) }}</template></template></el-table-column>
   <el-table-column label="角色" width="100"><template #default="{row}">{{ labels[row.role]??'全队' }}</template></el-table-column>
   <el-table-column label="事件" min-width="190"><template #default="{row}">{{ row.label }}<small v-if="row.event.label">{{ row.event.label }}</small></template></el-table-column>
   <el-table-column label="发生概率" width="115"><template #default="{row}">{{ probability(row.event.probability) }}</template></el-table-column>
   <el-table-column label="状态数" width="85"><template #default="{row}">{{ row.event.states.length }}</template></el-table-column>
   <el-table-column v-for="[key,title] in channel==='hits'?damageModes:[]" :key="key" :label="title" min-width="115"><template #default="{row}">{{ number(row.contributions[key]) }}</template></el-table-column>
   <el-table-column width="110"><template #default="{row}"><el-button type="text" @click.stop="selectEvent(row)">查看状态</el-button></template></el-table-column>
  </el-table>
  <el-pagination v-if="events.length>pageSize" v-model:current-page="eventPage" :page-size="pageSize" :total="events.length" layout="prev, pager, next" @current-change="selectedId=null"/>
  <section v-if="selected" class="event-states">
   <h4>{{ selected.label }} · 事件状态</h4>
   <p class="state-context">发生概率 {{ probability(selected.event.probability) }} · 下列概率包含事件发生概率，各行展示同一事件的一种状态。</p>
   <el-table :data="visibleStates" row-key="state" class="state-table" max-height="430">
    <el-table-column label="状态" width="75"><template #default="{row}">{{ row.state+1 }}</template></el-table-column>
    <el-table-column label="概率" width="110"><template #default="{row}">{{ probability(row.probability) }}</template></el-table-column>
    <el-table-column label="时间（秒）" width="105"><template #default="{row}">{{ number(row.value.time) }}</template></el-table-column>
    <template v-if="channel==='hits'">
     <el-table-column label="期望伤害" min-width="120"><template #default="{row}">{{ number(row.value.expectation) }}</template></el-table-column>
     <el-table-column label="气氛" width="100"><template #default="{row}">{{ number(row.value.fanfare) }}</template></el-table-column>
     <el-table-column label="攻击力 / 生命上限" min-width="180"><template #default="{row}">{{ number(row.value.atk) }} / {{ number(row.value.hp) }}</template></el-table-column>
     <el-table-column width="115"><template #default="{row}"><el-button type="text" @click="emit('hit-selected',{hit:row.value,probability:row.probability})">伤害构成</el-button></template></el-table-column>
    </template>
    <template v-else-if="channel==='health'">
     <el-table-column v-for="(label,r) in labels" :key="r" :label="label" min-width="175"><template #default="{row}">{{ number(row.value.hp[r]) }} / {{ number(row.value.maxHP[r]) }}<small>{{ probability(row.value.ratios[r]) }}</small></template></el-table-column>
     <el-table-column label="气氛 / 二命溢出" min-width="150"><template #default="{row}">{{ number(row.value.fanfare) }} / {{ number(row.value.overflow) }}</template></el-table-column>
    </template>
    <template v-else-if="channel==='heals'">
     <el-table-column label="实际治疗" min-width="120"><template #default="{row}">{{ number(row.value.amount) }}</template></el-table-column>
     <el-table-column label="溢出治疗" min-width="120"><template #default="{row}">{{ number(sum(row.value.overheals)) }}</template></el-table-column>
     <el-table-column label="清除生命之契" min-width="140"><template #default="{row}">{{ number(sum(row.value.absorbedAmounts)) }}</template></el-table-column>
    </template>
    <template v-else-if="channel==='effects'">
     <el-table-column label="变化" width="110"><template #default="{row}">{{ row.value.kind==='activate'?'生效 / 刷新':'消耗' }}</template></el-table-column>
     <el-table-column label="层数" width="90"><template #default="{row}">{{ number(row.value.stacks) }}</template></el-table-column>
     <el-table-column label="消耗次数" width="115"><template #default="{row}">{{ number(row.value.used) }}</template></el-table-column>
     <el-table-column label="剩余次数" width="140"><template #default="{row}">{{ number(row.value.before) }} → {{ number(row.value.after) }}</template></el-table-column>
     <el-table-column label="到期时间" min-width="120"><template #default="{row}">{{ expiry(row.value) }}</template></el-table-column>
    </template>
    <template v-else-if="channel==='resources'">
     <el-table-column label="资源" min-width="150"><template #default="{row}">{{ row.value.resource }}</template></el-table-column>
     <el-table-column label="变化前 / 变化后" min-width="160"><template #default="{row}">{{ number(row.value.before) }} → {{ number(row.value.after) }}</template></el-table-column>
     <el-table-column label="变化量" width="115"><template #default="{row}">{{ number(row.value.amount) }}</template></el-table-column>
    </template>
    <template v-else>
     <el-table-column label="生命之契" min-width="140"><template #default="{row}">{{ number(row.value.amount) }}</template></el-table-column>
     <el-table-column label="生命上限比例" min-width="140"><template #default="{row}">{{ probability(row.value.ratio) }}</template></el-table-column>
    </template>
   </el-table>
   <el-pagination v-if="selected.event.states.length>pageSize" v-model:current-page="statePage" :page-size="pageSize" :total="selected.event.states.length" layout="prev, pager, next"/>
  </section>
 </section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {teamEventRows,TEAM_EVENT_CHANNELS,teamProbabilityText} from '../../../beta-data/team-dps-result-view.mjs'
const props=defineProps<{trace:any,labels:string[]}>(),emit=defineEmits(['hit-selected'])
const channels=TEAM_EVENT_CHANNELS,channel=ref('hits'),eventPage=ref(1),statePage=ref(1),selectedId=ref<string|null>(null),pageSize=30
const rows=computed(()=>teamEventRows(props.trace)),events=computed(()=>rows.value.filter((row:any)=>row.event.channel===channel.value)),visibleEvents=computed(()=>events.value.slice((eventPage.value-1)*pageSize,eventPage.value*pageSize))
const selected=computed(()=>events.value.find((row:any)=>row.event.id===selectedId.value)),visibleStates=computed(()=>selected.value?.event.states.slice((statePage.value-1)*pageSize,statePage.value*pageSize)||[])
const damageModes=[['expectation','期望贡献'],['critical','暴击贡献'],['non_critical','非暴击贡献']]
const number=(value:any)=>typeof value==='number'?value.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—'
const expiry=(row:any)=>row.stackExpiries?row.stackExpiries.filter((time:number)=>time>row.time).map(number).join(' / '):number(row.expires)
const probability=teamProbabilityText
const sum=(values:any)=>Object.values(values||{}).reduce((n:number,v:any)=>n+v,0)
function resetSelection(){selectedId.value=null;eventPage.value=1;statePage.value=1}
function selectEvent(row:any){selectedId.value=row.event.id;statePage.value=1}
watch(()=>props.trace,resetSelection)
</script>
<style scoped>
.dps-events{background:#fff;border:1px solid #e2e7ef;border-radius:14px;padding:18px;min-width:0;font-variant-numeric:tabular-nums}.dps-events h3{margin:0 0 8px}.dps-events small{display:block;color:#6f8098;margin-top:4px}.event-table :deep(.el-table__row){cursor:pointer}.event-states{margin-top:22px;padding-top:14px;border-top:1px solid #e2e7ef}.event-states h4{margin:0}.state-context{color:#63728a;font-size:14px;line-height:1.6}.el-pagination{margin-top:10px}
</style>

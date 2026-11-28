<template>
  <main class="calculation-history cx-scope">
    <div class="history-frame" :class="{ 'show-detail': mobileDetail }">
      <header class="page-head" data-tour="history.header">
        <h2><i-ep-clock aria-hidden="true" />历史记录 <PageGuideButton guide-id="detail-history" /></h2>
        <RadioGroupRoot v-model="kind" class="history-kinds" data-tour="history.filters" aria-label="计算类型" orientation="horizontal">
          <RadioGroupItem value="single">单次计算</RadioGroupItem>
          <RadioGroupItem value="team">多人配装计算</RadioGroupItem>
        </RadioGroupRoot>
      </header>

      <p v-if="error" class="history-alert" data-tone="error" role="alert">{{ error }}</p>
      <p v-else-if="loading" class="empty-state" role="status">正在读取历史记录…</p>
      <div v-else class="history-layout">
        <aside data-tour="history.list" class="record-list history-panel" aria-label="记录列表">
          <div class="list-head">
            <h3>记录列表 <span class="count">{{ filtered.length }}</span></h3>
            <div class="history-search">
              <IconSearch class="history-search-icon" aria-hidden="true" />
              <UiInput ref="searchInput" v-model="query" class="history-search-input" type="search" :placeholder="searchLabel" :aria-label="searchLabel" />
              <UiButton v-if="query" class="history-search-clear" size="small" aria-label="清除搜索" @click="clearSearch">
                <i-ep-close aria-hidden="true" />
              </UiButton>
            </div>
          </div>
          <div v-if="visible.length" :key="`${kind}:${page}`" class="record-rows">
            <UiButton v-for="row in visible" :key="row.id" class="record-row"
              :class="{ chosen: selected.id === row.id, multi: row.members.length > 1 }" :aria-current="selected.id === row.id ? 'true' : undefined"
              :data-history-id="row.id" @click="selectRecord(row, $event.currentTarget)">
              <span class="row-avatars" aria-hidden="true">
                <img v-for="(m, i) in row.members" :key="i" :src="characterData[m.character.name]?.avatar" alt="" />
              </span>
              <span class="row-info">
                <span class="row-heading">
                  <b class="row-title">{{ row.members.map(m => characterName(m.character.name)).join(' / ') }}</b>
                  <span class="status" :class="row.status">{{ statuses[row.status] }}</span>
                </span>
                <span class="row-sub" :title="rowSubtitle(row)">{{ rowSubtitle(row) }}</span>
                <time>{{ date(row.startedAt) }}</time>
              </span>
            </UiButton>
          </div>
          <p v-else :key="kind" class="list-empty">{{ query.trim() ? '未找到匹配的记录' : '暂无历史记录' }}</p>
          <nav v-if="pages > 1" class="history-pagination" aria-label="历史记录分页">
            <UiButton size="small" aria-label="上一页" :disabled="page === 1" @click="page--"><i-ep-arrow-left aria-hidden="true" /></UiButton>
            <div class="history-page-picker">
              <UiSelect :model-value="String(page)" :options="pageOptions" label="历史记录页码" @update:model-value="page = Number($event)" />
              <span>/ {{ pages }}</span>
            </div>
            <UiButton size="small" aria-label="下一页" :disabled="page === pages" @click="page++"><i-ep-arrow-right aria-hidden="true" /></UiButton>
          </nav>
        </aside>

        <article v-if="selected" :key="selected.id" ref="detailCard" class="detail history-panel" :data-detail-id="selected.id" aria-label="记录详情">
          <div class="history-back">
            <UiButton ref="backButton" class="back-button" size="small" @click="backToList"><i-ep-arrow-left aria-hidden="true" />返回记录列表</UiButton>
          </div>
          <header class="detail-head">
            <div>
              <div class="detail-title"><h3>记录详情</h3><span class="status" :class="selected.status">{{ statuses[selected.status] }}</span></div>
              <div class="timestamp"><time>{{ date(selected.startedAt) }}</time><span>{{ selected.status === 'running' ? '已用时间' : '用时' }} {{ calculationDuration(selected.status === 'running' ? now - selected.startedAt : selected.elapsedMs) }}</span></div>
            </div>
            <UiButton v-if="selected.status === 'running'" @click="calculationHistory.cancel(account.currentAccountId.value, selected.id)">取消计算</UiButton>
            <UiButton v-else variant="primary" @click="view(selected)">查看计算<i-ep-right aria-hidden="true" /></UiButton>
          </header>

          <div v-if="selected.status === 'running'" class="progress-block">
            <div class="history-progress-row">
              <ProgressRoot class="history-progress" aria-label="计算进度" :model-value="progressValue">
                <ProgressIndicator class="history-progress-fill" :style="progressValue === null ? undefined : { width: `${progressValue}%` }" />
              </ProgressRoot>
              <span v-if="selected.kind !== 'team' || progressValue !== null" class="history-progress-value" aria-hidden="true">{{ percent(selected) }}%</span>
            </div>
            <p v-if="selected.kind === 'team'">{{ teamDpsProgressText(selected.progress) }}</p>
          </div>
          <p v-if="selected.error" class="history-alert" :data-tone="selected.status === 'failed' ? 'error' : 'warning'" role="alert">{{ selected.error }}</p>
          <p v-if="selected.storageError" class="history-alert" data-tone="error" role="alert">历史保存失败：{{ selected.storageError }}</p>

          <div v-if="selected.kind === 'team'" class="team-summary">
            <div class="axis-file"><i-ep-document aria-hidden="true" /><b>轴文件名</b><span>{{ selected.axisFileName }}</span></div>
            <dl v-if="selected.totalDamage != null" class="metrics">
              <div><dt>DPS</dt><dd>{{ number(selected.dps) }}</dd></div>
              <div><dt>轴时长</dt><dd>{{ number(selected.axisDuration) }}<small> 秒</small></dd></div>
              <div><dt>总伤害</dt><dd>{{ number(selected.totalDamage) }}</dd></div>
            </dl>
          </div>

          <section v-for="(member, i) in selected.members" :key="selected.id + ':' + i" class="history-member">
            <div class="member-head">
              <img v-if="characterData[member.character.name]?.avatar" :src="characterData[member.character.name].avatar" class="portrait" alt="" />
              <div class="member-name">
                <h4>{{ characterName(member.character.name) }}</h4>
                <div class="member-meta"><b>{{ member.character.constellation }} 命</b><span>天赋 {{ member.character.skill1 + 1 }} / {{ member.character.skill2 + 1 }} / {{ member.character.skill3 + 1 }}</span></div>
              </div>
              <div class="weapon">
                <img v-if="weaponData[member.weapon.name]?.url" :src="weaponData[member.weapon.name].url" alt="" />
                <span class="weapon-text"><span>武器</span><b>{{ weaponName(member.weapon.name) }}</b><span>精炼 {{ member.weapon.refine }} 阶</span></span>
              </div>
            </div>
            <div v-if="selected.kind === 'single'" class="buffs"><b>BUFF</b><span v-for="(name, j) in buffTitles(member.buffs)" :key="j">{{ name }}</span><span v-if="!member.buffs.length">无</span></div>
            <div v-if="selected.status === 'completed' && member.artifacts.length" class="history-artifacts">
              <template v-for="(item, j) in member.artifacts" :key="j">
                <artifact-card v-if="item" :item="item" :highlight-tags="characterArtifactHighlights(member.character.name)" short-recharge readonly />
                <div v-else class="empty-artifact"><b>{{ slots[j] }}</b><span>未装备</span></div>
              </template>
            </div>
          </section>
        </article>
      </div>
    </div>
  </main>
</template>

<script setup>
import PageGuideButton from "@/onboarding/PageGuideButton.vue"
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ProgressIndicator, ProgressRoot, RadioGroupItem, RadioGroupRoot } from 'radix-vue'
import IconSearch from '~icons/ep/search'
import { useAccountStore } from '@/store/pinia/account'
import { calculationHistory, calculationState } from '@/store/calculation-history'
import { calculationDuration } from '@/algorithms/calculation-history.mjs'
import { teamDpsProgressText, teamDpsProgressIndeterminate } from '../../beta-data/team-dps-progress.mjs'
import ArtifactCard from '@/components/display/ArtifactCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import { characterArtifactHighlights } from '@/utils/character-artifact-highlights'
import { characterData } from '@/assets/character'
import { weaponData } from '@/assets/weapon'
import { artifactsData } from '@asset/artifacts'
import { buffData } from '@buff'
import locale from '@/i18n/generated/zh-cn.json'

const account = useAccountStore(), router = useRouter()
const kind = ref('single'), page = ref(1), query = ref(''), selectedId = ref(null)
const searchInput = ref(null)
const mobileDetail = ref(false), backButton = ref(null), detailCard = ref(null)
let lastTrigger = null
const error = ref(''), loading = ref(false), now = ref(Date.now())
const slots = ['生之花', '死之羽', '时之沙', '空之杯', '理之冠']
const statuses = { running: '计算中', completed: '已完成', cancelled: '已取消', failed: '计算失败', interrupted: '已中断' }
const characterName = name => locale[characterData[name]?.nameLocale] || name
const weaponName = name => locale[weaponData[name]?.nameLocale] || name
const buffTitles = buffs => buffs.map(buff => locale[buffData[buff.name]?.nameLocale] || buff.config?.ExtensionEffect?.label || buff.name)
function rowSubtitle(row) {
  if (row.kind === 'team') return row.axisFileName
  const member = row.members[0]
  const weapon = weaponName(member.weapon.name)
  if (row.status !== 'completed') return weapon
  const counts = new Map()
  for (const item of member.artifacts) if (item) counts.set(item.setName, (counts.get(item.setName) || 0) + 1)
  const sets = [...counts].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1])
    .map(([name, count]) => (locale[artifactsData[name]?.nameLocale] || name) + '×' + count)
  return [weapon, ...sets].join(' · ')
}
const searchLabel = computed(() => kind.value === 'single' ? '搜索角色或武器' : '搜索角色、武器或轴文件')
const filtered = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return (calculationState.accounts[account.currentAccountId.value]?.entries || []).filter(row =>
    row.kind === kind.value && (!term || [row.axisFileName, ...row.members.flatMap(m => [characterName(m.character.name), weaponName(m.weapon.name)])]
      .some(value => value?.toLocaleLowerCase().includes(term))))
})
const pages = computed(() => Math.ceil(filtered.value.length / 10))
const pageOptions = computed(() => Array.from({ length: pages.value }, (_, index) => {
  const value = String(index + 1)
  return { value, label: value }
}))
const visible = computed(() => filtered.value.slice((page.value - 1) * 10, page.value * 10))
const selected = computed(() => visible.value.find(row => row.id === selectedId.value) || visible.value[0])
watch([kind, () => account.currentAccountId.value], () => { query.value = ''; resetList() })
watch(query, resetList)
watch(page, () => { selectedId.value = null; mobileDetail.value = false })
watch(pages, count => { page.value = Math.min(page.value, Math.max(1, count)) })
function resetList() { page.value = 1; selectedId.value = null; mobileDetail.value = false }
function clearSearch() {
  query.value = ''
  searchInput.value?.$el.focus()
}
watch(() => account.currentAccountId.value, async id => {
  loading.value = true; error.value = ''
  try { await calculationHistory.load(id) }
  catch (e) { if (id === account.currentAccountId.value) error.value = e.message }
  finally { if (id === account.currentAccountId.value) loading.value = false }
}, { immediate: true })

let timer
watch(() => selected.value?.status, status => {
  clearInterval(timer)
  if (status === 'running') { now.value = Date.now(); timer = setInterval(() => { now.value = Date.now() }, 1000) }
}, { immediate: true })
onBeforeUnmount(() => clearInterval(timer))
async function selectRecord(row, trigger) {
  selectedId.value = row.id; lastTrigger = trigger; mobileDetail.value = true
  await nextTick()
  const back = backButton.value?.$el
  if (back?.getClientRects().length) {
    back.focus({ preventScroll: true }); back.scrollIntoView({ block: 'nearest' })
  } else if (detailCard.value && detailCard.value.getBoundingClientRect().top < 0) {
    detailCard.value.scrollIntoView({ block: 'start' })
  }
}
async function backToList() {
  mobileDetail.value = false
  await nextTick()
  lastTrigger?.focus()
}
const number = value => value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
const date = value => {
  const d = new Date(value), pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
const indeterminate = row => row.kind === 'team' ? teamDpsProgressIndeterminate(row.progress) : row.progress?.percent == null
const percent = row => Math.max(0, Math.min(100, Number((row.progress?.percent ?? (row.progress?.total_teams ? row.progress.evaluated_teams / row.progress.total_teams * 100 : 0)).toFixed(1))))
const progressValue = computed(() => selected.value?.status === 'running' && !indeterminate(selected.value) ? percent(selected.value) : null)
function view(row) { router.push({ path: row.kind === 'single' ? '/calculate' : '/team-optimization', query: { history: String(row.id) } }) }
</script>

<style scoped src="./calculation-history.css"></style>

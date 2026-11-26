<template>
  <el-dialog :model-value="share.open.value" title="分享四人轴" width="min(520px, 94vw)"
    custom-class="cx-scope viewport-dialog share-axis-dialog" :close-on-click-modal="false"
    :close-on-press-escape="!busy" :show-close="!busy" @close="share.close()">
    <div class="object">
      <div><strong :title="axis.title">{{ axis.title }}</strong><span>{{ summary }}</span></div>
      <ul><li v-for="m in axis.members" :key="m.slot"><img :src="characterData[m.character].avatar" alt=""/>{{ locale[characterData[m.character].nameLocale] }}</li></ul>
    </div>
    <el-alert v-if="share.message.value" :title="share.message.value" type="error" :closable="false" />
    <template v-if="!active">
      <p v-if="record">{{ record.status === 'expired' ? '原链接已过期' : '原分享已取消' }}</p>
      <h4>链接有效期</h4>
      <el-radio-group v-model="term" :disabled="busy"><el-radio-button label="week">7 天</el-radio-button><el-radio-button label="month">30 天</el-radio-button><el-radio-button label="forever">永久</el-radio-button></el-radio-group>
      <p class="note">任何拿到链接的人都可以免登录查看和下载。分享内容仅包含这条轴的配置。</p>
    </template>
    <template v-else>
      <div v-if="!confirming" class="state" :class="{pending:dirty}">
        <b>{{ !share.verified.value ? '上次发布' : dirty ? '本地有修改，尚未发布' : '已分享' }}</b>
        <p v-if="dirty && share.verified.value">原链接仍显示上次发布的版本。发布更新后，其他人打开同一链接就能看到新版。</p>
        <small>{{ expiry }} · 上次发布 {{ date(record.publishedAt) }}</small>
      </div>
      <div v-if="dirty && !confirming" class="compare">
        <div><small>{{ share.verified.value ? '群友当前看到（线上）' : '上次发布' }}</small><b>{{ record.title }}</b><small>{{ record.summary }}</small><small>{{ date(record.publishedAt) }}</small></div>
        <div><small>本地版本</small><b>{{ axis.title }}</b><small>{{ summary }}</small></div>
      </div>
      <label for="axis-share-url">公开链接</label>
      <div class="url"><el-input id="axis-share-url" readonly :model-value="share.link.value" aria-label="公开链接" @focus="$event.target.select()" />
        <el-button v-if="!confirming" :type="dirty ? 'default' : 'primary'" :disabled="busy" @click="copy">{{ copied ? '已复制' : dirty ? '复制原链接' : '复制链接' }}</el-button></div>
      <section v-if="confirming" class="revoke"><b>确认取消这条轴的公开分享？</b><p>取消后，发出的原链接会立即失效。本地四人轴会保留。</p></section>
    </template>
    <template #footer><div class="actions">
      <el-button v-if="active && !confirming" link type="danger" :disabled="busy || !share.verified.value" @click="confirming=true">取消分享</el-button>
      <span class="spacer"></span>
      <el-button v-if="confirming" :disabled="busy" @click="confirming=false">保留分享</el-button>
      <el-button v-else :disabled="busy" @click="share.close()">{{ active && dirty ? '暂不发布' : '关闭' }}</el-button>
      <el-button v-if="!share.verified.value && !busy" @click="share.show()">重试</el-button>
      <el-button v-else-if="confirming || !active || dirty" :type="confirming?'danger':'primary'" :loading="busy" :disabled="!share.verified.value"
        @click="submit">{{ confirming?'确认取消分享':active?'发布更新到原链接':'生成并复制链接' }}</el-button>
    </div></template>
  </el-dialog>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { characterData } from '@/assets/character'
import locale from '@/i18n/generated/zh-cn.json'
import { axisSummary } from '../../../beta-data/shared-axis.mjs'
const props = defineProps({ share:Object, axis:Object })
const term = ref('month'), confirming = ref(false), copied = ref(false)
let timer
const busy = computed(()=>props.share.busy.value), active = computed(()=>props.share.active.value)
const dirty = computed(()=>props.share.dirty.value), record = computed(()=>props.share.published.value)
const summary = computed(()=>axisSummary(props.axis))
const date = value => new Date(value).toLocaleString()
const expiry = computed(()=>record.value?.expiresAt ? '有效期至 '+date(record.value.expiresAt) : '永久')
watch(()=>props.share.open.value,()=>{ confirming.value=false; copied.value=false; term.value='month' })
async function copy() {
    try {
        await props.share.copy()
        copied.value=true
        clearTimeout(timer)
        timer=setTimeout(()=>{copied.value=false},1800)
        ElMessage.success(dirty.value?'已复制原链接，本地修改尚未发布。':'已复制链接')
    } catch { props.share.message.value='请选中链接并手动复制。' }
}
async function submit() {
    const kind=confirming.value?'revoke':active.value?'update':'create'
    const result=await props.share.run(kind,{week:7,month:30,forever:null}[term.value])
    if (result) ElMessage.success(result)
    if (!active.value) confirming.value=false
}
onBeforeUnmount(()=>clearTimeout(timer))
</script>
<style scoped>
.object,.state,.compare>div,.revoke{background:var(--cx-step);padding:12px 14px;border-radius:12px;margin-bottom:14px;color:var(--cx-letter)}
.object>div,.url,.actions,li,ul{display:flex;align-items:center;gap:8px}.object>div{justify-content:space-between}
.object strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}.object span{white-space:nowrap}
ul{flex-wrap:wrap;padding:0;margin:8px 0 0;list-style:none}li,small,.note,.object span{color:var(--cx-dim);font-size:13px}li img{width:24px;height:24px;border-radius:50%}
.state{background:var(--cx-down-bg);color:var(--cx-down)}.pending{background:var(--cx-gold-soft);color:var(--cx-gold)}.state p,.revoke p{margin:5px 0}
.compare{display:grid;grid-template-columns:1fr 1fr;gap:8px}.compare b,.compare small,.state small{display:block}.compare>div:last-child{border:1px solid var(--cx-gold-edge)}
.revoke{margin-top:12px;color:var(--cx-up)}.spacer{flex:1}.url{margin-top:6px}.actions{flex-wrap:wrap}.actions :deep(.el-button){margin-left:0}
@media(max-width:440px){.compare{grid-template-columns:1fr}.compare>div{margin-bottom:4px}}@media(max-width:360px){.url{flex-wrap:wrap}}
</style>

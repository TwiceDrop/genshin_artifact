<template>
  <section class="oa-panel shares" aria-labelledby="oa-shares">
    <header class="oa-panel-head">
      <h3 id="oa-shares" class="oa-panel-title">我的分享</h3>
      <UiButton :disabled="busy" @click="load">刷新</UiButton>
    </header>
    <UiAlert v-if="error" tone="error" hide-icon>{{ error }}</UiAlert>
    <UiEmpty v-if="!busy && !error && !items.length" description="暂无分享" />
    <div v-if="items.length" class="oa-list share-list">
      <article v-for="item in items" :key="item.id" class="oa-list-row">
        <div class="oa-list-summary share-summary">
          <div class="oa-list-main">
            <div class="share-title">
              <strong :title="item.title">{{ item.title }}</strong>
              <span>{{ types[item.kind || 'axis'] }}</span>
            </div>
            <div class="oa-meta">{{ status[item.status] }} · {{ item.expiresAt ? '有效期至 '+new Date(item.expiresAt).toLocaleString() : '永久' }}</div>
          </div>
          <div v-if="item.status === 'active'" class="oa-actions oa-actions-end share-actions">
            <template v-if="confirmId === item.id">
              <UiButton size="small" :disabled="busy" @click="confirmId = ''">保留分享</UiButton>
              <UiButton size="small" class="share-confirm-button" variant="danger" :disabled="busy" :aria-describedby="'share-confirm-' + item.id" @click="revoke(item.id)">确认取消分享</UiButton>
            </template>
            <template v-else>
              <UiButton size="small" :disabled="busy" @click="copyLink(item.id)">复制链接</UiButton>
              <UiButton size="small" class="oa-quiet-danger" variant="danger" :disabled="busy" @click="confirmId = item.id">取消分享</UiButton>
            </template>
          </div>
        </div>
        <UiInput v-if="item.status === 'active' && manualId === item.id" class="share-manual-link" readonly :model-value="shareUrl(item.id)" aria-label="公开链接" @focus="$event.target.select()" />
        <p v-if="item.status === 'active' && confirmId === item.id" :id="'share-confirm-' + item.id" class="share-confirm">
          取消后，发出的原链接会立即失效。{{ item.kind==='axis' || !item.kind ? '本地四人轴会保留。' : '' }}
        </p>
      </article>
    </div>
  </section>
</template>
<script setup>
import { ref, watch, onBeforeUnmount, onActivated } from 'vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiInput from '@/components/ui/UiInput.vue'
import { showCalculationNotice } from '@/store/calculation-history'
import { cloudApi } from '@/platform/cloud.mjs'
const props=defineProps({userId:String,serviceUrl:String})
const items=ref([]), busy=ref(false), error=ref(''), confirmId=ref('')
const types={axis:'四人轴',dsl:'MONA-DSL',preset:'角色预设'}
const manualId=ref('')
const shareUrl=id=>props.serviceUrl+'/s/'+id
async function copyLink(id){
    try { await navigator.clipboard.writeText(shareUrl(id)); showCalculationNotice('success', '已复制链接') }
    catch { manualId.value=id }
}
const status={active:'已分享',revoked:'已取消',expired:'已过期'}
let generation=0
async function load() {
    const token=++generation, context={url:props.serviceUrl,userId:props.userId}
    busy.value=true
    error.value=''
    try {
        const result=await cloudApi('v1/shares','GET',undefined,context)
        if(token===generation)items.value=result.shares
    }catch(e){if(token===generation)error.value=e.message}
    finally{if(token===generation)busy.value=false}
}
async function revoke(id) {
    const token=++generation
    busy.value=true
    error.value=''
    try {
        await cloudApi('v1/shares/'+id,'DELETE',undefined,{url:props.serviceUrl,userId:props.userId})
        if(token!==generation)return
        confirmId.value=''
        await load()
    }catch(e){if(token===generation)error.value=e.message}
    finally{if(token===generation)busy.value=false}
}
watch(()=>[props.userId,props.serviceUrl],()=>{items.value=[];confirmId.value='';manualId.value='';load()},{immediate:true})
onActivated(()=>{if(!busy.value)load()})
onBeforeUnmount(()=>generation++)
</script>
<style scoped>
.shares .ui-alert + .share-list { margin-top: 10px; }
.share-summary { align-items: center; }
.share-title { display: flex; align-items: center; gap: 7px; margin-bottom: 3px; }
.share-title strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.share-title > span {
  flex: none;
  padding: 2px 7px;
  border: 1px solid var(--oa-line);
  border-radius: 6px;
  background: var(--cx-step);
  color: var(--cx-dim);
  font-size: 12px;
}
.share-actions { flex: 0 0 11rem; }
.share-confirm-button[data-slot="button"] { color: var(--cx-card); background: var(--cx-up); border-color: var(--cx-up); }
.share-confirm-button[data-slot="button"]:hover:enabled { background: color-mix(in srgb, var(--cx-up) 88%, var(--cx-letter)); }
.share-manual-link, .share-confirm { margin-top: 10px; }
.share-confirm { margin-bottom: 0; color: var(--cx-up); font-size: 12px; line-height: 1.5; }
@media (max-width: 639px) {
  .share-list .share-summary { flex-direction: column; align-items: stretch; }
  .share-summary > .oa-list-main, .share-actions { flex-basis: auto; }
  .share-list .share-actions { justify-content: flex-start; }
}
</style>

<template>
  <section class="shares">
    <div class="heading"><h3>我的分享</h3><el-button :disabled="busy" @click="load">刷新</el-button></div>
    <el-alert v-if="error" type="error" :title="error" :closable="false" />
    <span v-if="!busy && !error && !items.length">暂无分享</span>
    <article v-for="item in items" :key="item.id">
      <div><strong>{{ item.title }}</strong><small>{{ types[item.kind || 'axis'] }} · {{ status[item.status] }} · {{ item.expiresAt ? '有效期至 '+new Date(item.expiresAt).toLocaleString() : '永久' }}</small></div>
      <template v-if="item.status==='active'">
        <el-button link :disabled="busy" @click="copyLink(item.id)">复制链接</el-button>
        <el-input v-if="manualId===item.id" readonly :model-value="shareUrl(item.id)" aria-label="公开链接" @focus="$event.target.select()" />
        <el-button link type="danger" :disabled="busy" @click="confirmId=item.id">取消分享</el-button>
        <div v-if="confirmId===item.id" class="confirm">
          <p>取消后，发出的原链接会立即失效。{{ item.kind==='axis' || !item.kind ? '本地四人轴会保留。' : '' }}</p>
          <el-button :disabled="busy" @click="confirmId=''">保留分享</el-button><el-button type="danger" :disabled="busy" @click="revoke(item.id)">确认取消分享</el-button>
        </div>
      </template>
    </article>
  </section>
</template>
<script setup>
import { ref, watch, onBeforeUnmount, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import { cloudApi } from '@/platform/cloud.mjs'
const props=defineProps({userId:String,serviceUrl:String})
const items=ref([]), busy=ref(false), error=ref(''), confirmId=ref('')
const types={axis:'四人轴',dsl:'MONA-DSL',preset:'角色预设'}
const manualId=ref('')
const shareUrl=id=>props.serviceUrl+'/s/'+id
async function copyLink(id){
    try { await navigator.clipboard.writeText(shareUrl(id)); ElMessage.success('已复制链接') }
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
.shares{border:1px solid var(--cx-step-2);background:var(--cx-card);border-radius:var(--cx-radius);padding:18px;margin:0 0 16px}.heading,article{display:flex;align-items:center;justify-content:space-between;gap:10px}.heading h3{margin:0}article{border-top:1px solid var(--cx-step-2);padding:10px 0;flex-wrap:wrap}small{display:block;color:var(--cx-dim)}strong{overflow-wrap:anywhere}.confirm{flex-basis:100%;color:var(--cx-up)}
</style>

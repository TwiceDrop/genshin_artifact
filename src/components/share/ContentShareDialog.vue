<template>
    <el-dialog v-if="visible" :model-value="true" :title="typeLabel + '分享'" append-to-body
        width="min(460px,94vw)" custom-class="cx-scope viewport-dialog"
        :close-on-click-modal="false" :show-close="!busy" :close-on-press-escape="!busy" @close="close">
        <el-form label-position="top" @submit.prevent>
            <el-form-item label="分享标题"><el-input v-model="title" :readonly="locked || busy" /></el-form-item>
            <template v-if="!link">
                <el-form-item label="链接有效期"><el-radio-group v-model="term" :disabled="locked || busy">
                    <el-radio-button label="7">7 天</el-radio-button><el-radio-button label="30">30 天</el-radio-button><el-radio-button label="forever">永久</el-radio-button>
                </el-radio-group></el-form-item>
                <el-checkbox v-if="draft.kind==='preset'" v-model="withGear" :disabled="locked || busy || !draft.equipment.length">附带当前穿戴圣遗物（{{ draft.equipment.length }} 件）</el-checkbox>
            </template>
            <el-form-item v-else label="公开链接"><el-input readonly :model-value="link" @focus="$event.target.select()" /></el-form-item>
            <el-alert v-if="error" type="error" :closable="false" :title="error" />
        </el-form>
        <template #footer><el-button :disabled="busy" @click="close">关闭</el-button>
            <el-button v-if="link" type="primary" @click="copy">{{ copied ? '已复制' : '复制链接' }}</el-button>
            <el-button v-else type="primary" :loading="busy" :disabled="!title.trim()" @click="publish">生成并复制链接</el-button>
        </template>
    </el-dialog>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAccountStore } from '@/store/pinia/account'
import { cloudApi } from '@/platform/cloud.mjs'
import { pendingContentShare as draft } from './content-share.mjs'
const route=useRoute(), router=useRouter(), account=useAccountStore()
const term=ref('30'), title=ref(''), withGear=ref(false), busy=ref(false), copied=ref(false)
const link=ref(''), error=ref(''), locked=ref(false), returnPath=ref('')
const visible=computed(()=>Boolean(draft.value && !returnPath.value && route.name!=='login'))
const typeLabel=computed(()=>draft.value?.kind==='dsl'?'MONA-DSL':'角色预设')
function close(){ draft.value=null }
watch(draft, item=>{
    title.value=item?.content.title || ''
    term.value='30'; withGear.value=false; copied.value=false; link.value=''; error.value=''
    returnPath.value=''; locked.value=false; busy.value=false
},{flush:'sync'})
watch(()=>account.currentAccountId.value, close)
function contextChanged(){ if (!returnPath.value) close() }
window.addEventListener('mona-cloud-context-change',contextChanged)
onBeforeUnmount(()=>window.removeEventListener('mona-cloud-context-change',contextChanged))
watch(()=>route.fullPath, path=>{
    if (!draft.value || route.name==='login') return
    if (path===returnPath.value) returnPath.value=''
    else close()
})
async function copy(){
    const item=draft.value
    try { await navigator.clipboard.writeText(link.value); if(draft.value===item){ copied.value=true; error.value='' } }
    catch { if(draft.value===item) error.value='请选中链接并手动复制。' }
}
async function publish(){
    if(busy.value || !draft.value) return
    const item=draft.value
    busy.value=true; error.value=''
    try {
        const config=await cloudApi('config')
        if(item!==draft.value) return
        if(!config.user){
            returnPath.value=route.fullPath
            await router.push({name:'login',query:{redirect:returnPath.value}})
            return
        }
        const content={...item.content,title:title.value.trim()}
        if(item.kind==='preset'){
            content.includeEquipment=withGear.value
            if(withGear.value) content.equipment=item.equipment
        }
        locked.value=true
        const result=await cloudApi('v1/shares','POST',{kind:item.kind,requestId:item.requestId,
            days:term.value==='forever'?null:Number(term.value),content},{url:config.url,userId:config.user.id})
        if(item!==draft.value) return
        if(result.status!=='active') throw Error('分享链接已失效')
        link.value=config.url+'/s/'+result.id
        await copy()
    } catch(e){ if(item===draft.value){ error.value=e.message; if(e.status>=400 && e.status<500) locked.value=false } }
    finally { if(item===draft.value) busy.value=false }
}
</script>

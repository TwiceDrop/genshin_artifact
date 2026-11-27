<template>
    <el-dialog v-if="visible" :model-value="true" :title="isPreset ? '角色预设分享' : 'MONA-DSL分享'" append-to-body
        :width="isPreset ? 'min(500px, 94vw)' : 'min(460px,94vw)'" custom-class="cx-scope viewport-dialog"
        :close-on-click-modal="false" :show-close="!busy" :close-on-press-escape="!busy" @close="close">
        <div v-if="isPreset && !link" class="preset-identity">
            <CharacterPortrait class="avatar" thumbnail :character-name="role.name" :avatar="role.avatar" :splash="role.splash" alt="" />
            <div><strong>{{ locale[role.nameLocale] }}</strong>
                <small>Lv.{{ draft.content.level }} · {{ draft.content.constellation }} 命 · 天赋 {{ draft.content.talents.join('/') }} · {{ draft.content.weapon.name }} R{{ draft.content.weapon.refine }}</small>
            </div>
        </div>
        <template v-if="isPreset && link">
            <div class="result-banner" :class="{ success: copyStatus === 'success' }" role="status">
                <b>{{ copyStatus === 'success' ? '✓ 链接已生成并复制' : copyStatus === 'failed' ? '链接已生成，请点击下方按钮手动复制' : '链接已生成' }}</b>
                <small>{{ expiry }}</small>
            </div>
            <p class="published-scope">{{ record.content.includeEquipment
                ? '已公开：养成、武器、计算设置 + 当前穿戴圣遗物（' + record.content.equipment.length + ' 件）'
                : '仅配置，未附带圣遗物' }}</p>
            <label for="preset-share-url">公开链接</label>
            <div class="result-url">
                <el-input id="preset-share-url" ref="urlInput" readonly :model-value="link" @focus="$event.target.select()" />
                <el-button type="primary" :disabled="busy" @click="copy">{{ copied ? '✓ 已复制' : '复制链接' }}</el-button>
            </div>
            <p v-if="confirming" class="revoke-note" role="alert">确认取消分享？取消后，原链接将立即失效。</p>
        </template>
        <el-form v-else label-position="top" @submit.prevent>
            <el-form-item label="分享标题"><el-input v-model="title" :readonly="locked || busy" /></el-form-item>
            <template v-if="!link">
                <el-form-item label="链接有效期">
                    <el-radio-group v-model="term" :class="{ 'preset-terms': isPreset }" :disabled="locked || busy">
                        <el-radio-button label="7">7 天</el-radio-button><el-radio-button label="30">30 天</el-radio-button><el-radio-button label="forever">永久</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <div v-if="isPreset" class="gear-scope" :class="{ included: withGear }">
                    <el-checkbox v-model="withGear" :disabled="locked || busy || !draft.equipment.length" aria-describedby="gear-scope-description">{{ draft.equipment.length
                        ? '附带当前穿戴圣遗物（' + draft.equipment.length + ' 件）' : '当前未穿戴圣遗物' }}</el-checkbox>
                    <small id="gear-scope-description">{{ withGear ? '仅公开当前穿戴的这 ' + draft.equipment.length + ' 件圣遗物词条，不包含仓库其余圣遗物与 UID。'
                        : '默认仅分享养成、武器和计算设置，不包含圣遗物、仓库库存与 UID。' }}</small>
                </div>
            </template>
            <el-form-item v-else label="公开链接"><el-input readonly :model-value="link" @focus="$event.target.select()" /></el-form-item>
        </el-form>
        <el-alert v-if="error" type="error" :closable="false" :title="error" />
        <template #footer>
            <div class="actions">
                <el-button v-if="isPreset && link && !confirming" class="revoke-link" link type="danger" :disabled="busy" @click="confirming=true">取消分享</el-button>
                <span class="spacer"></span>
                <template v-if="confirming">
                    <el-button :disabled="busy" @click="confirming=false">保留分享</el-button>
                    <el-button type="danger" :loading="busy" @click="revoke">确认取消分享</el-button>
                </template>
                <template v-else>
                    <el-button :disabled="busy" @click="close">{{ isPreset && !link ? '取消' : '关闭' }}</el-button>
                    <el-button v-if="!link" type="primary" :loading="busy" :disabled="!title.trim()" @click="publish">生成并复制链接</el-button>
                    <el-button v-else-if="!isPreset" type="primary" @click="copy">{{ copied ? '已复制' : '复制链接' }}</el-button>
                </template>
            </div>
        </template>
    </el-dialog>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAccountStore } from '@/store/pinia/account'
import { cloudApi } from '@/platform/cloud.mjs'
import { characterData } from '@/assets/character'
import locale from '@/i18n/generated/zh-cn.json'
import CharacterPortrait from '@/components/display/CharacterPortrait.vue'
import { pendingContentShare as draft, contentShareReturnPath as returnPath } from './content-share.mjs'

const route=useRoute(), router=useRouter(), account=useAccountStore()
const term=ref('30'), title=ref(''), withGear=ref(false), busy=ref(false), copied=ref(false)
const link=ref(''), error=ref(''), locked=ref(false)
const record=ref(null), confirming=ref(false), copyStatus=ref(''), urlInput=ref(null)
let owner, copyTimer
const visible=computed(()=>Boolean(draft.value && !returnPath.value && route.name!=='login'))
const isPreset=computed(()=>draft.value?.kind==='preset')
const role=computed(()=>characterData[draft.value.content.character])
const expiry=computed(()=>record.value.expiresAt ? '有效期至 '+new Date(record.value.expiresAt).toLocaleDateString('zh-CN') : '永久')
function close(){ draft.value=null }
watch(draft, item=>{
    clearTimeout(copyTimer)
    title.value=item?.content.title || ''
    term.value='30'; withGear.value=false; copied.value=false; link.value=''; error.value=''
    returnPath.value=''; locked.value=false; busy.value=false
    record.value=null; owner=null; confirming.value=false; copyStatus.value=''
},{flush:'sync'})
watch(()=>account.currentAccountId.value, close)
function contextChanged(){ if (!returnPath.value) close() }
window.addEventListener('mona-cloud-context-change',contextChanged)
onBeforeUnmount(()=>{
    clearTimeout(copyTimer)
    window.removeEventListener('mona-cloud-context-change',contextChanged)
})
watch(()=>route.fullPath, path=>{
    if (!draft.value || route.name==='login') return
    if (path===returnPath.value) returnPath.value=''
    else if (!returnPath.value) close()
})
async function copy(){
    const item=draft.value
    try {
        await navigator.clipboard.writeText(link.value)
        if(draft.value!==item) return
        copied.value=true
        error.value=''
        if(isPreset.value){
            copyStatus.value='success'
            clearTimeout(copyTimer)
            copyTimer=setTimeout(()=>{ copied.value=false },1800)
        }
    } catch {
        if(draft.value!==item) return
        copied.value=false
        if(isPreset.value){
            copyStatus.value='failed'
            urlInput.value?.select()
        } else error.value='请选中链接并手动复制。'
    }
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
            await router.push({name:'login'})
            return
        }
        const content={...item.content,title:title.value.trim()}
        if(item.kind==='preset'){
            content.includeEquipment=withGear.value
            if(withGear.value) content.equipment=item.equipment
        }
        locked.value=true
        const context={url:config.url,userId:config.user.id}
        const result=await cloudApi('v1/shares','POST',{kind:item.kind,requestId:item.requestId,
            days:term.value==='forever'?null:Number(term.value),content},context)
        if(item!==draft.value) return
        if(result.status!=='active') throw Error('分享链接已失效')
        owner=context
        record.value=result
        link.value=config.url+'/s/'+result.id
        await copy()
    } catch(e){ if(item===draft.value){ error.value=e.message; if(e.status>=400 && e.status<500) locked.value=false } }
    finally { if(item===draft.value) busy.value=false }
}
async function revoke(){
    if(busy.value || !confirming.value) return
    const item=draft.value
    busy.value=true
    error.value=''
    try {
        await cloudApi('v1/shares/'+record.value.id,'DELETE',undefined,owner)
        if(draft.value===item) close()
    } catch(e){ if(draft.value===item) error.value=e.message }
    finally { if(draft.value===item) busy.value=false }
}
</script>
<style scoped>
.preset-identity,.gear-scope,.result-banner{padding:12px 14px;border-radius:12px;background:var(--cx-step);font-variant-numeric:tabular-nums}
.preset-identity{display:flex;align-items:center;gap:12px;margin-bottom:16px;color:var(--cx-letter)}
.preset-identity .avatar{width:36px;height:36px;flex:none;border-radius:50%;overflow:hidden}
.preset-identity small,.gear-scope small,.result-banner small{display:block;margin-top:3px;color:var(--cx-dim);font-size:12px;line-height:1.6;overflow-wrap:anywhere}
.preset-terms{display:grid;width:100%;grid-template-columns:repeat(3,minmax(0,1fr));font-variant-numeric:tabular-nums}
.preset-terms :deep(.el-radio-button__inner){width:100%}
.gear-scope{border:1px solid var(--cx-step-2)}
.gear-scope.included,.result-banner.success{background:rgba(111,207,151,.10);border:1px solid rgba(111,207,151,.34)}
.gear-scope :deep(.el-checkbox){height:auto;min-height:24px}
.result-banner{color:var(--cx-gold);border:1px solid color-mix(in srgb,var(--cx-gold) 34%,transparent);background:color-mix(in srgb,var(--cx-gold) 10%,var(--cx-card))}
.result-banner.success{color:var(--cx-down)}
.published-scope{margin:12px 0 18px;color:var(--cx-dim);font-variant-numeric:tabular-nums}
.result-url,.actions{display:flex;align-items:center;gap:8px}
.result-url{margin-top:6px}
.result-url :deep(.el-input){min-width:0}
.actions :deep(.el-button){margin:0}
.actions .revoke-link{color:var(--cx-up);font-weight:normal}
.spacer{flex:1}
.revoke-note{color:var(--cx-up);margin:14px 0 0}
</style>

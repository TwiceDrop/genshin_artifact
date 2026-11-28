<template>
    <UiDialog v-if="visible" :model-value="true" :title="isPreset ? '角色预设分享' : 'MONA-DSL分享'"
        :width="isPreset ? 'min(500px, 94vw)' : 'min(460px, 94vw)'"
        :top="draft.shadcn ? undefined : '10vh'" :max-height="draft.shadcn ? undefined : '80vh'"
        :max-width="draft.shadcn ? undefined : '94vw'" :focus-container="!draft.shadcn" prevent-outside :hide-close="busy"
        @escape-key-down="busy && $event.preventDefault()" @update:model-value="open => { if (!open && !busy) close() }">
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
                <UiInput id="preset-share-url" ref="urlInput" readonly :model-value="link" @focus="$event.target.select()" />
                <UiButton variant="primary" :disabled="busy" @click="copy">{{ copied ? '✓ 已复制' : '复制链接' }}</UiButton>
            </div>
            <p v-if="confirming" class="revoke-note" role="alert">确认取消分享？取消后，原链接将立即失效。</p>
        </template>
        <form v-else class="share-fields" :class="{ 'share-original-fields': !draft.shadcn }" @submit.prevent>
            <label><span>分享标题</span><UiInput v-model="title" :readonly="locked || busy" /></label>
            <template v-if="!link">
                <div class="share-term-row"><span>链接有效期</span>
                    <UiSegmentedControl v-model="term" label="链接有效期" :options="termOptions" :disabled="locked || busy"
                        :class="{ 'preset-terms': !draft.shadcn && isPreset }" />
                </div>
                <div v-if="isPreset" class="gear-scope" :class="{ included: withGear }">
                    <UiCheckbox v-model="withGear" :disabled="locked || busy || !draft.equipment.length" aria-describedby="gear-scope-description">{{ draft.equipment.length
                        ? '附带当前穿戴圣遗物（' + draft.equipment.length + ' 件）' : '当前未穿戴圣遗物' }}</UiCheckbox>
                    <small id="gear-scope-description">{{ withGear ? '仅公开当前穿戴的这 ' + draft.equipment.length + ' 件圣遗物词条，不包含仓库其余圣遗物与 UID。'
                        : '默认仅分享养成、武器和计算设置，不包含圣遗物、仓库库存与 UID。' }}</small>
                </div>
            </template>
            <label v-else><span>公开链接</span><UiInput readonly :model-value="link" @focus="$event.target.select()" /></label>
        </form>
        <UiAlert v-if="error" tone="error" class="share-error">{{ error }}</UiAlert>
        <template #footer>
            <div class="actions" :class="{ 'themed-actions': draft.shadcn }">
                <UiButton v-if="isPreset && link && !confirming" :class="{ 'revoke-link': !draft.shadcn }" variant="danger" :disabled="busy" @click="confirming = true">取消分享</UiButton>
                <span class="spacer"></span>
                <template v-if="confirming">
                    <UiButton :disabled="busy" @click="confirming = false">保留分享</UiButton>
                    <UiButton variant="danger" :loading="busy" @click="revoke">确认取消分享</UiButton>
                </template>
                <template v-else>
                    <UiButton :disabled="busy" @click="close">{{ isPreset && !link ? '取消' : '关闭' }}</UiButton>
                    <UiButton v-if="!link" variant="primary" :loading="busy" :disabled="!title.trim()" @click="publish">生成并复制链接</UiButton>
                    <UiButton v-else-if="!isPreset" variant="primary" @click="copy">{{ copied ? '已复制' : '复制链接' }}</UiButton>
                </template>
            </div>
        </template>
    </UiDialog>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAccountStore } from '@/store/pinia/account'
import { cloudApi } from '@/platform/cloud.mjs'
import { characterData } from '@/assets/character'
import locale from '@/i18n/generated/zh-cn.json'
import CharacterPortrait from '@/components/display/CharacterPortrait.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import { pendingContentShare as draft, contentShareReturnPath as returnPath } from './content-share.mjs'

const route=useRoute(), router=useRouter(), account=useAccountStore()
const term=ref('30'), title=ref(''), withGear=ref(false), busy=ref(false), copied=ref(false)
const termOptions = [{ value: '7', label: '7 天' }, { value: '30', label: '30 天' }, { value: 'forever', label: '永久' }]
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
    else close()
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
            urlInput.value?.$el.select()
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
            const sourcePath=route.fullPath
            returnPath.value=sourcePath
            try { await router.push({name:'login'}) }
            finally {
                if (draft.value===item && route.name!=='login' && returnPath.value===sourcePath) returnPath.value=''
            }
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
.share-term-row > .preset-terms{display:grid;width:100%;grid-template-columns:repeat(3,minmax(0,1fr));font-variant-numeric:tabular-nums}
.gear-scope{border:1px solid var(--cx-step-2)}
.gear-scope.included,.result-banner.success{background:rgba(111,207,151,.10);border:1px solid rgba(111,207,151,.34)}
.gear-scope :deep(.check-label){min-height:24px}
.result-banner{color:var(--cx-gold);border:1px solid color-mix(in srgb,var(--cx-gold) 34%,transparent);background:color-mix(in srgb,var(--cx-gold) 10%,var(--cx-card))}
.result-banner.success{color:var(--cx-down)}
.published-scope{margin:12px 0 18px;color:var(--cx-dim);font-variant-numeric:tabular-nums}
.result-url,.actions{display:flex;align-items:center;gap:8px}
.result-url{margin-top:6px}
.result-url button{flex:none}
.share-fields,.share-fields > label,.share-term-row{display:grid;gap:8px}
.share-fields{gap:14px}
.share-fields > label > span,.share-term-row > span{font-weight:600}
.share-term-row > :last-child{justify-self:start}
.share-error{margin-top:12px}
.themed-actions{flex-wrap:wrap}
.share-original-fields{gap:18px}
.share-original-fields > label > span,.share-original-fields .share-term-row > span{font-weight:normal}
.actions .revoke-link{border-color:transparent;background:transparent;color:var(--cx-up);font-weight:normal;padding-inline:0}
.spacer{flex:1}
.revoke-note{color:var(--cx-up);margin:14px 0 0}
</style>

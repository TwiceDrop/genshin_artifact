<template>
    <UiDialog :model-value="!saving" :title="'识图导入（' + files.length + ' 张）'"
        width="620px" :return-focus="returnFocus" @update:model-value="!saving && emit('close')">
        <div v-if="reading && files.length > 1" class="batch-progress" role="status">
            <progress :max="files.length" :value="completed" /> {{ completed }} / {{ files.length }} 张完成
        </div>
        <article v-for="row in rows" :key="row.id" class="review-card">
            <div class="card-head">
                <label class="heading"><input v-if="row.role" v-model="row.selected" type="checkbox" :disabled="saving || row.saved" />
                    <strong>{{ row.role && characters[row.role.character] ? locale[characters[row.role.character].nameLocale] : row.fileName }}</strong>
                </label>
                <button v-if="row.role" class="edit-link" type="button" :aria-expanded="!!editing[row.id]"
                    :aria-controls="'gear-review-'+row.id" @click="editing[row.id] = !editing[row.id]">{{ editing[row.id] ? '收起编辑' : '核对与修改' }}</button>
            </div>
            <small v-if="row.saved || row.status" role="status">{{ row.saved ? '已导入' : row.status }}</small>
            <template v-if="row.role">
                <div class="summary">
                    <span>Lv.{{ row.role.level || '？' }} · {{ row.role.constellation === '' ? '？' : row.role.constellation }} 命</span>
                    <span>{{ locale[weapons[row.role.weapon]?.nameLocale] || '待核对武器' }}<template v-if="row.role.weaponLevel"> Lv.{{ row.role.weaponLevel }}</template><template v-if="row.role.refine"> · 精{{ row.role.refine }}</template></span>
                    <span>圣遗物 {{ row.drafts.length }} 件</span><span>天赋 {{ row.role.talents.map(x=>x || '？').join(' / ') }}</span>
                </div>
                <p class="comparison-result" :class="{different: checks[row.id].differences || checks[row.id].error}">{{ checks[row.id].summary }}</p>
                <div v-if="editing[row.id]" :id="'gear-review-'+row.id" class="editor">
                    <fieldset :disabled="saving || row.saved">
                        <div class="fields">
                            <label>原神 UID<input v-model.trim="row.role.uid" inputmode="numeric" maxlength="10" /></label>
                            <label>角色<select v-model="row.role.character" aria-label="角色"><option value=""></option><option v-for="name in rosterChoices" :key="name" :value="name">{{ locale[characters[name].nameLocale] }}</option></select></label>
                            <label>角色等级<input v-model="row.role.level" type="number" min="1" max="100" /></label>
                            <label v-if="promotionLevels.includes(Number(row.role.level))">角色突破<select v-model="row.role.ascend" aria-label="角色突破"><option value=""></option><option value="no">未突破</option><option value="yes">已突破</option></select></label>
                            <label>命座<input v-model="row.role.constellation" type="number" min="0" max="6" /></label>
                            <label>武器<select v-model="row.role.weapon" aria-label="武器"><option value=""></option><option v-for="w in weaponOptions(row.role.character)" :key="w.name" :value="w.name">{{ locale[w.nameLocale] }}</option></select></label>
                            <label>武器等级<input v-model="row.role.weaponLevel" type="number" min="1" max="90" /></label>
                            <label v-if="promotionLevels.includes(Number(row.role.weaponLevel))">武器突破<select v-model="row.role.weaponAscend" aria-label="武器突破"><option value=""></option><option value="no">未突破</option><option value="yes">已突破</option></select></label>
                            <label>精炼<input v-model="row.role.refine" type="number" min="1" max="5" /></label>
                            <label v-for="(label,i) in ['普通攻击','元素战技','元素爆发']" :key="label">{{ label }}<input v-model="row.role.talents[i]" type="number" min="1" max="15" /></label>
                        </div>
                        <details v-for="(piece,i) in row.drafts" :key="i"><summary>{{ slotLabels[piece.position] || '圣遗物' }} · {{ locale[sets[piece.setName]?.nameLocale] || '待核对' }}</summary>
                            <svg v-if="piece.region" :viewBox="[piece.region.left,piece.region.top,piece.region.width,piece.region.height].map(n=>n*1000).join(' ')" aria-label="圣遗物原图">
                                <image :href="row.url" width="1000" :height="1000*row.aspect" />
                            </svg>
                            <ArtifactScreenshotFields :draft="piece" />
                        </details>
                    </fieldset>
                </div>
                <details><summary>面板对比</summary>
                    <p v-if="checks[row.id]?.error">{{ checks[row.id].error }}</p>
                    <table v-else><thead><tr><th>属性</th><th>图中数值</th><th>档位复算</th></tr></thead>
                        <tbody><tr v-for="(value,label) in checks[row.id]?.panel" :key="label" :class="{different:checks[row.id].mismatches.includes(label)}">
                            <th>{{ label }}</th><td>{{ row.role.stats[label] === '' ? '—' : row.role.stats[label] ?? '—' }}</td><td>{{ value }}</td>
                        </tr></tbody>
                    </table>
                </details>
                <details><summary>识别记录与原图</summary>
                    <dl><template v-for="[label,t] in row.role.transcript" :key="label"><dt>{{ label }}</dt><dd>{{ t || '—' }}</dd></template></dl>
                    <details><summary>查看原图</summary><img :src="row.url" alt="原神战绩分享原图" /></details>
                </details>
            </template>
        </article>
        <p v-if="error" role="alert">{{ error }}</p>
        <template #footer><UiButton :disabled="saving" @click="emit('close')">取消</UiButton>
            <UiButton variant="primary" :disabled="reading || saving || !selected.length" @click="confirm">{{ reading ? '识别中…' : '导入 ' + selected.length + ' 个角色' }}</UiButton></template>
    </UiDialog>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import ArtifactScreenshotFields from './ArtifactScreenshotFields.vue'
import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import sets from '@/assets/_gen_artifact'
import locale from '@/i18n/generated/zh-cn.json'
import { artifactTags } from '@/constants/artifact'
import { slotLabels } from '@/import/artifact-screenshot.mjs'
import { readArtifactScreenshot } from '@/import/local-artifact-ocr'
import { readRoleHeader } from '@/import/miyoushe-role-share'
import { compareRolePanel, reviewedRole, rosterChoices, promotionLevels } from '@/import/roster-screenshot'

const props = defineProps({files:{type:Array, required:true}, save:Function, returnFocus:Function})
const emit = defineEmits(['close'])
const rows=ref([]), reading=ref(false), saving=ref(false), error=ref('')
const editing = ref({})
const completed = computed(() => rows.value.filter(row => row.finished).length)
const job=new AbortController()
const selected=computed(()=>rows.value.filter(r=>r.selected && !r.saved))
const weaponOptions=name=>Object.values(weapons).filter(w=>w.type === characters[name]?.weapon)
function panelCheck(r) {
    try {
        const panel = compareRolePanel(reviewedRole(r), r.role.stats)
        const measured = Object.keys(panel).filter(label => r.role.stats[label] !== '' && r.role.stats[label] != null)
        const mismatches = measured.filter(label => Number(r.role.stats[label]) !== Number(panel[label]))
        const differences = mismatches.length
        const summary = differences ? '面板有 ' + differences + ' 项差异' : measured.length ? '已识别的 ' + measured.length + ' 项面板数值一致' : '暂无可对比的面板数值'
        return {panel,mismatches,differences,summary}
    } catch(e) {return {error:e.message,summary:e.message}}
}
const checks=computed(()=>Object.fromEntries(rows.value.filter(r=>r.role).map(r=>[r.id,panelCheck(r)])))
async function recognizeFiles(files) {
    reading.value=true
    error.value=''
    try {
        rows.value = files.map((file, index) => ({id:index+1,fileName:file.name,url:URL.createObjectURL(file),selected:false,status:'等待识别',finished:false}))
        for(const [index,file] of files.entries()) {
            if(job.signal.aborted) return
            const row=rows.value[index]
            row.status='正在识别…'
            try {
                const result=await readArtifactScreenshot(file,job.signal,sets,locale,artifactTags, async (canvas,worker,signal)=>{
                    row.aspect=canvas.height/canvas.width
                    return readRoleHeader(canvas,worker,signal,{characters,weapons,locale,rosterChoices})
                }, candidate => panelCheck(candidate).differences === 0)
                if(job.signal.aborted) return
                if (!result.drafts.length && !(result.role.uid && result.role.character)) throw new Error('未识别到原神战绩角色或圣遗物，请核对原图。')
                Object.assign(row,result,{selected:true,status:''})
            } catch(e) { if(!job.signal.aborted) row.status=e.message }
            finally {row.finished=true}
        }
    } finally { reading.value=false }
}
async function confirm() {
    if(saving.value || reading.value) return
    error.value=''
    saving.value=true
    try {
        const batches=new Map(), keys=new Set()
        for(const row of selected.value) {
            let review
            try { review=reviewedRole(row) } catch(e) { editing.value[row.id]=true; throw new Error(row.fileName+'：'+e.message) }
            const {uid,raw}=review, key=[uid,raw.base.id,raw.base.element].join(':')
            if(keys.has(key)) throw new Error('同一 UID 的同一角色请只勾选一张图')
            keys.add(key)
            if(!batches.has(uid)) batches.set(uid,[])
            batches.get(uid).push({row,raw})
        }
        for(const [uid,group] of batches) {
            await props.save({version:1,source:'screenshot',role:{uid},characters:group.map(g=>g.raw),total:group.length,importedAt:new Date().toISOString()})
            for(const {row} of group) {row.saved=true;row.selected=false}
        }
        emit('close')
    } catch(e) {error.value=e.message} finally {saving.value=false}
}
onMounted(()=>recognizeFiles(props.files))
onBeforeUnmount(()=>{ job.abort(); for(const row of rows.value) URL.revokeObjectURL(row.url) })
</script>
<style scoped>
label {display:grid;gap:5px}
.review-card {padding:14px 16px;border:1px solid var(--cx-step-2);border-radius:10px}
.review-card + .review-card {margin-top:8px}
.card-head,.heading,.batch-progress {display:flex;align-items:center;gap:9px}
.card-head {justify-content:space-between}
.heading {min-width:0;overflow-wrap:anywhere;font-size:16px}
.heading input {margin:0;accent-color:var(--cx-gold);width:16px;height:16px;flex:none}
.edit-link {flex:none;border:0;background:transparent;color:var(--cx-gold);font:inherit;font-size:13px;cursor:pointer;padding:4px}
.summary,small,.batch-progress {color:var(--cx-dim);font-size:13px}
.summary {display:flex;flex-wrap:wrap;column-gap:14px;row-gap:2px;margin:7px 0;line-height:1.5}
.comparison-result {margin:8px 0;color:var(--cx-dim);font-size:13px}
.comparison-result.different {color:var(--cx-up)}
.batch-progress {margin-bottom:10px}.batch-progress progress {flex:1;min-width:0;accent-color:var(--cx-gold)}
.editor {padding:8px 10px;background:var(--cx-step);border-radius:8px;margin:10px 0}
details {padding:4px 0} summary {cursor:pointer;color:var(--cx-dim);font-size:13px;width:fit-content}
summary:hover,.edit-link:hover {color:var(--cx-gold)} details[open]>summary {color:var(--cx-letter)}
fieldset {border:0;padding:0;min-width:0}.fields {display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:8px;margin:10px 0}
select,input:not([type=file]):not([type=checkbox]) {width:100%;box-sizing:border-box;color:inherit;background:var(--cx-step);border:1px solid var(--cx-step-2);border-radius:6px;padding:5px}
img,svg {display:block;width:100%} svg {max-height:220px;margin:8px 0}
dl {display:grid;grid-template-columns:auto 1fr;gap:4px 12px} dd {margin:0;overflow-wrap:anywhere} table {width:100%;border-collapse:collapse;font-size:13px}
td,th {padding:5px;text-align:right;font-variant-numeric:tabular-nums;border-bottom:1px solid var(--cx-step-2)} th:first-child {text-align:left}
.different td,[role=alert] {color:var(--el-color-danger)} button+button {margin-left:8px}
</style>

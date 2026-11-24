<template>
    <UiDialog :model-value="true" title="截图导入圣遗物" width="850px" @update:model-value="emit('close')">
        <label class="file-label">选择圣遗物截图
            <input type="file" accept="image/*" @change="pickFile" />
        </label>
        <p v-if="busy" role="status">正在识别…</p>
        <p v-if="error" role="alert">{{ error }}</p>
        <div v-if="url" class="review">
            <div class="image-column">
                <div class="preview" :class="{ cropping }" @pointerdown="startCrop" @pointermove="moveCrop" @pointerup="finishCrop" @pointercancel="crop = null">
                    <img ref="preview" v-show="!draft?.region || cropping" :src="url" alt="圣遗物原图" draggable="false" />
                    <svg v-if="draft?.region && !cropping" :viewBox="cardViewBox" aria-label="当前圣遗物原图" role="img">
                        <image :href="url" width="1000" :height="1000 * preview.naturalHeight / preview.naturalWidth" />
                    </svg>
                    <span v-if="box" class="crop" :style="boxStyle"></span>
                </div>
                <button v-if="cropping" type="button" @click="cropping = false; crop = null">取消框选</button>
                <button v-else-if="!draft?.region && !busy" type="button" @click="cropping = true">框选识别区域</button>
            </div>
            <form v-if="draft" id="artifact-screenshot-review" @submit.prevent="confirm">
                <h4 v-if="drafts.length > 1">核对圣遗物 · {{ index + 1 }} / {{ drafts.length }}</h4>
                <ArtifactScreenshotFields :draft="draft" />
            </form>
        </div>
        <template #footer>
            <button type="button" @click="emit('close')">取消</button>
            <button v-if="index > 0" type="button" @click="index--; error = ''">上一件</button>
            <button class="confirm" type="submit" form="artifact-screenshot-review" :disabled="!draft || busy || cropping">{{
                index < drafts.length-1 ? '核对下一件' : drafts.length > 1 ? '确认全部入库' : '确认入库' }}</button>
        </template>
    </UiDialog>
</template>
<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import sets from '@/assets/_gen_artifact'
import locale from '@/i18n/generated/zh-cn.json'
import { artifactTags, mainStatMap } from '@/constants/artifact'
import ArtifactScreenshotFields from '@/components/import/ArtifactScreenshotFields.vue'
import { readArtifactScreenshot } from '@/import/local-artifact-ocr'

const emit = defineEmits(['confirm', 'close'])
const url = ref(''), preview = ref(null), busy = ref(false), drafts = ref([]), index = ref(0), error = ref('')
const draft = computed(() => drafts.value[index.value])
const cardViewBox = computed(() => {
    const r = draft.value.region
    return [r.left,r.top,r.width,r.height].map(v => v*1000).join(' ')
})
const cropping = ref(false), crop = ref(null)
let request
const box = computed(() => crop.value && {
    x: Math.min(crop.value.x, crop.value.endX), y: Math.min(crop.value.y, crop.value.endY),
    width: Math.abs(crop.value.x - crop.value.endX), height: Math.abs(crop.value.y - crop.value.endY)
})
const boxStyle = computed(() => ({left: box.value.x*100+'%', top: box.value.y*100+'%', width: box.value.width*100+'%', height: box.value.height*100+'%'}))
const rarities = computed(() => [1,2,3,4,5].filter(n => !draft.value?.setName ||
    (n >= sets[draft.value.setName].minStar && n <= sets[draft.value.setName].maxStar)))
function point(event) {
    const r = preview.value.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (event.clientX-r.left)/r.width)), y: Math.max(0, Math.min(1, (event.clientY-r.top)/r.height)) }
}
function startCrop(event) {
    if (!cropping.value || !preview.value.naturalWidth) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const {x,y} = point(event)
    crop.value = {x,y,endX:x,endY:y}
}
function moveCrop(event) {
    if (!crop.value) return
    const {x,y} = point(event)
    Object.assign(crop.value, {endX:x,endY:y})
}
function finishCrop(event) {
    if (!crop.value) return
    moveCrop(event)
    const {x,y,width,height} = box.value, img = preview.value
    crop.value = null
    const w = Math.round(width * img.naturalWidth), h = Math.round(height * img.naturalHeight)
    if (w < 8 || h < 8) return
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d').drawImage(img, x*img.naturalWidth,y*img.naturalHeight,w,h,0,0,w,h)
    cropping.value = false
    recognize(canvas)
}
function pickFile(event) {
    const file = event.target.files[0]
    if (!file) return
    event.target.value = ''
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = URL.createObjectURL(file)
    crop.value = null; cropping.value = false
    recognize(file)
}
async function recognize(image) {
    request?.abort()
    const job = new AbortController()
    request = job; busy.value = true; error.value = ''; drafts.value = []; index.value = 0
    try {
        const result = await readArtifactScreenshot(image, job.signal, sets, locale, artifactTags)
        if (job.signal.aborted) return
        drafts.value = result
        if (!draft.value.mainTag.name) error.value = '未识别到主词条，可框选圣遗物详情重新识别，或手动补全。'
    } catch (e) {
        if (!job.signal.aborted) error.value = '截图识别失败：' + (e.message || e)
    } finally { if (!job.signal.aborted) busy.value = false }
}
function confirm() {
    const d = draft.value
    if (!d || busy.value || cropping.value) return
    if (!mainStatMap[d.position]?.includes(d.mainTag.name) || !rarities.value.includes(Number(d.star))) {
        error.value = '请核对部位、星级和主词条。'; return
    }
    const names = [d.mainTag, ...d.normalTags].map(tag => tag.name)
    if (new Set(names).size !== names.length) { error.value = '词条重复，请对照截图修改。'; return }
    if (index.value < drafts.value.length-1) { index.value++; error.value = ''; return }
    const convert = tag => ({name: tag.name, value: Number(tag.value) / (artifactTags[tag.name].percentage ? 100 : 1)})
    emit('confirm', drafts.value.map(piece => ({setName:piece.setName, position:piece.position, level:Number(piece.level), star:Number(piece.star),
        mainTag:convert(piece.mainTag), normalTags:piece.normalTags.map(convert)})))
}
onBeforeUnmount(() => { request?.abort(); if (url.value) URL.revokeObjectURL(url.value) })
</script>
<style scoped>
.review { display: grid; grid-template-columns: minmax(0,.9fr) minmax(0,1fr); gap: 18px; margin-top: 12px; }
.preview { position: relative; width: fit-content; max-width: 100%; touch-action: pan-y; }
.preview.cropping { touch-action: none; cursor: crosshair; }
.preview img { display: block; max-width: 100%; max-height: 52vh; border-radius: 8px; }
.preview:has(svg) { width: 100%; } .preview svg { display: block; width: 100%; border-radius: 8px; }
.crop { position: absolute; outline: 2px dashed var(--cx-gold); pointer-events: none; }
.fields { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
label { display: grid; gap: 4px; font-size: 13px; }
.tag { display: flex; gap: 6px; margin: 6px 0; }
.tag select { flex: 1 1 55%; } .tag input { width: 30%; }
.file-label input { width: 100%; }
button, select, input { font: inherit; color: var(--cx-letter); }
button, select, input[type=number] { min-width: 0; padding: 6px 9px; border: 1px solid var(--cx-step-2); border-radius: 7px; background: var(--cx-step); }
button { cursor: pointer; } h4 { margin: 12px 0 6px; } .image-column button { margin-top: 8px; }
.confirm { margin-left: 8px; background: var(--cx-gold); color: var(--cx-card); }
button:disabled { opacity: .5; } [role=alert] { color: var(--cx-gold); }
@media (max-width: 620px) { .review { grid-template-columns: 1fr; } .preview img { max-height: 31vh; } }
</style>

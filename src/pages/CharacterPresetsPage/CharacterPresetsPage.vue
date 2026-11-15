<template>
    <div class="presets-page cx-scope">
        <header class="presets-bar">
            <h2>{{ t('nav.preset') }}</h2>
            <span class="presets-spacer"></span>
            <button type="button" class="presets-btn" @click="showImportDialog = true">{{ t('misc.import') }}</button>
            <button type="button" class="presets-btn" @click="handleExportAll">{{ t('presetPage.exportAll') }}</button>
            <button type="button" class="presets-add" @click="editPreset()">新建自定义预设</button>
        </header>
        <preset-browser v-model="source">
            <template #default="{entry}">
                <preset-item :item="entry.item" :name="entry.name" :calculate-icon="false"
                    @delete="presetStore.deletePreset(entry.name)" @download="downloadPreset(entry)"
                    @click="editPreset(entry.name)" tabindex="0" role="button" @keydown.enter="editPreset(entry.name)" />
            </template>
        </preset-browser>
        <preset-editor v-if="editorOpen" :preset-name="editingName" @close="editorOpen = false" @saved="handleSaved" />
        <el-dialog v-model="showImportDialog" :title="t('misc.import')" :width="deviceIsPC ? '60%' : '90%'">
            <import-block ref="fileImportBlock" accept="application/json,text/plain" />
            <template #footer><el-button @click="showImportDialog = false">{{ t('misc.cancel') }}</el-button><el-button type="primary" @click="handleImport">{{ t('misc.confirm') }}</el-button></template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import {ElMessage} from 'element-plus'
import {checkImportFormat} from '@/utils/preset'
import {downloadString} from '@/utils/common'
import {deviceIsPC} from '@/utils/device'
import {usePresetStore} from '@/store/pinia/preset'
import {presetSource} from '@/utils/preset-workflow.mjs'
import {useI18n} from '@/i18n/i18n'
import PresetItem from '@/components/display/PresetItem.vue'
import PresetBrowser from '@/components/preset/PresetBrowser.vue'
import PresetEditor from '@/components/preset/PresetEditor.vue'
import ImportBlock from '@/components/misc/ImportBlock'

const {t} = useI18n(), presetStore = usePresetStore()
const showImportDialog = ref(false), source = ref('game'), editorOpen = ref(false)
const editingName = ref<string | undefined>(), fileImportBlock = ref<InstanceType<typeof ImportBlock> | null>(null)
function editPreset(name?: string) { editingName.value = name; editorOpen.value = true }
function handleSaved(name: string) { source.value = presetSource(presetStore.getPreset(name)!.item) }
async function handleImport() {
    if (!fileImportBlock.value) return
    try {
        const obj = JSON.parse(await fileImportBlock.value.getReadPromise())
        if (!checkImportFormat(obj)) { ElMessage.error(t('presetPage.wrongFormat')); return }
        for (const entry of obj) presetStore.addOrOverwrite(entry.name, entry.item)
        showImportDialog.value = false
    } catch (error: any) { ElMessage.error(error.message) }
}
async function downloadPreset(entry: any) {
    try { await downloadString(JSON.stringify([entry]), 'application/json', entry.name) }
    catch (error: any) { ElMessage.error(error.message) }
}
async function handleExportAll() {
    try { await downloadString(JSON.stringify(presetStore.allFlat.value), 'application/json', t('misc.preset')) }
    catch (error: any) { ElMessage.error(error.message) }
}
</script>
<style scoped>
/* 计算预设页（夜空风格）：颜色读 src/styles/content-theme.css 的 --cx-* */
.presets-page{min-height:calc(100vh - 48px);padding:16px clamp(10px,1.3vw,18px) 18px;box-sizing:border-box;border-radius:var(--cx-radius);background:var(--cx-ground);color:var(--cx-letter)}
.presets-bar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px}
.presets-bar h2{margin:0;font-size:20px;font-weight:700}
.presets-spacer{flex:1}
.presets-btn{height:40px;padding:0 16px;border:0;border-radius:10px;background:var(--cx-card);color:var(--cx-letter);font:inherit;cursor:pointer}
.presets-btn:hover{background:var(--cx-step-2)}
.presets-add{height:42px;padding:0 20px;border:0;border-radius:999px;background:var(--cx-gold);color:var(--cx-gold-on);font:inherit;font-weight:700;cursor:pointer}
.presets-add:hover{filter:brightness(1.08)}
.presets-bar button:focus-visible{outline:2px solid var(--cx-gold);outline-offset:2px}
@media(max-width:767px){.presets-bar h2{display:none}.presets-spacer{display:none}.presets-add{margin-left:auto}}
</style>

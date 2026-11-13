<template>
    <div>
        <div class="toolbar">
            <el-button-group>
                <el-button :icon="IconFa6SolidDownload" @click="handleExportAll">{{ t('presetPage.exportAll') }}</el-button>
                <el-button :icon="IconFa6SolidUpload" @click="showImportDialog = true">{{ t('misc.import') }}</el-button>
            </el-button-group>
            <el-button type="primary" @click="editPreset()">新建自定义预设</el-button>
        </div>
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
import IconFa6SolidUpload from '~icons/fa6-solid/upload'
import IconFa6SolidDownload from '~icons/fa6-solid/download'

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
.toolbar{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;margin-bottom:20px}
</style>

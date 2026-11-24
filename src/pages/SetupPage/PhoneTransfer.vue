<template>
    <div class="phone-transfer">
        <el-alert v-if="error" :title="error" type="error" :closable="false" />
        <el-select v-if="store.uidGroups.value.length" v-model="store.selectedUid.value" aria-label="选择原神 UID">
            <el-option v-for="group in store.uidGroups.value" :key="group.uid" :value="group.uid" :label="[group.nickname, group.uid].filter(Boolean).join(' · ')" />
        </el-select>
        <el-button type="primary" round :disabled="!store.selectedUid.value" @click="exportUid">导出此 UID 到手机 / 电脑</el-button>
        <el-checkbox v-model="includeInventory">附带未标记 UID 的仓库圣遗物（归入此 UID）</el-checkbox>
        <el-button round :disabled="!Object.keys(store.data.value.snapshots).length" @click="exportSnapshots">导出角色快照</el-button>
    </div>
</template>
<script setup>
import { ref } from 'vue'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { usePresetStore } from '@/store/pinia/preset'
import { useArtifactStore } from '@/store/pinia/artifact'
import { recordUsageUnlessCancelled } from '@/usage-stats/index.mjs'
import { saveText } from '@/platform/native.mjs'
import { exportUidPackage } from '@/import/uid-package.mjs'

const store = useMiyousheStore()
const includeInventory = ref(true), error = ref('')

async function exportSnapshots() {
    try { recordUsageUnlessCancelled(await saveText(JSON.stringify(Object.values(store.data.value.snapshots), null, 2), 'application/json', 'mona-miyoushe-characters.json'), 'action.data-export') }
    catch (e) { error.value = e.message }
}
async function exportUid() {
    try {
        const pack = exportUidPackage(store.selectedUid.value, store.data.value, usePresetStore().presets.value, useArtifactStore().artifacts.value, includeInventory.value)
        recordUsageUnlessCancelled(await saveText(JSON.stringify(pack), 'application/json', `mona-uid-${pack.uid}.json`), 'action.data-export')
    } catch (e) { error.value = e.message }
}
</script>
<style scoped>
.phone-transfer { display: grid; gap: 12px; justify-items: start; }
.phone-transfer .el-select { width: min(100%, 448px); }
.phone-transfer .el-button { margin: 0; }
.phone-transfer .el-checkbox { height: auto; white-space: normal; }
</style>

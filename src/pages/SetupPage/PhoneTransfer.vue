<template>
    <div class="phone-transfer">
        <UiAlert v-if="error" tone="error" hide-icon>{{ error }}</UiAlert>
        <UiSelect v-if="uidOptions.length" v-model="store.selectedUid.value" label="选择原神 UID" :options="uidOptions" />
        <UiButton class="transfer-button" variant="primary" :disabled="!store.selectedUid.value" @click="exportUid">导出此 UID 到手机 / 电脑</UiButton>
        <UiCheckbox v-model="includeInventory" class="transfer-inventory">附带未标记 UID 的仓库圣遗物（归入此 UID）</UiCheckbox>
        <UiButton class="transfer-button" :disabled="!Object.keys(store.data.value.snapshots).length" @click="exportSnapshots">导出角色快照</UiButton>
    </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { usePresetStore } from '@/store/pinia/preset'
import { useArtifactStore } from '@/store/pinia/artifact'
import { recordUsageUnlessCancelled } from '@/usage-stats/index.mjs'
import { saveText } from '@/platform/native.mjs'
import { exportUidPackage } from '@/import/uid-package.mjs'

const store = useMiyousheStore()
const includeInventory = ref(true), error = ref('')
const uidOptions = computed(() => store.uidGroups.value.map(group => ({ value: group.uid, label: [group.nickname, group.uid].filter(Boolean).join(' · ') })))

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
.phone-transfer :deep([data-slot="select-trigger"]) { width: min(100%, 448px); }
.transfer-button { border-radius: 999px; }
.transfer-inventory { white-space: normal; }
</style>

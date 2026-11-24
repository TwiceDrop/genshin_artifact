<template>
    <div class="uid-data-page cx-scope">
        <miyoushe-import />
    </div>
</template>
<script setup>
import { onActivated } from 'vue'
import MiyousheImport from '@/components/import/MiyousheImport.vue'
import { connectSavedRolePresets } from '@/import/role-presets'

onActivated(connectSavedRolePresets)
</script>
<style scoped>
/* UID 数据页外框（夜空风格），内容见 MiyousheImport */
.uid-data-page { box-sizing: border-box; min-height: calc(100vh - 48px); padding: 16px clamp(10px, 1.3vw, 18px) 18px; border-radius: var(--cx-radius); background: var(--cx-ground); color: var(--cx-letter); }
</style>

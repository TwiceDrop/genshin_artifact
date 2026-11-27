<template>
    <main class="uid-data-page cx-scope cx-page-frame">
        <miyoushe-import />
    </main>
</template>
<script setup>
import { onActivated } from 'vue'
import MiyousheImport from '@/components/import/MiyousheImport.vue'
import { connectSavedRolePresets } from '@/import/role-presets'

onActivated(connectSavedRolePresets)
</script>

<template>
    <div class="uid-data-page">
        <h2>我的 UID 数据</h2>
        <miyoushe-import @apply="name => router.push({ path: '/calculate', query: { preset: name } })" />
    </div>
</template>
<script setup>
import MiyousheImport from '@/components/import/MiyousheImport.vue'
import { useRouter } from 'vue-router'
const router = useRouter()
</script>
<style scoped>
.uid-data-page{max-width:1100px;margin:auto}.uid-data-page h2{font-size:23px;margin:8px 0 12px}
</style>

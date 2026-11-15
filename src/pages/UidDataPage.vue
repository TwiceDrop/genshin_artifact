<template>
    <div class="uid-data-page cx-scope">
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
/* UID 数据页外框（夜空风格），内容见 MiyousheImport */
.uid-data-page { box-sizing: border-box; min-height: calc(100vh - 48px); padding: 16px clamp(10px, 1.3vw, 18px) 18px; border-radius: var(--cx-radius); background: var(--cx-ground); color: var(--cx-letter); }
.uid-data-page h2 { margin: 0 0 14px; font-size: 20px; font-weight: 700; }
</style>

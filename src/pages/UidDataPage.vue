<template>
    <div class="uid-data-page">
        <h2>我的 UID 数据</h2>
        <p class="uid-data-tip">在电脑导出所选 UID 的 JSON 文件，发送到手机后在这里导入。角色、装备、计算预设和对比历史保存在本机，断网也能使用。</p>
        <miyoushe-import @apply="name => router.push({ path: '/calculate', query: { preset: name } })" />
    </div>
</template>
<script setup>
import MiyousheImport from '@/components/import/MiyousheImport.vue'
import { useRouter } from 'vue-router'
const router = useRouter()
</script>
<style scoped>
.uid-data-page{max-width:1100px;margin:auto}.uid-data-page h2{font-size:23px;margin:8px 0 12px}.uid-data-tip{background:var(--el-color-primary-light-9);padding:14px;border-radius:10px;font-size:14px;line-height:1.7;color:var(--el-text-color-regular)}
</style>

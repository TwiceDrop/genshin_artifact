<template>
    <p v-if="result?.presets != null" class="mys-result">已保存</p>
    <p v-else-if="result" class="mys-result">已保存 {{ result.imported }} 名角色；新增 {{ result.added }} 件、复用 {{ result.reused }} 件圣遗物。{{ result.rejected ? `${result.rejected} 名角色待适配，原始数据已保留。` : '' }}</p>
    <ul v-if="result?.warnings?.length" class="mys-warnings"><li v-for="(w, i) in result.warnings" :key="i">{{ w }}</li></ul>
</template>

<script setup>
defineProps({ result: Object })
</script>

<style scoped>
.mys-result { margin: 0; color: var(--cx-down); font-size: 13px; line-height: 1.6; }
.mys-warnings { margin: 0; padding-left: 18px; color: var(--cx-gold) !important; font-size: 12px; line-height: 1.7; max-height: 150px; overflow: auto; }
</style>

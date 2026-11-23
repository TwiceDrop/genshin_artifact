<template>
    <el-dialog :model-value="modelValue" title="计算出现错误" width="460px" append-to-body align-center
               @update:model-value="emit('update:modelValue', $event)">
        <p>很抱歉，计算过程中出了一些问题。</p>
        <p class="calc-error-hint">如果要寻求帮助，请向他人发送错误报告文件，而不是发送这个窗口的截图。你也可以查看错误报告，其中可能会有出错的原因。</p>
        <pre v-if="message" class="calc-error-message">{{ message }}</pre>
        <template #footer>
            <el-button @click="emit('update:modelValue', false)">确定</el-button>
            <el-button type="primary" @click="emit('export')">导出错误报告</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
defineProps<{ modelValue: boolean, message: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void, (e: 'export'): void }>()
</script>

<style scoped>
.calc-error-hint{font-weight:600}
.calc-error-message{max-height:160px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}
</style>

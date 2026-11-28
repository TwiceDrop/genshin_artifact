<template>
    <UiDialog :model-value="modelValue" title="计算出现错误" width="min(460px, calc(100vw - 24px))"
               :initial-focus="() => exportButton?.$el.focus({ preventScroll: true })"
               @update:model-value="emit('update:modelValue', $event)">
        <template #title-icon><span class="calc-error-icon"><i-ep-warning-filled aria-hidden="true" /></span></template>
        <p class="calc-error-intro">很抱歉，计算过程中出了一些问题。</p>
        <p class="calc-error-hint">如果要寻求帮助，请向他人发送错误报告文件，<mark class="calc-error-mark">而不是发送这个窗口的截图</mark>。你也可以查看错误报告，其中可能会有出错的原因。</p>
        <pre v-if="message" class="calc-error-message" tabindex="0">{{ message }}</pre>
        <template #footer>
            <div class="calc-error-actions">
                <UiButton @click="emit('update:modelValue', false)">确定</UiButton>
                <UiButton ref="exportButton" variant="primary" @click="emit('export')"><i-ep-download aria-hidden="true" />导出错误报告</UiButton>
            </div>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'

defineProps<{ modelValue: boolean, message: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void, (e: 'export'): void }>()
const exportButton = ref<InstanceType<typeof UiButton> | null>(null)
</script>

<style scoped>
.calc-error-icon { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border-radius: 8px; background: color-mix(in srgb, var(--cx-up) 13%, transparent); color: var(--cx-up); }
.calc-error-intro, .calc-error-hint { margin: 0 0 10px; font-size: 13px; line-height: 1.6; }
.calc-error-hint { color: var(--cx-dim); }
.calc-error-mark { padding: 0 2px; border-radius: 2px; background: color-mix(in srgb, var(--cx-gold) 15%, transparent); color: var(--cx-gold); font-weight: 600; }
.calc-error-message { box-sizing: border-box; max-height: min(260px, 38dvh); margin: 0 0 12px; overflow: auto; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--cx-up) 35%, var(--cx-step-2)); border-radius: 8px; background: var(--cx-step); white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.5; }
.calc-error-message:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: -2px; }
.calc-error-actions { display: flex; flex-wrap: wrap; justify-content: end; gap: 8px; }
</style>

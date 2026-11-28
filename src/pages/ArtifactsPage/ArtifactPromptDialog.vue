<script setup lang="ts">
import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiInput from '@/components/ui/UiInput.vue'
import { useI18n } from '@/i18n/i18n'
import { createArtifactPrompt, type ArtifactPrompt } from './artifact-prompt'

const props = defineProps<{ controller?: ArtifactPrompt; width?: string }>()
const { request, shownRequest, accept, cancel, confirm, prompt, alert } = props.controller ?? createArtifactPrompt()
const { t } = useI18n()
const value = ref('')
const error = ref('')
const input = ref<InstanceType<typeof UiInput> | null>(null)
const confirmButton = ref<InstanceType<typeof UiButton> | null>(null)
const open = computed(() => request.value !== null)
const ContentNode = defineComponent({ setup: () => () => shownRequest.value?.message })

watch(request, current => {
    if (!current) return
    value.value = current.options.inputValue ?? ''
    error.value = ''
}, { immediate: true, flush: 'sync' })

function focusPrompt() {
    if (input.value) input.value.$el.focus({ preventScroll: true })
    else confirmButton.value?.$el.focus({ preventScroll: true })
}

function preventAlertEscape(event: KeyboardEvent) {
    if (request.value?.kind === 'alert') event.preventDefault()
}

function submit() {
    const current = request.value
    if (!current) return
    const { inputPattern, inputErrorMessage, inputValidator } = current.options
    if (current.kind === 'prompt' && inputPattern && !inputPattern.test(value.value)) {
        error.value = inputErrorMessage ?? ''
        return
    }
    const valid = current.kind === 'prompt' ? inputValidator?.(value.value) : undefined
    if (valid !== undefined && valid !== true) {
        error.value = typeof valid === 'string' ? valid : inputErrorMessage ?? ''
        return
    }
    accept(value.value)
}

onBeforeUnmount(() => cancel('close'))
defineExpose({ confirm, prompt, alert })
</script>

<template>
    <UiDialog v-if="shownRequest" :model-value="open" :title="shownRequest.title" :width="width ?? 'min(420px, 94vw)'"
        :initial-focus="focusPrompt" :prevent-outside="shownRequest.kind === 'alert' || shownRequest.options.closeOnClickModal === false"
        @escape-key-down="preventAlertEscape" @update:model-value="cancel('close')">
        <div class="prompt-content">
            <i-ep-warning-filled v-if="shownRequest.options.type === 'warning'" aria-hidden="true" class="prompt-warning" />
            <p v-if="typeof shownRequest.message === 'string'">{{ shownRequest.message }}</p>
            <ContentNode v-else />
        </div>
        <UiInput v-if="shownRequest.kind === 'prompt'" ref="input" v-model="value" :aria-label="String(shownRequest.message)"
            :aria-invalid="!!error" @keydown.enter.prevent="submit" />
        <p v-if="error" role="alert" class="prompt-error">{{ error }}</p>
        <template #footer>
            <div class="prompt-actions">
                <UiButton v-if="shownRequest.kind !== 'alert'" @click="cancel('cancel')">{{ shownRequest.options.cancelButtonText ?? t('misc.cancel') }}</UiButton>
                <UiButton ref="confirmButton" variant="primary" @click="submit">{{ shownRequest.options.confirmButtonText ?? t('misc.confirm') }}</UiButton>
            </div>
        </template>
    </UiDialog>
</template>

<style scoped>
.prompt-error { color: var(--cx-up); margin: 6px 0 0; }
.prompt-content:has(> .prompt-warning) { display: flex; align-items: center; gap: 8px; }
.prompt-warning { flex: none; width: 20px; height: 20px; color: var(--cx-gold); }
.prompt-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>

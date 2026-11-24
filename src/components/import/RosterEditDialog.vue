<template>
    <UiDialog :model-value="!!step" :title="step === 'name' ? '新建角色预设' : title"
        width="400px" prevent-outside @update:model-value="!$event && (step = '')">
        <p v-if="step === 'confirm'">当前更改的是「{{ character }}」的游戏内角色数据。{{ question }}</p>
        <form v-else-if="step === 'name'" class="preset-form" @submit.prevent="save(true)">
            <label>预设名称<input ref="input" v-model.trim="name" /></label>
            <small v-if="name && nameError">{{ nameError }}</small>
        </form>
        <p v-if="error" role="alert">{{ error }}</p>
        <template #footer>
            <template v-if="step === 'confirm'">
                <UiButton @click="save(false)">否，修改游戏内数据</UiButton>
                <UiButton variant="primary" @click="startNaming">是，新建预设</UiButton>
            </template>
            <template v-else>
                <UiButton @click="step = ''">取消</UiButton>
                <UiButton v-if="step === 'name'" variant="primary" :disabled="!!nameError" @click="save(true)">保存</UiButton>
            </template>
        </template>
    </UiDialog>
</template>
<script setup>
import { computed, nextTick, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import { usePresetStore } from '@/store/pinia/preset'
import { customPresetNameError } from '@/utils/preset-workflow.mjs'

defineProps({ character: String })
const presets = usePresetStore()
const step = ref(''), name = ref(''), error = ref(''), input = ref(null)
const title = ref(''), question = ref('')
const nameError = computed(() => customPresetNameError(presets.presets.value, name.value))
let commit
function request(heading, prompt, confirm, action) {
    title.value = heading
    question.value = prompt
    error.value = ''
    commit = action
    if (confirm) step.value = 'confirm'
    else save(false)
}
async function startNaming() {
    step.value = 'name'
    name.value = ''
    await nextTick()
    input.value?.focus()
}
function save(copy) {
    if (copy && nameError.value) return
    try {
        commit(copy ? name.value : null)
        step.value = ''
    } catch (cause) {
        error.value = cause.message
        if (!step.value) step.value = 'error'
    }
}
defineExpose({ request })
</script>
<style scoped>
.preset-form label { display: grid; gap: 6px; }
.preset-form input { font: inherit; padding: 7px; color: var(--cx-letter); background: var(--cx-step); border: 1px solid var(--cx-step-2); border-radius: 8px; }
.ui-dialog footer button + button { margin-inline-start: 8px; }
</style>

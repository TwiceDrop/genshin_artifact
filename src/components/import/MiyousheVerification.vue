<template>
    <UiDialog :model-value="true" title="米游社验证" width="520px" prevent-outside @update:model-value="emit('cancel')">
        <p v-if="error" role="alert">{{ error }}</p>
        <div v-if="submitting" role="status" class="mys-verification-status">正在提交验证…</div>
        <iframe class="mys-verification-frame" v-show="!submitting" ref="frame" src="/mys-verification.html" title="米游社人工验证码" sandbox="allow-scripts" referrerpolicy="no-referrer" @load="configure" />
        <template #footer><UiButton @click="emit('cancel')">取消验证</UiButton></template>
    </UiDialog>
</template>
<script setup>
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
const props = defineProps({ verification: { type: Object, required: true }, submitting: Boolean })
const emit = defineEmits(['complete', 'cancel'])
const frame = ref(null), error = ref('')
function configure() {
    // The opaque sandbox cannot access the app origin, vault, storage or API session.
    frame.value?.contentWindow.postMessage({ type: 'mona-mys-verification-config', ...props.verification }, '*')
}
function receive(event) {
    if (event.source !== frame.value?.contentWindow || event.origin !== 'null' || event.data?.flowId !== props.verification.flowId) return
    if (event.data.type === 'mona-mys-verification-complete') emit('complete', event.data.result)
    else if (event.data.type === 'mona-mys-verification-error') error.value = '验证码加载失败，请关闭后重试'
}
onMounted(() => window.addEventListener('message', receive))
onBeforeUnmount(() => window.removeEventListener('message', receive))
</script>
<style>
.mys-verification-status{padding:48px 12px;text-align:center}
.mys-verification-frame{display:block;border:0;width:100%;height:480px;max-height:65vh;background:white}
</style>

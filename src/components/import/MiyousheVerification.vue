<template>
    <el-dialog :model-value="true" title="米游社验证" width="520px" custom-class="mys-verification-dialog" append-to-body :close-on-click-modal="false" @close="emit('cancel')">
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <div v-if="submitting" role="status" class="mys-verification-status">正在提交验证…</div>
        <iframe v-show="!submitting" ref="frame" src="/mys-verification.html" title="米游社人工验证码" sandbox="allow-scripts" referrerpolicy="no-referrer" @load="configure" />
        <template #footer><el-button @click="emit('cancel')">取消验证</el-button></template>
    </el-dialog>
</template>
<script setup>
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
.mys-verification-dialog{max-width:calc(100vw - 24px);margin-top:5vh!important}
.mys-verification-dialog .el-dialog__body{padding:12px;overflow:auto;max-height:72vh}
.mys-verification-status{padding:48px 12px;text-align:center}
.mys-verification-dialog iframe{display:block;border:0;width:100%;height:480px;max-height:65vh;background:white}
</style>

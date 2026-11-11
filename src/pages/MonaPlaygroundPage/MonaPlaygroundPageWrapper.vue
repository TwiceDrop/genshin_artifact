<template>
    <mona-playground-page></mona-playground-page>
</template>

<script setup lang="ts">
import SimpleLoading from "@/components/loading/SimpleLoading.vue"
import SimpleError from "@/components/loading/SimpleError.vue"


function loadMonaco() {
    return import('monaco-editor')
}


const MonaPlaygroundPage = defineAsyncComponent({
    loader: () => loadMonaco().then(() => import(
        /* webpackChunkName: "playground-page" */
        /* webpackPrefetch: true */
        "./MonaPlaygroundPage.vue"
    )),
    loadingComponent: SimpleLoading,
    errorComponent: SimpleError,
    timeout: 60000,
})
</script>

<style scoped>

</style>

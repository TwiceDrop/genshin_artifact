<template>
    <div>
        <suspense>
            <new-artifact-plan-page :key="account.currentAccountId.value + ':' + revision" @restart="revision++" />

            <template #fallback>
                <simple-loading></simple-loading>
            </template>
        </suspense>
    </div>
</template>

<script setup lang="ts">
import SimpleLoading from "@/components/loading/SimpleLoading.vue"
import SimpleError from "@/components/loading/SimpleError.vue"
import { useAccountStore } from '@/store/pinia/account'
const account = useAccountStore()
const revision = ref(0)


const NewArtifactPlanPage = defineAsyncComponent({
    loader: () => import(
        /* webpackChunkName: "artifact-plan-page" */
        /* webpackPrefetch: true */
        "./NewArtifactPlanPage.vue"
    ),
    loadingComponent: SimpleLoading,
    errorComponent: SimpleError,
    delay: 0,
    timeout: 60000
})
</script>

<style scoped>

</style>

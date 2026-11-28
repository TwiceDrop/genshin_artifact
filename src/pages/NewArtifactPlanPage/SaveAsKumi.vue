<template>
    <UiDialog
        :model-value="props.modelValue"
        @update:modelValue="emits('update:modelValue', $event)"
        :title="t('calcPage.saveKumi')"
        width="min(620px, 94vw)"
    >
        <p id="save-kumi-dirs" class="title">{{ t("calcPage.selectDir") }}</p>
        <div class="dirs" role="group" aria-labelledby="save-kumi-dirs">
            <UiCheckbox
                v-for="dir in kumiStore.dirs.value"
                :key="dir.id"
                :label="dir.title"
                :model-value="checkList.includes(dir.id)"
                :disabled="checkList.length === 1 && checkList.includes(dir.id)"
                class="dir-item"
                @update:model-value="checked => selectDirectory(dir.id, checked)"
            >{{ dir.title }}</UiCheckbox>
        </div>

        <label class="title" for="save-kumi-name">{{ t("calcPage.name") }}</label>
        <UiInput
            id="save-kumi-name"
            v-model="name"
            :placeholder="t('calcPage.enterName')"
        />

        <template #footer>
            <div class="actions">
                <UiButton @click="emits('update:modelValue', false)">{{ t("misc.cancel") }}</UiButton>
                <UiButton variant="primary" :disabled="name === ''" @click="handleConfirm">{{ t("misc.confirm") }}</UiButton>
            </div>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import {useKumiStore} from "@/store/pinia/kumi"
import {useI18n} from "@/i18n/i18n"
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiInput from '@/components/ui/UiInput.vue'

const { t } = useI18n()

const kumiStore = useKumiStore()

interface Props {
    defaultName: string,
    modelValue: boolean,
}

const props = withDefaults(defineProps<Props>(), {
    defaultName: ""
})

interface Emits {
    (e: "confirm", v: { dirIds: number[], name: string }): void,
    (e: "update:modelValue", v: boolean): void
}

const emits = defineEmits<Emits>()

const checkList = ref<number[]>([0])
const name = ref<string>(props.defaultName)

function selectDirectory(id: number, checked: boolean) {
    checkList.value = checked ? [...checkList.value, id] : checkList.value.filter(selected => selected !== id)
}

function handleConfirm() {
    const dirIds = checkList.value

    emits("confirm", {
        dirIds, name: name.value
    })
}

watch(() => props.defaultName, newName => {
    name.value = newName
})
</script>

<style scoped>
.title { display: block; margin: 0 0 8px; color: var(--cx-dim); font-size: 14px; }
.dirs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.dir-item { min-height: 34px; padding: 4px 10px; border: 1px solid var(--cx-step-2); border-radius: 8px; }
.dir-item:has([data-state="checked"]) { border-color: var(--cx-gold); background: var(--cx-step); }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
</style>

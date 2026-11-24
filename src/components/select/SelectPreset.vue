<template>
    <el-select
        :model-value="modelValue"
        @update:modelValue="$emit('update:modelValue', $event)"
    >
        <el-option
            v-for="entry in presetStore.allFlat.value"
            :key="entry.name"
            :label="characterPresetLabel(entry.name)"
            :value="entry.name"
        ></el-option>
    </el-select>
</template>

<script setup>
import {usePresetStore} from "@/store/pinia/preset"
import {useCharacterPresetLabel} from '@/composables/character-preset-label'

const presetStore = usePresetStore()
const characterPresetLabel = useCharacterPresetLabel()

const props = defineProps({
    modelValue: String
})

</script>

<style scoped>

</style>

<template>
<!-- use :key to force rerender, or there will be a bug   -->
    <div v-if="props.shadcn" :key="props.characterName" class="skill-select">
        <span class="skill-prefix" aria-hidden="true">{{ t('misc.skill') }}</span>
        <UiSelect :label="t('misc.skill')" :model-value="String(props.modelValue)" :options="skillOptions"
            @update:model-value="emits('update:modelValue', Number($event))" />
    </div>
    <el-select v-else
        :model-value="props.modelValue"
        @update:modelValue="emits('update:modelValue', $event)"
        :key="props.characterName"
    >
        <template #prefix>
            <span>{{ t("misc.skill") }}</span>
        </template>

        <el-option-group
            v-for="group in skillGroups"
            :key="group.title"
            :label="group.title"
        >
            <el-option
                v-for="item in group.items"
                :key="item.index.toString()"
                :label="item.label"
                :value="item.index"
            >
            </el-option>
        </el-option-group>
    </el-select>
</template>

<script setup lang="ts">
import UiSelect from '@/components/ui/UiSelect.vue'
import { characterData } from "@character"
import type {CharacterName} from "@/types/character"
import {characterSkillGroups} from "@/utils/character-skill-groups"
import {useI18n} from "@/i18n/i18n"


const { t, ta } = useI18n()

interface Props {
    characterName: CharacterName,
    modelValue: number
    shadcn?: boolean
}

const props = defineProps<Props>()

interface Emits {
    (e: "update:modelValue", v: number): void
}

const emits = defineEmits<Emits>()

const skillGroups = computed(() => characterSkillGroups(characterData[props.characterName], ta))
const skillOptions = computed(() => skillGroups.value.flatMap(group => group.items.map(item => ({
    label: item.label, value: String(item.index), group: group.title
}))))
</script>
<style scoped>
.skill-select { position: relative; min-width: 0; --skill-prefix-width: 44px; }
.skill-prefix { position: absolute; inset-inline-start: 10px; top: 50%; transform: translateY(-50%); color: var(--cx-dim); font-size: 13px; pointer-events: none; }
.skill-select :deep(button) { width: 100%; padding-inline-start: var(--skill-prefix-width); }
</style>

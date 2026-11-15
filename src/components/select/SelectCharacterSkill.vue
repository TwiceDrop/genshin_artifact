<template>
<!-- use :key to force rerender, or there will be a bug   -->
    <el-select
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
import { characterData } from "@character"
import type {CharacterName} from "@/types/character"
import {characterSkillGroups} from "@/utils/character-skill-groups"
import {useI18n} from "@/i18n/i18n"


const { t, ta } = useI18n()

interface Props {
    characterName: CharacterName,
    modelValue: number
}

const props = defineProps<Props>()

interface Emits {
    (e: "update:modelValue", v: number): void
}

const emits = defineEmits<Emits>()

const skillGroups = computed(() => characterSkillGroups(characterData[props.characterName], ta))
</script>
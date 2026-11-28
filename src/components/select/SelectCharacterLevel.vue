<template>
    <GroupedLevelSelect :model-value="modelValue" :level-groups="levelGroups" label="角色等级" :use-ui-select="useUiSelect"
        @update:model-value="$emit('update:modelValue', $event)" />
</template>

<script>
import { highCharacterLevels } from '@/utils/character-level.mjs'
import GroupedLevelSelect from './GroupedLevelSelect.vue'

const levelGroups = [
    ['>=60', ['60-', '60+', '65']],
    ['>=70', ['70-', '70+', '75']],
    ['>=80', ['80-', '80+', '85']],
    ['>=90', highCharacterLevels.map(String)],
]

export default {
    name: "SelectCharacterLevel",
    components: { GroupedLevelSelect },
    props: { modelValue: null, useUiSelect: Boolean },
    emits: ["update:modelValue"],
    setup: () => ({ levelGroups }),
}
</script>

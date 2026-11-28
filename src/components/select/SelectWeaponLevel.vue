<template>
    <GroupedLevelSelect :model-value="useUiSelect && modelValue === '90' ? '90-' : modelValue"
        :level-groups="levelGroups" label="武器等级" :use-ui-select="useUiSelect"
        @update:model-value="$emit('update:modelValue', $event)" />
</template>

<script>
import GroupedLevelSelect from './GroupedLevelSelect.vue'

const levelGroups = [
    ['>=80', [{ value: '90-', label: '90' }, '85', '80+', '80-']],
    ['>=70', ['75', '70+', '70-']],
    ['>=60', ['65', '60+', '60-']],
    ['>=50', ['55', '50+', '50-']],
    ['>=40', ['45', '40+', '40-']],
    ['>=30', ['35', '30']],
    ['>=20', ['25', '20+', '20-']],
    ['>=10', ['15', '10']],
    ['>=1', ['5', '1']],
]

export default {
    name: "SelectWeaponLevel",
    components: { GroupedLevelSelect },
    props: { modelValue: null, useUiSelect: Boolean },
    emits: ["update:modelValue"],
    setup() { return { levelGroups } },
}
</script>

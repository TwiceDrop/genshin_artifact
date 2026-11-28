<template>
    <UiSegmentedControl v-if="shadcn" :model-value="modelValue" :options="options" :label="label"
        @update:model-value="$emit('update:modelValue', $event)" />
    <el-radio-group
        v-else
        :model-value="modelValue"
        @update:modelValue="$emit('update:modelValue', $event)"
    >
        <el-radio-button label="NormalAttack">{{ t("skillType.a") }}</el-radio-button>
        <el-radio-button label="ChargedAttack">{{ t("skillType.b") }}</el-radio-button>
        <el-radio-button label="ElementalSkill">{{ t("skillType.e") }}</el-radio-button>
        <el-radio-button label="ElementalBurst">{{ t("skillType.q") }}</el-radio-button>
    </el-radio-group>
</template>

<script>
import {useI18n} from "../../i18n/i18n"
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'

export default {
    name: "SelectSkillType",
    components: { UiSegmentedControl },
    props: {
        modelValue: {
            type: String,
            required: true,
        },
        shadcn: Boolean,
        label: String,
    },
    emits: ["update:modelValue"],
    computed: {
        options() {
            return [
                { value: 'NormalAttack', label: this.t('skillType.a') },
                { value: 'ChargedAttack', label: this.t('skillType.b') },
                { value: 'ElementalSkill', label: this.t('skillType.e') },
                { value: 'ElementalBurst', label: this.t('skillType.q') },
            ]
        },
    },
    setup() {
        const { t } = useI18n()

        return {
            t
        }
    }
}
</script>

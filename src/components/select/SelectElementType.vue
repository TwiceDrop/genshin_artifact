<template>
    <RadioGroupRoot v-if="shadcn" class="element-options" :model-value="modelValue" :aria-label="label"
        orientation="horizontal" @update:model-value="$emit('update:modelValue', $event)">
        <RadioGroupItem v-for="element in orderedElements" :key="element" :value="element" class="element-option">
            <img v-if="elementIcons[element]" :src="elementIcons[element]" alt="" />
            {{ t('ele.' + element) }}
        </RadioGroupItem>
    </RadioGroupRoot>
    <el-radio-group
        v-else
        :model-value="modelValue"
        @update:modelValue="$emit('update:modelValue', $event)"
    >
        <el-radio-button v-if="eleMap.has('None')" label="None">{{ t("ele.None") }}</el-radio-button>
        <el-radio-button v-if="eleMap.has('Pyro')" label="Pyro">{{ t("ele.Pyro") }}</el-radio-button>
        <el-radio-button v-if="eleMap.has('Electro')" label="Electro">{{ t("ele.Electro") }}</el-radio-button>
        <el-radio-button v-if="eleMap.has('Hydro')" label="Hydro">{{ t("ele.Hydro") }}</el-radio-button>
        <el-radio-button v-if="eleMap.has('Anemo')" label="Anemo">{{ t("ele.Anemo") }}</el-radio-button>
        <el-radio-button v-if="eleMap.has('Geo')" label="Geo">{{ t("ele.Geo") }}</el-radio-button>
        <el-radio-button v-if="eleMap.has('Cryo')" label="Cryo">{{ t("ele.Cryo") }}</el-radio-button>
        <el-radio-button v-if="eleMap.has('Dendro')" label="Dendro">{{ t("ele.Dendro") }}</el-radio-button>
        <el-radio-button v-if="eleMap.has('Physical')" label="Physical">{{ t("ele.Physical") }}</el-radio-button>
    </el-radio-group>
</template>

<script>
import {useI18n} from "../../i18n/i18n"
import { RadioGroupItem, RadioGroupRoot } from 'radix-vue'
import elementIcons from '@/assets/element-icons'

const order = ['None', 'Pyro', 'Electro', 'Hydro', 'Anemo', 'Geo', 'Cryo', 'Dendro', 'Physical']

export default {
    name: "SelectElementType",
    components: { RadioGroupRoot, RadioGroupItem },
    emits: ["update:modelValue"],
    props: {
        modelValue: {
            type: String,
            required: true,
        },
        elements: {
            default: () => {
                return ["Pyro", "Electro", "Hydro", "Anemo", "Geo", "Cryo", "Dendro", "Physical"];
            }
        },
        clearable: {
            default: false,
        },
        shadcn: Boolean,
        label: String,
    },
    computed: {
        eleMap() {
            let temp = new Set();
            for (let ele of this.elements) {
                temp.add(ele);
            }
            return temp;
        },
        orderedElements() {
            return order.filter(element => this.eleMap.has(element))
        },
    },
    setup() {
        const { t } = useI18n()

        return {
            t, elementIcons
        }
    }
}
</script>

<style scoped>
.element-options { display: flex; flex-wrap: wrap; gap: 4px; }
.element-option { display: inline-flex; align-items: center; gap: 5px; min-height: 30px; padding: 4px 8px; border: 1px solid var(--cx-step-2); border-radius: 8px; background: var(--cx-card); color: var(--cx-letter); font: inherit; font-size: 13px; cursor: pointer; }
.element-option:hover { background: var(--cx-step); }
.element-option[data-state='checked'] { border-color: var(--cx-gold); color: var(--cx-gold); background: var(--cx-step); font-weight: 600; }
.element-option:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.element-option img { width: 16px; height: 16px; object-fit: contain; }
</style>

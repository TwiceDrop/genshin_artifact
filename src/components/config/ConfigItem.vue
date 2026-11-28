<template>
    <div :class="{ 'migrated-config': shadcn }">
        <h3 class="config-title">{{ title }}<UiHoverDetails v-if="shadcn && help" enabled :tap-label="title + ' ?'" side="top">
            <template #trigger><button type="button" class="config-help" :aria-label="title + ' ?'">?</button></template>
            <span class="config-help-text">{{ help }}</span>
        </UiHoverDetails><el-tooltip v-else-if="help" :trigger="['hover', 'focus']" placement="top" :show-after="150">
            <button type="button" class="config-help" :aria-label="title + ' ?'">?</button>
            <template #content><span class="config-help-text">{{ help }}</span></template>
        </el-tooltip></h3>
        <template v-if="shadcn">
            <div v-if="type === 'float' || type === 'int'" class="config-number">
                <UiSlider :model-value="modelValue" :label="title" :min="params.min" :max="params.max"
                    :step="type === 'float' ? 0.1 : 1" @update:model-value="handleChangeValue" />
                <UiNumberInput v-if="type === 'float'" :model-value="modelValue" :aria-label="title"
                    :min="params.min" :max="params.max" :step="0.1" @update:model-value="handleChangeValue" />
            </div>
            <UiNumberInput v-else-if="type === 'intInput'" :model-value="modelValue" :aria-label="title" :min="params.min" :max="params.max"
                :step="1" @update:model-value="handleChangeValue" />
            <div v-else-if="type === 'floatPercentageInput' || type === 'floatInput'" class="config-number">
                <UiInput :model-value="modelValue" :aria-label="title" inputmode="decimal" @change="commitInputValue" />
                <span v-if="type === 'floatPercentageInput'" aria-hidden="true">%</span>
            </div>
            <label v-else-if="type === 'bool'" class="config-switch">
                <UiSwitch :model-value="modelValue" :aria-label="title" @update:model-value="handleChangeValue" />
                <span>是</span>
            </label>
            <SelectElementType v-else-if="type === 'element4' || type === 'element8'" shadcn
                :model-value="modelValue" :label="title" :elements="type === 'element4' ? elements.slice(0, 4) : elements"
                @update:model-value="handleChangeValue" />
            <SelectElementMulti v-else-if="type === 'element8multi'" shadcn :model-value="modelValue" :label="title"
                @update:model-value="handleChangeValue" />
            <SelectSkillType v-else-if="type === 'skill4'" shadcn :model-value="modelValue" :label="title"
                @update:model-value="handleChangeValue" />
            <UiSegmentedControl v-else-if="type === 'option'" :model-value="String(modelValue)" :label="title"
                :options="params.options.map((label, index) => ({ label, value: String(index) }))"
                @update:model-value="handleChangeValue(Number($event))" />
        </template>
        <template v-else>
        <template v-if="type === 'float'">
            <el-slider
                :modelValue="modelValue"
                @update:modelValue="handleChangeValue"
                :min="params.min"
                :max="params.max"
                :step="0.1"
                :show-input="true"
                :show-input-controls="false"
            ></el-slider>
        </template>
        <template v-if="type === 'int'">
            <el-slider
                :modelValue="modelValue"
                @update:modelValue="handleChangeValue"
                :min="params.min"
                :max="params.max"
                :step="1"
            ></el-slider>
        </template>
        <template v-if="type === 'intInput'">
            <el-input-number
                :modelValue="modelValue"
                @update:modelValue="handleChangeValue"
                :min="params.min"
                :max="params.max"
            ></el-input-number>
        </template>
        <template v-if="type === 'bool'">
            <el-switch
                :modelValue="modelValue"
                @update:modelValue="handleChangeValue"
                active-text="是"
            ></el-switch>
        </template>
        <template v-if="type === 'floatPercentageInput'">
            <el-input
                :modelValue="modelValue"
                @update:modelValue="handleInputValue"
            >
                <template slot="append">%</template>
            </el-input>
        </template>
        <template v-if="type === 'floatInput'">
            <el-input
                :modelValue="modelValue"
                @update:modelValue="handleInputValue"
            >
            </el-input>
        </template>
        <template v-if="type === 'element4'">
            <select-element-type
                :modelValue="modelValue"
                @update:modelValue="handleChangeValue"
                :elements="['Pyro', 'Cryo', 'Electro', 'Hydro']"
            ></select-element-type>
        </template>
        <template v-if="type === 'element8'">
            <select-element-type
                :modelValue="modelValue"
                @update:modelValue="handleChangeValue"
                :elements="['Pyro', 'Cryo', 'Electro', 'Hydro', 'Anemo', 'Geo', 'Dendro', 'Physical']"
            ></select-element-type>
        </template>
        <template v-if="type === 'element8multi'">
            <select-element-multi
                :modelValue="modelValue"
                @update:modelValue="handleChangeValue"
            ></select-element-multi>
        </template>
        <template v-if="type === 'skill4'">
            <select-skill-type
                :modelValue="modelValue"
                @update:modelValue="handleChangeValue"
            ></select-skill-type>
        </template>
        <template v-if="type === 'option'">
            <el-radio-group
                :modelValue="modelValue"
                @update:modelValue="handleChangeValue"
            >
                <el-radio-button
                    v-for="(option, index) in params.options"
                    :key="index"
                    :label="index"
                >{{ option }}</el-radio-button>
            </el-radio-group>
        </template>
        </template>
    </div>
</template>

<script>
import SelectElementType from "@c/select/SelectElementType"
import SelectElementMulti from "@c/select/SelectElementMulti"
import SelectSkillType from "@c/select/SelectSkillType"
import UiHoverDetails from "@c/ui/UiHoverDetails.vue"
import UiInput from "@c/ui/UiInput.vue"
import UiNumberInput from "@c/ui/UiNumberInput.vue"
import UiSegmentedControl from "@c/ui/UiSegmentedControl.vue"
import UiSlider from "@c/ui/UiSlider.vue"
import UiSwitch from "@c/ui/UiSwitch.vue"

const elements = ['Pyro', 'Cryo', 'Electro', 'Hydro', 'Anemo', 'Geo', 'Dendro', 'Physical']

export default {
    name: "ConfigItem",
    components: { SelectSkillType, SelectElementType, SelectElementMulti, UiHoverDetails, UiInput, UiNumberInput, UiSegmentedControl, UiSlider, UiSwitch },
    props: {
        modelValue: {},
        type: {},
        params: {},
        title: {},
        help: String,
        shadcn: Boolean,
    },
    emits: ["update:modelValue"],
    data() {
        return { elements }
    },
    methods: {
        commitInputValue(event) {
            const input = event.target
            const value = input.value === '' ? 0 : Number.parseFloat(input.value)
            if (!Number.isFinite(value)) {
                input.value = String(this.modelValue)
                return
            }
            input.value = String(value)
            this.handleChangeValue(value)
        },
        handleInputValue(value) {
            let v = 0
            if (value === "") {
                v = 0
            } else {
                v = parseFloat(value)
                if (isNaN(v)) {
                    v = 0
                }
            }
            
            this.handleChangeValue(v)
        },

        handleChangeValue(value) {
            // console.log("change value", value)
            // it may be an element plus bug, when value is not changed, slider will also emit update:modelValue
            if (value !== this.modelValue) {
                // console.log("model value", this.modelValue)
                this.$emit("update:modelValue", value)
            }
            // this.$emit("update:modelValue", value)
        },
    }
}
</script>

<style lang="scss" scoped>
.config-title {
    font-size: 12px;
    color: #666666;
    margin: 0 0 12px 0;
}

.config-help {
    display: inline-grid;
    place-items: center;
    width: 15px;
    height: 15px;
    margin-inline-start: 5px;
    padding: 0;
    vertical-align: middle;
    border: 1px solid currentColor;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: 1;
    cursor: help;
}

.config-help-text {
    display: block;
    max-width: min(32em, calc(100vw - 48px));
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-line;
    overflow-wrap: anywhere;
}

.migrated-config .config-title { color: var(--cx-letter); margin-bottom: 6px; font-size: 13px; }
.migrated-config .config-help:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.config-number, .config-switch { display: flex; align-items: center; gap: 8px; min-width: 0; }
.config-switch { color: var(--cx-letter); font-size: 13px; }

// .config-item {
//     margin-bottom: 8px;

//     &:last-of-type {
//         margin-bottom: 0;
//     }
// }
</style>

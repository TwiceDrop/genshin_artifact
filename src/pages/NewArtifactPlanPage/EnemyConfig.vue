<template>
    <div v-if="shadcn" class="enemy-fields" :class="{ 'enemy-row-layout': rowLayout }">
        <div class="enemy-level">
            <span>{{ t('misc.lvl') }}</span>
            <TeamNumberInput v-if="rowLayout" :model-value="modelValue.level" :min="60" :max="120"
                :aria-label="t('misc.lvl')" @update:model-value="handleInput('level', $event)" />
            <UiNumberInput v-else :model-value="modelValue.level" :min="60" :max="120" :step="1"
                :aria-label="t('misc.lvl')" @update:model-value="handleInput('level', $event)" />
        </div>
        <div class="enemy-resistances">
            <div v-for="ele in elements8" :key="ele" class="enemy-resistance">
                <div class="enemy-label">
                    <img v-if="!rowLayout && elementIcons[ele]" :src="elementIcons[ele]" alt="" />
                    <span>{{ t('res', ele) }}</span>
                </div>
                <div class="enemy-value">
                    <TeamSlider v-if="rowLayout" class="enemy-slider" :model-value="modelValue[resNameMap[ele]]"
                        :label="t('res', ele)" :min="-1" :max="1" :step="0.1"
                        @update:model-value="handleInput(ele, $event)" />
                    <UiSlider v-else :model-value="modelValue[resNameMap[ele]]" :label="t('res', ele)" :min="-1" :max="1" :step="0.1"
                        @update:model-value="handleInput(ele, $event)" />
                    <TeamNumberInput v-if="rowLayout" :model-value="modelValue[resNameMap[ele]]" :min="-1" :max="1" :step="0.1" :precision="1"
                        :aria-label="t('res', ele)" @update:model-value="handleInput(ele, $event)" />
                    <UiNumberInput v-else :model-value="modelValue[resNameMap[ele]]" :min="-1" :max="1" :step="0.1"
                        :aria-label="t('res', ele)" @update:model-value="handleInput(ele, $event)" />
                </div>
            </div>
        </div>
    </div>
    <template v-else>
    <div class="item">
        <span class="title">{{ t("misc.lvl") }}</span>
        <el-input-number
            :model-value="modelValue.level"
            @update:modelValue="handleInput('level', $event)"
            :min="60"
            :max="120"
        ></el-input-number>
    </div>

    <div
        v-for="ele in elements8"
        :key="ele"
        class="item"
    >
        <span class="title">{{ t("res", ele) }}</span>
        <el-slider
            :model-value="modelValue[resNameMap[ele]]"
            @update:modelValue="handleInput(ele, $event)"
            class="input"
            :min="-1"
            :max="1"
            :step="0.1"
            :show-input="true"
        ></el-slider>
    </div>
    </template>
</template>

<script>
import {useI18n} from "@/i18n/i18n";
import { elements8 } from "@/constants/misc"
import elementIcons from '@/assets/element-icons'
import UiNumberInput from '@/components/ui/UiNumberInput.vue'
import UiSlider from '@/components/ui/UiSlider.vue'
import TeamNumberInput from '@/pages/TeamOptimizationPage/TeamNumberInput.vue'
import TeamSlider from '@/pages/TeamOptimizationPage/TeamSlider.vue'

const resNameMap = {
    Electro: "electro_res",
    Pyro: "pyro_res",
    Hydro: "hydro_res",
    Cryo: "cryo_res",
    Geo: "geo_res",
    Anemo: "anemo_res",
    Dendro: "dendro_res",
    Physical: "physical_res",
}
Object.freeze(resNameMap)

export default {
    name: "EnemyConfig",
    components: { UiNumberInput, UiSlider, TeamNumberInput, TeamSlider },
    props: { modelValue: Object, shadcn: Boolean, rowLayout: Boolean },
    emits: ["update:modelValue"],
    // created() {
    //     this.resNames = resNames
    // },
    data() {
        return {
            elements8,
            elementIcons,
            resNameMap,
        }
    },
    methods: {
        handleInput(name, value) {
            if (name === "level") {
                let temp = Object.assign({}, this.modelValue)
                temp["level"] = value
                this.$emit("update:modelValue", temp)
            } else {
                const resName = this.resNameMap[name]

                if (this.modelValue[resName] !== value) {
                    let temp = Object.assign({}, this.modelValue)
                    temp[this.resNameMap[name]] = value

                    this.$emit("update:modelValue", temp)
                }
            }
        }
    },
    setup() {
        const { t } = useI18n()

        return {
            t
        }
    }
}
</script>

<style scoped lang="scss">
$field-border: var(--cx-step-2);
.enemy-fields { display: grid; gap: 12px; }
.enemy-level, .enemy-value, .enemy-label { display: flex; align-items: center; gap: 8px; }
.enemy-level, .enemy-resistance { min-width: 0; padding: 10px 12px; border: 1px solid $field-border; border-radius: 8px; background: var(--cx-step); }
.enemy-level { justify-content: space-between; }
.enemy-resistances { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 8px; }
.enemy-resistance { display: grid; gap: 4px; }
.enemy-label img { width: 18px; height: 18px; object-fit: contain; }
.enemy-label, .enemy-level { color: var(--cx-letter); font-size: 13px; font-weight: 600; }
.enemy-row-layout .enemy-resistances { display: contents; }
.enemy-row-layout .enemy-level, .enemy-row-layout .enemy-resistance { border: 0; padding: 0; background: transparent; }
.enemy-row-layout .enemy-level { justify-content: flex-start; gap: 0; }
.enemy-row-layout .enemy-label, .enemy-row-layout .enemy-level { font: inherit; }
.enemy-row-layout .enemy-value { gap: 30px; }
.enemy-row-layout .enemy-value .enemy-slider { flex: 1; min-width: 48px; }
.enemy-row-layout .enemy-value .team-number { flex: 0 0 130px; }
@media (min-width: 992px) {
    .enemy-row-layout .enemy-resistance { display: grid; grid-template-columns: 150px minmax(0,1fr); align-items: center; gap: 0; }
    .enemy-row-layout .enemy-level > span { width: 150px; }
}
@media (max-width: 991px) {
    .enemy-row-layout .enemy-level { display: grid; gap: 4px; }
}

$width: 150px;

@media only screen and (min-width: 992px) {
    .item {
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        //width: 100%;

        .title {
            display: inline-block;
            //width: 20%;
            width: $width;
        }

        .input {
            //width: 80%;
            //display: inline;
            //flex-grow: 1;
            width: calc(100% - 150px);
        }

        &:last-of-type {
            margin: 0;
        }
    }
}

@media only screen and (max-width: 992px) {
    .item {
        margin-bottom: 12px;

        .title {
            display: inline-block;
            width: 100%;
            margin-bottom: 4px;
        }

        .input {
            width: 100%;
        }

        &:last-of-type {
            margin: 0;
        }
    }
}

</style>

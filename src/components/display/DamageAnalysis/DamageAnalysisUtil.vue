<template>
    <div :class="{ 'themed-composition': shadcnDamageAnalysis }" style="min-width: 100px">
        <div class="header" :title="result">{{ title }}</div>
        <div>
            <div
                v-for="item in arr"
                :key="item.name"
                class="item"
            >
                <div class="item-top">
                    <UiCheckbox v-if="shadcnDamageAnalysis" v-model="item.checked">{{ sourceName(item.name) }}</UiCheckbox>
                    <el-checkbox v-else v-model="item.checked">{{ sourceName(item.name) }}</el-checkbox>
<!--                    <span class="name">{{ sourceName(item.name) }}</span>-->
                </div>
                <div class="item-bottom">
                    <UiNumberInput v-if="shadcnDamageAnalysis" :model-value="Number(formatValue(item.value))" step="any"
                        :aria-label="sourceName(item.name)" @update:model-value="item.value = $event" />
                    <input v-else type="text" :value="formatValue(item.value)" @change="updateValue(item,$event)" class="input" />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { computed, inject } from 'vue'
import artifacts from '@/assets/_gen_artifact'
import {useI18n} from '@/i18n/i18n'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiNumberInput from '@/components/ui/UiNumberInput.vue'
const artifactSources = Object.fromEntries(Object.values(artifacts).flatMap(set =>
    [2, 4].map(count => [set.name2 + count, {index: set.nameLocale, count}])
))

export default {
    name: "DamageAnalysisUtil",
    components: { UiCheckbox, UiNumberInput },
    props: {
        arr: {},
        precision: {type: Number, default: 2},
        title: {
            default: "title"
        },
    },
    setup() {
        const {ta} = useI18n()
        const shadcnDamageAnalysis = computed(inject('isShadcnDamageAnalysis', () => false))
        return {shadcnDamageAnalysis, sourceName(name) {
            const source = artifactSources[name]
            return source ? `${ta(source.index)}${source.count}件套` : name
        }}
    },
    methods: {
        formatValue(value) { return String(Number(Number.parseFloat(value).toFixed(this.precision ?? 2))) },
        updateValue(item,event) {
            item.value = Number.parseFloat(event.target.value)
            event.target.value = this.formatValue(item.value)
        }
    },
    computed: {
        result() {
            let s = 0
            for (let item of this.arr) {
                if (item.checked) {
                    s += parseFloat(item.value)
                }
            }
            const scale = 10 ** (this.precision ?? 2)
            return Math.round(s * scale) / scale
        }
    }
}
</script>

<style lang="scss" scoped>
.themed-composition {
    flex: 0 0 142px;
    width: 142px;
    .header { height: auto; min-height: 32px; padding-inline: 4px; text-align: center; }
    .item { padding: 6px; }
    .item-top { align-items: flex-start; overflow-wrap: anywhere; }
    .item-bottom > input { width: 100%; }
}
.header {
    display: flex;
    height: 32px;
    justify-content: center;
    align-items: center;
    background: var(--cx-step);
}

.item {
    padding: 4px;
    //border-bottom: 1px solid #00000011;

    .item-top {
        display: flex;
        align-items: center;
        margin-bottom: 4px;
    }

    .name {
        margin: 0 4px;
    }

    .input {
        border: none;
        outline: none;
        width: 100%;
        box-sizing: border-box;
        padding: 4px;
        transition: 200ms;
        border-bottom: 1px solid transparent;
        //transform-origin: left;

        &:focus {
            //background-color: #00000005;
            border-bottom: 1px solid var(--cx-gold);
        }
    }
}
</style>

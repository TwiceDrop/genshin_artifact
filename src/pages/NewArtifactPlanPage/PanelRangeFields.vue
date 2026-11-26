<template>
    <div class="panel-bounds">
        <span>{{ t('calcPage.panelRangeStat') }}</span>
        <span>{{ t('calcPage.panelRangeMin') }}</span>
        <span>{{ t('calcPage.panelRangeMax') }}</span>
        <template v-for="stat in PANEL_STATS" :key="stat.key">
            <span>{{ t('stat.' + stat.locale) }}{{ stat.percent ? ' (%)' : '' }}</span>
            <input v-for="side in sides" :key="side.key" type="number" step="any"
                :value="boundValue(stat, side.key)"
                :aria-label="t('stat.' + stat.locale) + ' ' + t(side.locale)"
                @change="setBound(stat, side.key, $event.target)" />
        </template>
    </div>
</template>

<script setup>
import {useI18n} from '@/i18n/i18n'
import {PANEL_STATS} from '../../../beta-data/panel-search.mjs'

const props = defineProps({modelValue: {type: Object, required: true}})
const emit = defineEmits(['update:modelValue'])
const {t} = useI18n()
const sides = [{key: 'min', locale: 'calcPage.panelRangeMin'}, {key: 'max', locale: 'calcPage.panelRangeMax'}]

function boundValue(stat, side) {
    const value = props.modelValue[stat.key]?.[side]
    if (value == null) return ''
    return stat.percent ? Number((value * 100).toPrecision(15)) : value
}

function setBound(stat, side, input) {
    if (input.validity.badInput) return
    const range = {...props.modelValue[stat.key]}
    if (input.value === '') delete range[side]
    else range[side] = input.valueAsNumber / (stat.percent ? 100 : 1)
    emit('update:modelValue', {...props.modelValue, [stat.key]: range})
}
</script>

<style scoped>
.panel-bounds {
    display: grid;
    grid-template-columns: minmax(96px, 1.4fr) repeat(2, minmax(0, 1fr));
    align-items: center;
    gap: 8px;
}

.panel-bounds input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 8px;
    border: 1px solid var(--el-border-color);
    border-radius: 5px;
    background: var(--el-bg-color);
    color: inherit;
}
</style>

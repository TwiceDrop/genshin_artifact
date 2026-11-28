<script setup>
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'radix-vue';
import UiHoverDetails from '@/components/ui/UiHoverDetails.vue';
import UiInput from '@/components/ui/UiInput.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import UiButton from '@/components/ui/UiButton.vue';
import UiSwitch from '@/components/ui/UiSwitch.vue';
import elementIcons from '@/assets/element-icons';
import { useI18n } from '@/i18n/i18n';

const props = defineProps({ configs: Array, modelValue: Object, stacked: Boolean });
const emit = defineEmits(['update:modelValue']);
const { t, ta } = useI18n();
const elements = ['Pyro', 'Cryo', 'Electro', 'Hydro', 'Anemo', 'Geo', 'Dendro', 'Physical'];

function title(config) {
    return config.title ? ta(config.title) : config.name;
}

function update(name, value) {
    if (value !== props.modelValue[name]) {
        emit('update:modelValue', { ...props.modelValue, [name]: value });
    }
}

function updateNumber(config, event) {
    const input = event.target;
    if (Number.isFinite(input.valueAsNumber) && input.validity.valid) {
        update(config.name, input.valueAsNumber);
    } else {
        input.value = props.modelValue[config.name];
    }
}

function options(config) {
    return config.options.map((label, index) => ({ label, value: String(index) }));
}

function elementOptions(type) {
    return (type === 'element4' ? elements.slice(0, 4) : elements).map(value => ({ value, label: t('ele.' + value) }));
}

function toggleElement(name, value) {
    const selected = props.modelValue[name];
    update(name, selected.includes(value) ? selected.filter(element => element !== value) : [...selected, value]);
}
</script>

<template>
    <div class="param-fields" :class="{ stacked }">
        <div v-for="config in configs" :key="config.name" class="param-field">
            <div class="param-heading">
                <span>{{ title(config) }}</span>
                <UiHoverDetails v-if="ta(config.help)" enabled :tap-label="title(config) + ' ?'">
                    <template #trigger>
                        <button type="button" class="param-help" :aria-label="title(config) + ' ?'">?</button>
                    </template>
                    <span class="param-help-text">{{ ta(config.help) }}</span>
                </UiHoverDetails>
            </div>
            <UiSwitch v-if="config.type === 'bool'" class="param-switch" :aria-label="title(config)"
                :model-value="modelValue[config.name]" @update:model-value="update(config.name, $event)" />
            <UiSelect v-else-if="config.type === 'option'" :label="title(config)"
                :model-value="String(modelValue[config.name])" :options="options(config)"
                @update:model-value="update(config.name, Number($event))" />
            <UiSelect v-else-if="config.type === 'element4' || config.type === 'element8'" :label="title(config)"
                :model-value="modelValue[config.name]" :options="elementOptions(config.type)"
                @update:model-value="update(config.name, $event)" />
            <div v-else-if="config.type === 'element8multi'" class="param-elements" role="group" :aria-label="title(config)">
                <UiButton v-for="{ value, label } in elementOptions(config.type)" :key="value" size="small"
                    :aria-pressed="modelValue[config.name].includes(value)"
                    :variant="modelValue[config.name].includes(value) ? 'primary' : 'outline'"
                    @click="toggleElement(config.name, value)">
                    <img v-if="value !== 'Physical'" :src="elementIcons[value]" alt="" />
                    {{ label }}
                </UiButton>
            </div>
            <div v-else class="param-number-row">
                <SliderRoot v-if="config.type === 'float' || config.type === 'int'" class="param-slider"
                    :model-value="[modelValue[config.name]]" :min="config.min" :max="config.max"
                    :step="config.type === 'float' ? .1 : 1" @update:model-value="update(config.name, $event[0])">
                    <SliderTrack class="param-track"><SliderRange class="param-range" /></SliderTrack>
                    <SliderThumb class="param-handle" :aria-label="title(config)" />
                </SliderRoot>
                <UiInput type="number" class="param-input" :aria-label="title(config)"
                    :model-value="modelValue[config.name]" :min="config.min" :max="config.max"
                    :step="config.type.startsWith('float') ? 'any' : 1" @change="updateNumber(config, $event)" />
                <span v-if="config.type === 'floatPercentageInput'" aria-hidden="true">%</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.param-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 12px 16px; }
.param-fields.stacked { grid-template-columns: minmax(0, 1fr); }
.stacked .param-field:has(.param-switch) { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
.stacked :deep(.param-input) { text-align: right; font-variant-numeric: tabular-nums; }
.param-field { display: grid; min-width: 0; align-content: start; justify-items: start; gap: 8px; }
.param-heading, .param-number-row { display: flex; align-items: center; gap: 8px; }
.param-elements { display: flex; flex-wrap: wrap; gap: 4px; }
.param-elements img { width: 15px; height: 15px; object-fit: contain; }
.param-heading { font-size: 13px; font-weight: 600; }
.param-number-row { width: 100%; }
.param-number-row > .param-input { max-width: 86px; }
.param-number-row :deep(.param-slider) { position: relative; display: flex; flex: 1; min-width: 48px; align-items: center; height: 30px; touch-action: none; }
.param-number-row :deep(.param-track) { position: relative; flex: 1; height: 5px; border-radius: 999px; background: var(--cx-step-2); }
.param-number-row :deep(.param-range) { position: absolute; height: 100%; border-radius: inherit; background: var(--cx-gold); }
.param-number-row :deep(.param-handle) { display: block; width: 15px; height: 15px; border: 1px solid var(--cx-gold); border-radius: 50%; background: var(--cx-card); cursor: grab; }
.param-help { display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 1px solid var(--cx-step-2); border-radius: 50%; background: var(--cx-card); color: var(--cx-dim); cursor: help; }
.param-help-text { white-space: pre-line; overflow-wrap: anywhere; }
.param-field :deep(.param-handle:focus-visible),
:is(.param-help, .param-input):focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
</style>

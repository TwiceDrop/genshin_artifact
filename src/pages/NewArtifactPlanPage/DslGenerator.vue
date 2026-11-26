<template>
    <section class="dsl-generator" :class="{ 'dsl-workspace': wide }">
        <header class="generator-heading">
            <div>
                <h3>DSL 目标函数生成器</h3>
                <p>当前角色：{{ ta(character.nameLocale) }}（{{ state.character }}）</p>
            </div>
            <UiButton v-if="!wide" ref="pickerTrigger" variant="primary" @click="showSkills = true">
                <IconEpPlus aria-hidden="true" />添加技能伤害
            </UiButton>
        </header>

        <section class="generator-states">
            <header class="section-heading">
                <h4>命名状态</h4>
                <UiButton size="small" @click="addState"><IconEpPlus aria-hidden="true" />添加状态</UiButton>
            </header>
            <AccordionRoot v-model="expandedStates" type="multiple" class="state-list">
                <AccordionItem v-for="(stateItem, index) in statesList" :key="stateKey(stateItem.name)"
                    :value="stateKey(stateItem.name)" class="state-card">
                    <div class="state-card-header">
                        <AccordionHeader as="h5" class="state-heading">
                            <AccordionTrigger class="state-trigger">
                                <span class="state-name">{{ stateItem.name }}</span>
                                <span v-if="stateItem.buffs.length" class="buff-count">{{ stateItem.buffs.length }} BUFF</span>
                                <IconEpArrowDown class="state-chevron" aria-hidden="true" />
                            </AccordionTrigger>
                        </AccordionHeader>
                        <UiButton size="small" variant="danger" :aria-label="'删除' + stateItem.name" @click="removeState(index)">删除</UiButton>
                    </div>
                    <AccordionContent class="state-content">
                        <div class="state-fields">
                            <label class="generator-field state-name-field">
                                <span>状态名</span>
                                <input type="text" class="generator-input" :aria-invalid="isDraftInvalid(index, stateItem.name)"
                                    :value="renameDrafts[index] ?? stateItem.name" @input="onRenameInput(index, $event.target.value)"
                                    @change="commitRename(index, stateItem.name)" @blur="resetRenameDraft(index)"
                                    @keydown.enter.prevent="$event.target.blur()">
                            </label>
                            <section v-if="stateItem.buffs.length || inputBuffs.length" class="state-section">
                                <h5>BUFF</h5>
                                <div class="buff-columns">
                                    <ul v-if="stateItem.buffs.length" class="buff-list" aria-label="已选 BUFF">
                                        <li v-for="(buff, buffIndex) in stateItem.buffs" :key="buffIndex" class="buff-row">
                                            <span class="buff-description">
                                                <span>{{ buffLabel(buff) }}</span>
                                                <code v-if="buffConfigText(buff)">{{ buffConfigText(buff) }}</code>
                                            </span>
                                            <div class="buff-actions">
                                                <UiButton size="small" :disabled="buffIndex === 0" aria-label="上移"
                                                    @click="moveBuff(index, buffIndex, -1)"><IconEpArrowUp aria-hidden="true" /></UiButton>
                                                <UiButton size="small" :disabled="buffIndex === stateItem.buffs.length - 1" aria-label="下移"
                                                    @click="moveBuff(index, buffIndex, 1)"><IconEpArrowDown aria-hidden="true" /></UiButton>
                                                <UiButton size="small" aria-label="移除" @click="removeBuff(index, buffIndex)">移除</UiButton>
                                            </div>
                                        </li>
                                    </ul>
                                    <ul v-if="inputBuffs.length" class="buff-list" aria-label="可选 BUFF">
                                        <li v-for="(buff, buffIndex) in inputBuffs" :key="buffIndex" class="buff-row">
                                            <span class="buff-description">
                                                <span>{{ buffLabel(buff) }}</span>
                                                <code v-if="buffConfigText(buff)">{{ buffConfigText(buff) }}</code>
                                            </span>
                                            <UiButton size="small" :aria-label="'添加' + buffLabel(buff)" @click="addBuff(index, buff)">
                                                <IconEpPlus aria-hidden="true" />
                                            </UiButton>
                                        </li>
                                    </ul>
                                </div>
                            </section>
                            <section v-for="{ kind, label, configs } in effectGroups" :key="kind" class="state-section">
                                <h5>{{ label }}</h5>
                                <div class="override-fields">
                                    <label v-for="cfg in configs" :key="cfg.name" class="check-field">
                                        <CheckboxRoot class="generator-check" :checked="hasOverride(stateItem[kind], cfg.name)"
                                            @update:checked="toggleOverride(index, kind, cfg, $event === true)">
                                            <CheckboxIndicator><IconEpCheck aria-hidden="true" /></CheckboxIndicator>
                                        </CheckboxRoot>
                                        <span>{{ configLabel(cfg) }}</span>
                                    </label>
                                </div>
                                <DslParamFields v-if="overriddenConfigs(configs, stateItem[kind]).length"
                                    :model-value="stateItem[kind]" :configs="overriddenConfigs(configs, stateItem[kind])"
                                    @update:model-value="updateOverrideValues(index, kind, $event)" />
                            </section>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </AccordionRoot>
        </section>

        <component :is="wide ? 'section' : UiDialog" v-bind="pickerProps">
            <div class="generator-picker-content">
                <h4 v-if="wide">添加技能伤害</h4>
                <div class="picker-controls">
                    <div class="generator-field">
                        <span>状态</span>
                        <UiSelect v-model="dialogState" label="状态" :options="stateOptions" />
                    </div>
                    <div class="generator-field">
                        <span>取值</span>
                        <RadioGroupRoot v-model="value" class="segmented-control" aria-label="取值">
                            <RadioGroupItem v-for="item in DSL_VALUES" :key="item.key" :value="item.key" class="segment-option">
                                {{ item.label }}
                            </RadioGroupItem>
                        </RadioGroupRoot>
                    </div>
                    <div class="generator-field infusion-field">
                        <span>附魔</span>
                        <RadioGroupRoot v-model="infusion" class="segmented-control" aria-label="附魔">
                            <RadioGroupItem v-for="option in infusionOptions" :key="option.value" :value="option.value" class="segment-option">
                                {{ option.label }}
                            </RadioGroupItem>
                        </RadioGroupRoot>
                    </div>
                    <label class="generator-field number-field">
                        <span>次数</span>
                        <input type="number" class="generator-input" min="0" step="1" :value="count"
                            @change="changeNumber($event, count, next => count = next)">
                    </label>
                    <label class="generator-field number-field">
                        <span>权重</span>
                        <input type="number" class="generator-input" min="0" step="0.1" :value="weight"
                            @change="changeNumber($event, weight, next => weight = next)">
                    </label>
                </div>

                <section v-if="character.configSkill.length" class="state-section">
                    <h5>技能参数</h5>
                    <DslParamFields :model-value="skillConfig[state.character]" :configs="character.configSkill"
                        @update:model-value="skillConfig = { [state.character]: $event }" />
                </section>

                <label class="check-field">
                    <CheckboxRoot v-model:checked="showAll" class="generator-check">
                        <CheckboxIndicator><IconEpCheck aria-hidden="true" /></CheckboxIndicator>
                    </CheckboxRoot>
                    <span>显示全部伤害类型</span>
                </label>

                <ul class="skill-list" aria-label="技能">
                    <li v-for="row in rows" :key="row.index" class="skill-row">
                        <div class="skill-name">
                            <span>{{ ta(row.text) }}</span>
                            <small>{{ ta(row.title) }} <code>{{ row.token }}</code></small>
                        </div>
                        <div class="skill-options">
                            <RadioGroupRoot v-if="row.options.length" class="segmented-control" :aria-label="ta(row.text)"
                                :model-value="selection[row.index] || row.options[0]?.key" @update:model-value="select(row.index, $event)">
                                <RadioGroupItem v-for="option in row.options" :key="option.key" :value="option.key" class="segment-option">
                                    {{ option.label }}
                                </RadioGroupItem>
                            </RadioGroupRoot>
                            <p v-if="row.error" class="skill-error">{{ row.error }}</p>
                        </div>
                        <UiButton size="small" variant="primary" class="skill-add" :disabled="!row.options.length"
                            :aria-label="'添加' + ta(row.text)" @click="add(row)"><IconEpPlus aria-hidden="true" /></UiButton>
                    </li>
                </ul>
            </div>
        </component>

        <section class="generator-preview generator-panel">
            <ul v-if="state.entries.length" class="generator-entries">
                <li v-for="(entry, index) in state.entries" :key="index" class="generator-entry">
                    <div class="entry-heading">
                        <strong>{{ ta(entry.text) }}</strong>
                        <small>{{ reactionLabel(entry.reaction) }} · {{ valueLabel(entry.value) }} · {{ entry.infusion === 'None' ? '无附魔' : entry.infusion }}</small>
                    </div>
                    <div class="generator-field entry-state-field">
                        <span>状态</span>
                        <UiSelect :model-value="entry.state ?? BASE_STATE" label="状态" :options="stateOptions"
                            @update:model-value="changeEntryState(index, $event)" />
                    </div>
                    <label class="generator-field">
                        <span>次数</span>
                        <input type="number" class="generator-input" min="0" step="1" :value="entry.count"
                            @change="changeNumber($event, entry.count, next => changeEntry(index, 'count', next))">
                    </label>
                    <label class="generator-field">
                        <span>权重</span>
                        <input type="number" class="generator-input" min="0" step="0.1" :value="entry.weight"
                            @change="changeNumber($event, entry.weight, next => changeEntry(index, 'weight', next))">
                    </label>
                    <UiButton size="small" :aria-label="'移除' + ta(entry.text)" @click="removeEntry(index)">移除</UiButton>
                </li>
            </ul>
            <div class="generated-code">
                <header class="section-heading"><h4>生成的 MONA-DSL</h4><UiButton size="small" @click="reset">重置</UiButton></header>
                <component :is="hideSourceByDefault ? 'details' : 'div'" class="generated-code-details">
                    <summary v-if="hideSourceByDefault" class="generated-code-summary">查看生成源码</summary>
                    <textarea class="generator-input code-output" readonly :value="source" aria-label="生成的 MONA-DSL" rows="10" spellcheck="false"></textarea>
                </component>
            </div>
        </section>
    </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger,
    CheckboxIndicator, CheckboxRoot, RadioGroupItem, RadioGroupRoot } from 'radix-vue';
import characters from '@/assets/_gen_character.js';
import { weaponData } from '@weapon';
import { buffData } from '@buff';
import names from '../../../beta-data/dsl-skill-names.json';
import { DSL_VALUES, DSL_DAMAGE_TYPES, skillRows, availableDamageTypes, generateDsl, dslGeneratorInput } from '@/algorithms/dsl-generator.mjs';
import { useI18n } from '@/i18n/i18n';
import DslParamFields from './DslParamFields.vue';
import UiDialog from '@/components/ui/UiDialog.vue';
import UiSelect from '@/components/ui/UiSelect.vue';
import IconEpArrowDown from '~icons/ep/arrow-down';
import IconEpArrowUp from '~icons/ep/arrow-up';
import IconEpCheck from '~icons/ep/check';
import UiButton from '@/components/ui/UiButton.vue';
import IconEpPlus from '~icons/ep/plus';

const STATE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BASE_STATE = '@base';

const props = defineProps({ modelValue: Object, input: Object, availableBuffs: Array, mona: Object, wide: Boolean, active: Boolean, hideSourceByDefault: Boolean });
const emit = defineEmits(['update:modelValue']);
const { t, ta } = useI18n();

const state = computed(() => props.modelValue);
const statesList = computed(() => state.value.states ?? []);
const character = computed(() => characters[state.value.character]);
const characterConfigs = computed(() => character.value.config);
const weaponConfigs = computed(() => weaponData[props.input.weapon.name].configs ?? []);
const effectGroups = computed(() => [
    { kind: 'character', label: '角色参数', configs: characterConfigs.value },
    { kind: 'weapon', label: '武器参数', configs: weaponConfigs.value },
].filter(group => group.configs.length));
const inputBuffs = computed(() => props.availableBuffs ?? props.input.buffs);
const stateOptions = computed(() => [
    { label: '基础设置', value: BASE_STATE },
    ...statesList.value.map(({ name }) => ({ label: name, value: name })),
]);
const infusionOptions = computed(() => ['None', 'Pyro', 'Electro', 'Hydro', 'Anemo', 'Geo', 'Cryo', 'Dendro']
    .map(element => ({ value: element, label: t('ele.' + element) })));
const source = computed(() => generateDsl(state.value));

const showSkills = ref(false);
const pickerTrigger = ref(null);
const expandedStates = ref([]);
const stateKeys = new Map();
let nextStateKey = 0;
const showAll = ref(false);
const value = ref('e');
const infusion = ref('None');
const count = ref(1);
const weight = ref(1);
const selection = ref({});
const skillConfig = ref('NoConfig');
const dialogState = ref(BASE_STATE);
const renameDrafts = ref({});

const pickerProps = computed(() => props.wide ? { class: 'generator-picker generator-panel' } : {
    modelValue: showSkills.value,
    'onUpdate:modelValue': opened => { showSkills.value = opened; },
    title: '添加技能伤害',
    width: 'min(680px, 96vw)',
    returnFocus: () => pickerTrigger.value?.$el.focus(),
});
watch([() => props.wide, () => props.active], () => { showSkills.value = false; });

function clone(val) {
    return JSON.parse(JSON.stringify(val));
}

function hasOverride(obj, key) {
    return obj != null && Object.hasOwn(obj, key);
}

function configLabel(cfg) {
    return cfg.title ? ta(cfg.title) : cfg.name;
}

function buffLabel(buff) {
    const meta = buffData[buff.name];
    return meta?.nameLocale ? ta(meta.nameLocale) : buff.name;
}

function buffConfigText(buff) {
    if (buff.config === 'NoConfig') return '';
    return Object.entries(buff.config[buff.name]).map(([key, val]) => `${key}=${JSON.stringify(val)}`).join(', ');
}

function overriddenConfigs(configs, overrides) {
    if (!overrides) return [];
    return configs.filter(cfg => hasOverride(overrides, cfg.name));
}

function emitStates(nextStates, nextEntries = state.value.entries) {
    emit('update:modelValue', {
        ...state.value,
        entries: nextEntries,
        states: nextStates
    });
}

function isValidStateName(name, excludeIndex) {
    if (!STATE_NAME_RE.test(name)) return false;
    return !statesList.value.some((s, i) => i !== excludeIndex && s.name === name);
}

function nextStateName() {
    const used = new Set(statesList.value.map(s => s.name));
    let i = 1;
    while (used.has(`state_${i}`)) i += 1;
    return `state_${i}`;
}

function stateKey(name) {
    if (!stateKeys.has(name)) stateKeys.set(name, String(++nextStateKey));
    return stateKeys.get(name);
}

function addState() {
    const name = nextStateName();
    emitStates([...statesList.value, { name, buffs: [] }]);
    expandedStates.value = [...expandedStates.value, stateKey(name)];
}

function onRenameInput(index, val) {
    renameDrafts.value = { ...renameDrafts.value, [index]: val };
}

function isDraftInvalid(index, currentName) {
    const draft = renameDrafts.value[index];
    if (draft === undefined || draft === currentName) return false;
    return !isValidStateName(draft.trim(), index);
}

function resetRenameDraft(index) {
    if (!(index in renameDrafts.value)) return;
    const next = { ...renameDrafts.value };
    delete next[index];
    renameDrafts.value = next;
}

function commitRename(index, oldName) {
    const raw = renameDrafts.value[index];
    if (raw === undefined) return;
    const nextName = raw.trim();
    if (!nextName || nextName === oldName || !isValidStateName(nextName, index)) {
        resetRenameDraft(index);
        return;
    }
    const nextStates = statesList.value.map((s, i) => (i === index ? { ...s, name: nextName } : s));
    const nextEntries = state.value.entries.map(entry =>
        entry.state === oldName ? { ...entry, state: nextName } : entry
    );
    if (dialogState.value === oldName) {
        dialogState.value = nextName;
    }
    const key = stateKey(oldName);
    stateKeys.delete(oldName);
    stateKeys.set(nextName, key);
    resetRenameDraft(index);
    emitStates(nextStates, nextEntries);
}

function removeState(index) {
    const removedName = statesList.value[index]?.name;
    const nextStates = statesList.value.filter((_, i) => i !== index);
    const nextEntries = state.value.entries.map(entry => {
        if (entry.state !== removedName) return entry;
        const { state: _removed, ...rest } = entry;
        return rest;
    });
    if (dialogState.value === removedName) {
        dialogState.value = BASE_STATE;
    }
    expandedStates.value = expandedStates.value.filter(key => key !== stateKeys.get(removedName));
    stateKeys.delete(removedName);
    renameDrafts.value = {};
    emitStates(nextStates, nextEntries);
}

function updateStateAt(index, updater) {
    const nextStates = statesList.value.map((s, i) => (i === index ? updater(s) : s));
    emitStates(nextStates);
}

function addBuff(sIndex, {name, config}) {
    updateStateAt(sIndex, s => ({ ...s, buffs: [...s.buffs, {name, config: clone(config)}] }));
}

function removeBuff(sIndex, bIndex) {
    updateStateAt(sIndex, s => ({ ...s, buffs: s.buffs.filter((_, i) => i !== bIndex) }));
}

function moveBuff(sIndex, bIndex, delta) {
    updateStateAt(sIndex, s => {
        const target = bIndex + delta;
        if (target < 0 || target >= s.buffs.length) return s;
        const nextBuffs = [...s.buffs];
        const [item] = nextBuffs.splice(bIndex, 1);
        nextBuffs.splice(target, 0, item);
        return { ...s, buffs: nextBuffs };
    });
}

function baseFieldValue(kind, cfg) {
    const equipment = props.input[kind];
    const params = equipment.params[equipment.name];
    return clone(hasOverride(params, cfg.name) ? params[cfg.name] : cfg.default);
}

function toggleOverride(sIndex, kind, cfg, enabled) {
    updateStateAt(sIndex, s => {
        const current = s[kind] ? { ...s[kind] } : {};
        if (enabled) {
            if (!hasOverride(current, cfg.name)) {
                current[cfg.name] = baseFieldValue(kind, cfg);
            }
            return { ...s, [kind]: current };
        }
        delete current[cfg.name];
        if (!Object.keys(current).length) {
            const { [kind]: _removed, ...rest } = s;
            return rest;
        }
        return { ...s, [kind]: current };
    });
}

function updateOverrideValues(sIndex, kind, values) {
    updateStateAt(sIndex, s => ({ ...s, [kind]: values }));
}

watch(
    () => state.value.character,
    name => {
        skillConfig.value = character.value.configSkill.length
            ? { [name]: Object.fromEntries(character.value.configSkill.map(c => [c.name, c.default])) }
            : 'NoConfig';
        selection.value = {};
        showSkills.value = false;
        dialogState.value = BASE_STATE;
        renameDrafts.value = {};
        expandedStates.value = [];
        stateKeys.clear();
    },
    { immediate: true, flush: 'sync' }
);

const selectedDialogState = computed(() =>
    statesList.value.find(s => s.name === dialogState.value)
);

const previewInput = computed(() => dslGeneratorInput(props.input, selectedDialogState.value));

const rows = computed(() =>
    !props.active || !(props.wide || showSkills.value)
        ? []
        : skillRows(character.value, names[state.value.character]).map(row => {
              let options = [];
              let error = '';
              try {
                  options = availableDamageTypes(props.mona, previewInput.value, row, skillConfig.value, infusion.value);
              } catch (e) {
                  error = e.message || String(e);
              }
              return { ...row, options: showAll.value ? DSL_DAMAGE_TYPES : options, error };
          })
);

watch([skillConfig, infusion, showAll, selectedDialogState], () => {
    selection.value = {};
}, { deep: true });

const reactionLabel = key => DSL_DAMAGE_TYPES.find(t => t.key === key).label;
const valueLabel = key => DSL_VALUES.find(t => t.key === key).label;

function select(index, val) {
    selection.value = { ...selection.value, [index]: val };
}

function add(row) {
    const entry = {
        index: row.index,
        text: row.text,
        token: row.token,
        params: clone(skillConfig.value === 'NoConfig' ? {} : skillConfig.value[state.value.character]),
        reaction: selection.value[row.index] || row.options[0].key,
        value: value.value,
        infusion: infusion.value,
        count: count.value,
        weight: weight.value
    };
    if (selectedDialogState.value) {
        entry.state = selectedDialogState.value.name;
    }
    emit('update:modelValue', { ...state.value, entries: [...state.value.entries, entry] });
}

function changeEntry(index, key, val) {
    emit('update:modelValue', {
        ...state.value,
        entries: state.value.entries.map((entry, i) => (i === index ? { ...entry, [key]: val } : entry))
    });
}

function changeEntryState(index, val) {
    emit('update:modelValue', {
        ...state.value,
        entries: state.value.entries.map((entry, i) => {
            if (i !== index) return entry;
            if (val === BASE_STATE) {
                const { state: _removed, ...rest } = entry;
                return rest;
            }
            return { ...entry, state: val };
        })
    });
}

function removeEntry(index) {
    emit('update:modelValue', { ...state.value, entries: state.value.entries.filter((_, i) => i !== index) });
}

function changeNumber(event, current, update) {
    const input = event.target;
    if (Number.isFinite(input.valueAsNumber) && !input.validity.rangeUnderflow) {
        update(input.valueAsNumber);
    } else {
        input.value = current;
    }
}

function reset() {
    renameDrafts.value = {};
    expandedStates.value = [];
    stateKeys.clear();
    dialogState.value = BASE_STATE;
    emit('update:modelValue', { ...state.value, entries: [], states: [] });
}
</script>

<style scoped>
.dsl-generator { display: grid; min-width: 0; gap: 16px; color: var(--cx-letter); }
.dsl-workspace { grid-template-columns: minmax(0, 1.55fr) minmax(280px, 1fr); align-items: start; }
.dsl-workspace > :is(.generator-heading, .generator-states) { grid-column: 1 / -1; }
.generator-heading, .section-heading { display: flex; min-width: 0; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.dsl-generator :is(h3, h4, h5, p), .generator-picker-content :is(h4, h5, p) { margin: 0; }
.generator-heading h3 { font-size: 18px; line-height: 1.3; letter-spacing: -0.02em; }
.generator-heading p { margin-top: 4px; color: var(--cx-dim); font-size: 13px; }
.section-heading h4, .generator-picker-content h4 { font-size: 15px; line-height: 1.4; }
.generator-panel, .state-card { min-width: 0; border: 1px solid var(--cx-step-2); border-radius: 12px; background: var(--cx-card); }
.generator-panel { padding: 16px; }
.generator-states, .state-list, .state-fields, .generator-preview, .generated-code { display: grid; min-width: 0; gap: 10px; }
.state-list:empty { display: none; }
.state-card-header { display: flex; align-items: center; gap: 6px; padding: 5px 8px 5px 4px; }
.state-heading { flex: 1; min-width: 0; }
.state-trigger { display: flex; align-items: center; width: 100%; min-height: 36px; gap: 8px; padding: 6px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--cx-letter); font: inherit; text-align: start; cursor: pointer; }
.state-trigger:is(:hover, [data-state="open"]) { background: var(--cx-step); }
.state-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 13px/1.45 ui-monospace, Consolas, monospace; }
.state-chevron { width: 14px; flex: 0 0 14px; margin-inline-start: auto; color: var(--cx-dim); transition: transform 150ms ease; }
.state-trigger[data-state="open"] .state-chevron { transform: rotate(180deg); }
.buff-count { flex: 0 0 auto; padding: 1px 6px; border: 1px solid var(--cx-step-2); border-radius: 999px; color: var(--cx-dim); font-size: 11px; }
.state-content { border-top: 1px solid var(--cx-step-2); }
.state-fields { padding: 12px 14px; gap: 12px; }
.state-name-field { max-width: 260px; }
.state-section { display: grid; min-width: 0; gap: 8px; padding-top: 10px; border-top: 1px solid var(--cx-step-2); }
.state-section h5 { font-size: 13px; font-weight: 650; }
.buff-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr)); gap: 8px; }
.buff-list, .skill-list, .generator-entries { display: grid; min-width: 0; gap: 6px; padding: 0; margin: 0; list-style: none; }
.buff-row { display: flex; justify-content: space-between; align-items: center; min-width: 0; gap: 8px; padding: 7px 8px; border: 1px solid var(--cx-step-2); border-radius: 8px; background: var(--cx-step); }
.buff-description { display: grid; min-width: 0; gap: 2px; font-size: 13px; overflow-wrap: anywhere; }
.buff-description code { color: var(--cx-dim); font-size: 11px; }
.buff-actions, .override-fields { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.buff-actions { flex: 0 0 auto; }
.override-fields { gap: 8px 14px; }
.check-field { display: inline-flex; align-items: center; gap: 7px; min-width: 0; color: var(--cx-letter); font-size: 13px; cursor: pointer; }
.check-field :deep(.generator-check) { display: grid; place-items: center; flex: 0 0 18px; width: 18px; height: 18px; padding: 0; border: 1px solid var(--cx-dim); border-radius: 4px; background: var(--cx-card); color: var(--cx-gold-on); cursor: pointer; }
.check-field :deep(.generator-check[data-state="checked"]) { border-color: var(--cx-gold); background: var(--cx-gold); }
.check-field :deep(.generator-check svg) { display: block; width: 12px; height: 12px; }
.generator-picker { max-height: min(62vh, 600px); overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
.generator-picker-content { display: grid; min-width: 0; gap: 12px; }
.picker-controls { display: flex; flex-wrap: wrap; align-items: end; gap: 10px 12px; }
.generator-field { display: grid; gap: 5px; min-width: 0; color: var(--cx-dim); font-size: 12px; font-weight: 600; }
.generator-field :deep(.select-trigger) { width: 100%; min-width: 0; }
.number-field { width: 86px; }
.generator-input { box-sizing: border-box; width: 100%; min-width: 0; height: 34px; padding: 5px 9px; border: 1px solid var(--cx-step-2); border-radius: 8px; background: var(--cx-card); color: var(--cx-letter); font: inherit; font-size: 13px; font-weight: 400; }
.generator-input[aria-invalid="true"] { border-color: var(--cx-up); }
.segmented-control { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; min-width: 0; padding: 3px; border-radius: 8px; background: var(--cx-step); }
.segment-option { min-height: 27px; max-width: 100%; padding: 4px 8px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--cx-dim); font: inherit; font-size: 12px; cursor: pointer; }
.segment-option:hover { color: var(--cx-letter); }
.segment-option[data-state="checked"] { border-color: var(--cx-step-2); background: var(--cx-card); color: var(--cx-letter); font-weight: 650; }
.skill-row { display: grid; grid-template-columns: minmax(100px, .9fr) minmax(0, 1.3fr) auto; align-items: center; gap: 9px; padding: 8px 0; border-top: 1px solid var(--cx-step-2); }
.skill-name, .entry-heading { display: grid; min-width: 0; gap: 3px; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.skill-name small, .entry-heading small { color: var(--cx-dim); font-size: 11px; font-weight: 400; }
.skill-name code { white-space: normal; }
.skill-error { color: var(--cx-up); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.skill-add { align-self: start; }
.generator-entries { max-height: min(34vh, 300px); overflow-y: auto; overscroll-behavior: contain; }
.generator-entry { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; align-items: end; gap: 8px; padding: 0 0 10px; border-bottom: 1px solid var(--cx-step-2); }
.entry-heading, .entry-state-field { grid-column: 1 / -1; }
.generated-code-details { min-width: 0; }
.generated-code-summary { cursor: pointer; font-size: 13px; color: var(--cx-dim); user-select: none; border-radius: 4px; }
details.generated-code-details > .code-output { margin-top: 8px; }
.code-output { width: 100%; box-sizing: border-box; min-height: 140px; max-height: 44vh; height: auto; padding: 10px; resize: vertical; background: var(--cx-step); font: 12px/1.5 ui-monospace, Consolas, monospace; white-space: pre; overflow-x: auto; }
:is(.state-trigger, .generator-input, .segment-option, .generated-code-summary):focus-visible,
.check-field :deep(.generator-check:focus-visible) { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
@media (max-width: 520px) {
    .generator-panel { padding: 12px; }
    .picker-controls > .infusion-field { flex: 1 0 100%; }
    .skill-row { grid-template-columns: minmax(0, 1fr) auto; }
    .skill-options { grid-column: 1 / -1; grid-row: 2; }
}
@media (prefers-reduced-motion: reduce) { .state-chevron { transition: none; } }
</style>

<template>
    <section class="dsl-generator">
        <div class="generator-heading">
            <div>
                <strong>DSL 目标函数生成器</strong>
                <div>当前角色：{{ ta(character.nameLocale) }}（{{ state.character }}）</div>
            </div>
            <el-button type="primary" @click="showSkills = true">添加技能伤害</el-button>
        </div>

        <div class="generator-states">
            <div class="states-header">
                <strong>命名状态</strong>
                <el-button size="small" @click="addState">添加状态</el-button>
            </div>
            <div v-for="(s, sIndex) in statesList" :key="sIndex" class="state-card">
                <div class="state-card-header">
                    <label class="state-name-field">
                        <span>状态名</span>
                        <el-input
                            size="small"
                            :class="{ 'is-invalid': isDraftInvalid(sIndex, s.name) }"
                            :aria-invalid="isDraftInvalid(sIndex, s.name)"
                            :model-value="renameDrafts[sIndex] ?? s.name"
                            @update:modelValue="onRenameInput(sIndex, $event)"
                            @change="commitRename(sIndex, s.name)"
                            @blur="resetRenameDraft(sIndex)"
                        />
                    </label>
                    <el-button size="small" @click="removeState(sIndex)" :aria-label="'删除' + s.name">删除</el-button>
                </div>

                <div class="state-section">
                    <span class="state-section-title">BUFF</span>
                    <div class="state-buff-columns">
                        <div class="state-buff-list">
                            <div v-for="(b, bIndex) in s.buffs" :key="bIndex" class="state-buff-item">
                                <span class="buff-label">
                                    {{ buffLabel(b) }}
                                    <code v-if="buffConfigText(b)" class="buff-config">{{ buffConfigText(b) }}</code>
                                </span>
                                <div class="buff-actions">
                                    <el-button size="small" :disabled="bIndex === 0" @click="moveBuff(sIndex, bIndex, -1)" aria-label="上移">↑</el-button>
                                    <el-button size="small" :disabled="bIndex === s.buffs.length - 1" @click="moveBuff(sIndex, bIndex, 1)" aria-label="下移">↓</el-button>
                                    <el-button size="small" @click="removeBuff(sIndex, bIndex)" aria-label="移除">移除</el-button>
                                </div>
                            </div>
                        </div>
                        <div v-if="inputBuffs.length" class="state-buff-picker">
                            <div v-for="(b, bIndex) in inputBuffs" :key="bIndex" class="state-buff-item">
                                <span class="buff-label">
                                    {{ buffLabel(b) }}
                                    <code v-if="buffConfigText(b)" class="buff-config">{{ buffConfigText(b) }}</code>
                                </span>
                                <el-button size="small" @click="addBuff(sIndex, b)" :aria-label="'添加' + buffLabel(b)">+</el-button>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="characterConfigs.length" class="state-section">
                    <span class="state-section-title">角色参数</span>
                    <div class="override-fields">
                        <el-checkbox
                            v-for="cfg in characterConfigs"
                            :key="cfg.name"
                            :model-value="hasOverride(s.character, cfg.name)"
                            @update:modelValue="toggleOverride(sIndex, 'character', cfg, $event)"
                        >
                            {{ configLabel(cfg) }}
                        </el-checkbox>
                    </div>
                    <item-config
                        v-if="overriddenConfigs(characterConfigs, s.character).length"
                        :model-value="s.character"
                        :need-item-name="false"
                        :configs="overriddenConfigs(characterConfigs, s.character)"
                        @update:model-value="updateOverrideValues(sIndex, 'character', $event)"
                    />
                </div>

                <div v-if="weaponConfigs.length" class="state-section">
                    <span class="state-section-title">武器参数</span>
                    <div class="override-fields">
                        <el-checkbox
                            v-for="cfg in weaponConfigs"
                            :key="cfg.name"
                            :model-value="hasOverride(s.weapon, cfg.name)"
                            @update:modelValue="toggleOverride(sIndex, 'weapon', cfg, $event)"
                        >
                            {{ configLabel(cfg) }}
                        </el-checkbox>
                    </div>
                    <item-config
                        v-if="overriddenConfigs(weaponConfigs, s.weapon).length"
                        :model-value="s.weapon"
                        :need-item-name="false"
                        :configs="overriddenConfigs(weaponConfigs, s.weapon)"
                        @update:model-value="updateOverrideValues(sIndex, 'weapon', $event)"
                    />
                </div>
            </div>
        </div>

        <div v-for="(entry, index) in state.entries" :key="index" class="generator-entry">
            <div>
                <strong>{{ ta(entry.text) }}</strong>
                <span>{{ reactionLabel(entry.reaction) }} · {{ valueLabel(entry.value) }} · {{ entry.infusion === 'None' ? '无附魔' : entry.infusion }}</span>
            </div>
            <label>
                状态
                <el-select :model-value="entry.state ?? BASE_STATE" @update:modelValue="changeEntryState(index, $event)">
                    <el-option label="基础设置" :value="BASE_STATE" />
                    <el-option v-for="s in statesList" :key="s.name" :label="s.name" :value="s.name" />
                </el-select>
            </label>
            <label>次数<el-input-number :model-value="entry.count" :min="0" :step="1" @update:modelValue="changeEntry(index, 'count', $event)" /></label>
            <label>权重<el-input-number :model-value="entry.weight" :min="0" :step="0.1" @update:modelValue="changeEntry(index, 'weight', $event)" /></label>
            <el-button @click="removeEntry(index)" :aria-label="'移除' + ta(entry.text)">移除</el-button>
        </div>

        <div class="generated-code">
            <strong>生成的 MONA-DSL</strong>
            <el-input type="textarea" :rows="10" :model-value="source" readonly label="生成的 MONA-DSL" />
            <el-button @click="reset">重置</el-button>
        </div>

        <el-dialog custom-class="cx-scope" v-model="showSkills" title="添加技能伤害" width="min(1100px, 96vw)" append-to-body class="dsl-skill-dialog">
            <div class="generator-controls">
                <label>
                    状态
                    <el-select v-model="dialogState">
                        <el-option label="基础设置" :value="BASE_STATE" />
                        <el-option v-for="s in statesList" :key="s.name" :label="s.name" :value="s.name" />
                    </el-select>
                </label>
                <label>取值<el-radio-group v-model="value"><el-radio-button v-for="item in DSL_VALUES" :key="item.key" :label="item.key">{{ item.label }}</el-radio-button></el-radio-group></label>
                <label>附魔<select-element-type v-model="infusion" :elements="['None', 'Pyro', 'Hydro', 'Electro', 'Cryo', 'Anemo', 'Geo', 'Dendro']" /></label>
                <label>次数<el-input-number v-model="count" :min="0" :step="1" /></label>
                <label>权重<el-input-number v-model="weight" :min="0" :step="0.1" /></label>
            </div>
            <div v-if="character.configSkill.length" class="generator-skill-config"><strong>技能参数</strong><item-config v-model="skillConfig" :item-name="state.character" :configs="character.configSkill" /></div>
            <el-checkbox v-model="showAll">显示全部伤害类型</el-checkbox>
            <div class="generator-skill-list">
                <div class="skill-list-header"><span>类型</span><span>技能</span><span>参数</span><span>添加</span></div>
                <div v-for="row in rows" :key="row.index" class="generator-skill-row">
                    <span>{{ ta(row.title) }}</span>
                    <span>{{ ta(row.text) }}<code>{{ row.token }}</code></span>
                    <div>
                        <el-radio-group :model-value="selection[row.index] || row.options[0]?.key" @update:modelValue="select(row.index, $event)">
                            <el-radio-button v-for="option in row.options" :key="option.key" :label="option.key">{{ option.label }}</el-radio-button>
                        </el-radio-group>
                        <p v-if="row.error" class="skill-error">{{ row.error }}</p>
                    </div>
                    <el-button circle type="primary" :disabled="!row.options.length" :aria-label="'添加' + ta(row.text)" @click="add(row)">+</el-button>
                </div>
            </div>
        </el-dialog>
    </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import characters from '@/assets/_gen_character.js';
import { weaponData } from '@weapon';
import { buffData } from '@buff';
import names from '../../../beta-data/dsl-skill-names.json';
import { DSL_VALUES, DSL_DAMAGE_TYPES, skillRows, availableDamageTypes, generateDsl, dslGeneratorInput } from '@/algorithms/dsl-generator.mjs';
import { useI18n } from '@/i18n/i18n';
import ItemConfig from '@/components/config/ItemConfig.vue';
import SelectElementType from '@/components/select/SelectElementType.vue';

const STATE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BASE_STATE = '@base';

const props = defineProps({ modelValue: Object, input: Object, mona: Object });
const emit = defineEmits(['update:modelValue']);
const { ta } = useI18n();

const state = computed(() => props.modelValue);
const statesList = computed(() => state.value.states ?? []);
const character = computed(() => characters[state.value.character]);
const characterConfigs = computed(() => character.value.config);
const weaponConfigs = computed(() => weaponData[props.input.weapon.name].configs ?? []);
const inputBuffs = computed(() => props.input.buffs);
const source = computed(() => generateDsl(state.value));

const showSkills = ref(false);
const showAll = ref(false);
const value = ref('e');
const infusion = ref('None');
const count = ref(1);
const weight = ref(1);
const selection = ref({});
const skillConfig = ref('NoConfig');
const dialogState = ref(BASE_STATE);
const renameDrafts = ref({});

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

function addState() {
    const nextStates = [...statesList.value, { name: nextStateName(), buffs: [] }];
    emitStates(nextStates);
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
    },
    { immediate: true, flush: 'sync' }
);

const selectedDialogState = computed(() =>
    statesList.value.find(s => s.name === dialogState.value)
);

const previewInput = computed(() => dslGeneratorInput(props.input, selectedDialogState.value));

const rows = computed(() =>
    !showSkills.value
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

function reset() {
    renameDrafts.value = {};
    dialogState.value = BASE_STATE;
    emit('update:modelValue', { ...state.value, entries: [], states: [] });
}
</script>

<style scoped>
.dsl-generator { border: 1px solid var(--el-border-color); border-radius: 6px; padding: 14px; background: var(--el-fill-color-extra-light); }
.generator-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.generator-heading div div { font-size: 13px; margin-top: 6px; color: var(--el-text-color-secondary); }
.generator-states { display: grid; gap: 10px; margin-bottom: 14px; }
.states-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.state-card { border: 1px solid var(--el-border-color); border-radius: 6px; padding: 10px 12px; background: var(--el-bg-color); display: grid; gap: 10px; }
.state-card-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.state-name-field { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 180px; max-width: 320px; }
.state-name-field span { white-space: nowrap; font-size: 13px; }
.state-name-field :deep(.is-invalid .el-input__wrapper) { box-shadow: 0 0 0 1px var(--el-color-danger) inset; }
.state-section { display: grid; gap: 6px; padding-top: 6px; border-top: 1px dashed var(--el-border-color); }
.state-section-title { font-size: 13px; font-weight: 600; color: var(--el-text-color-regular); }
.state-buff-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
.state-buff-list, .state-buff-picker { display: grid; gap: 6px; align-content: start; }
.state-buff-item { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 8px; border: 1px solid var(--el-border-color-lighter); border-radius: 4px; background: var(--el-fill-color-blank); }
.buff-label { font-size: 13px; min-width: 0; overflow-wrap: anywhere; }
.buff-config { display: block; font-size: 11px; color: var(--el-text-color-secondary); }
.buff-actions { display: flex; gap: 4px; flex-shrink: 0; }
.override-fields { display: flex; flex-wrap: wrap; gap: 6px 12px; }
.generated-code { display: grid; gap: 10px; margin-top: 14px; }
.generated-code .el-button { justify-self: start; }
.generated-code :deep(textarea) { font-family: monospace; }
.generator-entry { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--el-border-color); }
.generator-entry > div:first-child { width: 100%; }
.generator-entry span { display: block; font-size: 12px; color: var(--el-text-color-secondary); margin-top: 4px; }
.generator-entry label { display: grid; gap: 4px; }
.generator-entry :deep(.el-input-number) { width: 110px; }
.generator-entry :deep(.el-select) { width: 150px; }
.generator-controls { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; }
.generator-controls > label { display: flex; flex-direction: column; gap: 8px; }
.generator-controls :deep(.el-select) { width: 160px; }
.generator-skill-config { margin-bottom: 12px; }
.generator-skill-list { overflow-x: auto; margin-top: 12px; max-height: 55vh; }
.skill-list-header, .generator-skill-row { display: grid; grid-template-columns: 180px 230px minmax(260px, 1fr) 52px; min-width: 780px; align-items: center; gap: 12px; padding: 10px 8px; border-bottom: 1px solid var(--el-border-color); }
.skill-list-header { background: var(--el-fill-color-light); font-weight: bold; position: sticky; top: 0; z-index: 1; }
.generator-skill-row code { display: block; color: var(--el-color-primary); margin-top: 4px; }
.generator-skill-row :deep(.el-radio-group) { display: flex; flex-wrap: wrap; gap: 3px; }
.skill-error { color: var(--el-color-danger); margin: 6px 0; white-space: pre-wrap; }
@media (max-width: 768px) {
    .dsl-generator { padding: 10px; }
    .state-name-field { max-width: none; width: 100%; }
    .state-buff-columns { grid-template-columns: 1fr; }
    .generator-entry :deep(.el-select), .generator-entry :deep(.el-input-number) { width: 130px; }
    .generator-controls > label { width: 100%; }
    .generator-controls :deep(.el-select) { width: 100%; }
}
</style>

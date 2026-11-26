<template>
    <section class="character-buff-groups">
        <div class="group-filters">
            <div class="character-element-tabs" role="group" aria-label="筛选 BUFF 元素">
                <button type="button" :aria-pressed="buffElement === ''" @click="selectElement('')">全部</button>
                <button v-for="element in elements" :key="element" type="button" :aria-pressed="buffElement === element" @click="selectElement(element)">
                    <img v-if="elementIcons[element]" :src="elementIcons[element]" alt="" />{{ t('ele', element) }}
                </button>
            </div>
            <el-select v-if="store.uidGroups.value.length" v-model="uid" class="uid-select" size="small" aria-label="BUFF 来源 UID" placeholder="选择 UID">
                <el-option v-for="g in store.uidGroups.value" :key="g.uid" :value="g.uid" :label="`${g.nickname} · UID ${g.uid}`" />
            </el-select>
        </div>
        <el-collapse v-model="expanded" accordion>
            <el-collapse-item v-for="g in visibleGroups" :key="g.character" :name="g.character">
                <template #title>
                    <div class="character-group-title" :data-element="g.element || 'None'">
                        <span class="element-accent" aria-hidden="true" />
                        <span class="character-avatar"><img :src="g.badge" alt="" loading="lazy" /></span>
                        <img v-if="g.element && elementIcons[g.element]" class="character-element-icon" :src="elementIcons[g.element]" :alt="`${t('ele', g.element)}元素`" />
                        <strong>{{ g.label }}</strong>
                        <span class="buff-count">{{ g.buffs.length }}项 BUFF</span>
                        <span v-if="profile(g.character).imported" class="saved-badge">{{ profile(g.character).constellation }}命 · 已保存</span>
                        <span class="character-group-actions">
                            <span v-if="selectedCount(g)" class="selected-badge">已添加 {{ selectedCount(g) }}</span>
                            <button v-if="available(g).length" type="button" class="quick-add-btn" :aria-label="`一键添加${g.label}全部可用 BUFF`" @click.stop="addAll(g)">一键全加</button>
                        </span>
                    </div>
                </template>
                <template v-if="expanded === g.character">
                    <div class="character-buff-profile">
                        <template v-if="g.character !== 'Traveler' && g.character !== 'Unmapped'">
                        <label>命座<el-input-number size="small" :model-value="profile(g.character).constellation" :min="0" :max="6" :aria-label="`${g.label}命座`" @update:modelValue="v => setProfile(g.character, 'constellation', v)" /></label>
                        <label v-for="(label,key) in skills" :key="key">{{ label }}<el-input-number size="small" :model-value="profile(g.character)[key]" :min="1" :max="15" :aria-label="`${g.label}${label}`" @update:modelValue="v => setProfile(g.character, key, v)" /></label>
                        <el-button size="small" @click="reset(g.character)">{{ profile(g.character).imported ? '恢复已保存数据' : '恢复默认值' }}</el-button>
                        </template>
                        <el-button class="add-all-buffs" size="small" type="primary" :disabled="!available(g).length" :aria-label="`添加${g.label}全部可用 BUFF`" @click="addAll(g)">{{ available(g).length ? `添加全部可用 BUFF（${available(g).length}）` : '无待添加的可用 BUFF' }}</el-button>
                    </div>
                    <article v-for="buff in orderedBuffs(g)" :key="buff.name" class="group-buff-row" :class="{ unavailable: !availability(buff,g).allowed, selected: selectedNames.includes(buff.name) }">
                        <div class="group-buff-heading"><strong>{{ buff.title }}</strong><el-tag :type="availability(buff,g).allowed ? 'info' : 'warning'" size="small">{{ availability(buff,g).label }}</el-tag>
                            <el-button size="small" type="primary" :disabled="!availability(buff,g).allowed" :aria-label="`${selectedNames.includes(buff.name) ? '再次添加' : '添加'}${buff.title}`" @click="add(buff,g)">{{ selectedNames.includes(buff.name) ? '再次添加' : '添加此 BUFF' }}</el-button>
                        </div>
                        <p v-if="buff.description" v-html="buff.description" />
                        <details v-if="manualFields(buff,g).length && availability(buff,g).allowed" class="group-buff-params"><summary>调整 BUFF 参数</summary>
                            <item-config :model-value="config(buff,g)" :item-name="buff.name" :configs="manualFields(buff,g)" @update:modelValue="v => setConfig(buff,g,v)" />
                        </details>
                    </article>
                </template>
            </el-collapse-item>
        </el-collapse>
        <el-empty v-if="!visibleGroups.length" description="没有匹配的角色或 BUFF" />
    </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { buffData } from '@/assets/buff'
import characters from '@/assets/_gen_character'
import {characterByElement} from '@/assets/character'
import elementIcons from '@/assets/element-icons'
import { useI18n } from '@/i18n/i18n'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { usePresetStore } from '@/store/pinia/preset'
import ItemConfig from '@/components/config/ItemConfig'
import rules from '@/algorithms/buff-groups/ownership.json'
import { groupCharacterBuffs, characterBuffProfile, buffAvailability, bindBuffConfig, isBoundBuffField, availableCharacterBuffs } from '@/algorithms/buff-groups/index.mjs'
const props = defineProps({ buffs: { type: Array, default: () => [] }, search: { type: String, default: '' }, preferredUid: String, selectedNames: { type: Array, default: () => [] } })
const emit = defineEmits(['select'])
const store = useMiyousheStore(), presets = usePresetStore(), { t, ta } = useI18n()
const uid = ref(''), expanded = ref(''), overrides = ref({}), configs = ref({})
const buffElement = ref('')
const elements = Object.keys(characterByElement)
const skills = { skill1: '普攻天赋', skill2: '战技天赋', skill3: '爆发天赋' }
watch(() => [props.preferredUid, store.selectedUid.value, store.uidGroups.value.map(g => g.uid).join(',')], () => {
    uid.value = props.preferredUid || store.selectedUid.value || ''
}, { immediate: true })
function key(character) { return `${uid.value}:${character}` }
function profile(character) { return { ...characterBuffProfile(character,uid.value,store.data.value.entries,presets.presets.value), ...overrides.value[key(character)] } }
function clearConfigs(character) { const prefix = key(character) + ':'; for (const k of Object.keys(configs.value)) if (k.startsWith(prefix)) delete configs.value[k] }
function setProfile(character, field, value) { if (value === '' || value == null) return; const number = Number(value); if (!Number.isInteger(number)) return; overrides.value[key(character)] = { ...overrides.value[key(character)], [field]: Math.min(field === 'constellation' ? 6 : 15, Math.max(field === 'constellation' ? 0 : 1, number)) } }
function reset(character) { delete overrides.value[key(character)]; clearConfigs(character) }
const groups = computed(() => groupCharacterBuffs(props.buffs,rules).filter(g => !buffElement.value || characters[g.character]?.element === buffElement.value).map(g => ({ ...g, element: characters[g.character]?.element || '', label: characters[g.character] ? ta(characters[g.character].nameLocale) : g.character === 'Traveler' ? '旅行者 · 通用' : '未分类角色效果', badge: g.buffs[0].badge })).sort((a,b) => Number(profile(b.character).imported)-Number(profile(a.character).imported) || a.label.localeCompare(b.label,'zh-CN')))
const visibleGroups = computed(() => {
    const query = props.search.trim().toLowerCase()
    return groups.value.filter(g => g.label.toLowerCase().includes(query) || g.buffs.some(b => b.title.toLowerCase().includes(query)))
})
function selectElement(value) { buffElement.value = value; expanded.value = '' }
function selectedCount(g) { return g.buffs.filter(b => props.selectedNames.includes(b.name)).length }
function availability(buff,g) { return buffAvailability(rules[buff.name],profile(g.character)) }
function orderedBuffs(g) {
    const currentProfile = profile(g.character)
    const unlocked = [], locked = []
    for (const buff of g.buffs) {
        const list = buffAvailability(rules[buff.name], currentProfile).allowed ? unlocked : locked
        list.push(buff)
    }
    return unlocked.concat(locked)
}
function config(buff,g) { return bindBuffConfig(buffData[buff.name],profile(g.character),configs.value[key(g.character)+':'+buff.name]) }
function manualFields(buff,g) { return buffData[buff.name].config.filter(c => !isBoundBuffField(buffData[buff.name],c.name)).map(c => buff.name === 'AlyoshaHunterPrecision' && c.name === 'stacks' ? { ...c, max: profile(g.character).constellation >= 6 ? 2 : 1 } : c) }
function setConfig(buff,g,value) { configs.value[key(g.character)+':'+buff.name] = value }
function add(buff,g) { if (availability(buff,g).allowed) emit('select',buff.name,{ config: JSON.parse(JSON.stringify(config(buff,g))), keepOpen: true }) }
function available(g) { return availableCharacterBuffs(g.buffs,rules,profile(g.character),props.selectedNames) }
function addAll(g) { for (const buff of available(g)) add(buff,g) }
</script>
<style scoped>
.group-filters { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 4px 0 12px; margin-bottom: 4px; background: var(--cx-card); border-bottom: 1px solid var(--cx-step-2); }
.character-element-tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
.character-element-tabs button { display: inline-flex; align-items: center; gap: 5px; flex: none; height: 32px; padding: 0 13px; border: 0; border-radius: 999px; background: var(--cx-step); color: var(--cx-dim); font: inherit; font-size: 13px; cursor: pointer; transition: background-color 140ms ease, color 140ms ease; }
.character-element-tabs button:hover { background: var(--cx-step-2); color: var(--cx-letter); }
.character-element-tabs button[aria-pressed=true] { background: var(--cx-gold); color: var(--cx-gold-on); font-weight: 600; }
.character-element-tabs button:focus-visible, .quick-add-btn:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.character-element-tabs img { width: 17px; height: 17px; object-fit: contain; }
.uid-select { width: 220px; flex-shrink: 0; }
.character-buff-groups :deep(.el-collapse) { border-top: 0; }
.character-buff-groups :deep(.el-collapse-item__header) { height: auto; min-height: 58px; padding: 0 6px; border-radius: 10px; transition: background-color 140ms ease; }
.character-buff-groups :deep(.el-collapse-item__header:hover) { background: var(--cx-step); }
.character-buff-groups :deep(.el-collapse-item__content) { padding: 8px 6px 14px; }
.character-group-title { --ele-color: var(--cx-step-2); display: flex; align-items: center; gap: 10px; min-width: 0; width: 100%; text-align: left; line-height: 1.5; padding: 6px 8px 6px 0; flex-wrap: wrap; }
.character-group-title[data-element="Pyro"] { --ele-color: #e26a4b; }
.character-group-title[data-element="Hydro"] { --ele-color: #3b9be8; }
.character-group-title[data-element="Anemo"] { --ele-color: #45b89a; }
.character-group-title[data-element="Electro"] { --ele-color: #9c6ade; }
.character-group-title[data-element="Dendro"] { --ele-color: #78b83a; }
.character-group-title[data-element="Cryo"] { --ele-color: #58b8d6; }
.character-group-title[data-element="Geo"] { --ele-color: #d4a63a; }
.element-accent { width: 3px; height: 28px; border-radius: 999px; background: var(--ele-color); flex-shrink: 0; }
.character-avatar { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: var(--cx-step-2); box-shadow: inset 0 0 0 1.5px var(--ele-color); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
.character-avatar img { width: 100%; height: 100%; object-fit: cover; }
.character-element-icon { width: 18px; height: 18px; object-fit: contain; flex-shrink: 0; }
.buff-count { color: var(--cx-dim); font-size: 12px; }
.saved-badge, .selected-badge { display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 1.6; }
.saved-badge { background: var(--cx-step-2); color: var(--cx-gold); }
.selected-badge { background: var(--cx-gold); color: var(--cx-gold-on); }
.character-group-actions { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
.quick-add-btn { height: 26px; padding: 0 10px; border: 1px solid var(--cx-step-2); border-radius: 8px; background: var(--cx-card); color: var(--cx-letter); font: inherit; font-size: 12px; cursor: pointer; opacity: 0; transition: opacity 140ms ease, border-color 140ms ease, color 140ms ease; }
.quick-add-btn:hover { border-color: var(--cx-gold); color: var(--cx-gold); }
.character-buff-groups :deep(.el-collapse-item__header:hover) .quick-add-btn,
.character-buff-groups :deep(.el-collapse-item__header:focus-within) .quick-add-btn { opacity: 1; }
.character-buff-profile { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; background: var(--cx-step); border: 1px solid var(--cx-step-2); padding: 12px 14px; border-radius: 10px; margin-bottom: 10px; }
.character-buff-profile label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--cx-dim); }
.character-buff-profile .el-input-number { width: 98px; }
.character-buff-profile .add-all-buffs { margin-left: auto; }
.group-buff-row { padding: 12px 14px; margin-bottom: 8px; border-radius: 10px; background: var(--cx-step); border: 1px solid var(--cx-step-2); transition: border-color 140ms ease; }
.group-buff-row:last-child { margin-bottom: 0; }
.group-buff-row:not(.unavailable):hover { border-color: var(--cx-gold); }
.group-buff-row.selected { border-left: 3px solid var(--cx-gold); }
.group-buff-row.unavailable { background: var(--cx-card); opacity: 0.65; }
.group-buff-heading { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.group-buff-heading .el-button { margin-left: auto; }
.group-buff-row p { margin: 8px 0 0; color: var(--cx-dim); font-size: 13px; line-height: 1.65; }
.group-buff-params { margin-top: 8px; }
.group-buff-params summary { cursor: pointer; color: var(--cx-gold); font-size: 13px; padding: 4px 0; }
.group-buff-params :deep(.config-root) { margin-top: 8px; }
@media (max-width: 600px) {
    .uid-select { width: 100%; }
    .quick-add-btn { opacity: 1; }
    .character-buff-profile label { flex: 1 1 42%; }
    .character-buff-profile .el-input-number { width: 100%; }
    .character-buff-profile .add-all-buffs { width: 100%; margin-left: 0; }
    .group-buff-heading strong { flex-basis: 100%; }
    .group-buff-heading .el-button { min-height: 36px; }
}
</style>

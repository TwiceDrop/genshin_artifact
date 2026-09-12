<template>
    <section class="character-buff-groups">
        <div class="group-filters">
            <el-select v-if="store.uidGroups.value.length" v-model="uid" aria-label="BUFF 来源 UID" placeholder="选择 UID">
                <el-option v-for="g in store.uidGroups.value" :key="g.uid" :value="g.uid" :label="`${g.nickname} · UID ${g.uid}`" />
            </el-select>
            <el-select v-model="focusedCharacter" filterable clearable placeholder="选择角色，展开对应 BUFF" aria-label="选择 BUFF 角色" @change="openCharacter">
                <el-option v-for="g in groups" :key="g.character" :value="g.character" :label="`${g.label} · ${g.buffs.length}项${profile(g.character).imported ? ' · 已保存角色' : ''}`" />
            </el-select>
        </div>
        <p class="group-note">展开角色后可逐条添加。命座、天赋优先读取所选 UID 的已保存角色；添加时使用这里的参数，不修改原角色数据。</p>
        <el-collapse v-model="expanded" accordion>
            <el-collapse-item v-for="g in visibleGroups" :key="g.character" :name="g.character">
                <template #title><div class="character-group-title"><img :src="g.badge" alt="" loading="lazy" /><strong>{{ g.label }}</strong><span>{{ g.buffs.length }}项 BUFF</span><el-tag v-if="profile(g.character).imported" size="small">{{ profile(g.character).constellation }}命 · 已保存</el-tag></div></template>
                <template v-if="expanded === g.character">
                    <div class="character-buff-profile">
                        <template v-if="g.character !== 'Traveler' && g.character !== 'Unmapped'">
                        <label>命座<el-input-number :model-value="profile(g.character).constellation" :min="0" :max="6" :aria-label="`${g.label}命座`" @update:modelValue="v => setProfile(g.character, 'constellation', v)" /></label>
                        <label v-for="(label,key) in skills" :key="key">{{ label }}<el-input-number :model-value="profile(g.character)[key]" :min="1" :max="15" :aria-label="`${g.label}${label}`" @update:modelValue="v => setProfile(g.character, key, v)" /></label>
                        <el-button @click="reset(g.character)">{{ profile(g.character).imported ? '恢复已保存数据' : '恢复默认值' }}</el-button>
                        </template>
                        <el-button class="add-all-buffs" type="primary" :disabled="!available(g).length" :aria-label="`添加${g.label}全部可用 BUFF`" @click="addAll(g)">{{ available(g).length ? `添加全部可用 BUFF（${available(g).length}）` : '无待添加的可用 BUFF' }}</el-button>
                    </div>
                    <p class="group-note">天赋使用游戏显示等级（含命座加成），手动改命座后请按需调整天赋。突破被动、队伍条件、层数及来源角色的面板数值请确认后添加。已有 BUFF 可在计算页调整。</p>
                    <article v-for="buff in g.buffs" :key="buff.name" class="group-buff-row" :class="{ unavailable: !availability(buff,g).allowed }">
                        <div class="group-buff-heading"><strong>{{ buff.title }}</strong><el-tag :type="availability(buff,g).allowed ? 'info' : 'warning'" size="small">{{ availability(buff,g).label }}</el-tag>
                            <el-button size="small" type="primary" :disabled="!availability(buff,g).allowed || selectedNames.includes(buff.name)" :aria-label="`${selectedNames.includes(buff.name) ? '已添加' : '添加'}${buff.title}`" @click="add(buff,g)">{{ selectedNames.includes(buff.name) ? '已添加' : '添加此 BUFF' }}</el-button>
                        </div>
                        <p v-html="buff.description" />
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
import { useI18n } from '@/i18n/i18n'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { usePresetStore } from '@/store/pinia/preset'
import ItemConfig from '@/components/config/ItemConfig'
import rules from '@/algorithms/buff-groups/ownership.json'
import { groupCharacterBuffs, characterBuffProfile, buffAvailability, bindBuffConfig, isBoundBuffField, availableCharacterBuffs } from '@/algorithms/buff-groups/index.mjs'
const props = defineProps({ buffs: { type: Array, default: () => [] }, search: { type: String, default: '' }, preferredUid: String, selectedNames: { type: Array, default: () => [] } })
const emit = defineEmits(['select'])
const store = useMiyousheStore(), presets = usePresetStore(), { ta } = useI18n()
const uid = ref(''), expanded = ref(''), focusedCharacter = ref(''), overrides = ref({}), configs = ref({})
const skills = { skill1: '普攻天赋', skill2: '战技天赋', skill3: '爆发天赋' }
watch(() => [props.preferredUid, store.selectedUid.value, store.uidGroups.value.map(g => g.uid).join(',')], () => {
    uid.value = props.preferredUid || store.selectedUid.value || ''
}, { immediate: true })
function key(character) { return `${uid.value}:${character}` }
function profile(character) { return { ...characterBuffProfile(character,uid.value,store.data.value.entries,presets.presets.value), ...overrides.value[key(character)] } }
function clearConfigs(character) { const prefix = key(character) + ':'; for (const k of Object.keys(configs.value)) if (k.startsWith(prefix)) delete configs.value[k] }
function setProfile(character, field, value) { if (value === '' || value == null) return; const number = Number(value); if (!Number.isInteger(number)) return; overrides.value[key(character)] = { ...overrides.value[key(character)], [field]: Math.min(field === 'constellation' ? 6 : 15, Math.max(field === 'constellation' ? 0 : 1, number)) } }
function reset(character) { delete overrides.value[key(character)]; clearConfigs(character) }
const groups = computed(() => groupCharacterBuffs(props.buffs,rules).map(g => ({ ...g, label: characters[g.character] ? ta(characters[g.character].nameLocale) : g.character === 'Traveler' ? '旅行者 · 通用' : '未分类角色效果', badge: g.buffs[0].badge })).sort((a,b) => Number(profile(b.character).imported)-Number(profile(a.character).imported) || a.label.localeCompare(b.label,'zh-CN')))
const visibleGroups = computed(() => groups.value.filter(g => (!focusedCharacter.value || focusedCharacter.value === g.character) && (!props.search || `${g.label} ${g.buffs.map(b => b.title+' '+b.description).join(' ')}`.toLowerCase().includes(props.search.toLowerCase()))))
function openCharacter(value) { expanded.value = value || '' }
function availability(buff,g) { return buffAvailability(rules[buff.name],profile(g.character)) }
function config(buff,g) { return bindBuffConfig(buffData[buff.name],profile(g.character),configs.value[key(g.character)+':'+buff.name]) }
function manualFields(buff,g) { return buffData[buff.name].config.filter(c => !isBoundBuffField(buffData[buff.name],c.name)).map(c => buff.name === 'AlyoshaHunterPrecision' && c.name === 'stacks' ? { ...c, max: profile(g.character).constellation >= 6 ? 2 : 1 } : c) }
function setConfig(buff,g,value) { configs.value[key(g.character)+':'+buff.name] = value }
function add(buff,g) { if (availability(buff,g).allowed) emit('select',buff.name,{ config: JSON.parse(JSON.stringify(config(buff,g))), keepOpen: true }) }
function available(g) { return availableCharacterBuffs(g.buffs,rules,profile(g.character),props.selectedNames) }
function addAll(g) { for (const buff of available(g)) add(buff,g) }
</script>
<style scoped>
.character-buff-profile .add-all-buffs{margin-left:auto;min-height:36px}@media(max-width:600px){.character-buff-profile .add-all-buffs{width:100%;margin-left:0}}
.group-filters{display:flex;gap:12px;flex-wrap:wrap}.group-filters>.el-select{flex:1;min-width:230px}.group-note{font-size:12px;color:#7b8492;line-height:1.7;margin:12px 0}.character-group-title{display:flex;align-items:center;gap:10px;min-width:0;width:100%;text-align:left;line-height:1.5;padding:6px 0;flex-wrap:wrap}.character-group-title img{width:40px;height:40px;object-fit:contain}.character-group-title>span{color:#8b94a2;font-size:12px}.character-buff-groups :deep(.el-collapse-item__header){height:auto;min-height:56px}.character-buff-profile{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;background:#f2f7ff;padding:14px;border-radius:8px}.character-buff-profile label{display:flex;flex-direction:column;gap:6px;font-size:12px}.character-buff-profile .el-input-number{width:130px}.group-buff-row{padding:16px 8px;border-bottom:1px solid #e8edf3}.group-buff-heading{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.group-buff-heading .el-button{margin-left:auto}.group-buff-row p{margin:8px 0;color:#6b7280;line-height:1.7}.group-buff-row.unavailable{background:#fafafa}.group-buff-params summary{cursor:pointer;color:#409eff;padding:8px 0}.group-buff-params :deep(.config-root){margin-top:8px}@media(max-width:600px){.group-filters>.el-select{width:100%;min-width:0;flex-basis:100%}.character-buff-profile label{flex:1 1 40%}.character-buff-profile .el-input-number{width:100%}.group-buff-heading strong{flex-basis:100%}.group-buff-heading .el-button{min-height:38px}}
</style>

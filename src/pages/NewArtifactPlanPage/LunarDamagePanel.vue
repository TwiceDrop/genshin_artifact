<template>
    <el-collapse v-model="opened" class="lunar-panel">
        <el-collapse-item name="lunar" title="星／月反应计算 · 手动面板">
            <p class="lunar-note">填写本次伤害实际享有的完整反应面板，点击计算后显示单次结果。这里的手填数值独立保存于当前页面，不参与圣遗物比较、收益曲线或自动配装。</p>
            <label class="mode-field">伤害类型
                <el-select v-model="mode" aria-label="月曜伤害类型">
                    <el-option value="team" label="月笼谐奏 · 多人月结晶" />
                    <el-option value="lunar-crystallize" label="角色技能 · 直伤月结晶" />
                    <el-option value="lunar-bloom" label="角色技能 · 直伤月绽放" />
                    <el-option value="lunar-electro" label="角色技能 · 直伤月感电" />
                    <el-option value="stellar-conduct" label="角色技能 · 直伤星超导" />
                </el-select>
            </label>
            <div class="lunar-fields shared-fields">
                <label>星／月反应基础伤害提升 Bbase（%）
                    <el-input-number v-model="baseBonus" :min="-100" :step="1" controls-position="right" aria-label="月曜基础伤害提升百分比" />
                </label>
                <label>{{ mode === 'stellar-conduct' ? (stellarElement === 'Cryo' ? '冰' : '雷') : mode === 'lunar-electro' ? '雷' : mode === 'lunar-bloom' ? '草' : '岩' }}元素抗性（%）
                    <el-input-number v-model="resistance" :step="5" controls-position="right" aria-label="敌人最终元素抗性百分比" />
                </label>
            </div>
            <el-checkbox v-if="mode !== 'stellar-conduct'" v-model="useRawResistance">抗性尚未扣除下方勾选 BUFF 的减抗（计算时扣除）</el-checkbox>
            <p class="lunar-note">未勾选时，抗性填写已扣除减抗后的数值。所有带 % 的输入按百分数填写，例如暴击伤害 150；G、I 按倍率填写，例如 1.2。</p>

            <template v-if="mode === 'team'">
                <p class="lunar-note">填写本次月笼记录到的 2～4 名水／岩反应参与者，须同时包含水和岩。每人独立判暴击后，按当次实际伤害排序，应用 60%／30%／5%／5% 权重。</p>
                <section v-for="(participant, index) in participants" :key="participant.key" class="participant-card">
                    <div class="card-heading">
                        <strong>参与者 {{ index + 1 }}</strong>
                        <el-button size="small" :disabled="participants.length <= 2" @click="removeParticipant(index)">移除</el-button>
                    </div>
                    <div class="lunar-fields">
                        <label>参与者名称（不可重复）<el-input v-model="participant.id" :aria-label="`参与者 ${index + 1} 名称`" /></label>
                        <label>参与反应的元素
                            <el-select v-model="participant.element" :aria-label="`参与者 ${index + 1} 元素`">
                                <el-option value="Hydro" label="水" /><el-option value="Geo" label="岩" />
                            </el-select>
                        </label>
                        <label v-for="field in participantFields" :key="field.key">{{ field.label }}
                            <el-input-number v-model="participant[field.key]" :min="field.min" :max="field.max" :step="field.step || 1" controls-position="right" :aria-label="`参与者 ${index + 1} ${field.label}`" />
                        </label>
                    </div>
                    <p class="lunar-note">90 级反应基础值默认 1446.8535；其他等级请填写对应值。</p>
                    <el-checkbox v-model="participant.confirmG" class="effect-confirm">确认 G 明确适用于本次反应型月结晶（G ≠ 1 时必选）</el-checkbox>
                    <el-checkbox v-model="participant.useCurrentBuffs">为此参与者应用当前角色选择的已适配月曜支持 BUFF</el-checkbox>
                    <el-button size="small" @click="copyPanel(participant)">读取当前普通面板的精通／双暴</el-button>
                </section>
                <el-button :disabled="participants.length >= 4" @click="addParticipant">添加参与者</el-button>
            </template>

            <section v-else class="participant-card">
                <div class="card-heading"><strong>这一段技能的伤害所有者</strong></div>
                <label v-if="mode === 'stellar-conduct'">星超导伤害元素 <el-select v-model="stellarElement"><el-option value="Cryo" label="冰" /><el-option value="Electro" label="雷" /></el-select></label>
                <label v-if="mode === 'stellar-conduct'">基础系数 K（未计入下方共鸣） <el-input-number v-model="stellarCoefficient" :min="0" :step="0.05" /></label>
                <div class="lunar-fields">
                    <label>角色名称<el-input v-model="direct.id" aria-label="直伤月曜伤害所有者" /></label>
                    <label>技能缩放的面板属性 A
                        <el-select v-model="scalingKind" aria-label="技能缩放属性">
                            <el-option value="atk" label="攻击力" /><el-option value="def" label="防御力" />
                            <el-option value="hp" label="生命值" /><el-option value="elemental_mastery" label="元素精通" />
                        </el-select>
                    </label>
                    <label v-for="field in visibleDirectFields" :key="field.key">{{ field.label }}
                        <el-input-number v-model="direct[field.key]" :min="field.min" :max="field.max" :step="field.step || 1" controls-position="right" :aria-label="`直伤月曜 ${field.label}`" />
                    </label>
                </div>
                <el-checkbox v-model="direct.confirmI" class="effect-confirm">确认 I 明确适用于这段{{ directName }}（I ≠ 1 时必选）</el-checkbox>
                <el-checkbox v-if="mode !== 'stellar-conduct'" v-model="direct.confirmG" class="effect-confirm">确认 G 明确适用于这段{{ directName }}（G ≠ 1 时必选）</el-checkbox>
                <el-checkbox v-model="direct.useCurrentBuffs">应用当前角色选择的已适配月曜支持 BUFF</el-checkbox>
                <el-button size="small" @click="copyPanel(direct, true)">读取当前普通面板</el-button>
                <p class="lunar-note">读取按钮复制当前角色的 {{ scalingLabels[scalingKind] }}、精通和双暴。随后请补齐只对这段月曜伤害生效的面板与增益；技能倍率 M 需手填，未自动读取。I、G 只放大本体分支，擢升同时放大本体和定额值。</p>
            </section>

            <p class="lunar-note">读取面板只复制普通属性。勾选后读取已适配来源的基础提升、反应增伤、双暴、定额、擢升与共鸣；来源 BUFF 的剩余层数代表本次命中条件，不会自动扣层；手填项不要重复计入这些 BUFF。未勾选时仍使用手填完整面板，不会随换装自动更新。普通元素增伤和敌人防御区不参与。攻击、防御、生命与精通输入应是普通 BUFF 生效后的面板。</p>
            <p v-if="notice" class="copy-notice" role="status">{{ notice }}</p>
            <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
            <div class="calculate-row"><el-button type="primary" @click="calculate">计算本次伤害</el-button><span v-if="!result" class="lunar-note">调整输入后请重新计算。</span></div>

            <section v-if="result" class="lunar-results" aria-live="polite">
                <div class="result-grid">
                    <div><span>{{ mode === 'team' ? '全员未暴击' : '非暴击伤害' }}</span><strong>{{ formatNumber(result.non_critical) }}</strong></div>
                    <div><span>{{ mode === 'team' ? '全员暴击' : '暴击伤害' }}</span><strong>{{ formatNumber(result.critical) }}</strong></div>
                    <div><span>{{ mode === 'team' ? '单次严格期望' : '单次期望伤害' }}</span><strong>{{ formatNumber(result.expectation) }}</strong></div>
                    <div v-if="mode === 'team'"><span>三次伤害总期望</span><strong>{{ formatNumber(result.three_hit_expectation) }}</strong></div>
                </div>
                <template v-if="mode === 'team'">
                    <p class="lunar-note">严格期望枚举每名角色各自的暴击状态，每个状态重新排序。三次总期望适用于三次均保持当前面板与增益的情况。</p>
                    <h4>各人的贡献伤害（加权前）</h4>
                    <el-table :data="result.participants" size="small">
                        <el-table-column prop="id" label="参与者" min-width="110" />
                        <el-table-column label="未暴击" min-width="100"><template #default="{ row }">{{ formatNumber(row.non_critical) }}</template></el-table-column>
                        <el-table-column label="暴击" min-width="100"><template #default="{ row }">{{ formatNumber(row.critical) }}</template></el-table-column>
                        <el-table-column label="个人期望" min-width="100"><template #default="{ row }">{{ formatNumber(row.expectation) }}</template></el-table-column>
                    </el-table>
                    <p class="lunar-note">个人期望用于查看各自面板；合成时按每次实际伤害排序，不能直接给此列套固定权重。</p>
                </template>
            </section>
        </el-collapse-item>
    </el-collapse>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { calculateDirectStellarConduct } from '../../../beta-data/direct-stellar-conduct.mjs'
import { calculateLunarCrystallizeTeam, calculateDirectLunarDamage } from '../../../beta-data/lunar-damage.mjs'

const props = defineProps({
    attribute: { type: Object, default: () => ({}) },
    character: { type: Object, default: () => ({}) },
    buffs: { type: Array, default: () => [] },
})
const opened = ref([])
const mode = ref('team')
const baseBonus = ref(0)
const resistance = ref(10)
const useRawResistance = ref(false)
const stellarElement = ref('Cryo')
const stellarCoefficient = ref(1)
const result = ref(null)
const error = ref('')
const notice = ref('')
const scalingKind = ref('atk')
const scalingLabels = { atk: '攻击力', def: '防御力', hp: '生命值', elemental_mastery: '元素精通' }
const directName = computed(() => ({'lunar-bloom':'直伤月绽放','lunar-crystallize':'直伤月结晶','lunar-electro':'直伤月感电','stellar-conduct':'直伤星超导'}[mode.value] || '月结晶'))
let nextParticipant = 1
function newParticipant(element = 'Hydro') {
    const key = nextParticipant++
    return { key, id: `参与者 ${key}`, element, levelBase: 1446.8535, em: 0, critRatePercent: 5,
        critDamagePercent: 50, lunarBonusPercent: 0, flatBonus: 0, elevationPercent: 0, multiplierG: 1, confirmG: false, useCurrentBuffs: false }
}
const participants = ref([newParticipant('Hydro'), newParticipant('Geo')])
const direct = ref({ id: props.character.name || '技能伤害所有者', scalingStat: 0, skillPercent: 100,
    em: 0, critRatePercent: 5, critDamagePercent: 50, lunarBonusPercent: 0, flatBonus: 0,
    elevationPercent: 0, multiplierI: 1, multiplierG: 1, confirmI: false, confirmG: false, useCurrentBuffs: false })
const commonFields = [
    { key: 'em', label: '本人元素精通 EM', min: 0 },
    { key: 'critRatePercent', label: '本人暴击率（%）', min: 0, max: 100 },
    { key: 'critDamagePercent', label: '本人暴击伤害（%）', min: 0 },
    { key: 'lunarBonusPercent', label: '当前星／月反应伤害提升（%）', min: -100 },
    { key: 'flatBonus', label: '定额提升 F', min: 0 },
    { key: 'elevationPercent', label: '擢升 E（%）', min: -100 },
    { key: 'multiplierG', label: '适用的特殊独立倍率 G', min: 0, step: 0.1 },
]
const participantFields = [{ key: 'levelBase', label: '等级反应基础值 L', min: 0 }, ...commonFields]
const directFields = [
    { key: 'scalingStat', label: '技能缩放属性 A 的最终数值', min: 0 },
    { key: 'skillPercent', label: '技能倍率 M（%）', min: 0 },
    ...commonFields,
    { key: 'multiplierI', label: '适用的技能独立倍率 I', min: 0, step: 0.1 },
]
const visibleDirectFields = computed(() => mode.value === 'stellar-conduct' ? directFields.filter(f => f.key !== 'multiplierG') : directFields)
function invalidate() { result.value = null; error.value = ''; notice.value = '' }
watch([mode, baseBonus, resistance, useRawResistance, participants, direct, scalingKind, stellarElement, stellarCoefficient, () => props.buffs], invalidate, { deep: true, flush: 'sync' })
watch(mode, () => { direct.value.confirmI = false; direct.value.confirmG = false })
function addParticipant() { if (participants.value.length < 4) participants.value.push(newParticipant()) }
function removeParticipant(index) { if (participants.value.length > 2) participants.value.splice(index, 1) }
function panelValue(key) {
    const entry = props.attribute[key]
    if (typeof entry === 'number' && Number.isFinite(entry)) return entry
    if (entry && typeof entry === 'object') {
        const values = Object.values(entry)
        if (values.every(value => typeof value === 'number' && Number.isFinite(value))) {
            return values.reduce((sum, value) => sum + value, 0)
        }
    }
    throw Error(`当前普通面板中没有可读取的 ${key}，请手动填写。`)
}
function copyPanel(target, isDirect = false) {
    try {
        const stats = { em: panelValue('elemental_mastery'), critRatePercent: Math.min(100, Math.max(0, panelValue('critical') * 100)),
            critDamagePercent: panelValue('critical_damage') * 100 }
        if (isDirect) stats.scalingStat = panelValue(scalingKind.value)
        Object.assign(target, stats)
        if (isDirect && props.character.name) target.id = props.character.name
        notice.value = `已读取当前角色 ${props.character.name || ''} 的普通面板。请确认本次反应享有的最终精通、双暴及专属增益；暴击率已限定在 0～100%。`
    } catch (cause) { error.value = cause.message || String(cause) }
}
function numeric(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw Error(`${label}需要填写有效数值。`)
    return value
}
function percent(value) { return typeof value === 'number' ? value / 100 : NaN }
function resistanceMultiplier(value) {
    const r = percent(value)
    if (!Number.isFinite(r)) throw Error('最终抗性需要填写有效数值。')
    return r < 0 ? 1 - r / 2 : r < 0.75 ? 1 - r : 1 / (4 * r + 1)
}
function ownerStats(value) {
    return { id: value.id.trim(), em: value.em, critRate: percent(value.critRatePercent), critDamage: percent(value.critDamagePercent) }
}
function effects(value, tag) {
    return { lunarBonus: percent(value.lunarBonusPercent), flatBonus: numeric(value.flatBonus, '定额提升'),
        elevation: percent(value.elevationPercent), lunarIndependentMultiplier: numeric(value.multiplierG, '特殊独立倍率 G'),
        lunarIndependentTags: value.confirmG ? [tag] : [] }
}
function calculate() {
    result.value = null
    error.value = ''
    try {
        const shared = { baseBonus: percent(baseBonus.value), ...(useRawResistance.value && mode.value !== 'stellar-conduct' ? {resistanceBeforeBuffs:percent(resistance.value)} : {resistanceMultiplier:resistanceMultiplier(resistance.value)}) }
        if (mode.value === 'team') {
            result.value = calculateLunarCrystallizeTeam({ ...shared, participants: participants.value.map(value => ({
                ...ownerStats(value), element: value.element, levelBase: value.levelBase,
                ...effects(value, 'reaction-lunar-crystallize'), buffs: value.useCurrentBuffs ? props.buffs : [],
            })) })
        } else if (mode.value === 'stellar-conduct') {
            const multiplier = numeric(direct.value.multiplierI, '星超导专属独立倍率')
            if (multiplier !== 1 && !direct.value.confirmI) throw Error('请确认该独立倍率明确适用于本段星超导。')
            result.value = calculateDirectStellarConduct({ ...shared, element: stellarElement.value, owner: ownerStats(direct.value),
                scalingStat: numeric(direct.value.scalingStat, '面板'), skillMultiplier: percent(direct.value.skillPercent),
                baseMultiplier: numeric(stellarCoefficient.value, '极星系数'), reactionBonus: percent(direct.value.lunarBonusPercent),
                independentMultiplier: multiplier, flatBonus: numeric(direct.value.flatBonus, '定额'), elevation: percent(direct.value.elevationPercent),
                buffs: direct.value.useCurrentBuffs ? props.buffs : [] })
        } else {
            const tag = `direct-${mode.value}`
            result.value = calculateDirectLunarDamage({ ...shared, kind: mode.value, owner: ownerStats(direct.value),
                scalingStat: direct.value.scalingStat, skillMultiplier: percent(direct.value.skillPercent),
                ...effects(direct.value, tag), skillIndependentMultiplier: numeric(direct.value.multiplierI, '技能独立倍率 I'),
                skillIndependentTags: direct.value.confirmI ? [tag] : [], buffs: direct.value.useCurrentBuffs ? props.buffs : [],
            })
        }
    } catch (cause) { error.value = cause.message || String(cause) }
}
const formatNumber = value => Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—'
</script>

<style scoped>
.lunar-panel { margin-top: 24px; }
.lunar-note { margin: 10px 0; color: #606266; font-size: 12px; line-height: 1.7; }
.mode-field { display: grid; gap: 6px; max-width: 360px; }
.lunar-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 12px 0; }
.lunar-fields label { min-width: 0; display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: #303133; }
.lunar-fields :deep(.el-input-number), .lunar-fields :deep(.el-select), .mode-field :deep(.el-select) { width: 100%; }
.participant-card { border: 1px solid #dcdfe6; border-radius: 6px; padding: 12px; margin: 12px 0; }
.card-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.effect-confirm { display: flex; height: auto; margin: 10px 0; white-space: normal; }
.effect-confirm :deep(.el-checkbox__label) { white-space: normal; line-height: 1.5; }
.calculate-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
.copy-notice { color: #267145; font-size: 12px; line-height: 1.7; }
.result-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 12px; }
.result-grid > div { display: flex; flex-direction: column; padding: 12px; background: #f5f7fa; border-radius: 6px; }
.result-grid span { color: #606266; font-size: 12px; }
.result-grid strong { color: #303133; font-size: 18px; margin-top: 6px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.lunar-results h4 { margin: 16px 0 8px; }
@media (max-width: 430px) { .lunar-fields { grid-template-columns: 1fr; } .participant-card { padding: 10px; } }
</style>


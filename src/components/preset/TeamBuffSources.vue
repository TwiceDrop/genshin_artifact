<template>
    <div class="team-context-control" :class="{ 'team-context-migrated': shadcn }">
        <h3 class="common-title2">队友来源（可选）</h3>
        <TeamPresetSelect v-if="shadcn" v-model="selectedTeamPresetNames" label="选择已保存的队友预设"
            :options="teamPresetOptions" :selected="selectedTeamPresetOptions" />
        <el-select v-else v-model="selectedTeamPresetNames" multiple filterable clearable
            placeholder="选择已保存的队友预设" style="width:100%">
            <el-option v-for="entry in teamPresetOptions" :key="entry.value" :label="entry.label" :value="entry.value" />
        </el-select>
        <template v-if="teamContextSources.length">
            <div class="team-context-row">
                <span>受益伤害模式</span>
                <UiSegmentedControl v-if="shadcn" :model-value="String(teamContextStellarMode)" label="受益伤害模式"
                    :options="damageModes" @update:model-value="teamContextStellarMode = $event === 'true'" />
                <el-radio-group v-else v-model="teamContextStellarMode" size="small">
                    <el-radio-button :label="false">普通伤害</el-radio-button>
                    <el-radio-button :label="true">星扩散</el-radio-button>
                </el-radio-group>
            </div>
            <div v-for="source in teamContextSources" :key="source.presetName" class="team-source-card">
                <strong>{{ presetStore.displayName(source.presetName) }} · {{ teamCharacterLabel(presetStore.presets.value[source.presetName]?.item.character.name) }}</strong>
                <span class="team-source-gear">{{ teamSourceGearLabel(source.presetName) }}</span>
                <label class="team-source-id">来源 ID
                    <UiInput v-if="shadcn" v-model="source.sourceId" aria-label="BUFF 来源 ID" />
                    <el-input v-else v-model="source.sourceId" size="small" aria-label="BUFF 来源 ID" />
                </label>
                <TeamTriggerSwitch v-model="source.triggers.recipientOnField" label="受益角色在前台" :shadcn="shadcn" />
                <template v-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Vodyanitsa'">
                    <div class="team-trigger-grid">
                        <TeamTriggerSwitch v-model="source.triggers.eActive" label="战技命中" :shadcn="shadcn" />
                        <TeamTriggerSwitch v-model="source.triggers.songActive" label="歌声状态" :shadcn="shadcn" />
                        <TeamTriggerSwitch v-model="source.triggers.a1Active" label="流荡风旋已触发" :shadcn="shadcn" />
                        <TeamTriggerSwitch v-model="source.triggers.a4Active" label="领唱／重唱已触发" :shadcn="shadcn" />
                        <TeamTriggerSwitch v-if="presetStore.presets.value[source.presetName]?.item.character.constellation >= 1"
                            v-model="source.triggers.c1Active" label="一命条件" :shadcn="shadcn" />
                        <TeamTriggerSwitch v-if="presetStore.presets.value[source.presetName]?.item.character.constellation >= 2"
                            v-model="source.triggers.c2Active" label="二命角笛命中" :shadcn="shadcn" />
                    </div>
                    <div v-if="presetStore.presets.value[source.presetName]?.item.weapon.name === 'HymnOfTheMaelstrom'" class="team-context-row">
                        <span>专武层数</span>
                        <component :is="shadcn ? UiNumberInput : ElInputNumber" v-model="source.triggers.signatureStacks"
                            :min="0" :max="3" v-bind="countAttrs" aria-label="专武层数" />
                        <TeamTriggerSwitch v-model="source.triggers.signatureBoosted" label="强化状态" :shadcn="shadcn" />
                        <TeamTriggerSwitch v-model="source.triggers.signatureOnField" label="专武对当前角色生效" :shadcn="shadcn" />
                    </div>
                </template>
                <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Vesna'">
                    <div class="team-trigger-grid">
                        <TeamTriggerSwitch v-model="source.triggers.vesnaRadiance" label="辉映已触发" :shadcn="shadcn" />
                        <TeamTriggerSwitch v-model="source.triggers.vesnaTalentActive" label="队友星耀祝礼已触发" :shadcn="shadcn" />
                    </div>
                    <div class="team-context-row">
                        <span>星耀祝礼平均覆盖率</span>
                        <component :is="shadcn ? UiNumberInput : ElInputNumber" v-model="source.triggers.vesnaTalentCoverage"
                            :min="0" :max="1" :step="0.1" :precision="2" :size="shadcn ? undefined : 'small'" aria-label="星耀祝礼平均覆盖率" />
                    </div>
                </template>
                <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Odette'">
                    <div class="team-context-row">
                        <span>奥黛塔辉映</span>
                        <UiSelect v-if="shadcn" :model-value="source.triggers.odetteRadianceMode?.toString()" label="奥黛塔辉映"
                            :options="radianceModes" @update:model-value="source.triggers.odetteRadianceMode = Number($event)" />
                        <el-select v-else v-model="source.triggers.odetteRadianceMode" size="small">
                            <el-option :value="0" label="未触发" /><el-option :value="1" label="星超导" /><el-option :value="2" label="星扩散" />
                        </el-select>
                        <TeamTriggerSwitch v-model="source.triggers.odetteBlessing" label="星耀祝礼生效" :shadcn="shadcn" />
                    </div>
                    <div class="team-context-row">
                        <TeamTriggerSwitch v-model="source.triggers.odetteSplendor" label="受益角色已获得华彩" :shadcn="shadcn" />
                        <span>受益华彩层数</span>
                        <component :is="shadcn ? UiNumberInput : ElInputNumber" v-model="source.triggers.odetteStacks"
                            :min="0" :max="presetStore.presets.value[source.presetName]?.item.character.constellation >= 1 ? 6 : 4"
                            v-bind="countAttrs" aria-label="受益华彩层数" />
                    </div>
                    <TeamTriggerSwitch v-model="source.triggers.odetteDouble" label="独舞倒影在场（二命）" :shadcn="shadcn" />
                    <TeamTriggerSwitch v-model="source.triggers.odetteDream" label="雪鹄之梦已触发（四命）" :shadcn="shadcn" />
                </template>
                <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Qiqi'">
                    <TeamTriggerSwitch v-model="source.triggers.qiqiTalisman" label="辉映·星烁：度厄真符条件已触发" :shadcn="shadcn" />
                    <TeamTriggerSwitch v-model="source.triggers.qiqiC6" label="六命增益已触发" :shadcn="shadcn" />
                </template>
                <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Sandrone'">
                    <TeamTriggerSwitch v-model="source.triggers.sandroneBlessing" label="星耀祝礼·星扩散已触发" :shadcn="shadcn" />
                    <TeamTriggerSwitch v-model="source.triggers.sandroneC1" label="一命队友星扩散增益已触发" :shadcn="shadcn" />
                </template>
            </div>
            <template v-if="shadcn">
                <UiAlert v-for="issue in issues" :key="issue" class="team-issue" tone="error">{{ issue }}</UiAlert>
            </template>
            <template v-else>
                <el-alert v-for="issue in issues" :key="issue" type="error" :closable="false" :title="issue" />
            </template>
        </template>
    </div>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {ElInputNumber} from 'element-plus'
import {usePresetStore} from '@/store/pinia/preset'
import {useArtifactStore} from '@/store/pinia/artifact'
import {createTeamContextSource} from '@/algorithms/single-team-context.mjs'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiNumberInput from '@/components/ui/UiNumberInput.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import TeamTriggerSwitch from './TeamTriggerSwitch.vue'
import TeamPresetSelect from './TeamPresetSelect.vue'
import type {ITeamContextSource} from '@/types/preset'
const props = withDefaults(defineProps<{modelValue: ITeamContextSource[], stellarMode: boolean, character: string, presetName?: string | null, issues?: string[], shadcn?: boolean}>(), {issues: () => []})
const emit = defineEmits(['update:modelValue', 'update:stellarMode'])
const presetStore = usePresetStore(), artifactStore = useArtifactStore()
const countAttrs = computed(() => props.shadcn ? { step: 1, precision: 0 } : { size: 'small' })
const damageModes = [
    { value: 'false', label: '普通伤害' },
    { value: 'true', label: '星扩散' },
]
const radianceModes = [
    { value: '0', label: '未触发' },
    { value: '1', label: '星超导' },
    { value: '2', label: '星扩散' },
]
const teamContextSources = computed({get: () => props.modelValue, set: value => emit('update:modelValue', value)})
const teamContextStellarMode = computed({get: () => props.stellarMode, set: value => emit('update:stellarMode', value)})
const availableTeamPresets = computed(() => presetStore.allFlat.value.filter(entry =>
    ['Vodyanitsa', 'Vesna', 'Odette', 'Qiqi', 'Sandrone'].includes(entry.item?.character?.name)
    && entry.item.character.name !== props.character
    && entry.name !== props.presetName))
const selectedTeamPresetNames = computed<string[]>({
    get: () => teamContextSources.value.map(source => source.presetName),
    set: names => {
        teamContextSources.value = names.map(name => teamContextSources.value.find(source => source.presetName === name)
            || createTeamContextSource(name, presetStore.presets.value[name]))
    },
})
const teamPresetOptions = computed(() => availableTeamPresets.value.map(entry => ({
    value: entry.name,
    label: `${presetStore.displayName(entry.name)} · ${teamCharacterLabel(entry.item.character.name)}`,
})))
const selectedTeamPresetOptions = computed(() => selectedTeamPresetNames.value.map(value => (
    teamPresetOptions.value.find(option => option.value === value) ?? { value, label: presetStore.displayName(value) }
)))
function teamCharacterLabel(name?: string) {
    return ({Vodyanitsa:'沃雅妮莎',Vesna:'薇斯纳',Odette:'奥黛塔',Qiqi:'七七',Sandrone:'桑多涅'} as Record<string,string>)[name || ''] || '未知角色'
}
function teamSourceGearLabel(name: string) {
    const ids = presetStore.presets.value[name]?.item.artifactIds
    if (!Array.isArray(ids)) return '未保存当前装备'
    return `当前装备 ${ids.filter(id => id >= 0 && !!artifactStore.getArtifact(id)).length}/5 件`
}
</script>
<style scoped>
.team-context-migrated .team-source-card { border-radius: 8px; }
.team-context-migrated .team-source-card > strong { overflow-wrap: anywhere; }
.team-context-migrated .team-source-id :deep(input) { flex: 1; }
.team-issue { margin-top: 8px; }
.team-context-control{padding:12px;margin:0 0 14px;border:1px solid var(--cx-step-2);border-radius:6px;background:var(--cx-card)}.team-context-control :deep(.el-alert){margin-top:8px}.team-source-card{display:flex;flex-direction:column;gap:9px;padding:12px;margin-top:10px;border:1px solid var(--cx-step-2);border-radius:6px;background:var(--cx-card);font-size:13px}.team-source-gear{color:var(--cx-dim);font-size:12px}.team-source-id{display:flex;align-items:center;gap:10px}.team-source-id :deep(.el-input){flex:1}.team-trigger-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.team-context-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:13px}
@media(max-width:600px){.team-trigger-grid{grid-template-columns:1fr}}
</style>

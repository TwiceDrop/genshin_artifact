<template>
                            <div class="team-context-control">
                                <h3 class="common-title2">队友来源（可选）</h3>
                                <el-select v-model="selectedTeamPresetNames" multiple filterable clearable
                                    placeholder="选择已保存的队友预设" style="width:100%">
                                    <el-option v-for="entry in availableTeamPresets" :key="entry.name"
                                        :label="`${entry.name} · ${teamCharacterLabel(entry.item.character.name)}`"
                                        :value="entry.name" />
                                </el-select>
                                <template v-if="teamContextSources.length">
                                    <div class="team-context-row">
                                        <span>受益伤害模式</span>
                                        <el-radio-group v-model="teamContextStellarMode" size="small">
                                            <el-radio-button :label="false">普通伤害</el-radio-button>
                                            <el-radio-button :label="true">星扩散</el-radio-button>
                                        </el-radio-group>
                                    </div>
                                    <div v-for="source in teamContextSources" :key="source.presetName" class="team-source-card">
                                        <strong>{{ source.presetName }} · {{ teamCharacterLabel(presetStore.presets.value[source.presetName]?.item.character.name) }}</strong>
                                        <span class="team-source-gear">{{ teamSourceGearLabel(source.presetName) }}</span>
                                        <label class="team-source-id">来源 ID
                                            <el-input v-model="source.sourceId" size="small" aria-label="BUFF 来源 ID" />
                                        </label>
                                        <el-switch v-model="source.triggers.recipientOnField" active-text="受益角色在前台" />
                                        <template v-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Vodyanitsa'">
                                            <div class="team-trigger-grid">
                                                <el-switch v-model="source.triggers.eActive" active-text="战技命中" />
                                                <el-switch v-model="source.triggers.songActive" active-text="歌声状态" />
                                                <el-switch v-model="source.triggers.a1Active" active-text="流荡风旋已触发" />
                                                <el-switch v-model="source.triggers.a4Active" active-text="领唱／重唱已触发" />
                                                <el-switch v-if="presetStore.presets.value[source.presetName]?.item.character.constellation >= 1"
                                                    v-model="source.triggers.c1Active" active-text="一命条件" />
                                                <el-switch v-if="presetStore.presets.value[source.presetName]?.item.character.constellation >= 2"
                                                    v-model="source.triggers.c2Active" active-text="二命角笛命中" />
                                            </div>
                                            <div v-if="presetStore.presets.value[source.presetName]?.item.weapon.name === 'HymnOfTheMaelstrom'" class="team-context-row">
                                                <span>专武层数</span>
                                                <el-input-number v-model="source.triggers.signatureStacks" :min="0" :max="3" size="small" />
                                                <el-switch v-model="source.triggers.signatureBoosted" active-text="强化状态" />
                                                <el-switch v-model="source.triggers.signatureOnField" active-text="专武对当前角色生效" />
                                            </div>
                                        </template>
                                        <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Vesna'">
                                            <div class="team-trigger-grid">
                                                <el-switch v-model="source.triggers.vesnaRadiance" active-text="辉映已触发" />
                                                <el-switch v-model="source.triggers.vesnaTalentActive" active-text="队友星耀祝礼已触发" />
                                            </div>
                                            <div class="team-context-row">
                                                <span>星耀祝礼平均覆盖率</span>
                                                <el-input-number v-model="source.triggers.vesnaTalentCoverage" :min="0" :max="1" :step="0.1" :precision="2" size="small" />
                                            </div>
                                        </template>
                                        <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Odette'">
                                            <div class="team-context-row">
                                                <span>奥黛塔辉映</span>
                                                <el-select v-model="source.triggers.odetteRadianceMode" size="small">
                                                    <el-option :value="0" label="未触发" /><el-option :value="1" label="星超导" /><el-option :value="2" label="星扩散" />
                                                </el-select>
                                                <el-switch v-model="source.triggers.odetteBlessing" active-text="星耀祝礼生效" />
                                            </div>
                                            <div class="team-context-row">
                                                <el-switch v-model="source.triggers.odetteSplendor" active-text="受益角色已获得华彩" />
                                                <span>受益华彩层数</span><el-input-number v-model="source.triggers.odetteStacks" :min="0" :max="presetStore.presets.value[source.presetName]?.item.character.constellation >= 1 ? 6 : 4" size="small" />
                                            </div>
                                            <el-switch v-model="source.triggers.odetteDouble" active-text="独舞倒影在场（二命）" />
                                            <el-switch v-model="source.triggers.odetteDream" active-text="雪鹄之梦已触发（四命）" />
                                        </template>
                                        <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Qiqi'">
                                            <el-switch v-model="source.triggers.qiqiTalisman" active-text="辉映·星烁：度厄真符条件已触发" />
                                            <el-switch v-model="source.triggers.qiqiC6" active-text="六命增益已触发" />
                                        </template>
                                        <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Sandrone'">
                                            <el-switch v-model="source.triggers.sandroneBlessing" active-text="星耀祝礼·星扩散已触发" />
                                            <el-switch v-model="source.triggers.sandroneC1" active-text="一命队友星扩散增益已触发" />
                                        </template>
                                    </div>
                                    <el-alert v-for="issue in issues" :key="issue" type="error" :closable="false" :title="issue" />
                                </template>
                            </div>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import {usePresetStore} from '@/store/pinia/preset'
import {useArtifactStore} from '@/store/pinia/artifact'
import {createTeamContextSource} from '@/algorithms/single-team-context.mjs'
import type {ITeamContextSource} from '@/types/preset'
const props = withDefaults(defineProps<{modelValue: ITeamContextSource[], stellarMode: boolean, character: string, presetName?: string | null, issues?: string[]}>(), {issues: () => []})
const emit = defineEmits(['update:modelValue', 'update:stellarMode'])
const presetStore = usePresetStore(), artifactStore = useArtifactStore()
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
.team-context-control{padding:12px;margin:0 0 14px;border:1px solid #e4e7ed;border-radius:6px;background:#f8faff}.team-context-control :deep(.el-alert){margin-top:8px}.team-source-card{display:flex;flex-direction:column;gap:9px;padding:12px;margin-top:10px;border:1px solid #e0e7f0;border-radius:6px;background:white;font-size:13px}.team-source-gear{color:#667085;font-size:12px}.team-source-id{display:flex;align-items:center;gap:10px}.team-source-id :deep(.el-input){flex:1}.team-trigger-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.team-context-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:13px}
@media(max-width:600px){.team-trigger-grid{grid-template-columns:1fr}}
</style>

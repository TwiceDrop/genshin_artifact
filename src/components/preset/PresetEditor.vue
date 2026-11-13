<template>
    <el-dialog :model-value="true" :title="creating ? '新建自定义预设' : '编辑角色预设'"
        width="min(960px, 96vw)" @update:model-value="value => { if (!value) $emit('close') }" :close-on-click-modal="false">
        <div class="preset-editor">
            <label class="preset-name"><span>预设名称</span><el-input v-model="name" :disabled="!creating" aria-label="预设名称" /></label>
            <el-tabs v-model="tab">
                <el-tab-pane :label="t('misc.character')" name="character">
                    <div class="form-grid">
                        <label><span>{{ t('misc.character') }}</span><select-character v-if="!gameIdentity" v-model="c.characterName" /><el-input v-else :model-value="c.characterLocale" disabled /></label>
                        <label><span>角色等级</span><select-character-level v-model="c.characterLevel" /></label>
                        <label><span>{{ t('misc.conste') }}</span><el-input-number v-model="c.characterConstellation" :min="0" :max="6" /></label>
                        <label><span>{{ t('skillType.a') }}</span><el-input-number v-model="c.characterSkill1" :min="1" :max="15" /></label>
                        <label><span>{{ t('skillType.e') }}</span><el-input-number v-model="c.characterSkill2" :min="1" :max="15" /></label>
                        <label><span>{{ t('skillType.q') }}</span><el-input-number v-model="c.characterSkill3" :min="1" :max="15" /></label>
                    </div>
                    <item-config v-if="c.characterNeedConfig" v-model="c.characterConfig" :item-name="c.characterName" :configs="c.characterConfigConfig" />
                </el-tab-pane>
                <el-tab-pane :label="t('misc.weapon')" name="weapon">
                    <div class="form-grid">
                        <label><span>{{ t('misc.weapon') }}</span><select-weapon v-model="w.weaponName" :type="c.characterWeaponType" /></label>
                        <label><span>武器等级</span><select-weapon-level v-model="w.weaponLevel" /></label>
                        <label><span>{{ t('misc.refine') }}</span><el-input-number v-model="w.weaponRefine" :min="1" :max="w.weaponMaxRefine" /></label>
                    </div>
                    <item-config v-if="w.weaponNeedConfig" v-model="w.weaponConfig" :item-name="w.weaponName" :configs="w.weaponConfigConfig" />
                </el-tab-pane>
                <el-tab-pane :label="t('misc.artifact')" name="artifacts">
                    <div class="preset-artifacts">
                        <div v-for="(position, i) in positions" :key="position">
                            <strong>{{ t('misc', position) }}</strong>
                            <artifact-display v-if="a.artifactItems[i]" :item="a.artifactItems[i]" selectable :buttons="true"
                                :delete-button="true" :lock-button="false" @delete="a.removeArtifact(i)" @click="selectSlot = i" />
                            <el-button @click="selectSlot = i">{{ t('calcPage.selectArt') }}</el-button>
                        </div>
                    </div>
                    <item-config v-if="a.artifactNeedConfig2" v-model="a.artifactSingleConfig" :item-name="a.artifactConfigItemName" :configs="a.artifactConfig2Configs" />
                    <item-config v-if="a.artifactNeedConfig4" v-model="a.artifactSingleConfig" :item-name="a.artifactConfigItemName" :configs="a.artifactConfig4Configs" />
                </el-tab-pane>
                <el-tab-pane label="BUFF" name="buffs">
                    <el-button @click="showBuffs = true">添加BUFF</el-button>
                    <div class="polestar-controls">
                        <el-switch v-model="b.polestarEnabled" active-text="启用极星辉域" />
                        <label><span>极星辉域层数</span><el-input-number :key="String(b.polestarEnabled)" v-model="b.polestarStacks" :min="0" :max="12" :disabled="!b.polestarEnabled" /></label>
                    </div>
                    <selected-buff-groups :buffs="otherBuffs">
                        <template #character-controls>
                            <team-buff-sources v-model="teamContext" v-model:stellar-mode="stellarMode" :character="c.characterName" :preset-name="creating ? null : presetName" />
                        </template>
                        <template #default="{buff}">
                            <buff-item :buff="buff" v-model:buffConfig="buff.config" @delete="b.deleteBuff(buff.id)" @toggle="b.toggleBuff(buff.id)" />
                            <label v-if="teamContext.length" class="manual-buff-source">手动 BUFF 来源
                                <el-select v-model="buff.source_id" clearable placeholder="未关联队友" size="small">
                                    <el-option v-for="source in teamContext" :key="source.sourceId" :label="source.presetName" :value="source.sourceId" />
                                </el-select>
                            </label>
                        </template>
                    </selected-buff-groups>
                </el-tab-pane>
                <el-tab-pane :label="t('calcPage.dmg')" name="damage">
                    <div class="form-grid">
                        <label><span>{{ t('calcPage.skill') }}</span><select-character-skill v-model="s.characterSkillIndex" :character-name="c.characterName" /></label>
                        <label><span>{{ t('calcPage.fumo') }}</span><select-element-type v-model="infusion" :elements="['Pyro', 'Electro', 'Hydro', 'Anemo', 'Geo', 'Cryo', 'Dendro', 'None']" /></label>
                    </div>
                    <item-config v-if="s.characterNeedSkillConfig" v-model="s.characterSkillConfig" :item-name="c.characterName" :configs="s.characterSkillConfigConfig" />
                    <h3>{{ t('calcPage.setupEnemy') }}</h3>
                    <enemy-config v-model="enemy" />
                </el-tab-pane>
            </el-tabs>
        </div>
        <template #footer>
            <el-button v-if="!creating" @click="creating = true; name = ''">另存为自定义</el-button>
            <el-button @click="$emit('close')">{{ t('misc.cancel') }}</el-button>
            <el-button type="primary" @click="save">保存</el-button>
        </template>
        <el-dialog :model-value="selectSlot !== null" :title="t('calcPage.selectArt')" width="min(1000px, 96vw)"
            append-to-body destroy-on-close @update:model-value="value => { if (!value) selectSlot = null }">
            <select-artifact v-if="selectSlot !== null" :position="positions[selectSlot]" @select="handleSelectArtifact" />
        </el-dialog>
        <el-dialog v-model="showBuffs" :title="t('calcPage.selectBuff')" width="min(800px, 96vw)" append-to-body destroy-on-close>
            <select-buff v-if="showBuffs" :preferred-uid="game.selectedUid.value" :selected-names="b.buffs.map(buff => buff.name)" @select="handleSelectBuff" />
        </el-dialog>
    </el-dialog>
</template>

<script setup lang="ts">
import {computed, reactive, ref, watch} from 'vue'
import {ElMessage} from 'element-plus'
import {usePresetStore} from '@/store/pinia/preset'
import {useMiyousheStore} from '@/store/pinia/miyoushe'
import {useCharacter, useCharacterSkill} from '@/composables/character'
import {useCharacterWeapon} from '@/composables/weapon'
import {useBuff} from '@/composables/buff'
import {use5Artifacts} from '@/composables/artifact'
import {useTargetFunction} from '@/composables/targetFunction'
import {useComputeConstraint} from '@/composables/constraint'
import {newDefaultArtifactConfigForWasm} from '@/utils/artifacts'
import {newPanelSearchOptions} from '../../../beta-data/panel-search.mjs'
import {applyPresetIdentity, restorePresetConfiguration} from '@/utils/preset-view'
import {snapshotPreset} from '@/utils/preset-workflow.mjs'
import {recordUsage} from '@/usage-stats/index.mjs'
import {useI18n} from '@/i18n/i18n'
import type {IPreset} from '@/types/preset'
import SelectCharacter from '@/components/select/SelectCharacter.vue'
import SelectCharacterLevel from '@/components/select/SelectCharacterLevel.vue'
import SelectWeapon from '@/components/select/SelectWeapon.vue'
import SelectWeaponLevel from '@/components/select/SelectWeaponLevel.vue'
import SelectCharacterSkill from '@/components/select/SelectCharacterSkill.vue'
import SelectElementType from '@/components/select/SelectElementType.vue'
import SelectArtifact from '@/components/select/SelectArtifact.vue'
import SelectBuff from '@/components/select/SelectBuff.vue'
import ItemConfig from '@/components/config/ItemConfig.vue'
import ArtifactDisplay from '@/components/display/ArtifactDisplay.vue'
import SelectedBuffGroups from '@/components/display/SelectedBuffGroups.vue'
import BuffItem from '@/pages/NewArtifactPlanPage/BuffItem.vue'
import EnemyConfig from '@/pages/NewArtifactPlanPage/EnemyConfig.vue'
import TeamBuffSources from './TeamBuffSources.vue'

const props = defineProps<{presetName?: string}>()
const emit = defineEmits(['close', 'saved'])
const store = usePresetStore(), game = useMiyousheStore(), {t} = useI18n()
const character = useCharacter(), weapon = useCharacterWeapon(character.characterName, character.characterWeaponType)
const skill = useCharacterSkill(character.characterName), target = useTargetFunction(character.characterName)
const c = reactive(character), w = reactive(weapon), s = reactive(skill)
const a = reactive(use5Artifacts()), b = reactive(useBuff())
const constraints = useComputeConstraint()
const name = ref(props.presetName || ''), creating = ref(!props.presetName), tab = ref('character')
const selectSlot = ref<number | null>(null), showBuffs = ref(false)
const positions = ['flower', 'feather', 'sand', 'cup', 'head']

const original = props.presetName ? store.getPreset(props.presetName)!.item : {
    name: '', character: c.characterInterface, weapon: w.weaponInterface,
    targetFunction: target.targetFunctionInterface.value, buffs: [], artifactIds: [-1, -1, -1, -1, -1],
    constraint: constraints.presetConstraint.value, filter: constraints.presetFilter.value,
    algorithm: constraints.algorithm.value, artifactEffectMode: 'auto', artifactConfig: newDefaultArtifactConfigForWasm(),
    useDSL: false, targetMode: 'normal', optimizationMode: 'damage', panelSearch: newPanelSearchOptions(),
    dslGenerator: {character: c.characterName, entries: []}, dslSource: '',
} as IPreset
const base = restorePresetConfiguration(original)
applyPresetIdentity(base, character, weapon)
target.targetFunctionName.value = base.targetFunction.name
target.targetFunctionConfig.value = base.targetFunction.params
target.targetFunctionUseDSL.value = !!base.useDSL
target.targetFunctionDSLSource.value = base.dslSource || ''
a.artifactIds = base.artifactIds || [-1, -1, -1, -1, -1]
a.artifactSingleConfig = base.singleConfig
b.buffs = (base.buffs || []).map((buff, id) => ({...buff, id}))
s.characterSkillIndex = base.skill!.index
s.characterSkillConfig = base.skill!.config
const enemy = ref(base.enemy!), infusion = ref(base.infusion!)
const teamContext = ref(base.teamContext || []), stellarMode = ref(base.teamContextStellarMode === true)
const gameIdentity = computed(() => !!original.miyousheKey && !creating.value)
const otherBuffs = computed(() => b.buffs.filter(buff => buff.name !== 'ResonancePolestarField'))
watch(character.characterName, value => { base.dslGenerator = {character: value, entries: []} }, {flush: 'sync'})

function handleSelectArtifact(id: number) { a.setArtifact(selectSlot.value!, id); selectSlot.value = null }
function handleSelectBuff(name: string, options?: {config?: any, keepOpen: boolean}) {
    b.addBuff(name, options?.config)
    if (!options?.keepOpen) showBuffs.value = false
}
function save() {
    const item = snapshotPreset({...base, name: name.value, character: c.characterInterface, weapon: w.weaponInterface,
        targetFunction: target.targetFunctionInterface.value, artifactIds: a.artifactIds, buffs: b.buffs,
        teamContext: teamContext.value, teamContextStellarMode: stellarMode.value,
        enemy: enemy.value, infusion: infusion.value, skill: s.characterSkillInterface, singleConfig: a.artifactSingleConfig})
    try {
        if (creating.value) store.createCustom(name.value, item)
        else store.addOrOverwrite(props.presetName!, item)
        recordUsage('action.preset-save')
        emit('saved', name.value)
        emit('close')
    } catch (error: any) { ElMessage.error(error.message) }
}
</script>

<style scoped>
.preset-editor{min-height:330px;container:buff-board / inline-size;--ink:var(--el-text-color-primary);--quiet:var(--el-text-color-secondary);--hairline:var(--el-border-color-light)}
.preset-name{display:grid;grid-template-columns:90px minmax(0,1fr);align-items:center;gap:12px;margin-bottom:16px}
.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:12px 0 24px}
.form-grid label{display:grid;gap:8px;min-width:0}
.form-grid label>:last-child{width:100%}
.preset-artifacts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:12px 0}
.preset-artifacts>div{display:grid;gap:10px;align-content:start;min-width:0}
.polestar-controls{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}
.polestar-controls label{display:flex;align-items:center;gap:10px}
.manual-buff-source{display:flex;align-items:center;gap:8px;margin:8px 0}
h3{font-size:15px;margin:20px 0 12px}
@media(max-width:600px){.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.preset-artifacts{grid-template-columns:1fr}.preset-name{grid-template-columns:1fr;gap:6px}}
</style>

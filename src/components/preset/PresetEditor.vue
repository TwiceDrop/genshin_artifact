<template>
    <UiDialog :model-value="true" :title="settingsPreset ? '计算设置' : creating ? '新建自定义预设' : '编辑角色预设'"
        :width="mobile ? mobileWidth : 'min(960px, 96vw)'" :max-width="dialogMaxWidth" :max-height="viewportHeight"
        :top="mobileTop" prevent-outside
        @update:model-value="value => { if (!value) $emit('close') }">
        <div class="preset-editor">
            <label v-if="!settingsPreset" class="preset-name"><span>预设名称</span><UiInput v-if="creating" v-model="name" aria-label="预设名称" /><UiInput v-else :model-value="store.displayName(name)" disabled aria-label="预设名称" /></label>
            <TabsRoot v-model="tab">
                <TabsList class="preset-tab-list" :aria-label="settingsPreset ? '计算设置' : '角色预设'">
                    <TabsTrigger v-if="!settingsPreset || c.characterNeedConfig" value="character">{{ t('misc.character') }}</TabsTrigger>
                    <TabsTrigger value="weapon">{{ t('misc.weapon') }}</TabsTrigger>
                    <TabsTrigger value="artifacts">{{ t('misc.artifact') }}</TabsTrigger>
                    <TabsTrigger value="buffs">BUFF</TabsTrigger>
                    <TabsTrigger value="damage">{{ t('calcPage.dmg') }}</TabsTrigger>
                </TabsList>
                <TabsContent v-if="!settingsPreset || c.characterNeedConfig" v-show="tab === 'character'" value="character" force-mount>
                    <div v-if="!settingsPreset" class="form-grid">
                        <label><span>{{ t('misc.character') }}</span><select-character v-if="!gameIdentity" v-model="c.characterName" /><UiInput v-else :model-value="c.characterLocale" disabled /></label>
                        <label><span>角色等级</span><select-character-level v-model="c.characterLevel" use-ui-select /></label>
                        <label><span>{{ t('misc.conste') }}</span><UiNumberInput v-model="c.characterConstellation" :min="0" :max="6" :step="1" /></label>
                        <label><span>{{ t('skillType.a') }}</span><UiNumberInput v-model="c.characterSkill1" :min="1" :max="15" :step="1" /></label>
                        <label><span>{{ t('skillType.e') }}</span><UiNumberInput v-model="c.characterSkill2" :min="1" :max="15" :step="1" /></label>
                        <label><span>{{ t('skillType.q') }}</span><UiNumberInput v-model="c.characterSkill3" :min="1" :max="15" :step="1" /></label>
                    </div>
                    <item-config v-if="c.characterNeedConfig" v-model="c.characterConfig" shadcn :item-name="c.characterName" :configs="c.characterConfigConfig" />
                </TabsContent>
                <TabsContent v-show="tab === 'weapon'" value="weapon" force-mount>
                    <div v-if="!settingsPreset" class="form-grid">
                        <label><span>{{ t('misc.weapon') }}</span><select-weapon v-model="w.weaponName" :type="c.characterWeaponType" /></label>
                        <label><span>武器等级</span><select-weapon-level v-model="w.weaponLevel" use-ui-select /></label>
                        <label><span>{{ t('misc.refine') }}</span><UiNumberInput v-model="w.weaponRefine" :min="1" :max="w.weaponMaxRefine" :step="1" /></label>
                    </div>
                    <section class="equipment-effects">
                        <h3>当前武器效果</h3>
                        <strong>{{ ta(weaponMeta.nameLocale) }} · 精炼 {{ w.weaponRefine }} 阶</strong>
                        <p>{{ weaponEffect || '无' }}</p>
                    </section>
                    <item-config v-if="w.weaponNeedConfig" v-model="w.weaponConfig" shadcn :item-name="w.weaponName" :configs="w.weaponConfigConfig" />
                </TabsContent>
                <TabsContent v-show="tab === 'artifacts'" value="artifacts" force-mount>
                    <div v-if="!settingsPreset" class="preset-artifacts">
                        <div v-for="(position, i) in positions" :key="position">
                            <strong>{{ t('misc', position) }}</strong>
                            <artifact-display v-if="a.artifactItems[i]" :item="a.artifactItems[i]" shadcn selectable :buttons="true"
                                :delete-button="true" :lock-button="false" @delete="a.removeArtifact(i)" @click="selectSlot = i" />
                            <UiButton @click="selectSlot = i">{{ t('calcPage.selectArt') }}</UiButton>
                        </div>
                    </div>
                    <section class="equipment-effects">
                        <h3>当前圣遗物效果</h3>
                        <div v-for="effect in setEffects" :key="effect.key">
                            <strong>{{ effect.name }} · {{ effect.pieces }}件套</strong><p>{{ effect.text }}</p>
                        </div>
                        <p v-if="!setEffects.length">无</p>
                    </section>
                    <item-config v-if="a.artifactNeedConfig2" v-model="a.artifactSingleConfig" shadcn :item-name="a.artifactConfigItemName" :configs="a.artifactConfig2Configs" />
                    <item-config v-if="a.artifactNeedConfig4" v-model="a.artifactSingleConfig" shadcn :item-name="a.artifactConfigItemName" :configs="a.artifactConfig4Configs" />
                </TabsContent>
                <TabsContent v-show="tab === 'buffs'" value="buffs" force-mount>
                    <UiButton @click="showBuffs = true">添加BUFF</UiButton>
                    <div class="polestar-controls">
                        <label><UiSwitch v-model="b.polestarEnabled" aria-label="启用极星辉域" /><span>启用极星辉域</span></label>
                        <label><span>极星辉域层数</span><UiNumberInput :key="String(b.polestarEnabled)" v-model="b.polestarStacks" :min="0" :max="12" :step="1" :disabled="!b.polestarEnabled" /></label>
                    </div>
                    <selected-buff-groups :buffs="otherBuffs" shadcn>
                        <template #character-controls>
                            <team-buff-sources v-model="teamContext" v-model:stellar-mode="stellarMode" shadcn :character="c.characterName" :preset-name="creating ? null : presetName" />
                        </template>
                        <template #default="{buff}">
                            <buff-item :buff="buff" v-model:buffConfig="buff.config" shadcn @delete="b.deleteBuff(buff.id)" @toggle="b.toggleBuff(buff.id)" />
                            <label v-if="teamContext.length" class="manual-buff-source">手动 BUFF 来源
                                <span class="manual-buff-select">
                                    <UiSelect v-model="buff.source_id" label="手动 BUFF 来源" placeholder="未关联队友" :options="buffSourceOptions" />
                                    <UiButton v-if="buff.source_id" size="small" class="clear-buff-source" aria-label="清除手动 BUFF 来源" @click="clearBuffSource(buff, $event)">
                                        <i-ep-close aria-hidden="true" />
                                    </UiButton>
                                </span>
                            </label>
                        </template>
                    </selected-buff-groups>
                </TabsContent>
                <TabsContent v-show="tab === 'damage'" value="damage" force-mount>
                    <div class="form-grid">
                        <label><span>{{ t('calcPage.skill') }}</span><select-character-skill v-model="s.characterSkillIndex" shadcn :character-name="c.characterName" /></label>
                        <label><span>{{ t('calcPage.fumo') }}</span><select-element-type v-model="infusion" shadcn :label="t('calcPage.fumo')" :elements="['Pyro', 'Electro', 'Hydro', 'Anemo', 'Geo', 'Cryo', 'Dendro', 'None']" /></label>
                    </div>
                    <item-config v-if="s.characterNeedSkillConfig" v-model="s.characterSkillConfig" shadcn :item-name="c.characterName" :configs="s.characterSkillConfigConfig" />
                    <h3>{{ t('calcPage.setupEnemy') }}</h3>
                    <enemy-config v-model="enemy" shadcn />
                </TabsContent>
            </TabsRoot>
        </div>
        <template #footer>
            <div class="preset-editor-actions">
                <UiButton v-if="!settingsPreset && !creating" @click="creating = true; name = ''">另存为自定义</UiButton>
                <UiButton @click="$emit('close')">{{ t('misc.cancel') }}</UiButton>
                <UiButton variant="primary" @click="save">保存</UiButton>
            </div>
        </template>
        <UiDialog :model-value="selectSlot !== null" :title="t('calcPage.selectArt')" :width="mobile ? mobileWidth : 'min(1000px, 96vw)'"
            :max-width="dialogMaxWidth" :max-height="mobile ? viewportHeight : undefined"
            :top="mobileTop ?? '15vh'" @update:model-value="value => { if (!value) selectSlot = null }">
            <select-artifact v-if="selectSlot !== null" shadcn :position="positions[selectSlot]" @select="handleSelectArtifact" />
        </UiDialog>
        <UiDialog v-model="showBuffs" :title="t('calcPage.selectBuff')" :width="mobile ? mobileWidth : 'min(800px, 96vw)'"
            :max-width="dialogMaxWidth" :max-height="viewportHeight" :top="mobileTop">
            <select-buff v-if="showBuffs" shadcn :preferred-uid="game.selectedUid.value" :selected-names="b.buffs.map(buff => buff.name)" @select="handleSelectBuff" />
        </UiDialog>
    </UiDialog>
</template>

<script setup lang="ts">
import {computed, reactive, ref, watch} from 'vue'
import {useMediaQuery} from '@vueuse/core'
import {TabsContent, TabsList, TabsRoot, TabsTrigger} from 'radix-vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiNumberInput from '@/components/ui/UiNumberInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiSwitch from '@/components/ui/UiSwitch.vue'
import {showCalculationNotice} from '@/store/calculation-history'
import {usePresetStore} from '@/store/pinia/preset'
import {useCharacterPresetLabel} from '@/composables/character-preset-label'
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
import type {IArtifact} from '@/types/artifact'
import weapons from '@/assets/_gen_weapon'
import artifacts from '@/assets/_gen_artifact'
import {weaponEffectText} from '@/algorithms/weapon-effect-summary.mjs'
import {equippedSetEffects} from '@/import/character-summary.mjs'
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

const props = defineProps<{presetName?: string; settingsPreset?: IPreset; equippedItems?: (IArtifact | null)[]}>()
const emit = defineEmits(['close', 'saved', 'save-settings'])
const store = usePresetStore(), game = useMiyousheStore(), {t, ta} = useI18n()
const characterPresetLabel = useCharacterPresetLabel()
const character = useCharacter(), weapon = useCharacterWeapon(character.characterName, character.characterWeaponType)
const skill = useCharacterSkill(character.characterName), target = useTargetFunction(character.characterName)
const c = reactive(character), w = reactive(weapon), s = reactive(skill)
const a = reactive(use5Artifacts(() => props.equippedItems)), b = reactive(useBuff())
const weaponMeta = computed(() => weapons[w.weaponName as keyof typeof weapons])
const weaponEffect = computed(() => 'effect' in weaponMeta.value ? weaponEffectText(ta(weaponMeta.value.effect), w.weaponRefine) : '')
const setEffects = computed(() => equippedSetEffects(a.artifactItems, artifacts, ta))
const constraints = useComputeConstraint()
const name = ref(props.presetName || ''), creating = ref(!props.presetName), tab = ref('character')
const selectSlot = ref<number | null>(null), showBuffs = ref(false)
const positions = ['flower', 'feather', 'sand', 'cup', 'head']
const mobile = useMediaQuery('(max-width: 767px)')
const mobileWidth = 'calc(100vw - 16px)'
const dialogMaxWidth = computed(() => mobile.value ? 'none' : '96vw')
const viewportHeight = computed(() => mobile.value ? 'calc(100dvh - 24px - env(safe-area-inset-top))' : '80vh')
const mobileTop = computed(() => mobile.value ? 'calc(8px + env(safe-area-inset-top))' : undefined)

const original = props.settingsPreset ?? (props.presetName ? store.getPreset(props.presetName)!.item : {
    name: '', character: c.characterInterface, weapon: w.weaponInterface,
    targetFunction: target.targetFunctionInterface.value, buffs: [], artifactIds: [-1, -1, -1, -1, -1],
    constraint: constraints.presetConstraint.value, filter: constraints.presetFilter.value,
    algorithm: constraints.algorithm.value, artifactEffectMode: 'auto', artifactConfig: newDefaultArtifactConfigForWasm(),
    useDSL: false, targetMode: 'normal', optimizationMode: 'damage', panelSearch: newPanelSearchOptions(),
    dslGenerator: {character: c.characterName, entries: []}, dslSource: '',
} as IPreset)
const base = restorePresetConfiguration(original)
applyPresetIdentity(base, character, weapon)
if (props.settingsPreset && !c.characterNeedConfig) tab.value = 'weapon'
if (!props.settingsPreset) {
    target.targetFunctionName.value = base.targetFunction.name
    target.targetFunctionConfig.value = base.targetFunction.params
    target.targetFunctionUseDSL.value = !!base.useDSL
    target.targetFunctionDSLSource.value = base.dslSource || ''
}
a.artifactIds = base.artifactIds || [-1, -1, -1, -1, -1]
a.artifactSingleConfig = base.singleConfig
b.buffs = (base.buffs || []).map((buff, id) => ({...buff, id}))
s.characterSkillIndex = base.skill!.index
s.characterSkillConfig = base.skill!.config
const enemy = ref(base.enemy!), infusion = ref(base.infusion!)
const teamContext = ref(base.teamContext || []), stellarMode = ref(base.teamContextStellarMode === true)
const buffSourceOptions = computed(() => teamContext.value.map(source => ({
    value: source.sourceId, label: characterPresetLabel(source.presetName)
})))
const gameIdentity = computed(() => !!original.miyousheKey && !creating.value)
const otherBuffs = computed(() => b.buffs.filter(buff => buff.name !== 'ResonancePolestarField'))
watch(character.characterName, value => { base.dslGenerator = {character: value, entries: []} }, {flush: 'sync'})

function handleSelectArtifact(id: number) { a.setArtifact(selectSlot.value!, id); selectSlot.value = null }
function clearBuffSource(buff: { source_id?: string }, event: MouseEvent) {
    const trigger = (event.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>('[role="combobox"]')
    buff.source_id = undefined
    trigger?.focus()
}
function handleSelectBuff(name: string, options?: {config?: any, keepOpen: boolean}) {
    b.addBuff(name, options?.config)
    if (!options?.keepOpen) showBuffs.value = false
}
function save() {
    const conditions = snapshotPreset({ buffs: b.buffs, teamContext: teamContext.value, teamContextStellarMode: stellarMode.value,
        enemy: enemy.value, infusion: infusion.value, skill: s.characterSkillInterface,
        singleConfig: a.artifactSingleConfig, artifactConfig: a.artifactSingleConfig, artifactEffectMode: base.artifactEffectMode
            ?? (original.artifactConfig || original.singleConfig ? 'custom' : 'auto') })
    if (props.settingsPreset) {
        emit('save-settings', {
            character: { params: c.characterConfig },
            weapon: { name: w.weaponName, params: w.weaponConfig },
            conditions
        })
        emit('close')
        return
    }
    const item = snapshotPreset({...base, name: name.value, character: c.characterInterface, weapon: w.weaponInterface,
        targetFunction: target.targetFunctionInterface.value, artifactIds: a.artifactIds, ...conditions})
    try {
        if (creating.value) store.createCustom(name.value, item)
        else store.addOrOverwrite(props.presetName!, item)
        recordUsage('action.preset-save')
        emit('saved', name.value)
        emit('close')
    } catch (error: any) { showCalculationNotice('error', error.message) }
}
</script>

<style scoped>
.preset-editor{min-height:330px;container:buff-board / inline-size;--ink:var(--cx-letter);--quiet:var(--cx-dim);--hairline:var(--cx-step-2)}
.preset-tab-list{display:flex;gap:6px;overflow-x:auto;border-bottom:1px solid var(--cx-step-2);margin-bottom:15px}
.preset-tab-list button{flex:none;padding:0 15px;height:39px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--cx-dim);font:inherit;cursor:pointer}
.preset-tab-list button[data-state="active"]{border-bottom-color:var(--cx-gold);color:var(--cx-gold);font-weight:600}
.preset-tab-list button:focus-visible{outline:2px solid var(--cx-gold);outline-offset:-3px}
.preset-editor-actions{display:flex;justify-content:flex-end;gap:10px}
.preset-name{display:grid;grid-template-columns:90px minmax(0,1fr);align-items:center;gap:12px;margin-bottom:16px}
.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:12px 0 24px}
.form-grid label{display:grid;gap:8px;min-width:0}
.form-grid label>:last-child{width:100%}
.preset-artifacts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:12px 0}
.preset-artifacts>div{display:grid;gap:10px;align-content:start;min-width:0}
.equipment-effects{margin:12px 0 16px}
.equipment-effects h3{margin:0 0 8px}
.equipment-effects strong{color:var(--cx-gold);font-size:13px}
.equipment-effects p{margin:4px 0 10px;font-size:13px;line-height:1.6;white-space:pre-line}
.polestar-controls{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}
.polestar-controls label{display:flex;align-items:center;gap:10px}
.manual-buff-source{display:flex;align-items:center;gap:8px;margin:8px 0}
.manual-buff-select{position:relative;display:inline-flex;min-width:0}
.manual-buff-select .clear-buff-source{position:absolute;inset:0 2px 0 auto;align-self:center;min-height:24px;padding:2px 7px;border:0;background:var(--cx-step);opacity:0}
.manual-buff-select:is(:hover,:focus-within) .clear-buff-source{opacity:1}
h3{font-size:15px;margin:20px 0 12px}
@media(max-width:600px){
    .preset-tab-list button{padding-inline:10px}
    .form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .preset-artifacts{grid-template-columns:1fr}
    .preset-name{grid-template-columns:1fr;gap:6px}
}
</style>

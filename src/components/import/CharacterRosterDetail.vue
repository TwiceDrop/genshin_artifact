<template>
    <article class="character-sheet" :aria-label="entry.label + '角色详情'">
        <header class="portrait">
            <CharacterPortrait v-if="entry.splash" :character-name="entry.characterName" :splash="entry.splash"
                :avatar="entry.avatar" :alt="entry.label + '立绘'" />
            <div class="identity">
                <span><img v-if="elementIcons[entry.element]" :src="elementIcons[entry.element]" alt="" />{{ entry.elementLabel }} · {{ entry.weaponType }}</span>
                <h3>{{ entry.label }}</h3>
                <UiButton v-if="displayEntry.preset" class="level-button" size="small" aria-label="修改角色等级" aria-haspopup="dialog"
                    @click="openLevel">Lv. {{ levelSelection }}</UiButton>
                <b v-else-if="displayEntry.level != null">Lv. {{ displayEntry.level }}</b>
                <div class="portrait-actions">
                    <RosterLoadouts :entry="entry" :base-entry="baseEntry" :character-presets="characterPresets"
                        @select-preset="$emit('select-preset', $event)" @create-preset="saveCopy" @share="sharePreset" />
                    <UiButton v-if="!entry.characterVariant" size="small" variant="danger" @click="$emit('remove')">删除角色</UiButton>
                    <UiButton size="small" class="calculation-settings" :disabled="!entry.preset" aria-haspopup="dialog" @click="settingsOpen = true">计算设置</UiButton>
                </div>
                <UiButton class="calculate-loadout" :disabled="!entry.preset" @click="calculateLoadout">用这套预设计算</UiButton>
            </div>
        </header>
        <div class="build">
            <RosterWeaponCard :entry="displayEntry" @change-weapon="changeWeapon" />
            <CharacterTalentCards :entry="displayEntry" @change-levels="changeTalentLevels" />
            <CharacterConstellation :entry="displayEntry" @change-rank="changeRank" />
            <section class="cx-panel">
                <header class="cx-panel-heading"><h4 class="cx-panel-title">角色面板</h4></header>
                <div class="cx-panel-body">
                    <p v-if="panel.error" class="issue">{{ panel.error }}</p>
                    <div v-else class="stat-grid">
                        <RosterStatRow v-for="([key, label, percent], index) in rows" :key="entry.characterName + key"
                            :side="narrow ? 'bottom' : index % 2 === 0 ? 'left' : 'right'"
                            :label="label" :percentage="percent" :composition="panel.value?.[key]"
                            :highlighted="highlightedStats?.includes(key)" />
                    </div>
                </div>
            </section>
            <p v-if="entry.warning || entry.error" class="issue">{{ entry.warning || entry.error }}</p>
        </div>
        <section class="equipment cx-panel">
            <header class="cx-panel-heading equipment-heading">
                <h4 class="cx-panel-title">圣遗物</h4>
                <span>{{ slots.filter(s => s.item || s.raw).length }} / 5</span>
            </header>
            <div class="cx-panel-body">
                <div v-if="buildScore.count" class="build-score">
                    喵喵总分 <strong class="miao-score" :data-grade="buildScore.grade">{{ buildScore.total?.toFixed(1) }} {{ buildScore.grade }}</strong>
                </div>
                <div class="gear-grid">
                    <div v-for="(slot, index) in slots" :key="slot.position" class="gear-slot">
                        <ArtifactCard v-if="slot.item" :item="slot.item" :icon-src="localPieceIcon(slot.item)" :highlight-tags="highlightedTags"
                            :score="scoresBySlot.get(index)?.score" :grade="scoresBySlot.get(index)?.grade" show-grade readonly
                            :score-details="() => scoreDetails(slot.item, scoreContext, equippedItems)" :score-side="narrow ? 'bottom' : 'left'">
                            <template #icon>
                                <UiDropdownMenu>
                                    <template #trigger>
                                        <button class="gear-icon-button" type="button" :aria-label="t('misc', slot.position) + '装备操作'"
                                            @focus="gearTrigger = $event.currentTarget">
                                            <ArtifactIcon :item="slot.item" :src="localPieceIcon(slot.item)" />
                                        </button>
                                    </template>
                                    <UiDropdownMenuItem @select="openGear(slot.position)">
                                        <IconEpSwitch class="gear-menu-icon" aria-hidden="true" />换一件
                                    </UiDropdownMenuItem>
                                    <UiDropdownMenuItem @select="unequip(slot.position)">
                                        <IconEpDownload class="gear-menu-icon" aria-hidden="true" />卸下
                                    </UiDropdownMenuItem>
                                </UiDropdownMenu>
                            </template>
                        </ArtifactCard>
                        <div v-else class="empty"><strong>{{ t('misc', slot.position) }}</strong><small>{{ slot.raw?.name || slot.raw?.set?.name || '未装备' }}</small>
                            <small v-if="slot.error" class="issue">{{ slot.error }}</small></div>
                        <button v-if="!slot.item" class="gear-action" type="button" aria-haspopup="dialog" :aria-label="'选择' + t('misc', slot.position)"
                            @click="openGear(slot.position, $event)">＋ 选择</button>
                    </div>
                    <section class="set-effects"><h5>圣遗物套装效果</h5>
                        <div v-for="effect in setEffects" :key="effect.key">
                            <strong>{{ effect.name }} · {{ effect.pieces }}件套</strong>
                            <p>{{ effect.text }}</p>
                        </div>
                        <small v-if="!setEffects.length">无</small>
                    </section>
                </div>
            </div>
        </section>
        <RosterEditDialog ref="editDialog" :character="entry.label" />
        <UiDialog v-model="levelOpen" title="修改角色等级" width="320px">
            <div class="level-row"><strong>角色等级</strong><UiSelect v-model="draftLevel" label="角色等级" :options="levelOptions" /></div>
            <template #footer>
                <UiButton @click="levelOpen = false">取消</UiButton>
                <UiButton variant="primary" :disabled="draftLevel === levelSelection" @click="saveLevel">保存</UiButton>
            </template>
        </UiDialog>
        <PresetEditor v-if="settingsOpen" :preset-name="entry.presetName" :settings-preset="displayEntry.preset" :equipped-items="equippedItems"
            @save-settings="saveCalculationSettings" @close="settingsOpen = false" />
        <RosterArtifactPicker v-if="picking" v-model="gearOpen" :entry="displayEntry" :roster="roster" :position="picking" :slots="slots" :highlight-tags="highlightedTags"
            :piece-icon="localPieceIcon" :return-focus="() => gearTrigger?.focus()" @equip="setArtifact(picking, $event)" />
    </article>
</template>

<script>
const pieceIcons = require.context('@/images/artifacts', false, /\.png$/)
const localIconKeys = new Set(pieceIcons.keys())

</script>

<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import RosterWeaponCard from './RosterWeaponCard.vue'
import { openContentShare } from '@/components/share/content-share.mjs'
import { presetPreview } from '@/components/share/preset-preview.mjs'
import RosterLoadouts from './RosterLoadouts.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import RosterArtifactPicker from './RosterArtifactPicker.vue'
import UiDropdownMenu from '@/components/ui/UiDropdownMenu.vue'
import UiDropdownMenuItem from '@/components/ui/UiDropdownMenuItem.vue'
import IconEpSwitch from '~icons/ep/switch'
import IconEpDownload from '~icons/ep/download'
import ArtifactIcon from '@/components/display/ArtifactIcon.vue'
import { editRosterArtifact, presetForRosterLoadout, retainRosterGear, withRosterCalculationSettings } from '@/import/roster-equipment.mjs'
import { setRosterWeapon } from '@/import/set-roster-weapon'
import RosterEditDialog from './RosterEditDialog.vue'
import { useArtifactStore } from '@/store/pinia/artifact'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { usePresetStore } from '@/store/pinia/preset'
import RosterStatRow from './RosterStatRow.vue'
import panelHighlights from '@/assets/character-panel-highlights.json'
import { characterArtifactHighlights } from '@/utils/character-artifact-highlights'
import CharacterTalentCards from './CharacterTalentCards.vue'
import CharacterConstellation from './CharacterConstellation.vue'
import CharacterPortrait from '@/components/display/CharacterPortrait.vue'
import ArtifactCard from '@/components/display/ArtifactCard.vue'
import elementIcons from '@/assets/element-icons'
import artifacts from '@/assets/_gen_artifact'
import weapons from '@/assets/_gen_weapon'
import { equippedScoreContext, scoreBuild, scoreDetails } from '@/algorithms/artifact-score/score.mjs'
import locale from '@/i18n/generated/zh-cn.json'
import { useI18n } from '@/i18n/i18n'
import { BREAKS, POSITIONS, createMysConverter } from '@/import/miyoushe.mjs'
import { characterLevelLabel, highCharacterLevels } from '@/utils/character-level.mjs'
import { convertArtifact } from '@/utils/converter'
import { rosterAttributes } from '@/algorithms/roster-attributes.mjs'
import { displayedTagParts } from '@/utils/artifacts'
import { equippedSetEffects } from '@/import/character-summary.mjs'
import { useRosterLoadout } from '@/composables/roster-loadout'
import { changeConstellation, withBaseTalentLevels } from '@/import/constellation-talents.mjs'

const props = defineProps({ entry: { type: Object, required: true }, baseEntry: Object, roster: Array, characterPresets: Array })
const { row, selectedConfig } = useRosterLoadout(() => props.entry)
const presets = usePresetStore(), inventory = useArtifactStore()
const PresetEditor = defineAsyncComponent(() => import('@/components/preset/PresetEditor.vue'))
const settingsOpen = ref(false)
const displayEntry = computed(() => {
    const entry = props.entry, config = selectedConfig.value
    if (!config || !entry.preset) return entry
    const preset = presetForRosterLoadout(entry.preset, config), character = preset.character
    return { ...entry, preset, characterVariant: true, level: character.level, constellation: character.constellation,
        talentLevels: [character.skill1, character.skill2, character.skill3].map(n => n + 1) }
})
const emit = defineEmits(['remove', 'select-preset', 'created-preset'])
const editDialog = ref(null)
function requestEdit(title, question, apply) {
    const entry = props.entry
    editDialog.value.request(title, question, !selectedConfig.value && (!!entry.preset?.miyousheKey || !entry.preset), apply)
}
function saveCopy(name, changes) {
    if (!props.entry.preset) throw new Error(props.entry.error)
    presets.createCustom(name, { ...displayEntry.value.preset, artifactIds: snapshotIds(), ...changes })
    emit('created-preset', name)
}
function changeRank(rank) {
    requestEdit('修改命之座', `要新建角色预设，改为 ${rank} 命吗？`, name => {
        const preset = displayEntry.value.preset
        const character = changeConstellation(preset.character, rank)
        if (name) saveCopy(name, { character })
        else if (selectedConfig.value) selectedConfig.value.constellation = rank
        else {
            presets.addOrOverwrite(props.entry.presetName, { ...preset, character })
            if (!props.entry.characterVariant) row.value.constellation = rank
        }
    })
}
const levelOpen = ref(false), draftLevel = ref('')
const levelOptions = Array.from({length: 89}, (_, n) => n + 1).concat(highCharacterLevels)
    .flatMap(level => BREAKS.includes(level) ? [characterLevelLabel(level, false), characterLevelLabel(level, true)] : [String(level)])
    .map(value => ({value, label: value}))
const levelSelection = computed(() => {
    const {level, ascend} = displayEntry.value.preset.character
    return characterLevelLabel(level, ascend)
})
function openLevel() {
    draftLevel.value = levelSelection.value
    levelOpen.value = true
}
function saveLevel() {
    const preset = displayEntry.value.preset
    const value = draftLevel.value
    const level = parseInt(value, 10), ascend = value.endsWith('+')
    levelOpen.value = false
    if (level === preset.character.level && ascend === !!preset.character.ascend) return
    requestEdit('修改角色等级', `要新建角色预设，将等级改为 Lv. ${value} 吗？`, name => {
        const character = { ...preset.character, level, ascend }
        if (name) saveCopy(name, { character })
        else if (selectedConfig.value) selectedConfig.value.characterLevel = { level, ascend }
        else {
            presets.addOrOverwrite(props.entry.presetName, { ...preset, character })
            if (!props.entry.characterVariant) row.value.level = level
        }
    })
}
function saveCalculationSettings(settings) {
    if (selectedConfig.value) selectedConfig.value.calculationSettings = settings
    else presets.addOrOverwrite(props.entry.presetName, withRosterCalculationSettings(displayEntry.value.preset, settings))
}
function changeTalentLevels(baseLevels) {
    const preset = displayEntry.value.preset
    const character = withBaseTalentLevels(preset.character, baseLevels)
    const levels = [character.skill1, character.skill2, character.skill3].map(n => n + 1).join(' / ')
    requestEdit('修改天赋等级', `要新建角色预设，将天赋等级改为 ${levels} 吗？`, name => {
        if (name) saveCopy(name, { character })
        else if (selectedConfig.value) selectedConfig.value.baseTalentLevels = baseLevels
        else presets.addOrOverwrite(props.entry.presetName, { ...preset, character })
    })
}
function changeWeapon(weapon, previousName) {
    const targetName = ta(weapons[weapon.name].nameLocale)
    const target = `「${targetName}」（Lv. ${weapon.level}${weapon.ascend ? '+' : ''}，精炼 ${weapon.refine} 阶）`
    const change = previousName === targetName ? `设置${target}` : previousName ? `将「${previousName}」换为${target}` : `装备${target}`
    requestEdit('更换武器', `要新建角色预设，${change}吗？`, name => {
        if (name && props.entry.preset) saveCopy(name, { weapon })
        else if (selectedConfig.value && props.entry.preset) selectedConfig.value.weapon = weapon
        else {
            setRosterWeapon(props.entry, weapon, name)
            if (name) emit('created-preset', name)
        }
    })
}
const router = useRouter()
const { t, ta } = useI18n()
const narrow = useMediaQuery('(max-width: 600px)')
const picking = ref(''), gearOpen = ref(false), gearTrigger = ref(null)
function openGear(position, event) {
    if (event) gearTrigger.value = event.currentTarget
    picking.value = position
    gearOpen.value = true
}
function unequip(position) {
    setArtifact(position, null)
}
function setArtifact(position, item) {
    const entry = props.entry
    const index = POSITIONS.indexOf(position), current = equippedItems.value[index]
    if (item && current?.id === item.id) return
    const piece = artifact => `「${ta(artifacts[artifact.setName][position].text)} +${artifact.level}」`
    const change = !item ? `卸下${piece(current)}` : current ? `将${piece(current)}换为${piece(item)}` : `装备${piece(item)}`
    requestEdit('修改圣遗物', `要新建角色预设，为${t('misc', position)}${change}吗？`, name => {
        if (name || entry.characterVariant || selectedConfig.value) {
            const ids = snapshotIds()
            ids[index] = item?.id ?? -1
            if (name) saveCopy(name, { artifactIds: ids })
            else if (selectedConfig.value) selectedConfig.value.ids = ids
            else presets.addOrOverwrite(entry.presetName, { ...entry.preset, artifactIds: ids })
        } else editRosterArtifact(useMiyousheStore().data.value, presets, inventory, row.value, position, item, equippedItems.value)
    })
}
function snapshotIds() {
    if (selectedConfig.value) return [...selectedConfig.value.ids]
    const { key, preset } = props.entry
    const inventory = useArtifactStore()
    // Restored snapshots can display a worn piece whose old warehouse ID no longer resolves.
    if (equippedItems.value.some((piece, i) => piece && inventory.getArtifact(preset?.artifactIds?.[i])?.position !== piece.position)) {
        const data = useMiyousheStore().data.value
        const row = data.entries.find(entry => entry.key === key)
        const presets = usePresetStore()
        const ids = retainRosterGear(data, presets.presets.value, inventory, row, equippedItems.value)
        return ids
    }
    return POSITIONS.map((_, i) => equippedItems.value[i]?.id ?? -1)
}
function calculateLoadout() {
    const { key, preset, presetName } = props.entry
    const ids = snapshotIds()
    if (!selectedConfig.value && !ids.every((id, i) => id === preset.artifactIds?.[i])) {
        if (!props.entry.characterVariant) useMiyousheStore().data.value.entries.find(row => row.key === key).artifactIds = ids
        usePresetStore().addOrOverwrite(presetName, { ...preset, artifactIds: ids })
    }
    const query = { preset: presetName }
    if (selectedConfig.value) query.loadout = selectedConfig.value.name
    router.push({ name: 'calculate', query })
}
function localPieceIcon(item) {
    const suffix = item.position === 'cup' ? 'goblet' : item.position
    const key = `./${artifacts[item.setName]?.name2}_${suffix}.png`
    return localIconKeys.has(key) ? pieceIcons(key) : undefined
}
const converter = createMysConverter({ artifacts, locale })
const slots = computed(() => POSITIONS.map((position, i) => {
    if (selectedConfig.value) return { position, item: inventory.getArtifact(selectedConfig.value.ids[i]) }
    const item = props.entry.equipped.find(piece => piece.position === position)
    const raw = props.entry.raw?.relics?.find(piece => Number(piece.pos) === i + 1)
    if (item || !raw || props.entry.savedGear || props.entry.preset) return { position, item }
    try { return { position, item: converter.artifact(raw) } }
    catch (e) { return { position, raw, error: e.message } }
}))
const setEffects = computed(() => equippedSetEffects(equippedItems.value, artifacts, ta))
const panel = computed(() => {
    const preset = displayEntry.value.preset
    if (!preset?.character || !preset.weapon) return {}
    try {
        const items = slots.value.filter(s => s.item).map(s => s.item)
        const sources = items.map(item => {
            const piece = ta(artifacts[item.setName].nameLocale) + ' · ' + t('misc', item.position)
            return [item.mainTag, ...item.normalTags].map((tag, index) => {
                const [stat, amount] = displayedTagParts(tag.name, tag.value)
                return piece + ' · ' + (index === 0 ? '主词条' : '副词条') + '（' + stat + ' ' + amount + '）'
            })
        })
        return { value: rosterAttributes({ character: preset.character, weapon: preset.weapon, artifacts: items.map(convertArtifact) },
            (index, line) => sources[index][line]) }
    } catch (e) { return { error: e.message } }
})
const highlightedStats = computed(() => panelHighlights[props.entry.characterName])
function sharePreset(title) {
    const {content,equipment} = presetPreview(displayEntry.value.preset,title,equippedItems.value,name=>t('stat',name))
    openContentShare('preset',content,equipment)
}
const equippedItems = computed(() => slots.value.map(slot => slot.item))
const scoreContext = computed(() => {
    const { characterName, label, constellation, element, preset, raw } = displayEntry.value
    return equippedScoreContext({
        character: preset?.character ?? { name: characterName, constellation }, label, element,
        weaponName: preset?.weapon ? locale[weapons[preset.weapon.name]?.nameLocale] : raw?.weapon?.name,
        weaponAffix: preset?.weapon?.refine ?? raw?.weapon?.affix_level, panel: panel.value.value,
        items: equippedItems.value, sets: artifacts, locale
    })
})
const buildScore = computed(() => scoreBuild(equippedItems.value, scoreContext.value))
const scoresBySlot = computed(() => new Map(buildScore.value.artifacts.map(piece => [piece.pos, piece])))
const highlightedTags = computed(() => characterArtifactHighlights(props.entry.characterName))
const rows = computed(() => [
    ['hp', '生命值'], ['atk', '攻击力'], ['def', '防御力'], ['elemental_mastery', '元素精通'],
    ['critical', '暴击率', true], ['critical_damage', '暴击伤害', true], ['recharge', '元素充能效率', true],
    ['bonus_' + props.entry.element.toLowerCase(), props.entry.elementLabel + '元素伤害加成', true],
    ...(highlightedStats.value?.includes('bonus_physical') ? [['bonus_physical', '物理伤害加成', true]] : []),
    ...(highlightedStats.value?.includes('healing_bonus') ? [['healing_bonus', '治疗加成', true]] : []),
])
</script>

<style scoped>
.character-sheet { display: grid; grid-template-columns: minmax(160px, .63fr) minmax(266px, 1fr) minmax(350px, 1.45fr); align-items: start; gap: 12px; margin-top: 14px; color: var(--cx-letter); }
.portrait { position: relative; min-height: 456px; align-self: stretch; overflow: hidden; isolation: isolate; border-radius: 15px; background: radial-gradient(ellipse at 55% 30%, var(--cx-step-2), var(--cx-card) 76%); }
.portrait > img { position: absolute; width: 100%; height: 100%; object-fit: cover; object-position: var(--portrait-focus-x, 50%) 24%; }
.identity { --scrim: rgba(10,14,29,.91); --letters: #fff; position: absolute; inset: auto 0 0; padding: 70px 17px 19px; background: linear-gradient(transparent, var(--scrim)); color: var(--letters); }
.identity > span { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.identity > span img { width: 20px; }
.identity h3 { margin: 6px 0 2px; font-size: clamp(24px, 2.3vw, 38px); line-height: 1.15; }
.level-button { margin-top: 4px; font-variant-numeric: tabular-nums; }
.level-row { display: flex; align-items: center; justify-content: space-between; }
.identity b, dd { font-variant-numeric: tabular-nums; }
.portrait-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.calculation-settings { margin-inline-start: auto; }
.portrait-actions > button:first-child { min-width: 0; }
.calculate-loadout { width: 100%; margin-top: 8px; border-color: var(--cx-gold); color: var(--cx-gold); }
.build { display: grid; gap: 9px; min-width: 0; }
.equipment-heading { justify-content: space-between; }
.equipment-heading span, small { color: var(--cx-dim); font-size: 12px; font-weight: 500; }
.stat-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); column-gap: 14px; }
.issue { font-size: 12px; color: var(--cx-gold); overflow-wrap: anywhere; }
.build-score { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; font-size: 13px; }
.gear-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
.gear-slot { min-width: 0; display: flex; flex-direction: column; align-items: stretch; border-radius: 9px; background: var(--cx-step); }
.gear-action { align-self: flex-end; margin: 0 10px 8px; border: 1px solid var(--cx-step-2); border-radius: 7px; padding: 3px 10px; background: transparent; color: var(--cx-gold); font: inherit; font-size: 12px; cursor: pointer; }
.gear-action:focus-visible, .gear-action:hover { border-color: var(--cx-gold); }
.gear-icon-button { border: 0; border-radius: 12px; background: transparent; padding: 0; cursor: pointer; display: inline-flex; }
.gear-icon-button:hover, .gear-icon-button:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.gear-menu-icon { width: 16px; height: 16px; flex: none; color: var(--cx-dim); }
.set-effects { min-width: 0; padding: 12px; border-radius: 9px; background: var(--cx-step); }
.set-effects h5 { margin: 0 0 8px; font-size: 14px; }
.set-effects div + div { margin-top: 8px; }
.set-effects strong { font-size: 12px; color: var(--cx-gold); }
.set-effects p { margin: 3px 0 0; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.gear-slot :deep(.art-card), .empty { height: 100%; box-sizing: border-box; background: var(--cx-step); border-radius: 9px; }
.empty { display: grid; align-content: center; gap: 5px; min-height: 90px; padding: 12px; border: 1px dashed var(--cx-step-2); }
@media (max-width: 1080px) {
    .character-sheet { grid-template-columns: minmax(140px, .7fr) minmax(240px, 1.3fr); }
    .equipment { grid-column: 1 / -1; }
    .gear-grid { grid-template-columns: repeat(auto-fit,minmax(145px,1fr)); }
}
@media (max-width: 600px) {
    .character-sheet { grid-template-columns: minmax(0,1fr); gap: 9px; }
    .portrait { display: grid; align-items: end; min-height: 200px; }
    .portrait > img { top: 0; right: 0; width: 70%; object-position: var(--portrait-focus-x, 50%) 22%; }
    .identity { position: relative; inset: auto; min-width: 0; padding: 35px 15px 12px; }
    .gear-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .gear-slot :deep(.art-head) { padding-right: 0; flex-wrap: wrap; }
    .gear-slot :deep(.art-card) { padding: 9px; }
    .gear-slot :deep(.art-subs) { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: no-preference) {
    .character-sheet { animation: character-detail-enter 170ms ease-out; }
    @keyframes character-detail-enter { from { opacity: .55; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
}
</style>
<style scoped src="../../styles/artifact-score.css"></style>

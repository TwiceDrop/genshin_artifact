<template>
    <section class="cx-panel">
        <header class="cx-panel-heading"><h4 class="cx-panel-title">天赋</h4></header>
        <div class="cx-panel-body">
            <ul class="combat-talents">
                <li v-for="(talent, index) in talents?.slice(0, kinds.length) || kinds" :key="index">
                    <UiHoverDetails v-if="talents" enabled :tap-label="talent.name">
                        <template #trigger>
                            <UiButton class="talent-card">
                                <span class="talent-symbol">
                                    <img :src="iconUrl(talent.icon)" alt="" />
                                </span>
                                <span class="talent-copy">
                                    <strong>{{ talent.name }}</strong>
                                    <span>{{ kinds[index] }} <b>Lv. {{ entry.talentLevels[index] }}</b></span>
                                </span>
                            </UiButton>
                        </template>
                        <GameEffectText :title="talent.name" :effect="talent.effect" />
                    </UiHoverDetails>
                    <div v-else class="talent-card"><span class="talent-copy"><strong>{{ kinds[index] }}</strong><span>Lv. {{ entry.talentLevels[index] }}</span></span></div>
                </li>
            </ul>
            <div class="talent-footer">
                <ul v-if="passives.length" class="passive-talents" aria-label="固有天赋">
                    <li v-for="talent in passives" :key="talent.name">
                        <UiHoverDetails enabled :tap-label="talent.name">
                            <template #trigger>
                                <UiButton class="passive-icon talent-symbol" :aria-label="talent.name">
                                    <img :src="iconUrl(talent.icon)" alt="" />
                                </UiButton>
                            </template>
                            <GameEffectText :title="talent.name" :effect="talent.effect" />
                        </UiHoverDetails>
                    </li>
                </ul>
                <UiButton v-if="$slots.editor" class="edit-talents" size="small" :aria-expanded="editing" :disabled="disabled"
                    @click="editing = !editing">修改天赋等级</UiButton>
                <UiButton v-else class="edit-talents" size="small" aria-haspopup="dialog" :disabled="disabled || (!effectiveLevels && !entry.preset)" @click="openEditor">修改天赋等级</UiButton>
            </div>
            <slot v-if="$slots.editor && editing" name="editor" />
        </div>
        <UiDialog v-if="!$slots.editor" v-model="editing" title="修改天赋等级" width="370px">
            <div v-for="(kind, i) in kinds" :key="kind" class="level-row">
                <div><strong>{{ talents?.[i]?.name || kind }}</strong><small v-if="talents?.[i]?.name">{{ kind }}</small></div>
                <UiSelect v-model="draft[i]" :label="kind" :options="options[i]" :disabled="disabled" />
            </div>
            <template #footer>
                <UiButton @click="editing = false">取消</UiButton>
                <UiButton variant="primary" :disabled="disabled || !changed" @click="saveLevels">保存</UiButton>
            </template>
        </UiDialog>
    </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import catalog from '@/assets/character-talents.json'
import UiHoverDetails from '@/components/ui/UiHoverDetails.vue'
import GameEffectText from '@/components/display/GameEffectText.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import { constellationTalentBonuses } from '@/import/constellation-talents.mjs'

const props = defineProps({ entry: { type: Object, required: true }, effectiveLevels: Boolean, disabled: Boolean })
const emit = defineEmits(['change-levels'])
const kinds = ['普通攻击', '元素战技', '元素爆发']
const effectiveOptions = Array.from({ length: 15 }, (_, index) => ({ value: String(index + 1), label: 'Lv. ' + (index + 1) }))
const talents = computed(() => catalog[props.entry.characterName?.replace(/^(Aether|Lumine)/, 'Traveler')])
const passives = computed(() => talents.value?.slice(kinds.length) || [])
const editing = ref(false), draft = ref([]), options = ref([])
const changed = computed(() => draft.value.some((v, i) => Number(v) !== Number(props.entry.talentLevels[i])))
function bonuses() {
    const { name, constellation } = props.entry.preset.character
    return constellationTalentBonuses(name, constellation)
}
function openEditor() {
    draft.value = props.entry.talentLevels.map(String)
    options.value = props.effectiveLevels ? kinds.map(() => effectiveOptions) : bonuses().map((bonus, i) => {
        const levels = new Set(Array.from({ length: 10 }, (_, index) => index + 1 + bonus))
        levels.add(Number(draft.value[i]))
        return [...levels].sort((a, b) => a - b).map(n => ({ value: String(n), label: 'Lv. ' + n }))
    })
    editing.value = true
}
function saveLevels() {
    editing.value = false
    const levels = draft.value.map(Number)
    emit('change-levels', props.effectiveLevels ? levels : bonuses().map((bonus, i) => levels[i] - bonus))
}
function iconUrl(icon) { return process.env.BASE_URL + 'talent-icons/' + icon + '.webp' }
</script>

<style scoped>
ul { padding: 0; margin: 0; list-style: none; }
.combat-talents { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.talent-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
.passive-talents { display: flex; flex-wrap: wrap; gap: 6px; }
.passive-talents li { width: 44px; }
.edit-talents { margin-inline-start: auto; border-color: var(--cx-gold); color: var(--cx-gold); }
.level-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-block: 7px; }
.level-row strong, .level-row small { display: block; }
.level-row small { margin-top: 2px; color: var(--cx-dim); }
.ui-dialog footer button + button { margin-inline-start: 8px; }
.talent-card { width: 100%; height: 100%; display: grid; justify-items: center; align-content: start; gap: 6px; padding: 8px 3px; border: 1px solid transparent; border-radius: 8px; background: var(--cx-step); color: var(--cx-letter); text-align: center; font: inherit; cursor: pointer; }
.talent-card:not(button) { cursor: default; }
button.talent-card:hover, .talent-card[data-state$="open"], .passive-icon:hover, .passive-icon[data-state$="open"] { border-color: var(--cx-gold); }
.talent-card:focus-visible, .passive-icon:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 1px; }
.talent-symbol { --disc: #242a41; flex: none; width: 38px; height: 38px; display: grid; place-items: center; background: var(--disc); border-radius: 9px; }
.talent-symbol img { width: 32px; height: 32px; object-fit: contain; }
.passive-icon { width: 100%; height: 44px; padding: 0; border: 1px solid transparent; cursor: pointer; }
.passive-icon img { max-width: 100%; }
.talent-copy { display: grid; gap: 2px; min-width: 0; }
.talent-copy strong { font-size: 14px; line-height: 1.35; overflow-wrap: anywhere; }
.talent-copy > span { color: var(--cx-dim); font-size: 12px; }
.talent-copy b { display: inline-block; margin-left: 3px; font-weight: 600; color: var(--cx-gold); font-variant-numeric: tabular-nums; }
</style>

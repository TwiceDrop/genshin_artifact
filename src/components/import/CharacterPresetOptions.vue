<template>
    <div class="preset-list">
        <article v-for="option in options" :key="option.key" class="preset-option" :class="{ 'is-previewed': openGear === option.key }">
            <button type="button" class="select-preset" @click="emit('select', option.choice)">
                <strong>{{ option.choice.name }}</strong><span class="apply">使用 ›</span>
                <span>{{ entry.label }} · Lv. {{ option.summary.level }} · {{ option.summary.constellation }}命</span>
                <span>{{ option.summary.weapon }}</span>
                <span>{{ option.summary.talents }}</span>
            </button>
            <component :is="shadcn ? UiPopover : ElPopover"
                v-bind="shadcn ? { open: openGear === option.key, label: option.choice.name + ' · 圣遗物' } : legacyPreview"
                @update:open="openGear = $event ? option.key : null">
                <template #[previewSlot]>
                    <button type="button" class="gear-preview"><span>圣遗物</span> · {{ option.sets }}</button>
                </template>
                <strong>{{ option.choice.name }} · 圣遗物</strong>
                <div class="preset-gear" tabindex="0" :aria-label="option.choice.name + '的圣遗物'">
                    <ArtifactPiecePreview v-for="position in POSITIONS" :key="position" :position="position"
                        :item="option.pieces[position]" :highlight-tags="highlightedTags" />
                </div>
            </component>
        </article>
    </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ElPopover } from 'element-plus'
import UiPopover from '@/components/ui/UiPopover.vue'
import { useArtifactStore } from '@/store/pinia/artifact'
import { presetForRosterLoadout } from '@/import/roster-equipment.mjs'
import { POSITIONS } from '@/import/miyoushe.mjs'
import { characterSummary, equippedSetCounts } from '@/import/character-summary.mjs'
import { characterArtifactHighlights } from '@/utils/character-artifact-highlights'
import ArtifactPiecePreview from '@/components/display/ArtifactPiecePreview.vue'
import { useI18n } from '@/i18n/i18n'
import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import artifacts from '@/assets/_gen_artifact'
import locale from '@/i18n/generated/zh-cn.json'

const props = defineProps({ entry: { type: Object, required: true }, shadcn: Boolean })
const previewSlot = computed(() => props.shadcn ? 'trigger' : 'reference')
const emit = defineEmits(['select'])
const openGear = ref(null)
const legacyPreview = {
    placement: 'bottom-start', trigger: ['hover', 'focus', 'click'], persistent: false,
    width: 'min(640px, 92vw)', showAfter: 100, popperClass: 'cx-scope preset-gear-popover',
}
const { ta } = useI18n()
const inventory = useArtifactStore()
const highlightedTags = computed(() => characterArtifactHighlights(props.entry.characterName))
const options = computed(() => props.entry.choices.map(choice => {
    const preset = choice.loadout ? presetForRosterLoadout(choice.item, choice.loadout) : choice.item
    const summary = characterSummary(props.entry, { preset, characters, weapons, artifacts, locale, inventory: inventory.artifacts.value })
    const sets = [...equippedSetCounts(summary.equipped)].map(([set, count]) => ta(artifacts[set].nameLocale) + ' ×' + count)
    const pieces = Object.fromEntries(summary.equipped.map(item => [item.position, item]))
    return { choice, key: choice.key ?? choice.name, summary, pieces, sets: sets.join(' / ') || '未装备' }
}))
</script>
<style scoped>
.preset-list { display: grid; gap: 10px; }
.preset-option { padding: 12px 16px; border-radius: 12px; background: var(--cx-step); color: var(--cx-letter); }
.preset-option.is-previewed { box-shadow: inset 0 0 0 1px var(--cx-gold); background: color-mix(in srgb, var(--cx-gold) 9%, var(--cx-step)); }
.select-preset, .gear-preview { border: 0; background: transparent; color: inherit; text-align: left; font: inherit; cursor: pointer; }
.select-preset:focus-visible, .gear-preview:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; border-radius: 5px; }
.select-preset { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; width: 100%; padding: 0; }
.select-preset strong { font-size: 16px; overflow-wrap: anywhere; }
.select-preset span:not(.apply) { grid-column: 1 / -1; font-size: 13px; }
.apply, .gear-preview span { color: var(--cx-gold); }
.select-preset:hover strong { color: var(--cx-gold); }
.gear-preview { margin-top: 4px; padding: 4px 0; font-size: 13px; color: var(--cx-dim); }
.gear-preview span { text-decoration: underline dotted; text-underline-offset: 3px; }
.preset-gear { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 8px; margin-top: 8px; overflow-y: auto; max-height: min(50dvh, 400px); }
</style>

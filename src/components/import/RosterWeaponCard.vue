<template>
    <UiHoverDetails :enabled="!!weapon && !choosing" :tap-label="name">
        <template #trigger>
            <section class="weapon cx-panel" :tabindex="weapon ? 0 : undefined">
                <header class="cx-panel-heading"><h4 class="cx-panel-title">武器</h4></header>
                <div class="weapon-body cx-panel-body">
                    <div class="weapon-summary">
                        <div class="weapon-title"><strong>{{ name || '未记录武器' }}</strong>
                            <span v-if="signatures.includes(weaponKey)" class="signature-badge">专武</span>
                        </div>
                        <small v-if="name" class="weapon-level">Lv. {{ level }}{{ weapon?.ascend ? '+' : '' }} · 精炼 {{ refine }} 阶</small>
                        <div v-if="weapon" class="weapon-stats"><WeaponBaseStats :weapon="weapon" /></div>
                        <small v-if="equipment.error" class="issue">{{ equipment.error }}</small>
                    </div>
                    <button ref="trigger" class="weapon-icon" type="button" aria-label="选择武器" aria-haspopup="dialog"
                        :disabled="!weaponType" @click.stop="choosing = true">
                        <img v-if="meta?.url && !imageFailed" :src="meta.url" alt="" @error="imageFailed = true" />
                        <span v-else aria-hidden="true">{{ name ? '⚔' : '＋' }}</span>
                    </button>
                </div>
            </section>
        </template>
        <RosterWeaponDetails v-if="weapon" :weapon="weapon" />
    </UiHoverDetails>
    <CharacterWeaponPicker v-model="choosing" :character-label="entry.label" :weapon-type="weaponType"
        :weapon-key="weaponKey" :weapon="weapon" :signatures="signatures" :return-focus="() => trigger?.focus()" @select="equip" />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import CharacterWeaponPicker from '@/components/select/CharacterWeaponPicker.vue'
import UiHoverDetails from '@/components/ui/UiHoverDetails.vue'
import WeaponBaseStats from '@/components/display/WeaponBaseStats.vue'
import characters from '@/assets/_gen_character'
import { weaponData, weaponByType } from '@/assets/weapon'
import { characterSignatureWeapons } from '@/utils/weapon'
import locale from '@/i18n/generated/zh-cn.json'
import RosterWeaponDetails from './RosterWeaponDetails.vue'
import { weaponNames } from '@/import/enka-catalog.mjs'
import { snapshotWeaponStats } from '@/import/miyoushe.mjs'

const props = defineProps({ entry: { type: Object, required: true } })
const emit = defineEmits(['change-weapon'])
const choosing = ref(false), trigger = ref(null), imageFailed = ref(false)
const raw = computed(() => props.entry.raw?.weapon)
const weaponType = computed(() => characters[props.entry.characterName]?.weapon)
const available = computed(() => weaponByType[weaponType.value] || [])
const weaponKey = computed(() => props.entry.preset?.weapon?.name || weaponNames[raw.value?.id]
    || available.value.find(w => locale[w.nameLocale] === raw.value?.name)?.name)
const meta = computed(() => weaponData[weaponKey.value])
const name = computed(() => locale[meta.value?.nameLocale] || raw.value?.name)
const level = computed(() => props.entry.preset?.weapon?.level ?? raw.value?.level ?? '—')
const refine = computed(() => props.entry.preset?.weapon?.refine ?? raw.value?.affix_level ?? '—')
const equipment = computed(() => {
    if (props.entry.preset?.weapon) return { weapon: props.entry.preset.weapon }
    if (!meta.value || !raw.value) return {}
    try { return { weapon: snapshotWeaponStats(weaponKey.value, raw.value) } }
    catch (e) { return { error: e.message } }
})
const weapon = computed(() => equipment.value.weapon)
const signatures = computed(() => characterSignatureWeapons(props.entry.characterName))
watch(weaponKey, () => { imageFailed.value = false })
function equip(next) {
    if (!props.entry.preset || ['name', 'level', 'refine', 'ascend'].some(key => next[key] !== weapon.value[key])) {
        emit('change-weapon', next, name.value)
    }
}
</script>
<style scoped>
.weapon-body { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.weapon small { margin: 0; font-size: 12px; color: var(--cx-dim); }
.weapon-title { grid-area: 1 / 1; display: flex; gap: 4px 8px; align-items: baseline; flex-wrap: wrap; }
.weapon-title strong { font-size: 18px; overflow-wrap: anywhere; }
.weapon-summary { display: grid; grid-template-columns: minmax(0, auto) auto; align-items: baseline; gap: 4px 8px; min-width: 0; }
.weapon-summary .issue { grid-column: 1 / -1; }
.weapon-level { grid-area: 2 / 1; }
.weapon small.issue { color: var(--cx-gold); }
.signature-badge { --gilt: #946715; --lettering: #fff; background: var(--gilt); color: var(--lettering); border-radius: 999px; padding: 2px 8px; font-size: 12px; line-height: 1.4; font-weight: 700; }
.weapon-icon { --stitch: #000; flex: none; display: grid; place-items: center; box-sizing: border-box; width: 64px; height: 64px; padding: 0; background: transparent; border: 1px dashed var(--stitch); color: var(--cx-gold); border-radius: 10px; font: inherit; font-size: 24px; cursor: pointer; }
html[data-color-mode="dark"] .weapon-icon { --stitch: #fff; }
.weapon-icon:hover { background: var(--cx-step); }
.weapon-icon:focus-visible, .weapon:focus-visible { outline: 2px solid var(--cx-gold); }
.weapon-icon img { width: 60px; height: 60px; object-fit: contain; }
@media (max-width: 480px) {
    .weapon-icon { width: 36px; height: 36px; }
    .weapon-icon img { width: 32px; height: 32px; }
}
.weapon-stats { display: contents; }
.weapon-stats :deep(.weapon-stat) { grid-column: 2; margin: 0; font-size: 13px; }
.weapon-stats :deep(.weapon-stat:first-child) { grid-row: 1; font-size: 16px; line-height: 1.4; font-weight: 650; }
.weapon-stats :deep(.weapon-stat:nth-child(2)) { grid-row: 2; }
.weapon-stats :deep(.weapon-stat:first-child .weapon-stat-value) { font-size: 18px; font-weight: 700; }
</style>

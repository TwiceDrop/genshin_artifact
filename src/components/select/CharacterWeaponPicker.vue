<template>
    <UiDialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :title="draft ? '设置「' + locale[weaponData[draft.name].nameLocale] + '」' : '为' + characterLabel + '选择武器'"
        :width="draft ? '360px' : '760px'" :return-focus="returnFocus" :initial-focus="pickOnly && !coarsePointer ? focusSearch : undefined">
        <form v-if="draft" class="weapon-settings" @submit.prevent="equip">
            <label>武器等级<input v-model.number="draft.level" type="number" required min="1" :max="limits.maxLevel" step="1" /></label>
            <label v-if="canAscend" class="ascension"><input v-model="draft.ascend" type="checkbox" />已突破</label>
            <label>精炼等阶<UiSelect :model-value="String(draft.refine)" label="精炼等阶" :options="refinements"
                @update:model-value="draft.refine = Number($event)" /></label>
            <div class="weapon-actions"><UiButton @click="draft = null">返回</UiButton><UiButton type="submit" variant="primary">确定</UiButton></div>
        </form>
        <template v-else>
            <input ref="searchInput" v-model.trim="search" class="weapon-search" :class="{ 'sticky-search': pickOnly }" type="search" placeholder="搜索武器" aria-label="搜索武器" />
            <div class="weapon-options">
                <UiHoverDetails v-for="item in choices" :key="item.name" enabled>
                    <template #trigger>
                        <button type="button" class="weapon-choice" :aria-pressed="item.name === weaponKey" @click="choose(item)">
                            <span class="thumb" :data-rarity="item.star"><img :src="item.url" alt="" loading="lazy" />
                                <span v-if="signatures.includes(item.name)" class="signature-badge">专武</span>
                            </span><span>{{ locale[item.nameLocale] }}</span>
                        </button>
                    </template>
                    <RosterWeaponDetails :weapon="rosterWeapon(item, weapon)" show-stats />
                </UiHoverDetails>
            </div>
            <p v-if="!choices.length">没有匹配的武器</p>
        </template>
    </UiDialog>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiHoverDetails from '@/components/ui/UiHoverDetails.vue'
import RosterWeaponDetails from '@/components/import/RosterWeaponDetails.vue'
import { weaponData, weaponByType } from '@/assets/weapon'
import locale from '@/i18n/generated/zh-cn.json'
import { BREAKS } from '@/import/miyoushe.mjs'
import { rosterWeapon, rosterWeaponLimits } from '@/import/set-roster-weapon'

const props = defineProps({
    modelValue: Boolean,
    characterLabel: String,
    weaponType: String,
    weaponKey: String,
    weapon: Object,
    availableWeapons: Array,
    pickOnly: Boolean,
    signatures: { type: Array, required: true },
    returnFocus: Function,
})
const emit = defineEmits(['update:modelValue', 'select', 'choose'])
const search = ref('')
const searchInput = ref(null)
const coarsePointer = useMediaQuery('(pointer: coarse)')
const draft = ref(null)
watch(() => props.modelValue, open => {
    if (open) {
        draft.value = null
        search.value = ''
    }
})
const choices = computed(() => (props.availableWeapons ?? weaponByType[props.weaponType] ?? [])
    .filter(w => locale[w.nameLocale].includes(search.value))
    .sort((a, b) => Number(props.signatures.includes(b.name)) - Number(props.signatures.includes(a.name))))
const limits = computed(() => rosterWeaponLimits(weaponData[draft.value.name]))
const canAscend = computed(() => draft.value && draft.value.level < limits.value.maxLevel && BREAKS.includes(draft.value.level))
const refinements = computed(() => Array.from({ length: limits.value.maxRefine }, (_, i) => ({ value: String(i + 1), label: (i + 1) + ' 阶' })))
function focusSearch() {
    searchInput.value?.focus({ preventScroll: true })
}
function choose(item) {
    if (props.pickOnly) {
        emit('update:modelValue', false)
        emit('choose', item.name)
    } else {
        draft.value = rosterWeapon(item, props.weapon)
    }
}
function equip() {
    const next = { ...draft.value, ascend: canAscend.value && draft.value.ascend }
    emit('update:modelValue', false)
    emit('select', next)
}
</script>
<style scoped>
.signature-badge { --gilt: #946715; --lettering: #fff; background: var(--gilt); color: var(--lettering); border-radius: 999px; padding: 2px 8px; font-size: 12px; line-height: 1.4; font-weight: 700; }
.weapon-choice:hover { background: var(--cx-step); border-color: var(--cx-step-2); }
.weapon-choice:focus-visible { outline: 2px solid var(--cx-gold); }
.weapon-search { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--cx-step-2); border-radius: 9px; background: var(--cx-step); color: var(--cx-letter); font: inherit; }
.sticky-search { position: sticky; top: 0; z-index: 1; }
.weapon-options { margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fill,minmax(84px,1fr)); gap: 6px; }
.weapon-choice { min-width: 0; border: 1px solid transparent; background: transparent; border-radius: 10px; padding: 6px 3px; color: var(--cx-letter); font: inherit; font-size: 12px; cursor: pointer; display: grid; align-content: start; justify-items: center; gap: 4px; }
.weapon-choice[aria-pressed=true] { border-color: var(--cx-gold); background: var(--cx-step); }
.thumb { position: relative; display: grid; place-items: center; width: 62px; height: 62px; border-radius: 9px; background: var(--cx-step-2); }
.thumb[data-rarity="5"] { background: linear-gradient(145deg,#76513e,#c69960); }
.thumb[data-rarity="4"] { background: linear-gradient(145deg,#554c72,#9886b2); }
.thumb img { position: absolute; inset: 5%; width: 90%; height: 90%; object-fit: contain; }
.weapon-settings { display: grid; gap: 12px; }
.weapon-settings label, .weapon-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.weapon-settings input[type="number"] { width: 70px; padding: 7px; border: 1px solid var(--cx-step-2); border-radius: 8px; color: var(--cx-letter); background: var(--cx-step); font: inherit; }
.weapon-settings .ascension, .weapon-actions { justify-content: flex-end; }
.thumb .signature-badge { position: absolute; top: 0; right: -3px; padding: 1px 5px; font-size: 10px; }
</style>

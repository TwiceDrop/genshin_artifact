<template>
    <section class="mys-character-picker">
        <div v-if="uidGroups.length" class="character-uid-list" aria-label="已保存角色的 UID">
            <button v-for="group in uidGroups" :key="group.uid" type="button" class="character-uid"
                :class="{ active: selectedUid === group.uid }" :aria-pressed="selectedUid === group.uid"
                :disabled="disabled" @click="selectUid(group.uid)">
                <strong>{{ group.nickname }} · UID {{ group.uid }}</strong>
                <span>{{ group.regionName }} · {{ group.count }} 名角色</span>
            </button>
        </div>
        <p v-if="selectedUid" class="character-uid-summary">UID {{ selectedUid }} · 已保存 {{ uidEntries.length }} 名角色</p>
        <div class="character-element-tabs" role="group" aria-label="按元素筛选">
            <button type="button" :aria-pressed="element === 'all'" @click="element = 'all'">全部</button>
            <button v-for="(name, key) in ELEMENT_NAMES" :key="key" type="button" :aria-pressed="element === key" @click="element = key">
                <img :src="elementIcons[key]" alt="" />{{ name }}
            </button>
        </div>
        <div class="character-picker-list">
            <button v-for="entry in visibleEntries" :key="entry.key" type="button" class="character-picker-row"
                :disabled="disabled || !!entry.error" :aria-label="`选择${entry.label}，${entry.uid}`" @click="emit('apply', entry.presetName)">
                <span class="character-art-frame"><CharacterPortrait v-if="entry.splash" thumbnail :character-name="entry.characterName" :splash="entry.splash" :avatar="entry.avatar" :alt="`${entry.label}立绘`" loading="lazy" /></span>
                <span class="character-body">
                    <span class="character-identity-line"><strong>{{ entry.label }}</strong><span class="character-element"><img v-if="elementIcons[entry.element]" :src="elementIcons[entry.element]" :alt="`${entry.elementLabel}元素`" />{{ entry.elementLabel }}</span></span>
                    <span class="character-tags"><b>{{ entry.constellation }}命</b><span>{{ entry.weaponType }}</span></span>
                    <small v-if="multipleUids">UID {{ entry.uid }}</small>
                    <small v-if="entry.error" class="character-warning">{{ entry.error }}</small>
                    <small v-else-if="entry.warning" class="character-warning">{{ entry.warning }}</small>
                    <span class="character-equipment">
                        <span>{{ entry.weapon }}</span>
                        <span>圣遗物套装：{{ entry.set }}</span>
                        <span>{{ entry.talents }}</span>
                    </span>
                </span>
            </button>
            <p v-if="!visibleEntries.length" class="character-picker-empty">{{ entries.length ? '暂无该元素的已导入角色' : '暂无已导入角色，请先同步账号或恢复角色快照' }}</p>
        </div>
    </section>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { usePresetStore } from '@/store/pinia/preset'
import { useArtifactStore } from '@/store/pinia/artifact'
import characters from '@/assets/_gen_character'
import weapons from '@/assets/_gen_weapon'
import artifacts from '@/assets/_gen_artifact'
import locale from '@/i18n/generated/zh-cn.json'
import { characterSummary, ELEMENT_NAMES, isPickerCharacter } from '@/import/character-summary.mjs'
import elementIcons from "@/assets/element-icons"
import CharacterPortrait from '@/components/display/CharacterPortrait.vue'
defineProps({ disabled: Boolean })
const emit = defineEmits(['apply'])
const element = ref('all')
const store = useMiyousheStore(), presets = usePresetStore(), inventory = useArtifactStore()
const { uidGroups, selectedUid } = store
function selectUid(uid) { selectedUid.value = uid; element.value = 'all' }
const entries = computed(() => store.data.value.entries.map(entry => {
    const raw = store.data.value.snapshots[entry.uid]?.characters.find(c => `${entry.uid}:${c.base?.id}:${c.base?.element || ''}` === entry.key)
    return characterSummary(entry, { preset: presets.getPreset(entry.presetName)?.item, raw, characters, weapons, artifacts, locale, inventory: inventory.artifacts.value })
}))
const multipleUids = computed(() => new Set(entries.value.map(e => e.uid)).size > 1)
const uidEntries = computed(() => entries.value.filter(e => String(e.uid) === selectedUid.value))
const visibleEntries = computed(() => uidEntries.value.filter(e =>
    isPickerCharacter(e.characterName, e.label) && (element.value === 'all' || e.element === element.value)))
</script>
<style scoped src="../select/character-picker.css"></style>

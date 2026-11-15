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
                <span class="character-art-frame"><img v-if="entry.splash" class="character-art" :src="entry.splash" :alt="`${entry.label}立绘`" loading="lazy" /></span>
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
import { characterSummary, ELEMENT_NAMES } from '@/import/character-summary.mjs'
import elementIcons from "@/assets/element-icons"
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
const visibleEntries = computed(() => uidEntries.value.filter(e => element.value === 'all' || e.element === element.value))
</script>
<style scoped>
/* 已保存的角色：UID 胶囊、元素胶囊、角色卡片网格。颜色读 --cx-*。 */
.mys-character-picker { display: grid; gap: 12px; color: var(--cx-letter); }
.character-uid-list { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: thin; }
.character-uid { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; padding: 10px 16px; border: 0; border-radius: 14px; background: var(--cx-step); color: inherit; font: inherit; text-align: left; cursor: pointer; }
.character-uid:hover:not(:disabled) { background: var(--cx-step-2); }
.character-uid.active { background: var(--cx-gold); color: var(--cx-gold-on); }
.character-uid span { font-size: 12px; color: var(--cx-dim); }
.character-uid.active span { color: inherit; opacity: .8; }
.character-uid-summary { margin: 0; font-size: 13px; color: var(--cx-dim); }
.character-element-tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.character-element-tabs button { display: inline-flex; align-items: center; gap: 5px; flex: none; height: 34px; padding: 0 14px; border: 0; border-radius: 999px; background: var(--cx-step); color: var(--cx-dim); font: inherit; font-size: 13px; cursor: pointer; }
.character-element-tabs button:hover { background: var(--cx-step-2); color: var(--cx-letter); }
.character-element-tabs button[aria-pressed=true] { background: var(--cx-gold); color: var(--cx-gold-on); font-weight: 600; }
.character-element-tabs img { width: 18px; height: 18px; object-fit: contain; }
.character-picker-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 10px; }
.character-picker-row { display: flex; gap: 12px; min-width: 0; padding: 10px 14px 10px 10px; border: 0; border-radius: 16px; background: var(--cx-step); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
.character-picker-row:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 0 0 2px var(--cx-step-2); }
.character-picker-row:disabled { cursor: default; opacity: .7; }
.character-uid:focus-visible, .character-element-tabs button:focus-visible, .character-picker-row:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.character-art-frame { flex: none; width: 84px; height: 104px; border-radius: 12px; overflow: hidden; background: var(--cx-step-2); }
.character-art { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
.character-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.character-identity-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.character-identity-line strong { font-size: 16px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.character-element { display: inline-flex; align-items: center; gap: 3px; flex: none; color: var(--cx-dim); font-size: 12px; }
.character-element img { width: 18px; height: 18px; object-fit: contain; }
.character-tags { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--cx-dim); }
.character-tags b { padding: 1px 8px; border-radius: 999px; background: var(--cx-step-2); color: var(--cx-gold); }
.character-body small { color: var(--cx-dim); font-size: 12px; }
.character-equipment { display: grid; gap: 2px; margin-top: auto; font-size: 12px; line-height: 1.5; color: var(--cx-dim); }
.character-equipment span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.character-equipment span:first-child { color: var(--cx-letter); }
.character-warning { color: var(--cx-gold) !important; }
.character-picker-empty { grid-column: 1 / -1; margin: 0; text-align: center; padding: 35px 12px; color: var(--cx-dim); font-size: 14px; }
@media (prefers-reduced-motion: reduce) { .character-picker-row { transition: none; } }
</style>

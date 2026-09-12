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
        <el-tabs v-model="element" class="character-element-tabs">
            <el-tab-pane label="全部" name="all" />
            <el-tab-pane v-for="(name, key) in ELEMENT_NAMES" :key="key" :name="key">
                <template #label><span class="element-tab"><img :src="elementIcons[key]" alt="" />{{ name }}</span></template>
            </el-tab-pane>
        </el-tabs>
        <div class="character-picker-list">
            <button v-for="entry in visibleEntries" :key="entry.key" type="button" class="character-picker-row"
                :disabled="disabled || !!entry.error" :aria-label="`选择${entry.label}，${entry.uid}`" @click="emit('apply', entry.presetName)">
                <div class="character-picker-left">
                    <img v-if="entry.splash" class="character-art" :src="entry.splash" :alt="`${entry.label}立绘`" loading="lazy" />
                    <div class="character-identity">
                        <div class="character-identity-line"><strong>{{ entry.label }}</strong><span class="character-element"><img v-if="elementIcons[entry.element]" :src="elementIcons[entry.element]" :alt="`${entry.elementLabel}元素`" />{{ entry.elementLabel }}</span><span>{{ entry.weaponType }}</span><span>{{ entry.constellation }}命</span></div>
                        <small v-if="multipleUids">UID {{ entry.uid }}</small>
                        <small v-if="entry.error" class="character-warning">{{ entry.error }}</small>
                        <small v-else-if="entry.warning" class="character-warning">{{ entry.warning }}</small>
                    </div>
                </div>
                <div class="character-equipment">
                    <p>{{ entry.talents }}</p>
                    <p>圣遗物套装：{{ entry.set }}</p>
                    <p>{{ entry.weapon }}</p>
                </div>
            </button>
            <p v-if="!visibleEntries.length" class="character-picker-empty">{{ entries.length ? '暂无该元素的已导入角色' : '暂无已导入角色，请先通过米游社同步或恢复角色快照' }}</p>
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
import pyro from '@/images/misc/pyro.png'
import hydro from '@/images/misc/hydro.png'
import anemo from '@/images/misc/anemo.png'
import electro from '@/images/misc/electro.png'
import dendro from '@/images/misc/dendro.png'
import cryo from '@/images/misc/cryo.png'
import geo from '@/images/misc/geo.png'
defineProps({ disabled: Boolean })
const emit = defineEmits(['apply'])
const element = ref('all'), elementIcons = { Pyro: pyro, Hydro: hydro, Anemo: anemo, Electro: electro, Dendro: dendro, Cryo: cryo, Geo: geo }
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
.mys-character-picker{color:var(--el-text-color-primary)}
.character-uid-list{display:flex;gap:10px;overflow-x:auto;padding:4px 0 10px}
.character-uid{display:flex;flex-direction:column;gap:6px;flex-shrink:0;padding:12px 16px;border:1px solid var(--el-border-color);border-radius:8px;background:var(--el-fill-color-light);color:inherit;font:inherit;text-align:left;cursor:pointer}
.character-uid.active{border-color:var(--el-color-primary);background:var(--el-color-primary-light-9);color:var(--el-color-primary)}
.character-uid span,.character-uid-summary{font-size:13px;color:var(--el-text-color-secondary)}
.character-uid:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:1px}
.character-element-tabs :deep(.el-tabs__header){margin-bottom:0}
.element-tab{display:inline-flex;align-items:center;gap:6px}.element-tab img{width:20px;height:20px;object-fit:contain}
.character-picker-list{max-height:58vh;overflow:auto}
.character-picker-row{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(230px,1fr);gap:24px;width:100%;padding:12px 16px 12px 0;border:0;border-bottom:1px solid var(--el-border-color-lighter);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;align-items:center}
.character-picker-row:hover:not(:disabled){background:var(--el-fill-color-light)}.character-picker-row:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:-2px}.character-picker-row:disabled{cursor:default}
.character-picker-left{display:flex;align-items:center;gap:12px;min-width:0}.character-art{width:100px;height:112px;object-fit:contain;flex-shrink:0}
.character-identity{min-width:0}.character-identity-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px;line-height:1.8}.character-identity-line strong{font-size:17px;font-weight:600}
.character-element{display:inline-flex;align-items:center;gap:3px}.character-element img{width:20px;height:20px;object-fit:contain}.character-identity small{display:block;color:var(--el-text-color-secondary);margin-top:5px;font-size:12px}
.character-equipment{font-size:14px;line-height:1.8}.character-equipment p{margin:3px 0;overflow-wrap:anywhere}.character-warning{color:var(--el-color-warning)!important}.character-picker-empty{text-align:center;padding:35px 12px;color:var(--el-text-color-secondary);font-size:14px}
@media(max-width:650px){.character-picker-row{grid-template-columns:1fr;gap:4px;padding-right:8px}.character-art{width:76px;height:86px}.character-equipment{padding-left:88px;font-size:13px}.character-identity-line{gap:6px}}
</style>

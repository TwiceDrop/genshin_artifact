<template>
                <div class="fields">
                    <label>套装<select v-model="draft.setName" aria-label="套装" required><option value=""></option>
                        <option v-for="(set, key) in sets" :key="key" :value="key">{{ locale[set.nameLocale] }}</option>
                    </select></label>
                    <label>部位<select v-model="draft.position" aria-label="部位" required><option value=""></option>
                        <option v-for="(label, key) in slotLabels" :key="key" :value="key">{{ label }}</option>
                    </select></label>
                    <label>星级<select v-model="draft.star" aria-label="星级" required><option value=""></option>
                        <option v-for="star in rarities" :value="star" :key="star">{{ star }} 星</option>
                    </select></label>
                    <label>等级<input v-model="draft.level" type="number" min="0" :max="maxLevel" step="1" required /></label>
                </div>
                <h4>主词条</h4>
                <div class="tag">
                    <select v-model="draft.mainTag.name" aria-label="主词条" required><option value=""></option>
                        <option v-for="key in mainStatMap[draft.position]" :key="key" :value="key">{{ tagLabel(key) }}</option>
                    </select>
                    <input v-model="draft.mainTag.value" type="number" min="0.01" step="any" aria-label="主词条数值" required />
                </div>
                <h4>副词条</h4>
                <div v-for="(tag, i) in draft.normalTags" :key="i" class="tag">
                    <select v-model="tag.name" :aria-label="'副词条 ' + (i+1)" required><option value=""></option>
                        <option v-for="key in subStats" :key="key" :value="key">{{ tagLabel(key) }}</option>
                    </select>
                    <input v-model="tag.value" type="number" min="0.01" step="any" :aria-label="'副词条数值 ' + (i+1)" required />
                    <button type="button" :aria-label="'移除副词条 ' + (i+1)" @click="draft.normalTags.splice(i, 1)">×</button>
                </div>
                <button v-if="draft.normalTags.length < 4" type="button" @click="draft.normalTags.push({name: '', value: ''})">＋ 副词条</button>
</template>
<script setup>
import { computed } from 'vue'
import sets from '@/assets/_gen_artifact'
import locale from '@/i18n/generated/zh-cn.json'
import { artifactTags, mainStatMap, subStats } from '@/constants/artifact'
import { slotLabels } from '@/import/artifact-screenshot.mjs'
const props = defineProps({ draft: { type: Object, required: true } })
const rarities = computed(() => [1,2,3,4,5].filter(n => !props.draft?.setName ||
    (n >= sets[props.draft.setName].minStar && n <= sets[props.draft.setName].maxStar)))
const maxLevel = computed(() => [0,4,4,12,16,20][props.draft?.star] || 20)
const tagLabel = key => artifactTags[key].chs.replace(/%$/, '') + (artifactTags[key].percentage ? ' (%)' : '')
</script>
<style scoped>
.fields { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
label { display: grid; gap: 4px; font-size: 13px; }
.tag { display: flex; gap: 6px; margin: 6px 0; }
.tag select { flex: 1 1 55%; } .tag input { width: 30%; }
button, select, input { font: inherit; color: var(--cx-letter); }
button, select, input[type=number] { min-width: 0; padding: 6px 9px; border: 1px solid var(--cx-step-2); border-radius: 7px; background: var(--cx-step); }
button { cursor: pointer; } h4 { margin: 12px 0 6px; } .image-column button { margin-top: 8px; }
</style>

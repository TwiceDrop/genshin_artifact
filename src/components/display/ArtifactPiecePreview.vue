<template>
    <section class="artifact-piece-preview">
        <small>{{ t('misc', position) }}</small>
        <template v-if="item">
            <b>{{ ta(artifacts[item.setName][position].text) }} +{{ item.level }} · {{ item.star }}★</b>
            <strong :class="{ recommended: highlightedMainStat(item, highlightTags) }">{{ displayedTag(item.mainTag.name, item.mainTag.value) }}</strong>
            <span v-for="(tag, index) in item.normalTags" :key="tag.name" :class="{ recommended: highlightedSubStat(tag.name, highlightTags) }">
                {{ displayedTag(tag.name, tag.value) }}<ArtifactUpgradeCount :count="hits[index]" />
            </span>
        </template>
        <span v-else>未装备</span>
    </section>
</template>
<script setup>
import { computed } from 'vue'
import artifacts from '@/assets/_gen_artifact'
import { useI18n } from '@/i18n/i18n'
import { displayedTag, displayedUpgradeHits } from '@/utils/artifacts'
import { highlightedMainStat, highlightedSubStat } from '@/utils/character-artifact-highlights'
import ArtifactUpgradeCount from './ArtifactUpgradeCount.vue'

const props = defineProps({
    position: { type: String, required: true },
    item: Object,
    highlightTags: Array,
})
const { t, ta } = useI18n()
const hits = computed(() => displayedUpgradeHits(props.item))
</script>
<style scoped>
.artifact-piece-preview { display: grid; align-content: start; gap: 3px; padding: 10px; border-radius: 8px; background: var(--cx-step); color: var(--cx-letter); font-size: 13px; }
.artifact-piece-preview > small { color: var(--cx-dim); }
.recommended { color: var(--cx-gold); }
</style>

<template>
    <Teleport v-if="current" to="body">
        <div :id="previewId" :key="current.anchor.dataset.preview" ref="panel"
            class="tr-artifact-preview cx-scope mona-hover-enter" role="tooltip"
            :data-state="panelPosition.visibility === 'hidden' ? 'positioning' : 'open'"
            :style="[panelPosition, { '--tr-azure': azure }]">
            <header class="tr-preview-heading">
                <strong>{{ current.detail.name }}</strong>
                <span>+{{ current.detail.item.level }}</span>
            </header>
            <div class="tr-preview-slot">{{ current.detail.slotLabel }}</div>
            <div v-if="mainStat" class="tr-preview-stat tr-preview-main">
                <strong>{{ mainStat[0] }}</strong>
                <strong>{{ mainStat[1] }}</strong>
            </div>
            <ul v-if="subStats.length" class="tr-preview-subs">
                <li v-for="stat in subStats" :key="stat.name" class="tr-preview-stat">
                    <span>{{ stat.label }}<ArtifactUpgradeCount :count="stat.hits" /></span>
                    <strong>{{ stat.value }}</strong>
                </li>
            </ul>
            <p v-if="current.detail.different" class="tr-preview-diff">与第1套此部位装备不同</p>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { CSSProperties } from 'vue'
import ArtifactUpgradeCount from '@/components/display/ArtifactUpgradeCount.vue'
import type { IArtifact } from '@/types/artifact'
import { displayedTagParts, displayedUpgradeHits } from '@/utils/artifacts'

defineProps<{ azure: string }>()

type PreviewTrigger = 'pointer' | 'focus'
interface PreviewDetail {
    item: IArtifact
    name: string
    slotLabel: string
    different: boolean
}
interface ArtifactPreview {
    anchor: HTMLElement
    detail: PreviewDetail
    trigger: PreviewTrigger
}

const previewId = `team-result-artifact-preview-${getCurrentInstance()!.uid}`
const current = shallowRef<ArtifactPreview | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelPosition = ref<CSSProperties>({})
const item = computed(() => current.value?.detail.item)

const mainStat = computed(() => {
    const tag = item.value?.mainTag
    return tag && displayedTagParts(tag.name, tag.value)
})
const subStats = computed(() => {
    const artifact = item.value
    if (!artifact) return []
    const hits = displayedUpgradeHits(artifact)
    return artifact.normalTags.map((tag, index) => {
        const [label, value] = displayedTagParts(tag.name, tag.value)
        return { name: tag.name, label, value, hits: hits[index] }
    })
})

function describe(anchor: HTMLElement, attach: boolean) {
    const ids = new Set(anchor.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean))
    if (attach) ids.add(previewId)
    else ids.delete(previewId)
    if (ids.size) anchor.setAttribute('aria-describedby', [...ids].join(' '))
    else anchor.removeAttribute('aria-describedby')
}

function onViewportChange() {
    dismiss()
}

function dismiss(anchor?: HTMLElement, trigger?: PreviewTrigger) {
    const previous = current.value
    if (!previous || (anchor && previous.anchor !== anchor) || (trigger && previous.trigger !== trigger)) return
    describe(previous.anchor, false)
    const owner = previous.anchor.ownerDocument
    owner.removeEventListener('scroll', onViewportChange, true)
    owner.defaultView?.removeEventListener('resize', onViewportChange)
    owner.defaultView?.removeEventListener('blur', onViewportChange)
    current.value = null
}

async function show(anchor: HTMLElement, detail: PreviewDetail, trigger: PreviewTrigger) {
    const previous = current.value
    if (previous?.anchor === anchor && previous.trigger === trigger) return
    dismiss()
    const owner = anchor.ownerDocument
    const next = { anchor, detail, trigger }
    panelPosition.value = { visibility: 'hidden' }
    current.value = next
    describe(anchor, true)
    owner.addEventListener('scroll', onViewportChange, { capture: true, passive: true })
    owner.defaultView?.addEventListener('resize', onViewportChange)
    owner.defaultView?.addEventListener('blur', onViewportChange)

    await nextTick()
    if (current.value !== next || !panel.value) return
    const anchorRect = anchor.getBoundingClientRect()
    const previewRect = panel.value.getBoundingClientRect()
    const { clientWidth, clientHeight } = owner.documentElement
    const margin = 12
    const gap = 8
    const below = anchorRect.bottom + gap
    const above = anchorRect.top - gap - previewRect.height
    const preferredTop = below + previewRect.height <= clientHeight - margin ? below : above
    const top = Math.max(margin, Math.min(preferredTop, clientHeight - previewRect.height - margin))
    const left = Math.max(margin, Math.min(anchorRect.left, clientWidth - previewRect.width - margin))
    const layer = anchor.closest('[data-slot="dialog-content"]')
    const zIndex = layer ? Number(owner.defaultView?.getComputedStyle(layer).zIndex) + 1 : 3000
    panelPosition.value = { top: `${top}px`, left: `${left}px`, zIndex }
}

onBeforeUnmount(dismiss)
defineExpose({ show, dismiss })
</script>

<style scoped>
.tr-artifact-preview {
    position: fixed;
    width: max-content;
    min-width: min(230px, calc(100vw - 24px));
    max-width: min(280px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: hidden;
    box-sizing: border-box;
    padding: 12px 14px;
    border: 1px solid var(--cx-step-2);
    border-radius: 12px;
    background: var(--cx-card);
    color: var(--cx-letter);
    box-shadow: 0 10px 24px color-mix(in srgb, var(--cx-letter) 16%, transparent);
    pointer-events: none;
    font-size: 12px;
    line-height: 1.45;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
}

.tr-preview-heading, .tr-preview-stat {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
}

.tr-preview-heading {
    margin-bottom: 4px;
    font-size: 14px;
}

.tr-preview-heading > span {
    flex-shrink: 0;
    color: var(--cx-gold);
    font-weight: 700;
}

.tr-preview-slot, .tr-preview-subs, .tr-preview-diff { color: var(--cx-dim); }
.tr-preview-main { margin-top: 8px; }

.tr-preview-subs {
    display: grid;
    gap: 4px;
    margin: 8px 0 0;
    padding: 8px 0 0;
    border-top: 1px solid var(--cx-step-2);
    list-style: none;
}

.tr-preview-subs strong { color: var(--cx-letter); }

.tr-preview-diff {
    color: color-mix(in srgb, var(--tr-azure) 48%, var(--cx-letter));
    margin: 8px 0 0;
    padding-top: 8px;
    border-top: 1px dashed var(--cx-step-2);
}
</style>

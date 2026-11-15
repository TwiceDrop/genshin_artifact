<template>
    <section class="kumi-card">
        <header class="kumi-head">
            <div class="kumi-title">
                <h3>{{ props.data.title }}</h3>
                <p>{{ summary || '还没有圣遗物' }}</p>
            </div>
            <el-dropdown trigger="click" @command="handleCommand">
                <button type="button" class="kumi-menu" :aria-label="`${props.data.title} 的操作`"><icon-ep-more-filled aria-hidden="true" /></button>
                <template #dropdown><el-dropdown-menu>
                    <el-dropdown-item command="edit">重命名</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu></template>
            </el-dropdown>
        </header>
        <div class="kumi-slots">
            <div v-for="(artifact, index) in artifacts" :key="positions[index]" class="kumi-slot" :class="{ empty: !artifact }">
                <button type="button" class="kumi-slot-main"
                        :aria-label="artifact ? `更换${slotLabel(index)}` : `选择${slotLabel(index)}`"
                        :title="artifact ? `${slotLabel(index)} · ${mainText(artifact)}` : undefined"
                        @click="emits('click', positions[index])">
                    <template v-if="artifact">
                        <artifact-icon :item="artifact" :size="52" />
                        <span class="kumi-slot-stat">{{ mainValue(artifact) }}</span>
                    </template>
                    <template v-else>
                        <span class="kumi-slot-empty"><img :src="slotIcons[positions[index]]" alt="" /><b>+</b></span>
                        <span class="kumi-slot-stat">{{ slotLabel(index) }}</span>
                    </template>
                </button>
                <button v-if="artifact" type="button" class="kumi-slot-remove" :aria-label="`从这组移除${slotLabel(index)}`"
                        @click="emits('deleteArtifact', artifact.id)">×</button>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
// 圣遗物套装卡片：组名、套装汇总、五个部位格。事件接口与改版前一致。
import IconEpMoreFilled from "~icons/ep/more-filled"
import {computed} from "vue"
import {positions} from "@/constants/artifact"
import slotIcons from "@/assets/artifacts/icons"
import {artifactsData} from "@/assets/artifacts"
import {displayedTagParts} from "@/utils/artifacts"
import ArtifactIcon from "@/components/display/ArtifactIcon.vue"
import {useI18n} from "@/i18n/i18n"
import type {KumiItem} from "@/types/kumi"
import type {IArtifact, ArtifactPosition} from "@/types/artifact"
import {useArtifactStore} from "@/store/pinia/artifact"

interface Emits {
    (e: "click", p: ArtifactPosition): void,
    (e: "deleteArtifact", id: number): void,
    (e: "delete"): void,
    (e: "edit"): void
}
const emits = defineEmits<Emits>()
const props = defineProps<{ data: KumiItem }>()
const { t, ta } = useI18n()
const artifactStore = useArtifactStore()

// 按部位排好的五件；缺的部位为 null
const artifacts = computed(() => {
    const byPosition: Partial<Record<ArtifactPosition, IArtifact>> = {}
    for (const id of props.data.artifactIds ?? []) {
        const artifact = id ? artifactStore.artifacts.value.get(id) : undefined
        if (artifact) byPosition[artifact.position] = artifact
    }
    return positions.map(position => byPosition[position] ?? null)
})

// 套装汇总：按件数从多到少，如「炽烈的炎之魔女 4 · 角斗士的终幕礼 1」
const summary = computed(() => {
    const counts = new Map<string, number>()
    for (const artifact of artifacts.value) if (artifact) counts.set(artifact.setName, (counts.get(artifact.setName) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
        .map(([setName, count]) => `${ta((artifactsData as any)[setName].nameLocale)} ${count}`).join(' · ')
})

function slotLabel(index: number) {
    return t("misc", positions[index])
}
function mainText(artifact: IArtifact) {
    return displayedTagParts(artifact.mainTag.name, artifact.mainTag.value).join(" ")
}
function mainValue(artifact: IArtifact) {
    return displayedTagParts(artifact.mainTag.name, artifact.mainTag.value)[1]
}
function handleCommand(command: string) {
    if (command === "edit") emits("edit")
    else emits("delete")
}
</script>

<style lang="scss" scoped>
.kumi-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px 18px;
    border-radius: 16px;
    background: var(--cx-card);
    color: var(--cx-letter);
}

.kumi-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.kumi-title {
    flex: 1;
    min-width: 0;

    h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    p {
        margin: 2px 0 0;
        color: var(--cx-dim);
        font-size: 13px;
    }
}

.kumi-menu {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: var(--cx-step);
    color: var(--cx-dim);
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
        color: var(--cx-letter);
    }
}

.kumi-slots {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
}

.kumi-slot {
    position: relative;
}

.kumi-slot-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 4px 8px;
    border: 0;
    border-radius: 12px;
    background: var(--cx-step);
    color: var(--cx-letter);
    font: inherit;
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
    }
}

.kumi-slot-stat {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.kumi-slot.empty .kumi-slot-stat {
    color: var(--cx-dim);
    font-weight: 400;
}

.kumi-slot-empty {
    position: relative;
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: var(--cx-card);

    img {
        width: 26px;
        height: 26px;
        opacity: .45;
    }

    b {
        position: absolute;
        right: 4px;
        bottom: 0;
        color: var(--cx-gold);
    }
}

html[data-color-mode="dark"] .kumi-slot-empty img {
    filter: invert(1);
}

// 移除按钮：悬停或键盘聚焦到这一格时出现
.kumi-slot-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--cx-card);
    color: var(--cx-up);
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity .15s ease;
}

.kumi-slot:hover .kumi-slot-remove,
.kumi-slot:focus-within .kumi-slot-remove {
    opacity: 1;
}

// 触屏没有悬停，移除按钮常显
@media (hover: none) {
    .kumi-slot-remove {
        opacity: 1;
    }
}

.kumi-card button:focus-visible {
    outline: 2px solid var(--cx-gold);
    outline-offset: 2px;
}
</style>

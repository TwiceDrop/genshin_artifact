<template>
    <span class="art-icon" :data-star="item.star" :style="{ width: size + 'px', height: size + 'px' }">
        <img :src="image" alt="" :style="{ width: size - 4 + 'px', height: size - 4 + 'px' }" />
        <span class="art-level">+{{ item.level }}</span>
    </span>
</template>

<script setup lang="ts">
// 圣遗物图标：品级底色 + 右下角等级，卡片和详情共用
import {computed} from "vue"
import {artifactsData} from "@/assets/artifacts"
import type {IArtifact} from "@/types/artifact"

const props = withDefaults(defineProps<{ item: IArtifact, size?: number }>(), { size: 58 })
const image = computed(() => (artifactsData as any)[props.item.setName]?.[props.item.position]?.url)
</script>

<style lang="scss" scoped>
.art-icon {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 12px;
    // 品级底色；变量名避开 postcss-mona-colors.cjs 的角色词，深色模式下不被改色
    --rarity-a: #8a5a2b;
    --rarity-b: #c9893d;
    background: linear-gradient(160deg, var(--rarity-a), var(--rarity-b));

    &[data-star="4"] {
        --rarity-a: #5a4a8a;
        --rarity-b: #9a76c9;
    }

    &[data-star="3"] {
        --rarity-a: #3a5a8a;
        --rarity-b: #5b8ec9;
    }
}

.art-level {
    position: absolute;
    right: -4px;
    bottom: -4px;
    padding: 0 5px;
    border-radius: 6px;
    background: var(--sh-night);
    color: var(--sh-letter);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
}
</style>

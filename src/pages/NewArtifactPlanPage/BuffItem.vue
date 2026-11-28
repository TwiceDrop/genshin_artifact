<template>
    <div class="buff-root" :class="{ 'buff-root-migrated': shadcn }">
        <div class="top" :class="{ lock }">
            <p class="buff-title">{{ displayName }}</p>
            <div v-if="shadcn" class="buttons">
                <UiButton class="button" size="small" variant="danger" :aria-label="`删除${displayName}`" @click="emits('delete')">
                    <IconEpDelete aria-hidden="true" />
                </UiButton>
                <UiButton class="button" size="small" :aria-pressed="!lock"
                    :aria-label="`${lock ? '启用' : '停用'}${displayName}`" @click="emits('toggle')">
                    <component :is="lock ? IconEpUnlock : IconEpLock" aria-hidden="true" />
                </UiButton>
            </div>
            <div v-else class="buttons">
                <el-button
                    text
                    circle
                    class="button"
                    :icon="IconEpDelete"
                    :aria-label="`删除${displayName}`"
                    @click="emits('delete')"
                ></el-button>
                <el-button
                    text
                    circle
                    class="button"
                    :icon="lock ? IconEpUnlock : IconEpLock"
                    :aria-label="`${lock ? '启用' : '停用'}${displayName}`"
                    @click="emits('toggle')"
                ></el-button>
            </div>
        </div>

        <div class="detail">
            <img v-if="data.badge" :src="data.badge">
            <div>
                <p v-if="description"><span v-html="description"></span></p>
            </div>
        </div>
        
        <item-config
            v-if="data.config.length > 0"
            :model-value="props.buffConfig"
            @update:modelValue="handleChangeConfig"
            :item-name="props.buff.name"
            :shadcn="shadcn"
            :configs="data.config"
        ></item-config>
    </div>
</template>

<script setup lang="ts">
import { buffData } from "@buff"

import ItemConfig from "@c/config/ItemConfig"
import UiButton from '@/components/ui/UiButton.vue'
import {type BuffEntry} from "@/composables/buff"

import IconEpDelete from "~icons/ep/delete"
import IconEpLock from "~icons/ep/lock"
import IconEpUnlock from "~icons/ep/unlock"
import {useI18n} from "@/i18n/i18n";

const { t, ta } = useI18n()

interface Props {
    buff: BuffEntry,
    buffConfig: any
    shadcn?: boolean
}

const props = defineProps<Props>()

interface Emits {
    (e: "update:buffConfig", v: any): void,
    (e: "delete"): void,
    (e: "toggle"): void,
}

const emits = defineEmits<Emits>()

function handleChangeConfig(v: any) {
    emits("update:buffConfig", v)
}

const data = computed((): any => {
    return buffData[props.buff.name] || { config: [], badge: '' }
})

const displayName = computed(() => data.value.nameLocale ? ta(data.value.nameLocale) : `已移除的 BUFF：${props.buff.name}`)

const lock = computed(() => {
    return props.buff.lock
})

const description = computed(() => {
    if (!buffData[props.buff.name]) return '此旧配置已不再提供计算。可删除或停用这一项后继续，其他已保存配置会保留。'
    return data.value.description ? ta(data.value.description) : null
})
</script>

<style lang="scss" scoped>
.buff-root.buff-root-migrated {
    .top {
        border-bottom-color: var(--cx-step-2);
        &.lock { background: var(--cx-step); }
        &.lock .buff-title { color: var(--cx-dim); }
        .buttons {
            gap: 4px;
            .button { width: 29px; min-width: 29px; padding: 0; color: var(--cx-letter); }
            .button[data-variant="danger"] { color: var(--cx-up); }
        }
    }
}

.buff-root {
    //background-color: rgb(239, 246, 253);
    margin-bottom: 12px;

    .top {
        border-bottom: 1px solid #DCDFE6;
        padding: 0 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition-duration: 200ms;

        &.lock {
            // background-image: linear-gradient(45deg, #ff5272 25%, #ffffff 25%, #ffffff 50%, #ff5272 50%, #ff5272 75%, #ffffff 75%, #ffffff 100%);
            background: linear-gradient(45deg, #ffd4e2 25%, #fff 25%, #fff 50%, #ffd4e2 50%, #ffd4e2 75%, #fff 75%, #fff 100%);
            background-size: 40px 40px;
        }

        .buff-title {
            font-weight: bold;
            font-size: 14px;
            margin: 0px;
            color: #666666;
            margin-right: 24px;
        }

        .buttons {
            display: flex;

            .button {
                color: var(--cx-gold);
            }
        }
    }

    .detail {
        display: flex;
        padding: 8px;

        img {
            height: 64px;
            width: 64px;
            border-radius: 50%;
            margin-right: 12px;
        }

        p {
            margin: 0;
            font-size: 12px;
            color: #606266;
        }
    }
}
</style>

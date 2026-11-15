<template>
    <div class="preset-card" @click="$emit('click')">
        <div class="preset-head">
            <img class="preset-avatar" :src="characterAvatar" alt="" />
            <div class="preset-title">
                <b>{{ props.name }}</b>
                <small>{{ ta(characterLocaleIndex) }}</small>
            </div>
            <el-dropdown v-if="toolbar" trigger="click" @command="handleCommand" @click.stop>
                <button type="button" class="preset-menu" :aria-label="`${props.name} 的操作`" @click.stop @keydown.enter.stop>
                    <icon-ep-more-filled aria-hidden="true" />
                </button>
                <template #dropdown><el-dropdown-menu>
                    <el-dropdown-item command="download">{{ t('misc.export') }}</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>{{ t('misc.del') }}</el-dropdown-item>
                </el-dropdown-menu></template>
            </el-dropdown>
        </div>
        <div class="preset-rows">
            <span class="preset-row"><img :src="wData.url" alt="" /><span>{{ ta(weaponNameIndex) }}</span></span>
            <span class="preset-row"><img :src="tfData.badge" alt="" /><span>{{ ta(tfNameIndex) }}</span></span>
        </div>
    </div>
</template>

<script setup lang="ts">
// 计算预设卡片：角色、预设名、武器、计算目标；「…」菜单导出 / 删除。props 与事件和改版前一致。
import { characterData } from "@character"
import { weaponData } from "@weapon"
import { targetFunctionData } from "@targetFunction"
import IconEpMoreFilled from "~icons/ep/more-filled"
import {computed} from "vue"
import {IPreset} from "@/types/preset"
import {useI18n} from "@/i18n/i18n"

const { t, ta } = useI18n()

interface Props {
    item: IPreset,
    name: string,
    toolbar?: boolean,
    calculateIcon?: boolean,
}
const props = withDefaults(defineProps<Props>(), {
    toolbar: true,
    calculateIcon: true,
    name: "name",
})
const emit = defineEmits(["click", "delete", "download", "cpu"])

const characterLocaleIndex = computed(() => characterData[props.item.character.name].nameLocale)
const characterAvatar = computed(() => characterData[props.item.character.name].avatar)
const wData = computed(() => weaponData[props.item.weapon.name])
const weaponNameIndex = computed(() => wData.value.nameLocale)
const tfData = computed(() => targetFunctionData[props.item.targetFunction.name])
const tfNameIndex = computed(() => tfData.value.nameLocale)

function handleCommand(command: string) {
    if (command === "download") emit("download")
    else emit("delete")
}
</script>

<style lang="scss" scoped>
.preset-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--cx-card);
    color: var(--cx-letter);
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 0 2px var(--cx-step-2);
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

.preset-head {
    display: flex;
    align-items: center;
    gap: 12px;
}

.preset-avatar {
    flex: none;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--cx-step-2);
    object-fit: cover;
}

.preset-title {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    b {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 15px;
    }

    small {
        color: var(--cx-dim);
        font-size: 12px;
    }
}

.preset-menu {
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

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

.preset-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.preset-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--cx-step);
    font-size: 13px;

    img {
        flex: none;
        width: 28px;
        height: 28px;
        border-radius: 50%;
    }

    span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

@media (prefers-reduced-motion: reduce) {
    .preset-card {
        transition: none;
    }
}
</style>

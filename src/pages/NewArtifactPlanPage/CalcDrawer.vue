<template>
    <el-drawer
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        :direction="narrow ? 'btt' : 'rtl'"
        :size="narrow ? '100%' : 'min(440px, 92vw)'"
        :with-header="false"
        append-to-body
        :custom-class="narrow ? 'calc-drawer narrow' : 'calc-drawer'"
    >
        <header class="calc-drawer-head">
            <h3>{{ title }}</h3>
            <slot name="actions" />
            <button type="button" class="calc-drawer-close" :aria-label="`关闭${title}`" @click="emit('update:modelValue', false)">
                <icon-ep-close aria-hidden="true" />
            </button>
        </header>
        <div class="calc-drawer-body">
            <slot />
        </div>
    </el-drawer>
</template>

<script setup lang="ts">
// 计算器的编辑抽屉外壳：桌面从右侧滑出，窄屏（820px 以下）从底部升起占满高度。
// 关闭、Esc 和焦点回到触发按钮由 el-drawer 负责。Element Plus 2.2 的抽屉只认 custom-class，不认 class。挂到 body 上，配色变量见 calculator-theme.css。
import IconEpClose from "~icons/ep/close"
import {computed} from "vue"
import {useScreen} from "@/composables/screen"

defineProps<{ modelValue: boolean, title: string }>()
const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>()

const { width } = useScreen()
const narrow = computed(() => width.value <= 820)
</script>

<style lang="scss">
// el-drawer 的根节点不带本组件的 scoped 标记，样式写成不带 scoped 的，用 .calc-drawer 限定
.calc-drawer {
    background: var(--cx-card);
    color: var(--cx-letter);

    .el-drawer__body {
        display: flex;
        flex-direction: column;
        padding: 0;
    }

    &.narrow {
        border-radius: 18px 18px 0 0;
    }
}

.calc-drawer-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 22px 24px 14px;

    h3 {
        margin: 0 auto 0 0;
        font-size: 20px;
        font-weight: 700;
    }
}

.calc-drawer-close {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 50%;
    background: var(--cx-step);
    color: var(--cx-letter);
    cursor: pointer;

    &:hover {
        background: var(--cx-step-2);
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

.calc-drawer-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 24px calc(24px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 18px;
}

// 窄屏时底部导航在抽屉遮罩之下，抽屉占满高度后底部仍留出安全区
.calc-drawer.narrow .calc-drawer-body {
    padding-bottom: calc(32px + env(safe-area-inset-bottom));
}
</style>

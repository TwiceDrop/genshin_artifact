<template>
    <section class="tool-card">
        <h3>{{ props.name }}</h3>
        <p v-if="props.description">{{ props.description }}</p>
        <div class="tool-links">
            <button
                v-for="(item, index) in props.buttons"
                :key="index"
                type="button"
                :class="{ primary: item.primary }"
                @click="navigate(item.link)"
            ><component :is="item.icon" aria-hidden="true" />{{ item.label }}</button>
        </div>
    </section>
</template>

<script setup lang="ts">
interface Props {
    name: string,
    description: string,
    buttons: {
        label: string,
        primary: boolean,
        link: string,
        icon: any
    }[]
}

const props = defineProps<Props>()

function navigate(link: string) {
    window.open(link, "_blank")
}

</script>

<style scoped lang="scss">
// 导出工具卡片：名称、说明、链接按钮（主链接金色）
.tool-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 18px;
    border-radius: 16px;
    background: var(--cx-card);

    h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
    }

    p {
        margin: 0;
        color: var(--cx-dim);
        font-size: 14px;
        line-height: 1.6;
    }
}

.tool-links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: auto;
    padding-top: 4px;

    button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 16px;
        border: 0;
        border-radius: 999px;
        background: var(--cx-step);
        color: var(--cx-letter);
        font: inherit;
        font-size: 13px;
        cursor: pointer;

        &:hover {
            background: var(--cx-step-2);
        }

        &.primary {
            background: var(--cx-gold);
            color: var(--cx-gold-on);
            font-weight: 700;

            &:hover {
                filter: brightness(1.08);
            }
        }

        &:focus-visible {
            outline: 2px solid var(--cx-gold);
            outline-offset: 2px;
        }
    }
}
</style>

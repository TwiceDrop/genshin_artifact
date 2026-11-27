<template>
    <div class="root">
        <div v-if="value != null" class="back" :style="styleForBack"></div>
        <span class="display">
            <template v-if="value != null">{{ (value * 100).toFixed(1) }}</template>
            <span v-if="extra">{{ value != null ? '/ ' : '' }}{{ extra }}</span>
        </span>
    </div>
</template>

<script>
export default {
    name: "ValueDisplay",
    props: {
        "value": {},
        "extra": {
            default: ""
        }
    },
    computed: {
        styleForBack() {
            return {
                width: `${this.value * 100}%`
            }
        }
    }
}
</script>

<style scoped lang="scss">
.root {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;

    .back {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        background-color: var(--cx-step);
        z-index: -1;
    }

    .display {
        color: black;
        font-size: 12px;
    }
}
</style>

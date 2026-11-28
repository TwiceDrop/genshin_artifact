<template>
    <div class="config-root" :style="styleRoot">
<!--        {{ configs }}-->
        <ConfigItem
            class="config"
            v-for="config in configs"
            :key="config.name"
            :params="config"
            :title="ta(config.title)"
            :help="ta(config.help)"
            :type="config.type"
            :modelValue="value2[config.name]"
            :shadcn="shadcn"
            @update:modelValue="handleInput(config.name, $event)"
        ></ConfigItem>
    </div>
</template>

<script>
import ConfigItem from "./ConfigItem"
import {useI18n} from "@/i18n/i18n"

export default {
    name: "ItemConfig",
    components: {
        ConfigItem
    },
    props: {
        modelValue: {},
        itemName: {},
        configs: {
            type: Array
        },
        bg: {
            default: "var(--cx-step)"
        },
        needItemName: {
            default: true,
        },
        shadcn: Boolean,
    },
    emits: ["update:modelValue"],
    computed: {
        styleRoot() {
            return {
                backgroundColor: this.bg
            }
        },

        value2() {
            if (this.needItemName) {
                return this.modelValue[this.itemName]
            } else {
                return this.modelValue
            }
        }
    },
    
    methods: {
        handleInput(name, value) {
            if (this.needItemName) {
                let obj = Object.assign({}, this.modelValue[this.itemName])
                obj[name] = value

                this.$emit("update:modelValue", {
                    [this.itemName]: obj
                })
            } else {
                let obj = Object.assign({}, this.modelValue)
                obj[name] = value
                this.$emit("update:modelValue", obj)
            }
        }
    },
    setup() {
        const { t, ta } = useI18n()
        return {
            t, ta
        }
    }
}
</script>

<style lang="scss" scoped>
.config-root {
    padding: 12px;
    border-radius: 3px;
    // background-color: var(--cx-step);

    .config {
        margin-bottom: 8px;
        &:last-of-type {
            margin-bottom: 0;
        }
    }
}
</style>

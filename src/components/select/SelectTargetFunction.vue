<template>
    <SelectRoot
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
    >
        <SelectTrigger class="tf-trigger" :aria-label="t('misc.tf')">
            <SelectValue :placeholder="t('misc.tf')" />
            <SelectIcon class="tf-chevron" aria-hidden="true" />
        </SelectTrigger>
        <SelectPortal>
            <SelectContent
                class="tf-menu"
                data-slot="ui-select-menu"
                position="popper"
                :side-offset="5"
                :collision-padding="8"
            >
                <SelectViewport class="tf-viewport">
                    <SelectGroup v-if="characterTargetFunctionList && characterTargetFunctionList.length > 0">
                        <SelectLabel class="tf-group-label">{{ t('misc.charSpecific') }}</SelectLabel>
                        <SelectItem
                            v-for="item in characterTargetFunctionList"
                            :key="item.name"
                            class="tf-item"
                            :value="item.name"
                        >
                            <div class="option-root">
                                <img class="option-badge" :src="item.badge" alt="" aria-hidden="true" />
                                <div class="option-body">
                                    <SelectItemText as="p" class="option-title">{{ ta(item.nameLocale) }}</SelectItemText>
                                </div>
                            </div>
                            <SelectItemIndicator class="tf-check" aria-hidden="true">✓</SelectItemIndicator>
                        </SelectItem>
                    </SelectGroup>

                    <SelectGroup v-if="commonTargetFunctionList">
                        <SelectLabel class="tf-group-label">{{ t('misc.general') }}</SelectLabel>
                        <SelectItem
                            v-for="item in commonTargetFunctionList"
                            :key="item.name"
                            class="tf-item"
                            :value="item.name"
                        >
                            <div class="option-root">
                                <img class="option-badge" :src="item.badge" alt="" aria-hidden="true" />
                                <div class="option-body">
                                    <SelectItemText as="p" class="option-title">{{ ta(item.nameLocale) }}</SelectItemText>
                                </div>
                            </div>
                            <SelectItemIndicator class="tf-check" aria-hidden="true">✓</SelectItemIndicator>
                        </SelectItem>
                    </SelectGroup>
                </SelectViewport>
            </SelectContent>
        </SelectPortal>
    </SelectRoot>
</template>

<script>
import {
    SelectRoot,
    SelectTrigger,
    SelectValue,
    SelectIcon,
    SelectPortal,
    SelectContent,
    SelectViewport,
    SelectGroup,
    SelectLabel,
    SelectItem,
    SelectItemText,
    SelectItemIndicator
} from "radix-vue"
import { targetFunctionByCharacterName } from "@targetFunction"
import {useI18n} from "@/i18n/i18n";

export default {
    name: "SelectTargetFunction",
    components: {
        SelectRoot,
        SelectTrigger,
        SelectValue,
        SelectIcon,
        SelectPortal,
        SelectContent,
        SelectViewport,
        SelectGroup,
        SelectLabel,
        SelectItem,
        SelectItemText,
        SelectItemIndicator
    },
    props: {
        modelValue: {},
        characterName: {
            default: "Amber"
        }
    },
    emits: ["update:modelValue"],
    data() {
        return {
            commonTargetFunctionList: targetFunctionByCharacterName["common"]
        }
    },
    // created() {
    //     this.commonTargetFunctionList = targetFunctionByCharacterName["common"]
    // },
    computed: {
        characterTargetFunctionList() {
            return targetFunctionByCharacterName[this.characterName] ?? []
        }
    },
    setup() {
        const { t, ta } = useI18n()

        return {
            t,
            ta
        }
    }
}
</script>

<style lang="scss" scoped>
.tf-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 34px;
    padding: 6px 12px;
    box-sizing: border-box;
    border: 1px solid var(--cx-step-2);
    border-radius: 8px;
    color: var(--cx-letter);
    background: var(--cx-step);
    font: inherit;
    cursor: pointer;

    &:is(:hover, [data-state="open"]) {
        border-color: var(--cx-gold);
    }

    &:focus-visible {
        outline: 2px solid var(--cx-gold);
        outline-offset: 2px;
    }
}

.tf-chevron {
    flex-shrink: 0;
    font-size: 0;
    width: 6px;
    height: 6px;
    border: solid currentColor;
    border-width: 0 1.5px 1.5px 0;
    transform: translateY(-2px) rotate(45deg);
}

.tf-menu {
    max-height: min(320px, var(--radix-select-content-available-height));
}

.tf-viewport {
    max-height: min(312px, calc(var(--radix-select-content-available-height) - 8px));
    overflow-y: auto;
}

.tf-group-label {
    padding: 6px 10px 4px;
    font-size: 12px;
    color: var(--cx-letter);
    opacity: 0.7;
}

.tf-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 36px;
    padding: 4px 10px;
    box-sizing: border-box;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    outline: none;

    &[data-highlighted] {
        background: var(--cx-step);
    }

    &[data-state="checked"] {
        color: var(--cx-gold);
        background: color-mix(in srgb, var(--cx-gold) 13%, var(--cx-card));
        font-weight: 600;
    }
}

.tf-check {
    flex-shrink: 0;
    font-size: 13px;
}

.option-root {
    height: 32px;
    display: flex;
    align-items: center;

    .option-badge {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        margin-right: 16px;
    }

    .option-body {
        .option-title {
            margin: 0;
        }
    }
}
</style>

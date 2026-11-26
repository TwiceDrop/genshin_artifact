<template>
    <div class="character-picker-controls">
        <UiButton ref="trigger" class="character-trigger" :aria-label="selected ? `${title} ${selected.label}` : title"
            aria-haspopup="dialog" :aria-expanded="open" @click="openPicker">
            <img v-if="selected" :src="selected.avatar" alt="" />
            <span>{{ selected?.label ?? placeholder }}</span>
        </UiButton>
        <UiButton v-if="clearable && selected" class="character-clear" :aria-label="`清除${title}`" @click="clear">
            <i-ep-close aria-hidden="true" />
        </UiButton>
    </div>

    <UiDialog v-model="open" :title="title" width="760px" :return-focus="returnFocus">
        <div class="character-filters">
            <CharacterElementFilter v-model="element" />
            <input v-model.trim="search" class="character-search" type="search" placeholder="搜索角色" aria-label="搜索角色" />
        </div>
        <div v-if="visibleOptions.length" class="character-options">
            <button v-for="option in visibleOptions" :key="option.value" type="button" class="character-choice"
                :aria-pressed="option.value === modelValue" @click="select(option.value)">
                <span class="character-thumb" :data-rarity="option.star">
                    <img :src="option.avatar" alt="" loading="lazy" />
                </span>
                <span>{{ option.label }}</span>
            </button>
        </div>
        <p v-else role="status">暂无结果</p>
    </UiDialog>
</template>

<script setup lang="ts">
import { computed, onDeactivated, ref } from 'vue'
import CharacterElementFilter from './CharacterElementFilter.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'

interface CharacterOption {
    value: string
    label: string
    avatar: string
    element: string
    star: number
}

const props = defineProps<{
    modelValue: string
    options: CharacterOption[]
    title: string
    placeholder: string
    clearable?: boolean
}>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()

const open = ref(false)
const search = ref('')
const element = ref('all')
const trigger = ref<InstanceType<typeof UiButton> | null>(null)
const selected = computed(() => props.options.find(option => option.value === props.modelValue))
const visibleOptions = computed(() => {
    const query = search.value.toLowerCase()
    return props.options.filter(option => (element.value === 'all' || option.element === element.value)
        && option.label.toLowerCase().includes(query))
        .sort((a, b) => b.star - a.star)
})

onDeactivated(() => { open.value = false })

function openPicker() {
    search.value = ''
    element.value = 'all'
    open.value = true
}

function returnFocus() {
    trigger.value?.$el.focus()
}

function clear() {
    emit('update:modelValue', '')
    returnFocus()
}

function select(value: string) {
    emit('update:modelValue', value)
    open.value = false
}
</script>

<style scoped>
.character-picker-controls { display: inline-flex; align-items: stretch; gap: 4px; max-width: 100%; }
.character-trigger { flex: 1; min-width: 0; justify-content: flex-start; }
.character-trigger img { flex: none; width: 26px; height: 26px; object-fit: cover; border-radius: 5px; }
.character-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.character-clear { padding-inline: 9px; }
.character-filters { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.character-search { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--cx-step-2); border-radius: 9px; background: var(--cx-step); color: var(--cx-letter); font: inherit; }
.character-options { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px; margin-top: 12px; }
.character-choice { display: grid; align-content: start; justify-items: center; gap: 4px; min-width: 0; padding: 6px 3px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--cx-letter); font: inherit; font-size: 12px; overflow-wrap: anywhere; cursor: pointer; }
.character-choice:hover { background: var(--cx-step); border-color: var(--cx-step-2); }
.character-choice[aria-pressed="true"] { background: var(--cx-step); border-color: var(--cx-gold); }
.character-choice:focus-visible, .character-search:focus-visible { outline: 2px solid var(--cx-gold); }
.character-thumb { width: 62px; height: 62px; overflow: hidden; border-radius: 9px; }
.character-thumb[data-rarity="5"] { background: linear-gradient(145deg, #76513e, #c69960); }
.character-thumb[data-rarity="4"] { background: linear-gradient(145deg, #554c72, #9886b2); }
.character-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>

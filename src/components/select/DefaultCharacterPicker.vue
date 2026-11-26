<template>
    <section class="default-character-picker">
        <CharacterElementFilter v-model="element" />
        <div class="character-picker-list">
            <button v-for="character in visibleCharacters" :key="character.name" type="button" class="character-picker-row"
                :aria-label="`选择${ta(character.nameLocale)}${added?.has(character.name) ? '，已添加' : ''}`"
                :disabled="added?.has(character.name)" @click="emit('select', character.name)">
                <span class="character-art-frame"><CharacterPortrait thumbnail :character-name="character.name" :splash="character.splash" :avatar="character.avatar" :alt="`${ta(character.nameLocale)}立绘`" loading="lazy" /></span>
                <span class="character-body">
                    <span class="character-identity-line"><strong>{{ ta(character.nameLocale) }}</strong><span class="character-element"><img :src="elementIcons[character.element]" :alt="`${ELEMENT_NAMES[character.element]}元素`" />{{ ELEMENT_NAMES[character.element] }}</span></span>
                    <small v-if="added?.has(character.name)">已添加</small>
                    <template v-else>
                        <span class="character-tags"><b>0命</b></span>
                        <span class="character-equipment"><span>天赋：8、8、8</span></span>
                    </template>
                </span>
            </button>
        </div>
    </section>
</template>
<script setup>
import { computed, ref } from 'vue'
import { characterByElement } from '@character'
import { useI18n } from '@/i18n/i18n'
import { ELEMENT_NAMES, isPickerCharacter } from '@/import/character-summary.mjs'
import elementIcons from '@/assets/element-icons'
import CharacterPortrait from '@/components/display/CharacterPortrait.vue'
import CharacterElementFilter from './CharacterElementFilter.vue'

const emit = defineEmits(['select'])
defineProps({ added: Set })
const { ta } = useI18n()
const element = ref('all')
const visibleCharacters = computed(() => (element.value === 'all'
    ? Object.values(characterByElement).flat()
    : characterByElement[element.value]).filter(character => isPickerCharacter(character.name)))
</script>
<style scoped src="./character-picker.css"></style>
<style scoped>
.character-picker-row:disabled { filter: grayscale(1); opacity: .55; }
</style>

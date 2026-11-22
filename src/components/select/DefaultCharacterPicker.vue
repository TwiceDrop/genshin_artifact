<template>
    <section class="default-character-picker">
        <div class="character-element-tabs" role="group" aria-label="按元素筛选">
            <button type="button" :aria-pressed="element === 'all'" @click="element = 'all'">全部</button>
            <button v-for="(label, key) in ELEMENT_NAMES" :key="key" type="button" :aria-pressed="element === key" @click="element = key">
                <img :src="elementIcons[key]" alt="" />{{ label }}
            </button>
        </div>
        <div class="character-picker-list">
            <button v-for="character in visibleCharacters" :key="character.name" type="button" class="character-picker-row"
                :aria-label="`选择${ta(character.nameLocale)}`" @click="emit('select', character.name)">
                <span class="character-art-frame"><CharacterPortrait thumbnail :character-name="character.name" :splash="character.splash" :avatar="character.avatar" :alt="`${ta(character.nameLocale)}立绘`" loading="lazy" /></span>
                <span class="character-body">
                    <span class="character-identity-line"><strong>{{ ta(character.nameLocale) }}</strong><span class="character-element"><img :src="elementIcons[character.element]" :alt="`${ELEMENT_NAMES[character.element]}元素`" />{{ ELEMENT_NAMES[character.element] }}</span></span>
                    <span class="character-tags"><b>0命</b></span>
                    <span class="character-equipment"><span>天赋：8、8、8</span></span>
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

const emit = defineEmits(['select'])
const { ta } = useI18n()
const element = ref('all')
const visibleCharacters = computed(() => (element.value === 'all'
    ? Object.values(characterByElement).flat()
    : characterByElement[element.value]).filter(character => isPickerCharacter(character.name)))
</script>
<style scoped src="./character-picker.css"></style>

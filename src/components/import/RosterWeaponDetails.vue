<script setup>
import { computed } from 'vue'
import { weaponData } from '@/assets/weapon'
import locale from '@/i18n/generated/zh-cn.json'
import { weaponEffectText } from '@/algorithms/weapon-effect-summary.mjs'
import WeaponBaseStats from '@/components/display/WeaponBaseStats.vue'

const props = defineProps({ weapon: { type: Object, required: true }, showStats: Boolean })
const meta = computed(() => weaponData[props.weapon.name])
const effect = computed(() => meta.value.effect != null ? weaponEffectText(locale[meta.value.effect], props.weapon.refine) : '')
</script>
<template>
    <div class="weapon-details">
        <strong>{{ locale[meta.nameLocale] }}</strong>
        <small>Lv. {{ weapon.level }}{{ weapon.ascend ? '+' : '' }} · 精炼 {{ weapon.refine }} 阶</small>
        <WeaponBaseStats v-if="showStats" :weapon="weapon" />
        <p v-if="effect">{{ effect }}</p>
    </div>
</template>
<style scoped>
.weapon-details { display: grid; gap: 5px; }
small { color: var(--cx-dim); font-size: 12px; }
p { margin: 5px 0 0; padding-top: 8px; border-top: 1px solid var(--cx-step-2); font-size: 13px; line-height: 1.6; white-space: pre-line; }
</style>

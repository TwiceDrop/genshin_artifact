<template>
    <span v-for="stat in stats" :key="stat.key" class="weapon-stat">{{ t('stat', stat.key) }}：<span class="weapon-stat-value">{{ stat.value }}</span></span>
</template>

<script setup>
import {computed} from 'vue'
import {useI18n} from '@/i18n/i18n'
import {weaponBaseStats} from '@/algorithms/roster-attributes.mjs'

const props = defineProps({weapon: {type: Object, required: true}})
const {t} = useI18n()
const secondaryLabels = {
    FIGHT_PROP_CRITICAL_HURT: 'criticalDamage',
    FIGHT_PROP_CRITICAL: 'critical',
    FIGHT_PROP_ATTACK_PERCENT: 'attackStatic',
    FIGHT_PROP_DEFENSE_PERCENT: 'defendStatic',
    FIGHT_PROP_HP_PERCENT: 'lifeStatic',
    FIGHT_PROP_PHYSICAL_ADD_HURT: 'physicalBonus',
    FIGHT_PROP_CHARGE_EFFICIENCY: 'recharge',
    FIGHT_PROP_ELEMENT_MASTERY: 'elementalMastery',
}
const stats = computed(() => {
    const {FIGHT_PROP_BASE_ATTACK: attack, ...secondary} = weaponBaseStats(props.weapon)
    const rows = [{key: 'baseAttack', value: String(Math.round(attack))}]
    for (const [prop, value] of Object.entries(secondary)) {
        const amount = prop === 'FIGHT_PROP_ELEMENT_MASTERY' ? Math.round(value) : `${(value * 100).toFixed(1)}%`
        rows.push({key: secondaryLabels[prop], value: `+${amount}`})
    }
    return rows
})
</script>

<style scoped>
.weapon-stat {
    display: inline-block;
    margin-inline-start: 0.75em;
    font-size: 12px;
    font-weight: normal;
    white-space: nowrap;
}

.weapon-stat-value {
    color: var(--cx-gold);
}
</style>

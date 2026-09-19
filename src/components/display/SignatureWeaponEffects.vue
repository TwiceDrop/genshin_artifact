<template>
    <div v-if="weapon.name === 'BeyondTheChrysalis'" class="weapon-effects">
        <template v-if="effects">
            <p>覆盖率折算：暴击伤害 +{{ percent(effects.criticalDamage) }}%；星扩散伤害 +{{ percent(effects.stellarSwirlBonus) }}%。</p>
            <p>丰获之风：触发一次回复 {{ effects.energyPerTrigger }} 点能量，每4秒至多一次；按覆盖率折算为 {{ number(effects.energyPerFourSeconds) }} 点/4秒。</p>
            <p>三项覆盖率独立设置，不要求相加为100%。前两项按平均属性计算；第三项按4秒触发机会的利用率折算，仅统计直接回能，不增加充能效率或伤害。实际回能仍需施放E/Q触发。退场时三项均不生效。</p>
        </template>
        <p v-else>{{ error }}</p>
    </div>
    <div v-else-if="weapon.name === 'HymnOfTheMaelstrom'" class="weapon-effects">
        <p>特效生命填0时，随装备者面板自动计算；填写正数时，将其作为生命转攻击的最终生命（含武器、命座等加成），不再重复叠加。</p>
        <p>自定义值只影响专武加攻，不改写角色自身生命或治疗量。为其他前台角色计算此加攻，请添加沃雅妮莎分组中的「漩流颂歌」BUFF，并填写来源生命。</p>
    </div>
</template>

<script setup>
import {computed} from 'vue'
import {chrysalisEffects} from '../../../beta-data/weapon-effects.mjs'
const props = defineProps({weapon: {type: Object, required: true}})
const state = computed(() => {
    if (props.weapon.name !== 'BeyondTheChrysalis') return {}
    try { return {effects: chrysalisEffects(props.weapon)} }
    catch (error) { return {error: error.message} }
})
const effects = computed(() => state.value.effects)
const error = computed(() => state.value.error)
const number = value => Number(value.toFixed(3))
const percent = value => number(value * 100)
</script>

<style scoped>
.weapon-effects { font-size: 12px; line-height: 1.7; color: #606266; padding: 0 12px; }
</style>

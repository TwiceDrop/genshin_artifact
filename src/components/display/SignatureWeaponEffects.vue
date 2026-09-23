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
    <div v-else-if="limited" class="weapon-effects">
        <template v-if="effects">
            <p>按覆盖率折算：攻击力 +{{ percent(effects.attack ?? 0) }}%；元素精通 +{{ number(effects.em ?? 0) }}；星烁反应伤害 +{{ percent(effects.stellar ?? 0) }}%；元素充能效率 +{{ percent(effects.recharge ?? 0) }}%。</p>
            <p v-if="effects.energyPerTrigger !== undefined">直接回能：每次为{{ energyTarget }}回复 {{ number(effects.energyPerTrigger) }} 点能量<span v-if="effects.energyInterval">，每{{ effects.energyInterval }}秒至多一次</span><span v-if="effects.energyPerInterval !== undefined">；按触发机会利用率折算为 {{ number(effects.energyPerInterval) }} 点/{{ effects.energyInterval }}秒</span>。回能利用率与攻击覆盖率独立；需实际触发元素反应，不计作充能效率或伤害。</p>
            <p v-if="weapon.name === 'NewBough'">覆盖率按0～1填写，1表示100%。普通模式每层提供攻击与精通；辉映·星烁改为攻击与星伤，不保留普通模式的精通。层数与覆盖率相乘，按平均属性计算。</p>
            <p v-else-if="weapon.name === 'WintersHeavyHeart'">计数包含装备者，冰、雷角色合计不能超过4人。普通模式按冰、雷人数分别提供精通、攻击；辉映·星烁改为每位冰或雷角色提供精通、星伤。覆盖率表示所选队伍状态的占比，默认100%；该状态持续存在时保持1。</p>
            <p v-else-if="weapon.name === 'BreezeborneRefrain'">充能加成按精炼常驻（20%/25%/30%/35%/40%），覆盖率只影响三层触发后的队伍星伤。覆盖率按0～1填写，1表示100%。同名效果不叠加；其他角色可添加「柔风游弦·蛇信的死毒」队友BUFF。</p>
            <p v-else-if="weapon.name === 'JadeVista'">只填写其他队员，排除装备者；同元素优先生效，两项合计最多3层。覆盖率表示所选队伍状态的占比，默认100%；该状态持续存在时保持1。</p>
            <p v-else-if="weapon.name === 'HereticsMoltenBlade'">加成强度与覆盖率分别设置：强度0关闭，0.5对应生效期间的最低加成，1对应最高加成。强度不是移动距离；最终攻击加成再乘独立覆盖率。</p>
            <p v-else-if="weapon.name === 'ForgedByTheGoldenMelody'">普通乐章每10秒轮转；触发星烁后，复调保留触发时的乐章12秒。当前普通乐章与仍在持续的复调可以不同，两者分别设置覆盖率。</p>
            <p v-else-if="['Emberwell','BladeOfAtonement','EchoesOfTheHeart'].includes(weapon.name)">元素反应和星烁反应触发的效果分别设置覆盖率；关闭对应触发开关后，该项不生效。</p>
            <p>摘要仅列武器特效，不含基础攻击与副词条。星伤同时作用于星超导和星扩散；开关表示当前效果是否生效。覆盖率按0～1填写，1表示100%；多项覆盖率独立设置，不要求相加为1。同一效果中的攻击、精通等属性共用覆盖率。</p>
        </template>
        <p v-else>{{ error }}</p>
    </div>
</template>

<script setup>
import {computed} from 'vue'
import {chrysalisEffects} from '../../../beta-data/weapon-effects.mjs'
import {isLimitedWeapon, limitedWeaponEffects} from '../../../beta-data/limited-weapons.mjs'
const props = defineProps({weapon: {type: Object, required: true}})
const limited = computed(() => isLimitedWeapon(props.weapon))
const state = computed(() => {
    try {
        if (props.weapon.name === 'BeyondTheChrysalis') return {effects: chrysalisEffects(props.weapon)}
        if (limited.value) return {effects: limitedWeaponEffects(props.weapon)}
        return {}
    } catch (error) { return {error: error.message} }
})
const effects = computed(() => state.value.effects)
const error = computed(() => state.value.error)
const energyTarget = computed(() => effects.value?.energyTarget || (props.weapon.name === 'Frostbreath' ? '队伍中其他角色' : '装备者'))
const number = value => Number(Number(value).toFixed(3))
const percent = value => number(value * 100)
</script>

<style scoped>
.weapon-effects { font-size: 12px; line-height: 1.7; color: #606266; padding: 0 12px; }
</style>

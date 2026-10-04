<template>
    <div style="margin-bottom: 16px;" class="flex-row damage-reaction-controls">
        <el-radio-group v-model="damageType" style="margin-right: 24px;">
            <el-radio-button v-for="option in reactionOptions" :key="option.key" :label="option.key">{{ option.key === 'normal' ? normalDamageName : option.label }}</el-radio-button>
        </el-radio-group>

        <span class="damage-display" v-if="selectedActualResult">{{ formatStellarDamage(selectedActualResult.expectation) }}</span>
    </div>

    <section v-if="selectedStellarResult" class="stellar-detail">
        <el-descriptions :column="3" border>
            <el-descriptions-item label="期望伤害">{{ formatStellarDamage(selectedStellarResult.expectation) }}</el-descriptions-item>
            <el-descriptions-item label="暴击伤害">{{ formatStellarDamage(selectedStellarResult.critical) }}</el-descriptions-item>
            <el-descriptions-item label="非暴击伤害">{{ formatStellarDamage(selectedStellarResult.non_critical) }}</el-descriptions-item>
        </el-descriptions>
    </section>


    <div v-if="!selectedStellarResult" class="header-row" style="overflow: auto; margin-bottom: 16px;">
        <div>
            <div class="big-title base-damage-region" :title="Math.round(baseDamageSpread*1000)/1000" v-if="damageType === 'spread'">{{ baseRegionName }}</div>
            <div class="big-title base-damage-region" :title="Math.round(baseDamageAggravate*1000)/1000" v-else-if="damageType === 'aggravate'">{{ baseRegionName }}</div>
            <div class="big-title base-damage-region" :title="Math.round(baseDamage*1000)/1000" v-else>{{ baseRegionName }}</div>
            <div class="header-row">
                <damage-analysis-util
                    v-if="atkRatioState.length > 0"
                    :arr="atkState"
                    title="攻击力"
                ></damage-analysis-util>
                <damage-analysis-util
                    v-if="atkRatioState.length > 0"
                    :arr="atkRatioState"
                    title="攻击力倍率"
                ></damage-analysis-util>
                <damage-analysis-util
                    v-if="defRatioState.length > 0"
                    :arr="defState"
                    title="防御力"
                ></damage-analysis-util>
                <damage-analysis-util
                    v-if="defRatioState.length > 0"
                    :arr="defRatioState"
                    title="防御力倍率"
                ></damage-analysis-util>
                <damage-analysis-util
                    v-if="hpRatioState.length > 0"
                    :arr="hpState"
                    title="生命值"
                ></damage-analysis-util>
                <damage-analysis-util
                    v-if="hpRatioState.length > 0"
                    :arr="hpRatioState"
                    title="生命值倍率"
                ></damage-analysis-util>
                <damage-analysis-util
                    v-if="emRatioState.length > 0"
                    :arr="emState"
                    title="元素精通"
                ></damage-analysis-util>
                <damage-analysis-util
                    v-if="emRatioState.length > 0"
                    :arr="emRatioState"
                    title="元素精通倍率"
                ></damage-analysis-util>
                <damage-analysis-util v-if="finalIndependentState.length" :arr="finalIndependentState" title="最终独立倍率增量"></damage-analysis-util>
                <damage-analysis-util v-if="independentState.length" :arr="independentState" title="普通独立倍率增量"></damage-analysis-util>
                <damage-analysis-util
                    v-if="extraDamageState.length > 0"
                    :arr="extraDamageState"
                    title="其他"
                ></damage-analysis-util>
                <div v-if="damageType === 'spread'" style="min-width: 100px">
                    <div class="big-title" style="background: rgb(236, 245, 255)">蔓激化基础伤害</div>
                    <div class="header-row" style="height: 100%; display: flex; align-items: center; justify-content: center">
                        <span>{{ Math.round(baseDamageQuicken * 1000) / 1000 }}</span>
                    </div>
                </div>
                <div v-if="damageType === 'aggravate'" style="min-width: 100px">
                    <div class="big-title" style="background: rgb(236, 245, 255)">超激化基础伤害</div>
                    <div class="header-row" style="height: 100%; display: flex; align-items: center; justify-content: center">
                        <span>{{ Math.round(baseDamageQuicken * 1000) / 1000 }}</span>
                    </div>
                </div>
                <damage-analysis-util
                    v-if="damageType === 'spread'"
                    :arr="spreadState"
                    title="蔓激化伤害提升"
                ></damage-analysis-util>
                <damage-analysis-util
                    v-if="damageType === 'aggravate'"
                    :arr="aggravateState"
                    title="超激化伤害提升"
                ></damage-analysis-util>
            </div>
        </div>
        <div v-show="isDamage">
            <div class="big-title critical-region" :title="Math.round(this.critical * this.criticalDamage * 1000)/1000">暴击</div>
            <div class="header-row">
                <damage-analysis-util
                    :arr="criticalState"
                    title="暴击率"
                ></damage-analysis-util>
                <damage-analysis-util
                    :arr="criticalDamageState"
                    title="暴击伤害"
                ></damage-analysis-util>
            </div>
        </div>
        <div>
            <div class="big-title bonus-region">加成</div>
            <div class="header-row">
                <damage-analysis-util
                    :arr="bonusRegionState"
                    :title="bonusRegionName"
                ></damage-analysis-util>
            </div>
        </div>
        <div v-if="damageType === 'melt' || damageType === 'vaporize'">
            <div class="big-title reaction-ratio-region">反应倍率</div>
            <div class="header-row" style="height: 100%; display: flex; align-items: center; justify-content: center">
                <span>{{ reactionRatio }}</span>
            </div>
        </div>
        <div v-if="damageType === 'melt'">
            <div class="big-title melt-region">增幅伤害加成</div>
            <div class="header-row">
                <damage-analysis-util
                    :arr="meltEnhanceState"
                    title="融化伤害加成"
                ></damage-analysis-util>
            </div>
        </div>
        <div v-if="damageType === 'vaporize'">
            <div class="big-title vaporize-region">增幅伤害加成</div>
            <div class="header-row">
                <damage-analysis-util
                    :arr="vaporizeEnhanceState"
                    title="蒸发伤害加成"
                ></damage-analysis-util>
            </div>
        </div>
    </div>

    <div v-if="isDamage && !selectedStellarResult" class="header-row" style="overflow: auto">
        <div>
            <div class="big-title def-minus">防御乘区</div>
            <div class="header-row">
                <damage-analysis-util
                    :arr="defMinusState"
                    title="减防"
                ></damage-analysis-util>
                <damage-analysis-util
                    :arr="defPenetrationState"
                    title="穿防"
                ></damage-analysis-util>
            </div>
        </div>

        <div>
            <div class="big-title res-minus">抗性乘区</div>
            <div class="header-row">
                <damage-analysis-util
                    :arr="resMinusState"
                    title="减抗"
                ></damage-analysis-util>
            </div>
        </div>
    </div>
</template>

<script>
import DamageAnalysisUtil from "./DamageAnalysisUtil"
import { LEVEL_MULTIPLIER } from "@/constants/levelMultiplier"
import { damageReactionOptions, defaultDamageReaction } from "@/algorithms/reaction-labels.mjs"

function sum(arr) {
    let s = 0
    for (let item of arr) {
        if (item.checked) {
            s += parseFloat(item.value)
        }
    }
    return s
}

export default {
    name: "DamageAnalysis",
    components: {
        DamageAnalysisUtil
    },
    props: ["enemyConfig", "characterLevel"],
    data() {
        return {
            damageType: "normal",
            stellarResults: [],
            reactionOptions: [],
            nativeResults: {},
            independentState: [],
            finalIndependentState: [],
            element: "Pyro",
            isHeal: false,
            isShield: false,
            isDamage: true,

            atkState: [{ name: "test", value: 1000, checked: true }],
            atkRatioState: [{ name: "test", value: 1000, checked: true }],
            defState: [],
            defRatioState: [],
            hpState: [],
            hpRatioState: [],
            emState: [],
            emRatioState: [],
            extraDamageState: [],
            spreadState: [],
            aggravateState: [],
            criticalState: [],
            criticalDamageState: [],
            meltEnhanceState: [],
            vaporizeEnhanceState: [],
            defMinusState: [],
            defPenetrationState: [],
            resMinusState: [],
            bonusState: [],
            healingBonusState: []
        }
    },
    methods: {
        formatStellarDamage(value) {
            return Number.isFinite(value) ? Math.round(value).toLocaleString("zh-CN") : "—"
        },
        setValue(analysis) {
            this.nativeResults = analysis
            let map = {
                "independentState": "independent_damage_multiplier",
                "finalIndependentState": "independent_multiplier",
                "atkState": "atk",
                "atkRatioState": "atk_ratio",
                "defState": "def",
                "defRatioState": "def_ratio",
                "hpState": "hp",
                "hpRatioState": "hp_ratio",
                "emState": "em",
                "emRatioState": "em_ratio",
                "extraDamageState": "extra_damage",
                "criticalState": "critical",
                "criticalDamageState": "critical_damage",
                "meltEnhanceState": "melt_enhance",
                "vaporizeEnhanceState": "vaporize_enhance",
                "bonusState": "bonus",
                "defMinusState": "def_minus",
                "defPenetrationState": "def_penetration",
                "resMinusState": "res_minus",
                "healingBonusState": "healing_bonus",
                "aggravateState": "aggravate_compose",
                "spreadState": "spread_compose",
            }
            this.element = analysis.element
            this.isHeal = analysis.is_heal
            this.isShield = analysis.is_shield
            this.isDamage = !this.isHeal && !this.isShield
            this.reactionOptions = damageReactionOptions(analysis, { includeUncalibrated: true })
            this.stellarResults = this.reactionOptions.filter(({ key }) => !['normal', 'melt', 'vaporize', 'spread', 'aggravate'].includes(key))
                .map(option => ({ ...option, ...analysis[option.key], reason: analysis.reaction_availability?.[option.key]?.reason }))
            const preferred = defaultDamageReaction(analysis)
            this.damageType = preferred || this.reactionOptions[0]?.key || ''
            for (let key in map) {
                let fromKey = map[key]
                let temp = []
                for (let i in analysis[fromKey]) {
                    temp.push({
                        name: i,
                        checked: true,
                        value: analysis[fromKey][i]
                    })
                }
                this[key] = temp
            }
        }
    },
    computed: {
        selectedActualResult() { return this.nativeResults[this.damageType] },
        ordinaryPreview() {
            return { normal: this.damageNormal, melt: this.damageMelt, vaporize: this.damageVaporize,
                spread: this.damageSpread, aggravate: this.damageAggravate }[this.damageType]
        },
        selectedStellarResult() {
            return this.stellarResults.find(result => result.key === this.damageType)
        },
        normalDamageName() {
            const map = {
                "Pyro": "火元素伤害",
                "Electro": "雷元素伤害",
                "Hydro": "水元素伤害",
                "Anemo": "风元素伤害",
                "Geo": "岩元素伤害",
                "Dendro": "草元素伤害",
                "Cryo": "冰元素伤害",
                "Physical": "物理伤害"
            }
            if (this.isHeal) {
                return "治疗量"
            } else if (this.isShield) {
                return "护盾量"
            } else {
                return map[this.element]
            }
        },

        showMeltOption() {
            return (this.element === "Cryo" || this.element === "Pyro") && this.isDamage
        },

        showVaporizeOption() {
            return (this.element === "Pyro" || this.element === "Hydro") && this.isDamage
        },

        showSpreadOption() {
            return this.element === "Dendro"
        },

        showAggravateOption() {
            return this.element === "Electro"
        },

        showMoonfallOption() {
            return this.element === "Dendro" || this.element === "Hydro"
        },

        showMoonElectroOption() {
            return this.element === "Electro" || this.element === "Hydro"
        },

        showDirectMoonElectroOption() {
            return this.element === "Electro" || this.element === "Hydro"
        },
        
        baseRegionName() {
            if (this.isHeal) {
                return "基础治疗"
            } else {
                return "基础伤害"
            }
        },

        bonusRegionState() {
            if (this.isHeal) {
                return this.healingBonusState
            } else {
                return this.bonusState
            }
        },

        bonusRegionName() {
            if (this.isHeal) {
                return "治疗加成"
            } else {
                return "伤害加成"
            }
        },

        reactionRatio() {
            let map = {
                "Cryomelt": 1.5,
                "Pyromelt": 2,
                "Pyrovaporize": 1.5,
                "Hydrovaporize": 2
            }

            return map[this.element + this.damageType]
        },

        atk() {
            return sum(this.atkState)
        },

        atkRatio() {
            return sum(this.atkRatioState)
        },

        def() {
            return sum(this.defState)
        },

        defRatio() {
            return sum(this.defRatioState)
        },

        hp() {
            return sum(this.hpState)
        },

        hpRatio() {
            return sum(this.hpRatioState)
        },

        em() {
            return sum(this.emState)
        },

        emRatio() {
            return sum(this.emRatioState)
        },

        extraDamage() {
            return sum(this.extraDamageState)
        },

        bonus() {
            return sum(this.bonusState)
        },

        healingBonus() {
            return sum(this.healingBonusState)
        },

        critical() {
            return Math.max(0, Math.min(sum(this.criticalState), 1))
        },

        criticalDamage() {
            return sum(this.criticalDamageState)
        },

        meltEnhance() {
            return sum(this.meltEnhanceState)
        },

        vaporizeEnhance() {
            return sum(this.vaporizeEnhanceState)
        },

        defMinus() {
            return sum(this.defMinusState)
        },

        defPenetration() {
            return sum(this.defPenetrationState)
        },

        resMinus() {
            return sum(this.resMinusState)
        },

        baseDamage() {
            return (this.atk * this.atkRatio + this.def * this.defRatio + this.hp * this.hpRatio + this.em * this.emRatio) * (1 + sum(this.independentState)) + this.extraDamage;
        },

        spreadEnhance() {
            return sum(this.spreadState)
        },

        aggravateEnhance() {
            console.log(this.aggravateState)
            return sum(this.aggravateState)
        },






        baseDamageSpread() {
            return this.baseDamage + LEVEL_MULTIPLIER[this.characterLevel - 1] * 1.25 * (1 + this.spreadEnhance)
        },

        baseDamageAggravate() {
            return this.baseDamage + LEVEL_MULTIPLIER[this.characterLevel - 1] * 1.15 * (1 + this.aggravateEnhance)
        },




        baseDamageQuicken() {
            return LEVEL_MULTIPLIER[this.characterLevel - 1] * (this.damageType === "spread" ? 1.25 : 1.15)
        },


        // 元素精通对反应伤害的加成

        resRatio() {
            // default res to 0.1
            // console.log(this.enemyConfig)
            const originalRes = this.enemyConfig[this.element.toLowerCase() + "_res"]
            const res = originalRes - this.resMinus
            let res_ratio
            if (res > 0.75) {
                res_ratio = 1 / (1 + res * 4)
            } else if (res > 0) {
                res_ratio = 1 - res
            } else {
                res_ratio = 1 - res / 2
            }
            return res_ratio
        },

        defMultiplier() {
            const enemyLevel = this.enemyConfig.level
            const characterLevel = this.characterLevel
            const c = 100 + characterLevel
            return c / ((1 - this.defPenetration) * (1 - this.defMinus) * (100 + enemyLevel) + c)
        },

        damageSpread() {
            return (1 + sum(this.finalIndependentState)) * this.baseDamageSpread * (1 + this.critical * this.criticalDamage) * (1 + this.bonus) * this.resRatio * this.defMultiplier
        },

        damageAggravate() {
            return (1 + sum(this.finalIndependentState)) * this.baseDamageAggravate * (1 + this.critical * this.criticalDamage) * (1 + this.bonus) * this.resRatio * this.defMultiplier
        },




        damageNormal() {
            let d
            if (this.isHeal) {
                d = this.baseDamage * (1 + this.healingBonus)
            } else {
                d = (1 + sum(this.finalIndependentState)) * this.baseDamage * (1 + this.critical * this.criticalDamage) * (1 + this.bonus) * this.resRatio * this.defMultiplier
            }
            return d
        },

        damageMelt() {
            const d = this.damageNormal * this.reactionRatio * (1 + this.meltEnhance)
            return d
        },

        damageVaporize() {
            const d = this.damageNormal * this.reactionRatio * (1 + this.vaporizeEnhance)
            return d
        }
    }
}
</script>

<style scoped lang="scss">
.damage-reaction-controls { flex-wrap: wrap; gap: 12px; }
.damage-reaction-controls :deep(.el-radio-group) { display: flex; flex-wrap: wrap; row-gap: 8px; }
.stellar-detail { overflow-x: auto; }
.stellar-detail p { color: #7a8797; font-size: 12px; line-height: 1.7; }

.header-row {
    display: flex;
    // align-items: center;
}

.big-title {
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 100px;

    &.base-damage-region {
        background-color: rgb(217, 236, 255);
    }

    &.critical-region {
        background-color: rgb(179, 216, 255);
    }

    &.bonus-region {
        background-color: rgb(217, 236, 255);
    }

    &.reaction-ratio-region {
        background-color: rgb(179, 216, 255);
    }

    &.vaporize-region {
        background-color: rgb(217, 236, 255);
    }

    &.melt-region {
        background-color: rgb(217, 236, 255);
    }

    &.def-minus {
        background-color: rgb(217, 236, 255);
    }

    &.res-minus {
        background-color: rgb(179, 216, 255);
    }
}
</style>
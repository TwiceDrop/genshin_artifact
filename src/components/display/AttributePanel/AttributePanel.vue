<template>
    <div :class="{ 'calculator-attributes': shadcn }">
        <h3 class="class">{{ t("stat.base") }}</h3>
        <attribute-item :shadcn="shadcn" :title="t('stat.lifeStatic')" :composition="attribute.hp" :baseline="baseline?.hp"></attribute-item>
        <attribute-item :shadcn="shadcn" :title="t('stat.attackStatic')" :composition="attribute.atk" :baseline="baseline?.atk"></attribute-item>
        <attribute-item :shadcn="shadcn" :title="t('stat.defendStatic')" :composition="attribute.def" :baseline="baseline?.def"></attribute-item>
        
        <attribute-item :shadcn="shadcn" :title="t('stat.elementalMastery')" :composition="attribute.elemental_mastery" :baseline="baseline?.elemental_mastery"></attribute-item>

        <h3 class="class">{{ t("stat.advanced") }}</h3>
        <attribute-item :shadcn="shadcn" :title="t('stat.critical')" :composition="attribute.critical" :baseline="baseline?.critical" :percentage="true"></attribute-item>
        <attribute-item :shadcn="shadcn" :title="t('stat.criticalDamage')" :composition="attribute.critical_damage" :baseline="baseline?.critical_damage" :percentage="true"></attribute-item>

        <attribute-item :shadcn="shadcn" :title="t('stat.cureEffect')" :composition="attribute.healing_bonus" :baseline="baseline?.healing_bonus" :percentage="true"></attribute-item>
        <attribute-item :shadcn="shadcn" :title="t('stat.incomingHealing')" :composition="attribute.incoming_healing_bonus" :baseline="baseline?.incoming_healing_bonus" :percentage="true" />
        <attribute-item :shadcn="shadcn" :title="t('stat.recharge')" :composition="attribute.recharge" :baseline="baseline?.recharge" :percentage="true"></attribute-item>
        <attribute-item :shadcn="shadcn" :title="t('stat.cooldownReduction')" :composition="attribute.cooldown_reduction" :baseline="baseline?.cooldown_reduction" :percentage="true" />
        <attribute-item :shadcn="shadcn" :title="t('stat.shield')" :composition="attribute.shield_strength" :baseline="baseline?.shield_strength" :percentage="true"></attribute-item>

        <h3 class="class">{{ t("stat.ele") }}</h3>
        <template v-for="[element, label] in elements" :key="element">
            <attribute-item :shadcn="shadcn" :title="t('stat.' + label + 'Bonus')" :composition="attribute['bonus_' + element]" :baseline="baseline?.['bonus_' + element]" :percentage="true" />
            <attribute-item :shadcn="shadcn" :title="t('stat.' + label + 'Res')" :composition="attribute['res_' + element]" :baseline="baseline?.['res_' + element]" :percentage="true" />
        </template>
    </div>
</template>

<script>
import AttributeItem from "./AttributeItem"
import {useI18n} from "../../../i18n/i18n";

export default {
    name: "AttributePanel",
    components: {
        AttributeItem
    },
    props: {
        shadcn: Boolean,
        baseline: { type: Object, default: null },
        attribute: {
            type: Object,
        },
    },
    computed: {
        attack() {
            let p = this.attribute;
            return p.attackStatic + p.attackBasic + p.attackPercentage;
        },

        defend() {
            let p = this.attribute;
            return p.defendStatic + p.defendBasic + p.defendPercentage;
        },

        life() {
            let p = this.attribute;
            return p.lifeStatic + p.lifeBasic + p.lifePercentage;
        }
    },
    setup() {
        const { t } = useI18n()

        return {
            t,
            elements: [['pyro', 'fire'], ['hydro', 'water'], ['dendro', 'dendro'], ['electro', 'thunder'],
                ['anemo', 'wind'], ['cryo', 'ice'], ['geo', 'rock'], ['physical', 'physical']],
        }
    }
}
</script>

<style lang="scss" scoped>

.attribute {
    margin-bottom: 8px;
}

.class {
    /* background:rgb(74, 99, 211); */
    // padding: 0px 16px;
    // display: inline-block;
    /* color: white; */
    border-radius: 3px;
    font-size: 14px;
    // border-bottom: 5px solid rgb(74, 99, 211);
    color: #555555;
}
.calculator-attributes .class { margin: 16px 0 4px; color: var(--cx-letter); }
.calculator-attributes .class:first-child { margin-top: 0; }
</style>

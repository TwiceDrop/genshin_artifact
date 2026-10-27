<template>
    <div class="stellar-composition">
        <div class="stellar-columns">
            <section class="composition-region"><h3>基础伤害</h3><div class="composition-columns">
                <damage-analysis-util :arr="state.scaling" :title="state.scaling_name" />
                <damage-analysis-util :arr="state.ratio" :title="title+'倍率'" />
                <damage-analysis-util v-if="state.extra_base.length" :arr="state.extra_base" title="基础伤害加值" />
                <damage-analysis-util v-if="state.independent.length" :arr="state.independent" :title="title+'独立倍率增量'" />
                <damage-analysis-util :arr="state.base_multiplier" :title="title+'基础倍率'" />
                <damage-analysis-util :arr="state.bonus" :title="family+'增伤'" />
                <damage-analysis-util :arr="state.base_bonus" :title="family+'基础提升'" />
                <damage-analysis-util :arr="state.flat" :title="title+'固定伤害'" />
            </div></section>
            <section class="composition-region critical"><h3>暴击</h3><div class="composition-columns">
                <damage-analysis-util :arr="state.critical" title="暴击率" /><damage-analysis-util :arr="state.critical_damage" title="暴击伤害" />
                <damage-analysis-util :arr="state.reaction_critical" :title="family+'专属暴击率'" /><damage-analysis-util :arr="state.reaction_critical_damage" :title="family+'专属暴击伤害'" />
            </div></section>
        </div>
        <div class="stellar-columns secondary">
            <section class="composition-region resistance"><h3>抗性乘区</h3><div class="composition-columns"><damage-analysis-util :arr="state.res_minus" title="减抗" /></div></section>
            <section class="composition-region elevation"><h3>擢升乘区</h3><div class="composition-columns"><damage-analysis-util :arr="state.elevation" :title="family+'擢升'" /><damage-analysis-util :arr="state.universal_elevation" title="星烁反应伤害擢升" /></div></section>
            <section v-if="state.final_multiplier.length" class="composition-region elevation"><h3>独立乘区</h3><damage-analysis-util :arr="state.final_multiplier" title="星烁反应伤害提升" /></section>
        </div>
    </div>
</template>
<script setup>
import {computed} from 'vue';import DamageAnalysisUtil from './DamageAnalysisUtil.vue';
const props=defineProps({state:Object,kind:String});const family=computed(()=>props.kind==='direct_stellarconduct'?'星超导':'星扩散'),title=computed(()=>'直伤'+family.value);
</script>
<style scoped>
.stellar-composition{overflow-x:auto;padding-bottom:8px}.stellar-columns,.composition-columns{display:flex;align-items:stretch;width:max-content}.stellar-columns{min-width:100%}.composition-region h3{margin:0;height:32px;display:flex;align-items:center;justify-content:center;background:rgb(217,236,255);font-size:14px}.composition-region.critical h3,.composition-region.resistance h3{background:rgb(179,216,255)}.composition-region.elevation h3{background:#ffe6d9}.composition-columns>div{width:125px;flex:0 0 125px}.secondary{margin-top:20px}.stellar-composition :deep(.header){height:auto;min-height:42px;text-align:center;box-sizing:border-box;padding:4px}.stellar-composition :deep(.el-checkbox){height:auto;white-space:normal;align-items:flex-start}.stellar-composition :deep(.el-checkbox__label){white-space:normal;overflow-wrap:anywhere;line-height:1.4}.stellar-composition :deep(.input){background:var(--el-fill-color-extra-light);color:var(--el-text-color-primary);border:1px solid var(--el-border-color-lighter);border-radius:2px}
</style>

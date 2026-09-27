<template>
 <el-collapse class="single-hit-panel"><el-collapse-item name="manual" title="单次伤害 · 主C手填面板（7.1.07）">
  <p>选择主C后填写面板，队友BUFF使用本页已添加的条目。技能倍率手填；不自动加入主C天赋、武器被动或套装。前后台、层数与持续状态由你声明。</p>
  <div class="fields">
   <label>伤害类型<el-select v-model="form.kind"><el-option v-for="o in kinds" :key="o[0]" :value="o[0]" :label="o[1]" /></el-select></label>
   <label>面板口径<el-select v-model="form.panelMode"><el-option value="final" label="已含普通属性BUFF的最终面板"/><el-option value="before-buffs" label="尚未加入下方队友BUFF"/></el-select></label>
   <label>伤害元素<el-select v-model="form.element"><el-option v-for="e in elements" :key="e[0]" :value="e[0]" :label="e[1]"/></el-select></label>
   <label>技能类别<el-select v-model="form.skillType"><el-option v-for="s in skills" :key="s[0]" :value="s[0]" :label="s[1]"/></el-select></label>
   <label>缩放属性<el-select v-model="form.scaling"><el-option v-for="s in stats" :key="s[0]" :value="s[0]" :label="s[1]"/></el-select></label>
   <label v-for="f in fields" :key="f[0]">{{f[1]}}<el-input-number v-model="form[f[0]]" :min="f[2]" :step="f[3]||1" controls-position="right" /></label>
  </div>
  <el-checkbox v-model="form.recipientOnField">主C当前在场上</el-checkbox>
  <el-checkbox v-model="form.useBuffs">应用本页已选BUFF</el-checkbox>
  <p>最终面板包含普通攻击／生命／防御／精通、普通增伤和元素双暴；勾选BUFF后只另外计算反应专属效果、定额及敌人减抗减防。“尚未加入”模式会加入普通BUFF，白值与已有百分比用于正确换算攻击等增益。敌人抗性始终填本次BUFF减抗前数值。</p>
  <p>BUFF本身未提供手动配方时会明确提示，不会静默忽略。多人月结晶和反应星扩散继续使用对应多人入口。此处不模拟多击消耗，不参与自动配装。</p>
  <el-button type="primary" @click="calculate">计算这一击</el-button>
  <el-alert v-if="error" :title="error" type="error" :closable="false"/>
  <p v-if="result" aria-live="polite">非暴击 {{format(result.non_critical)}} · 暴击 {{format(result.critical)}} · 期望 {{format(result.expectation)}}</p>
 </el-collapse-item></el-collapse>
</template>
<script setup>
import {reactive,ref,computed,watch} from 'vue'
import {calculateSingleHit} from '../../../beta-data/single-hit-damage.mjs'
const props=defineProps({character:{type:Object,default:()=>({})},buffs:{type:Array,default:()=>[]}})
const form=reactive({kind:'ordinary',panelMode:'final',element:'Pyro',skillType:'ElementalSkill',scaling:'ATK',stat:2000,base:1000,percentage:100,em:0,cr:50,cd:100,bonus:0,multiplier:100,res:10,characterLevel:90,enemyLevel:90,levelBase:1446.8535,K:1,baseBonus:0,reactionBonus:0,elevation:0,flat:0,recipientOnField:true,useBuffs:true})
const kinds=[['ordinary','普通技能直伤'],['lunar-electro','直伤月感电'],['lunar-bloom','直伤月绽放'],['lunar-crystallize','直伤月结晶'],['stellar-conduct','直伤星超导'],['stellar-swirl','直伤星扩散'],['bloom','普通绽放'],['hyperbloom','超绽放'],['burgeon','烈绽放'],['burning','燃烧单次跳伤']]
const elements=[['Pyro','火'],['Hydro','水'],['Electro','雷'],['Cryo','冰'],['Anemo','风'],['Geo','岩'],['Dendro','草'],['Physical','物理']]
const skills=[['NormalAttack','普攻'],['ChargedAttack','重击'],['PlungingAttack','下落攻击'],['ElementalSkill','元素战技'],['ElementalBurst','元素爆发']]
const stats=[['ATK','攻击'],['HP','生命'],['DEF','防御'],['ElementalMastery','精通']]
const fields=computed(()=>{
 const transformative=['bloom','hyperbloom','burgeon','burning'].includes(form.kind)
 return [...(!transformative?[["stat","缩放属性数值",0],["multiplier","技能倍率（%）",0],["cr","普通暴击率（%）",0],["cd","普通暴击伤害（%）",0]]:[]),["em","主C精通",0],["res","BUFF前敌人抗性（%）",-100],...(form.kind==='ordinary'?[["bonus","普通伤害加成（%）",0],["characterLevel","主C等级",1],["enemyLevel","敌人等级",1]]:[]),...(transformative?[["levelBase","触发者等级反应基础值",0]]:[]),...(form.panelMode==='before-buffs'&&!transformative&&form.scaling!=='ElementalMastery'?[["base","缩放属性白值（攻击含武器）",0],["percentage","已有该属性百分比（%）",-100]]:[]),...(form.kind==='stellar-conduct'?[["K","极星基础系数（未含BUFF）",0,.05]]:[]),...(form.kind!=='ordinary'?[["reactionBonus","反应增伤（%，未含BUFF）",0]]:[]),...(!transformative&&form.kind!=='ordinary'?[["baseBonus","反应基础提升（%，未含BUFF）",0],["elevation","擢升（%，未含BUFF）",0]]:[]),["flat","额外定额（未含BUFF）",0]]
})
const error=ref(''),result=ref(null),format=x=>Number(x).toFixed(2)
watch([form,()=>props.buffs,()=>props.character],()=>{result.value=null;error.value=''},{deep:true})
watch(()=>form.kind,k=>{form.element=({'lunar-electro':'Electro','lunar-bloom':'Dendro','lunar-crystallize':'Geo','stellar-conduct':'Cryo','stellar-swirl':'Anemo',bloom:'Dendro',hyperbloom:'Dendro',burgeon:'Dendro',burning:'Pyro'})[k]||form.element})
function calculate(){try{error.value='';result.value=calculateSingleHit({character:props.character,buffs:form.useBuffs?props.buffs:[],kind:form.kind,panelMode:form.panelMode,element:form.element,skillType:form.skillType,scaling:form.scaling,panel:{[form.scaling]:form.scaling==='ElementalMastery'?form.em:form.stat,[form.scaling+'Base']:form.base,[form.scaling+'Percentage']:form.percentage/100,em:form.em,critRate:form.cr/100,critDamage:form.cd/100,damageBonus:form.bonus/100},skillMultiplier:form.multiplier/100,resistanceBeforeBuffs:form.res/100,characterLevel:form.characterLevel,enemyLevel:form.enemyLevel,levelBase:form.levelBase,baseMultiplier:form.K,baseBonus:form.baseBonus/100,reactionBonus:form.reactionBonus/100,elevation:form.elevation/100,flatBonus:form.flat,recipientOnField:form.recipientOnField})}catch(e){result.value=null;error.value=e.message||String(e)}}
</script>
<style scoped>
.single-hit-panel{margin:16px 0}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.fields label{display:flex;flex-direction:column;gap:6px}p{line-height:1.6;color:var(--el-text-color-regular)}
</style>

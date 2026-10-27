<template>
    <section class="dsl-generator">
        <div class="generator-heading"><div><strong>DSL 目标函数生成器</strong><div>当前角色：{{ ta(character.nameLocale) }}（{{ state.character }}）</div></div><el-button type="primary" @click="showSkills = true">添加技能伤害</el-button></div>
        <div v-for="(entry,index) in state.entries" :key="index" class="generator-entry">
            <div><strong>{{ ta(entry.text) }}</strong><span>{{ reactionLabel(entry.reaction) }} · {{ valueLabel(entry.value) }} · {{ entry.infusion === 'None' ? '无附魔' : entry.infusion }}</span></div>
            <label>次数<el-input-number :model-value="entry.count" :min="0" :step="1" @update:modelValue="changeEntry(index,'count',$event)" /></label>
            <label>权重<el-input-number :model-value="entry.weight" :min="0" :step="0.1" @update:modelValue="changeEntry(index,'weight',$event)" /></label>
            <el-button @click="removeEntry(index)" :aria-label="'移除'+ta(entry.text)">移除</el-button>
        </div>
        <div class="generated-code"><strong>生成的 MONA-DSL</strong><el-input type="textarea" :rows="10" :model-value="source" readonly label="生成的 MONA-DSL" /><el-button @click="reset">重置</el-button></div>
        <el-dialog v-model="showSkills" title="添加技能伤害" width="min(1100px, 96vw)" append-to-body class="dsl-skill-dialog">
            <div class="generator-controls">
                <label>取值<el-radio-group v-model="value"><el-radio-button v-for="item in DSL_VALUES" :key="item.key" :label="item.key">{{ item.label }}</el-radio-button></el-radio-group></label>
                <label>附魔<select-element-type v-model="infusion" :elements="['None','Pyro','Hydro','Electro','Cryo','Anemo','Geo','Dendro']" /></label>
                <label>次数<el-input-number v-model="count" :min="0" :step="1" /></label><label>权重<el-input-number v-model="weight" :min="0" :step="0.1" /></label>
            </div>
            <div v-if="character.configSkill.length" class="generator-skill-config"><strong>技能参数</strong><item-config v-model="skillConfig" :item-name="state.character" :configs="character.configSkill" /></div>
            <el-checkbox v-model="showAll">显示全部伤害类型</el-checkbox>
            <div class="generator-skill-list">
                <div class="skill-list-header"><span>类型</span><span>技能</span><span>参数</span><span>添加</span></div>
                <div v-for="row in rows" :key="row.index" class="generator-skill-row">
                    <span>{{ ta(row.title) }}</span><span>{{ ta(row.text) }}<code>{{ row.token }}</code></span>
                    <div><el-radio-group :model-value="selection[row.index] || row.options[0]?.key" @update:modelValue="select(row.index,$event)"><el-radio-button v-for="option in row.options" :key="option.key" :label="option.key">{{ option.label }}</el-radio-button></el-radio-group><p v-if="row.error" class="skill-error">{{ row.error }}</p></div>
                    <el-button circle type="primary" :disabled="!row.options.length" :aria-label="'添加'+ta(row.text)" @click="add(row)">+</el-button>
                </div>
            </div>
        </el-dialog>
    </section>
</template>
<script setup>
import {ref,computed,watch} from 'vue';
import characters from '@/assets/_gen_character.js';
import names from '../../../beta-data/dsl-skill-names.json';
import {DSL_VALUES,DSL_DAMAGE_TYPES,skillRows,availableDamageTypes,generateDsl} from '@/algorithms/dsl-generator.mjs';
import {useI18n} from '@/i18n/i18n';
import ItemConfig from '@/components/config/ItemConfig.vue';
import SelectElementType from '@/components/select/SelectElementType.vue';
const props=defineProps({modelValue:Object,input:Object,mona:Object});const emit=defineEmits(['update:modelValue']);const {ta}=useI18n();
const state=computed(()=>props.modelValue),character=computed(()=>characters[state.value.character]),source=computed(()=>generateDsl(state.value));
const showSkills=ref(false),showAll=ref(false),value=ref('e'),infusion=ref('None'),count=ref(1),weight=ref(1),selection=ref({}),skillConfig=ref('NoConfig');
watch(()=>state.value.character,name=>{skillConfig.value=character.value.configSkill.length?{[name]:Object.fromEntries(character.value.configSkill.map(c=>[c.name,c.default]))}:'NoConfig';selection.value={};showSkills.value=false;},{immediate:true,flush:'sync'});
const rows=computed(()=>!showSkills.value?[]:skillRows(character.value,names[state.value.character]).map(row=>{let options=[],error='';try{options=availableDamageTypes(props.mona,props.input,row,skillConfig.value,infusion.value)}catch(e){error=e.message||String(e)}return {...row,options:showAll.value?DSL_DAMAGE_TYPES:options,error};}));
watch([skillConfig,infusion,showAll],()=>{selection.value={};},{deep:true});
const reactionLabel=key=>DSL_DAMAGE_TYPES.find(t=>t.key===key).label,valueLabel=key=>DSL_VALUES.find(t=>t.key===key).label;
function select(index,value){selection.value={...selection.value,[index]:value};}
function add(row){emit('update:modelValue',{...state.value,entries:[...state.value.entries,{index:row.index,text:row.text,token:row.token,params:JSON.parse(JSON.stringify(skillConfig.value==='NoConfig'?{}:skillConfig.value[state.value.character])),reaction:selection.value[row.index]||row.options[0].key,value:value.value,infusion:infusion.value,count:count.value,weight:weight.value}]});}
function changeEntry(index,key,value){emit('update:modelValue',{...state.value,entries:state.value.entries.map((entry,i)=>i===index?{...entry,[key]:value}:entry)});}
function removeEntry(index){emit('update:modelValue',{...state.value,entries:state.value.entries.filter((_,i)=>i!==index)});}
function reset(){emit('update:modelValue',{...state.value,entries:[]});}
</script>
<style scoped>
.dsl-generator{border:1px solid var(--el-border-color);border-radius:6px;padding:14px;background:var(--el-fill-color-extra-light)}
.generator-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}.generator-heading div div{font-size:13px;margin-top:6px;color:var(--el-text-color-secondary)}
.generated-code{display:grid;gap:10px;margin-top:14px}.generated-code .el-button{justify-self:start}.generated-code :deep(textarea){font-family:monospace}
.generator-entry{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--el-border-color)}.generator-entry>div:first-child{width:100%}.generator-entry span{display:block;font-size:12px;color:var(--el-text-color-secondary);margin-top:4px}.generator-entry label{display:grid;gap:4px}.generator-entry :deep(.el-input-number){width:110px}
.generator-controls{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:16px}.generator-controls>label{display:flex;flex-direction:column;gap:8px}.generator-skill-config{margin-bottom:12px}.generator-skill-list{overflow-x:auto;margin-top:12px;max-height:55vh}.skill-list-header,.generator-skill-row{display:grid;grid-template-columns:180px 230px minmax(260px,1fr) 52px;min-width:780px;align-items:center;gap:12px;padding:10px 8px;border-bottom:1px solid var(--el-border-color)}.skill-list-header{background:var(--el-fill-color-light);font-weight:bold;position:sticky;top:0;z-index:1}.generator-skill-row code{display:block;color:var(--el-color-primary);margin-top:4px}.generator-skill-row :deep(.el-radio-group){display:flex;flex-wrap:wrap;gap:3px}.skill-error{color:var(--el-color-danger);margin:6px 0;white-space:pre-wrap}
</style>

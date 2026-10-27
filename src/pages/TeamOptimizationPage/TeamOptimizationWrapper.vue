<template>
 <div class="team-configurations">
  <header class="toolbar">
   <h2><i-ep-data-analysis/>{{ managing?'管理计算配置':'多人优化' }}</h2>
   <div v-if="managing"><el-button @click="managing=false">返回计算</el-button><el-button type="primary" :disabled="loading||saving" @click="fileInput?.click()">导入</el-button></div>
   <el-button v-else :disabled="loading||saving" @click="openManager">管理计算配置</el-button>
  </header>
  <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importFile"/>
  <el-alert v-if="error" :title="error" type="error" :closable="false"/>
  <simple-loading v-if="loading"/>
  <template v-else-if="managing">
   <div class="manager">
    <aside><el-button v-for="entry in library.entries" :key="entry.key" :type="editingKey===entry.key?'primary':''" :disabled="saving" @click="edit(entry)">{{ entry.axis.title }}</el-button></aside>
    <section v-if="draft" class="editor">
     <el-form label-position="top" :disabled="saving">
      <div class="config-fields">
       <el-form-item label="名称"><el-input v-model="draft.title"/></el-form-item>
       <el-form-item label="轴长（秒）"><el-input-number :model-value="draft.durationMs/1000" :min="0.1" :step="0.5" @update:model-value="draft.durationMs=$event*1000"/></el-form-item>
       <el-form-item label="修订"><el-input-number v-model="draft.revision" :min="1"/></el-form-item>
       <el-form-item label="初始前台"><el-select popper-class="team-dps-popper" v-model="draft.initialActiveSlot"><el-option v-for="m in draft.members" :key="m.slot" :value="m.slot" :label="locale[characterData[m.character].nameLocale]"/></el-select></el-form-item>
      </div>
      <el-tabs v-model="editorTab">
       <el-tab-pane label="动作时间轴" name="timeline"><el-input v-model="timelineText" type="textarea" :rows="19" aria-label="动作时间轴 JSON"/></el-tab-pane>
       <el-tab-pane label="BUFF覆盖" name="coverage"><el-input v-model="coverageText" type="textarea" :rows="19" aria-label="BUFF覆盖 JSON"/></el-tab-pane>
       <el-tab-pane label="动作支持" name="actions"><el-table :data="actionSupport"><el-table-column prop="role" label="角色" width="110"/><el-table-column prop="supported" label="当前动作模板"/><el-table-column prop="pending" label="后续动作"/></el-table></el-tab-pane>
      </el-tabs>
     </el-form>
     <div class="editor-actions"><el-button type="primary" :disabled="saving" @click="saveDraft(false)">保存</el-button><el-button :disabled="saving" @click="saveDraft(true)">用于计算</el-button><el-button :disabled="saving" @click="exportDraft">导出</el-button><el-button type="danger" :disabled="saving" @click="removeDraft">删除</el-button></div>
    </section>
    <div v-else class="empty"><el-button type="primary" @click="fileInput?.click()">导入计算配置</el-button></div>
   </div>
  </template>
  <template v-else>
   <div v-if="library.entries.length" class="choose-config"><el-select popper-class="team-dps-popper" :model-value="library.selectedId" placeholder="选择计算配置" :disabled="saving" @update:model-value="choose($event)"><el-option v-for="entry in library.entries" :key="entry.key" :value="entry.key" :label="entry.axis.title"/></el-select><el-button :disabled="saving" @click="fileInput?.click()">导入计算配置</el-button></div>
   <team-dps-page v-if="selected" :key="selected.key+'-'+generation" :configuration="selected.axis" :task-key="selected.key" :tasks="tasks[selected.key]||{}" @save-task="saveTask"/>
   <div v-else class="empty"><el-button type="primary" size="large" :disabled="saving" @click="fileInput?.click()">导入计算配置</el-button></div>
  </template>
 </div>
</template>
<script setup lang="ts">
import './team-dps-theme.css'
import {ref,computed,watch,onBeforeUnmount} from 'vue'
import {ElMessage} from 'element-plus'
import TeamDpsPage from './TeamDpsPage.vue'
import SimpleLoading from '@/components/loading/SimpleLoading.vue'
import {useAccountStore} from '@/store/pinia/account'
import backend from '@/store/backend'
import {downloadString} from '@/utils/common'
import {characterData} from '@/assets/character'
import locale from '@/i18n/generated/zh-cn.json'
import {teamDpsLibraryKey,emptyTeamDpsLibrary,importTeamDpsConfiguration,updateTeamDpsConfiguration,deleteTeamDpsConfiguration,exportTeamDpsConfiguration} from '../../../beta-data/team-dps-library.mjs'
const account=useAccountStore(),library=ref<any>(emptyTeamDpsLibrary()),managing=ref(false),loading=ref(true),saving=ref(false),error=ref(''),generation=ref(0)
const fileInput=ref<HTMLInputElement|null>(null),editingKey=ref<number|null>(null),draft=ref<any>(null),timelineText=ref(''),coverageText=ref(''),editorTab=ref('timeline')
const tasks=ref<Record<string,any>>({})
const actionSupport=[
 {role:'丝柯克',supported:'七相普攻第1～5段、重击、一命与六命追加；凋尽覆盖',pending:'普通形态攻击、直接爆发伤害'},
 {role:'芙宁娜',supported:'荒性泡沫、三位沙龙成员、万众狂欢、普攻第1段、重击、下落、六命乌西亚',pending:'芒性与荒芒切换、普攻第2～4段'},
 {role:'爱可菲',supported:'冻霜芭菲、爆发、治疗、普攻第1段、重击、下落；六命由内核自动追加',pending:'战技施放初击、普攻第2～3段'},
 {role:'沃雅妮莎',supported:'战技施放、唤春角笛、治疗、普攻第1段、重击、下落',pending:'爆发伤害与对应状态、普攻第2～4段'},
]
const tasksKey=(accountId:number)=>'mona_account_team_dps_tasks_'+accountId
let taskWrites=Promise.resolve()
function saveTask({key,accountId,uid,state}:any){
 if(accountId!==account.currentAccountId.value)return;
 (tasks.value[key]??={})[uid]=state;
 const storageKey=tasksKey(accountId),snapshot=JSON.parse(JSON.stringify(tasks.value));
 taskWrites=taskWrites.then(()=>backend.setItem(storageKey,snapshot)).catch(fail);
}
const selected=computed(()=>library.value.entries.find((entry:any)=>entry.key===library.value.selectedId))
let sequence=0
const fail=(e:any)=>{console.error(e);error.value=e.message}
function edit(entry:any){editingKey.value=entry.key;draft.value=JSON.parse(JSON.stringify(entry.axis));timelineText.value=JSON.stringify(draft.value.timeline,null,2);coverageText.value=JSON.stringify(draft.value.coverage,null,2);error.value=''}
function openManager(){managing.value=true;const entry=selected.value||library.value.entries[0];if(entry)edit(entry)}
function currentDraft(){return {...draft.value,timeline:JSON.parse(timelineText.value),coverage:JSON.parse(coverageText.value)}}
async function persist(){const key=teamDpsLibraryKey(account.currentAccountId.value);await backend.setItem(key,JSON.parse(JSON.stringify(library.value)))}
async function importFile(event:Event){
 const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;
 const task=sequence;saving.value=true;error.value='';
 try{const text=await file.text();if(task!==sequence)return;const entry=importTeamDpsConfiguration(library.value,text);generation.value++;edit(entry);await persist();if(task===sequence)ElMessage.success('计算配置已导入')}
 catch(e){if(task===sequence)fail(e)}finally{if(task===sequence)saving.value=false}
}
async function choose(key:number){library.value.selectedId=key;generation.value++;saving.value=true;const task=sequence;try{await persist()}catch(e){if(task===sequence)fail(e)}finally{if(task===sequence)saving.value=false}}
async function saveDraft(use:boolean){const task=sequence;saving.value=true;error.value='';try{const axis=currentDraft();updateTeamDpsConfiguration(library.value,editingKey.value,axis);if(use)library.value.selectedId=editingKey.value;generation.value++;await persist();if(task===sequence){edit(library.value.entries.find((e:any)=>e.key===editingKey.value));if(use)managing.value=false;ElMessage.success('计算配置已保存')}}catch(e){if(task===sequence)fail(e)}finally{if(task===sequence)saving.value=false}}
async function exportDraft(){try{const axis=currentDraft();await downloadString(exportTeamDpsConfiguration(axis),'application/json',axis.id+'.mona-axis.json')}catch(e){fail(e)}}
async function removeDraft(){const task=sequence;saving.value=true;delete tasks.value[editingKey.value];const storageKey=tasksKey(account.currentAccountId.value),snapshot=JSON.parse(JSON.stringify(tasks.value));taskWrites=taskWrites.then(()=>backend.setItem(storageKey,snapshot)).catch(fail);deleteTeamDpsConfiguration(library.value,editingKey.value);draft.value=null;editingKey.value=null;generation.value++;try{await persist()}catch(e){if(task===sequence)fail(e)}finally{if(task===sequence)saving.value=false}}
watch(()=>account.currentAccountId.value,async id=>{
 const task=++sequence;loading.value=true;saving.value=false;library.value=emptyTeamDpsLibrary();tasks.value={};draft.value=null;editingKey.value=null;error.value='';generation.value++;
 try{await taskWrites;const [saved,personal]=await Promise.all([backend.getItem(teamDpsLibraryKey(id)),backend.getItem(tasksKey(id))]);if(task===sequence){library.value=saved??emptyTeamDpsLibrary();tasks.value=personal??{}}}
 catch(e){if(task===sequence)fail(e)}finally{if(task===sequence)loading.value=false}
},{immediate:true})
onBeforeUnmount(()=>{sequence++})
</script>
<style scoped>
.team-configurations{padding:18px}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #e4e9f2}.toolbar h2{display:flex;align-items:center;gap:12px;margin:0;font-size:25px;font-weight:650;letter-spacing:.02em}.toolbar h2 svg{color:#568de0;width:24px;height:24px}.empty{display:flex;align-items:center;justify-content:center;min-height:45vh;border:1px dashed #dce5f1;border-radius:16px;background:#ffffff}.choose-config{display:flex;gap:12px;margin:0 0 14px;align-items:center}.choose-config .el-select{width:420px;max-width:65vw}.manager{display:grid;grid-template-columns:230px minmax(0,1fr);gap:14px}.manager aside{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid #e2e7ef;border-radius:14px;background:#ffffff}.manager aside .el-button{margin:0;height:auto;white-space:normal;text-align:left;justify-content:flex-start;padding:12px;line-height:1.5}.editor{padding:18px;border:1px solid #e2e7ef;border-radius:14px;background:#ffffff;min-width:0}.config-fields{display:flex;gap:12px;flex-wrap:wrap}.config-fields .el-form-item:first-child{flex:1;min-width:220px}.editor-actions{display:flex;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid #e2e7ef;flex-wrap:wrap}.editor :deep(textarea){font-family:Consolas,monospace;line-height:1.55;padding:12px;font-size:15px;color:#526a8e}.editor :deep(.el-tabs__item){font-weight:600}@media(max-width:800px){.team-configurations{padding:12px}.manager{grid-template-columns:1fr}.toolbar{flex-wrap:wrap}.toolbar h2{font-size:22px}.manager aside{flex-direction:row;overflow:auto}.manager aside .el-button{flex-shrink:0}.editor{padding:14px}.choose-config{flex-wrap:wrap}.choose-config .el-select{max-width:100%;width:100%}}
</style>

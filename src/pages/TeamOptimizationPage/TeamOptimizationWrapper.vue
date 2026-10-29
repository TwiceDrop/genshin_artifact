<template>
 <div class="team-configurations">
  <header class="toolbar">
   <div class="toolbar-title"><h2><i-ep-data-analysis/>{{ managing?'管理计算配置':'多人优化' }}</h2><span v-if="!managing" class="technical-credit">技术支持：<a href="https://www.gensri.wiki/" target="_blank" rel="noopener noreferrer">强度研究院</a></span></div>
   <div v-if="managing"><el-button @click="managing=false">返回计算</el-button><el-button :disabled="loading||saving" @click="createDraft">新建动作轴</el-button><el-button type="primary" :disabled="loading||saving" @click="fileInput?.click()">导入</el-button></div>
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
       <el-form-item label="轴长（秒）"><span v-if="actionDraft" class="duration-value">{{ Number((draftDurationMs/1000).toFixed(3)) }}</span><el-input-number v-else :model-value="draft.durationMs/1000" :min="0.1" :step="0.5" @update:model-value="draft.durationMs=$event*1000"/></el-form-item>
       <el-form-item label="初始前台"><el-select popper-class="team-dps-popper" v-model="draft.initialActiveSlot"><el-option v-for="m in draft.members" :key="m.slot" :value="m.slot" :label="locale[characterData[m.character].nameLocale]"/></el-select></el-form-item>
       <el-form-item label="轴尾命中"><el-select popper-class="team-dps-popper" v-model="draft.endHit"><el-option value="include" label="计入"/><el-option value="exclude" label="排除"/></el-select></el-form-item>
      </div>
      <el-tabs v-model="editorTab">
       <el-tab-pane label="动作时间轴" name="timeline">
        <template v-if="actionDraft">
         <div class="timeline-toolbar"><el-button @click="addAction">添加动作</el-button><el-button @click="draft.timeline.sort((a,b)=>a.timeMs-b.timeMs)">按时间排序</el-button><el-button @click="openTimelineJson">编辑 JSON</el-button><el-button @click="openMultiplierPreview">倍率预览</el-button></div>
         <el-table :data="draft.timeline" row-key="id" class="action-timeline" max-height="min(55vh, 560px)" scrollbar-always-on>
          <el-table-column label="时间（秒）" width="125"><template #default="{row}"><el-input-number :model-value="row.timeMs/1000" :min="0" :step="0.1" :controls="false" @update:model-value="row.timeMs=$event*1000"/></template></el-table-column>
          <el-table-column label="角色" width="115"><template #default="{row}"><el-select popper-class="team-dps-popper" v-model="row.actor" @change="changeActor(row)"><el-option v-for="m in draft.members" :key="m.slot" :value="m.slot" :label="locale[characterData[m.character].nameLocale]"/></el-select></template></el-table-column>
          <el-table-column label="类型" width="110"><template #default="{row}"><el-select popper-class="team-dps-popper" v-model="row.kind" @change="changeKind(row)"><el-option value="action" label="动作"/><el-option value="switch" label="切换至"/></el-select></template></el-table-column>
          <el-table-column label="技能" min-width="270"><template #default="{row}"><el-select v-if="row.kind==='action'" popper-class="team-dps-popper" v-model="row.action" @change="changeAction(row)"><el-option v-for="a in actionsFor(row)" :key="a.id" :value="a.id" :label="a.label"/></el-select><div v-for="field in parametersFor(row)" :key="field.key" class="action-effect"><span>{{ field.label }}</span><el-input-number :model-value="row.params?.[field.key]===undefined?undefined:row.params[field.key]/(field.scale||1)" :min="field.min/(field.scale||1)" :max="field.max/(field.scale||1)" :step="field.step" :controls="false" :placeholder="field.placeholder" :aria-label="field.label" @update:model-value="setActionParameter(row,field,$event)"/><small v-if="field.help">{{ field.help }}</small></div></template></el-table-column>
          <el-table-column label="顺序" width="145"><template #default="{$index}"><el-button :disabled="$index===0" aria-label="上移" @click="moveAction($index,-1)">↑</el-button><el-button :disabled="$index===draft.timeline.length-1" aria-label="下移" @click="moveAction($index,1)">↓</el-button><el-button type="danger" link @click="draft.timeline.splice($index,1)">删除</el-button></template></el-table-column>
         </el-table>
        </template>
        <template v-else><div class="timeline-toolbar"><el-button @click="convertLegacyDraft">转为动作轴</el-button></div><el-input v-model="timelineText" type="textarea" :rows="19" aria-label="动作时间轴 JSON"/></template>
       </el-tab-pane>
       <el-tab-pane v-if="!actionDraft" label="BUFF覆盖" name="coverage"><el-input v-model="coverageText" type="textarea" :rows="19" aria-label="BUFF覆盖 JSON"/></el-tab-pane>
       <el-tab-pane v-if="!actionDraft" label="动作支持" name="actions"><el-table :data="actionSupport"><el-table-column prop="role" label="角色" width="110"/><el-table-column prop="supported" label="当前动作模板"/><el-table-column prop="pending" label="后续动作"/></el-table></el-tab-pane>
      </el-tabs>
     </el-form>
     <div class="editor-actions"><el-button type="primary" :disabled="saving" @click="saveDraft(false)">保存</el-button><el-button :disabled="saving||actionDraft&&draftDurationMs===0" @click="saveDraft(true)">用于计算</el-button><el-button :disabled="saving" @click="exportDraft">导出</el-button><el-button type="danger" :disabled="saving" @click="removeDraft">删除</el-button></div>
    </section>
    <div v-else class="empty"><el-button type="primary" @click="createDraft">新建动作轴</el-button><el-button @click="fileInput?.click()">导入计算配置</el-button></div>
   </div>
  </template>
  <template v-else>
   <div v-if="library.entries.length" class="choose-config"><el-select popper-class="team-dps-popper" :model-value="library.selectedId" placeholder="选择计算配置" :disabled="saving" @update:model-value="choose($event)"><el-option v-for="entry in library.entries" :key="entry.key" :value="entry.key" :label="entry.axis.title"/></el-select><el-button :disabled="saving" @click="fileInput?.click()">导入计算配置</el-button></div>
   <team-dps-page v-if="selected" :key="selected.key+'-'+generation" :configuration="selected.axis" :task-key="selected.key" :tasks="tasks[selected.key]||{}" @save-task="saveTask"/>
   <div v-else class="empty"><el-button type="primary" size="large" :disabled="saving" @click="createDraft">新建动作轴</el-button><el-button size="large" :disabled="saving" @click="fileInput?.click()">导入计算配置</el-button></div>
  </template>
  <team-multiplier-preview v-if="multiplierPreview" :axis="multiplierPreview.axis" :characters="multiplierPreview.characters" @close="multiplierPreview=null"/>
  <el-dialog v-model="jsonDialog" title="动作时间轴 JSON" width="min(850px,94vw)" custom-class="team-dps-dialog">
   <el-alert v-if="error" :title="error" type="error" :closable="false"/>
   <el-input v-model="timelineText" type="textarea" :rows="20" aria-label="动作时间轴 JSON"/>
   <template #footer><el-button @click="jsonDialog=false">取消</el-button><el-button type="primary" @click="applyTimelineJson">应用</el-button></template>
  </el-dialog>
  <el-dialog v-model="selectingMembers" title="选择队伍角色" width="min(720px,94vw)" custom-class="team-dps-dialog">
   <el-input v-model="characterSearch" placeholder="搜索角色" clearable/>
   <div class="member-picker"><button v-for="name in selectableCharacters" :key="name" :class="{selected:newMembers.includes(name)}" :disabled="newMembers.length===4&&!newMembers.includes(name)" :aria-pressed="newMembers.includes(name)" @click="toggleMember(name)"><img :src="characterData[name].avatar" alt=""/><strong>{{ locale[characterData[name].nameLocale] }}</strong><span v-if="newMembers.includes(name)">{{ newMembers.indexOf(name)+1 }}</span></button></div>
   <template #footer><span class="member-count">{{ newMembers.length }}/4</span><el-button @click="selectingMembers=false">取消</el-button><el-button type="primary" :disabled="newMembers.length!==4" @click="confirmMembers">创建动作轴</el-button></template>
  </el-dialog>
 </div>
</template>
<script setup lang="ts">
import './team-dps-theme.css'
import {ref,shallowRef,computed,watch,onBeforeUnmount} from 'vue'
import {ElMessage} from 'element-plus'
import 'element-plus/es/components/message/style/css'
import TeamDpsPage from './TeamDpsPage.vue'
import TeamMultiplierPreview from './TeamMultiplierPreview.vue'
import SimpleLoading from '@/components/loading/SimpleLoading.vue'
import {useAccountStore} from '@/store/pinia/account'
import {useMiyousheStore} from '@/store/pinia/miyoushe'
import backend from '@/store/backend'
import {downloadString} from '@/utils/common'
import {characterData} from '@/assets/character'
import locale from '@/i18n/generated/zh-cn.json'
import {loadTeamDpsLibrary,saveTeamDpsLibrary,emptyTeamDpsLibrary,installTeamDpsBuiltins,importTeamDpsConfiguration,updateTeamDpsConfiguration,deleteTeamDpsConfiguration,exportTeamDpsConfiguration} from '../../../beta-data/team-dps-library.mjs'
import {TEAM_ACTION_CATALOG,createActionAxis,actionAxisDurationMs} from '../../../beta-data/team-engine/action-config.mjs'
import {validateTeamDpsConfiguration} from '../../../beta-data/team-dps-config.mjs'
import {legacyActionAxis} from '../../../beta-data/team-engine/legacy-conversion.mjs'
const account=useAccountStore(),mys=useMiyousheStore(),library=ref<any>(emptyTeamDpsLibrary()),managing=ref(false),loading=ref(true),saving=ref(false),error=ref(''),generation=ref(0)
const fileInput=ref<HTMLInputElement|null>(null),editingKey=ref<number|null>(null),draft=ref<any>(null),timelineText=ref(''),coverageText=ref(''),editorTab=ref('timeline')
const tasks=shallowRef<Record<string,any>>({})
const jsonDialog=ref(false),actionDraft=computed(()=>draft.value?.format==='mona-action-axis')
const multiplierPreview=ref<any>(null)
function openMultiplierPreview(){try{validateTeamDpsConfiguration(currentDraft());const fields=editingKey.value===null?undefined:tasks.value[editingKey.value]?.[mys.selectedUid.value||'']?.fields;multiplierPreview.value=JSON.parse(JSON.stringify({axis:currentDraft(),characters:fields?.members.map((m:any)=>m.character)}));error.value=''}catch(e){fail(e)}}
const draftDurationMs=computed(()=>actionDraft.value?actionAxisDurationMs(draft.value,editingKey.value===null?undefined:tasks.value[editingKey.value]?.[mys.selectedUid.value||'']?.fields.members):draft.value?.durationMs)
const selectingMembers=ref(false),newMembers=ref<string[]>([]),characterSearch=ref('')
const selectableCharacters=computed(()=>Object.keys(TEAM_ACTION_CATALOG).filter(name=>(name+' '+locale[characterData[name].nameLocale]).toLowerCase().includes(characterSearch.value.toLowerCase())))
function toggleMember(name:string){const index=newMembers.value.indexOf(name);if(index<0)newMembers.value.push(name);else newMembers.value.splice(index,1)}
const actionsFor=(row:any)=>TEAM_ACTION_CATALOG[draft.value.members.find((m:any)=>m.slot===row.actor).character]
const parametersFor=(row:any)=>row.kind==='action'?(actionsFor(row).find((a:any)=>a.id===row.action)?.parameters||[]):[]
function createDraft(){newMembers.value=[];characterSearch.value='';selectingMembers.value=true}
function confirmMembers(){editingKey.value=null;draft.value=createActionAxis('action-axis-'+library.value.nextId,newMembers.value);managing.value=true;selectingMembers.value=false;editorTab.value='timeline';savedDraft='';error.value=''}
function addAction(){let id=1;const ids=new Set(draft.value.timeline.map((a:any)=>a.id));while(ids.has('action-'+id))id++;const row={id:'action-'+id,kind:'action',actor:draft.value.initialActiveSlot,action:'',timeMs:0};row.action=actionsFor(row)[0].id;draft.value.timeline.push(row)}
function changeActor(row:any){if(row.kind==='action')row.action=actionsFor(row)[0].id;delete row.params}
function changeKind(row:any){delete row.params;if(row.kind==='switch')delete row.action;else row.action=actionsFor(row)[0].id}
function changeAction(row:any){delete row.params}
function setActionParameter(row:any,field:any,value:number|null){if(value===null||value===undefined){if(row.params)delete row.params[field.key]}else row.params={...row.params,[field.key]:value*(field.scale||1)}}
function moveAction(index:number,offset:number){const [row]=draft.value.timeline.splice(index,1);draft.value.timeline.splice(index+offset,0,row)}
function openTimelineJson(){timelineText.value=JSON.stringify(draft.value.timeline,null,2);error.value='';jsonDialog.value=true}
function applyTimelineJson(){try{const timeline=JSON.parse(timelineText.value);validateTeamDpsConfiguration({...draft.value,timeline});draft.value.timeline=timeline;jsonDialog.value=false;error.value=''}catch(e){fail(e)}}
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
 tasks.value={...tasks.value,[key]:{...tasks.value[key],[uid]:state}};
 const storageKey=tasksKey(accountId),snapshot=tasks.value;
 taskWrites=taskWrites.then(()=>backend.setItem(storageKey,snapshot)).catch(fail);
}
const selected=computed(()=>library.value.entries.find((entry:any)=>entry.key===library.value.selectedId))
let sequence=0
let savedDraft=''
const fail=(e:any)=>{console.error(e);error.value=e.message}
function edit(entry:any){editingKey.value=entry.key;draft.value=JSON.parse(JSON.stringify(entry.axis));timelineText.value=JSON.stringify(draft.value.timeline,null,2);coverageText.value=JSON.stringify(draft.value.coverage,null,2);editorTab.value='timeline';savedDraft=JSON.stringify(draft.value);error.value=''}
function openManager(){managing.value=true;const entry=selected.value||library.value.entries[0];if(entry)edit(entry)}
function currentDraft(){return actionDraft.value?draft.value:{...draft.value,timeline:JSON.parse(timelineText.value),coverage:JSON.parse(coverageText.value)}}
function convertLegacyDraft(){try{draft.value=legacyActionAxis(validateTeamDpsConfiguration(currentDraft()));editorTab.value='timeline';error.value=''}catch(e){fail(e)}}
function persist(){return saveTeamDpsLibrary(backend,account.currentAccountId.value,library.value)}
async function importFile(event:Event){
 const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;
 const task=sequence;saving.value=true;error.value='';
 try{const text=await file.text();if(task!==sequence)return;const entry=importTeamDpsConfiguration(library.value,text);generation.value++;edit(entry);await persist();if(task===sequence)ElMessage.success('计算配置已导入')}
 catch(e){if(task===sequence)fail(e);else console.error(e)}finally{if(task===sequence)saving.value=false}
}
async function choose(key:number){library.value.selectedId=key;generation.value++;saving.value=true;const task=sequence;try{await persist()}catch(e){if(task===sequence)fail(e);else console.error(e)}finally{if(task===sequence)saving.value=false}}
async function saveDraft(use:boolean,automatic=false){const task=sequence;saving.value=true;error.value='';try{const axis=JSON.parse(JSON.stringify(currentDraft()));if(editingKey.value===null){const selectedId=library.value.selectedId;editingKey.value=importTeamDpsConfiguration(library.value,exportTeamDpsConfiguration(axis)).key;if(!use)library.value.selectedId=selectedId}else updateTeamDpsConfiguration(library.value,editingKey.value,axis);if(use)library.value.selectedId=editingKey.value;generation.value++;await persist();if(task===sequence){edit(library.value.entries.find((e:any)=>e.key===editingKey.value));if(use)managing.value=false;if(!automatic)ElMessage({message:'保存成功',type:'success',customClass:'team-dps-save-success'})}}catch(e){if(task===sequence)fail(e);else console.error(e)}finally{if(task===sequence)saving.value=false}}
async function autoSaveDraft(){if(!managing.value||!draft.value||loading.value||saving.value||jsonDialog.value||selectingMembers.value)return;try{if(JSON.stringify(currentDraft())!==savedDraft)await saveDraft(false,true)}catch(e){fail(e)}}
const autosaveTimer=setInterval(autoSaveDraft,15000)
async function exportDraft(){try{const axis=currentDraft();await downloadString(exportTeamDpsConfiguration(axis),'application/json',axis.id+'.mona-axis.json')}catch(e){fail(e)}}
async function removeDraft(){if(editingKey.value===null){draft.value=null;return}const task=sequence;saving.value=true;const snapshot={...tasks.value};delete snapshot[editingKey.value];tasks.value=snapshot;const storageKey=tasksKey(account.currentAccountId.value);taskWrites=taskWrites.then(()=>backend.setItem(storageKey,snapshot)).catch(fail);deleteTeamDpsConfiguration(library.value,editingKey.value);draft.value=null;editingKey.value=null;generation.value++;try{await persist()}catch(e){if(task===sequence)fail(e);else console.error(e)}finally{if(task===sequence)saving.value=false}}
watch(()=>account.currentAccountId.value,async id=>{
 const task=++sequence;loading.value=true;saving.value=false;library.value=emptyTeamDpsLibrary();tasks.value={};draft.value=null;editingKey.value=null;selectingMembers.value=false;multiplierPreview.value=null;savedDraft='';error.value='';generation.value++;
 try{await taskWrites;const [saved,personal]=await Promise.all([loadTeamDpsLibrary(backend,id),backend.getItem(tasksKey(id))]);if(task===sequence){const next=saved??emptyTeamDpsLibrary();if(installTeamDpsBuiltins(next))await saveTeamDpsLibrary(backend,id,next);if(task===sequence){library.value=next;tasks.value=personal??{}}}}
 catch(e){if(task===sequence)fail(e);else console.error(e)}finally{if(task===sequence)loading.value=false}
},{immediate:true})
onBeforeUnmount(()=>{sequence++;clearInterval(autosaveTimer)})
</script>
<style scoped>
.toolbar-title{display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px}.technical-credit{font-size:14px;color:#718096;white-space:nowrap}.technical-credit a{color:#568de0;text-decoration:none}.technical-credit a:hover{text-decoration:underline}
.action-effect{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;margin-top:8px;color:#718096;font-size:13px}.action-effect :deep(.el-input-number){width:88px;flex:0 0 88px}.action-effect small{flex-basis:100%;line-height:1.5;font-size:12px}.action-effect>span{white-space:nowrap}.action-timeline :deep(.el-table__body td.el-table__cell){vertical-align:top}
.duration-value{display:flex;align-items:center;min-height:40px;padding:0 14px;border:1px solid #dce4ef;border-radius:8px;background:#f4f7fb;color:#355b85;font-size:18px;font-weight:600;min-width:100px}.member-picker{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.member-picker button{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 8px;border:1px solid #dfe6ef;border-radius:12px;background:#fff;color:#526a8e;cursor:pointer;font:inherit}.member-picker button img{width:64px;height:64px;object-fit:cover;border-radius:50%}.member-picker button.selected{background:#edf5ff;border-color:#6fa4e6;color:#315e98}.member-picker button span{position:absolute;top:5px;right:8px;color:#fff;background:#5596e0;border-radius:50%;width:24px;line-height:24px}.member-picker button:disabled{opacity:.45;cursor:default}.member-count{margin-right:20px;color:#55718f}@media(max-width:550px){.member-picker{grid-template-columns:repeat(2,minmax(0,1fr))}}
.timeline-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}.timeline-toolbar .el-button{margin:0}.timeline-toolbar span{margin-left:auto;color:#748096;font-size:14px}.action-timeline :deep(.el-input-number),.action-timeline :deep(.el-select){width:100%}.action-timeline :deep(.cell){padding:8px}.action-timeline .el-button{padding:6px 8px;margin-left:4px}.action-timeline :deep(.el-table__body-wrapper){overflow-x:auto}
.team-configurations{padding:18px}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #e4e9f2}.toolbar h2{display:flex;align-items:center;gap:12px;margin:0;font-size:25px;font-weight:650;letter-spacing:.02em}.toolbar h2 svg{color:#568de0;width:24px;height:24px}.empty{display:flex;align-items:center;justify-content:center;min-height:45vh;border:1px dashed #dce5f1;border-radius:16px;background:#ffffff}.choose-config{display:flex;gap:12px;margin:0 0 14px;align-items:center}.choose-config .el-select{width:420px;max-width:65vw}.manager{display:grid;grid-template-columns:230px minmax(0,1fr);gap:14px}.manager aside{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid #e2e7ef;border-radius:14px;background:#ffffff}.manager aside .el-button{margin:0;height:auto;white-space:normal;text-align:left;justify-content:flex-start;padding:12px;line-height:1.5}.editor{padding:18px;border:1px solid #e2e7ef;border-radius:14px;background:#ffffff;min-width:0}.config-fields{display:flex;gap:12px;flex-wrap:wrap}.config-fields .el-form-item:first-child{flex:1;min-width:220px}.editor-actions{display:flex;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid #e2e7ef;flex-wrap:wrap}.editor :deep(textarea){font-family:Consolas,monospace;line-height:1.55;padding:12px;font-size:15px;color:#526a8e}.editor :deep(.el-tabs__item){font-weight:600}@media(max-width:800px){.team-configurations{padding:12px}.manager{grid-template-columns:1fr}.toolbar{flex-wrap:wrap}.toolbar h2{font-size:22px}.manager aside{flex-direction:row;overflow:auto}.manager aside .el-button{flex-shrink:0}.editor{padding:14px}.choose-config{flex-wrap:wrap}.choose-config .el-select{max-width:100%;width:100%}}
</style>

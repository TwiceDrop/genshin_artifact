<template>
 <div class="team-configurations cx-scope">
  <header class="toolbar" data-tour="team.toolbar">
   <div class="toolbar-title"><h2><i-ep-data-analysis/>{{ managing?'管理计算配置':'多人优化' }}<PageGuideButton guide-id="detail-team-dps" /></h2><span v-if="!managing" class="technical-credit">技术支持：<a href="https://www.gensri.wiki/" target="_blank" rel="noopener noreferrer">强度研究院</a></span></div>
   <div v-if="managing" class="toolbar-actions"><UiButton @click="managing=false">返回计算</UiButton><UiButton :disabled="loading||saving" @click="createDraft">新建动作轴</UiButton><UiButton variant="primary" :disabled="loading||saving" @click="fileInput?.click()">导入</UiButton></div>
   <UiButton v-else data-tour="team.manage-btn" :disabled="loading||saving" @click="openManager">管理计算配置</UiButton>
  </header>
  <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importFile"/>
  <p v-if="error" class="team-inline-error" role="alert">{{ error }}</p>
  <simple-loading v-if="loading"/>
  <template v-else-if="managing">
   <div class="manager">
    <aside><UiButton v-for="entry in library.entries" :key="entry.key" :variant="editingKey===entry.key?'primary':'outline'" :disabled="saving" @click="edit(entry)"><span>{{ entry.axis.title }}<small v-if="share.entryStatus(entry)" class="share-list-status">● {{ share.entryStatus(entry) }}</small></span></UiButton></aside>
    <section v-if="draft" class="editor">
     <fieldset class="team-fieldset" :disabled="saving">
      <div class="config-fields">
       <div class="team-form-item"><label for="team-axis-name">名称</label><UiInput id="team-axis-name" v-model="draft.title"/></div>
       <div class="team-form-item"><span class="team-field-label">轴长（秒）</span><span v-if="actionDraft" class="duration-value">{{ Number((draftDurationMs/1000).toFixed(3)) }}</span><TeamNumberInput v-else :model-value="draft.durationMs/1000" :min="0.1" :step="0.5" aria-label="轴长（秒）" @update:model-value="draft.durationMs=$event*1000"/></div>
       <div class="team-form-item"><span class="team-field-label">初始前台</span><UiSelect v-model="draft.initialActiveSlot" label="初始前台" :disabled="saving" :options="draftMemberOptions"/></div>
       <div class="team-form-item"><span class="team-field-label">轴尾命中</span><UiSelect v-model="draft.endHit" label="轴尾命中" :disabled="saving" :options="endHitOptions"/></div>
      </div>
      <TabsRoot v-model="editorTab" class="team-tabs">
       <TabsList class="team-tabs-list" aria-label="动作轴配置">
        <TabsTrigger class="team-tab" value="timeline">动作时间轴</TabsTrigger>
        <TabsTrigger v-if="!actionDraft" class="team-tab" value="coverage">BUFF覆盖</TabsTrigger>
        <TabsTrigger v-if="!actionDraft" class="team-tab" value="actions">动作支持</TabsTrigger>
       </TabsList>
       <TabsContent value="timeline">
        <template v-if="actionDraft">
         <div class="timeline-toolbar"><UiButton @click="addAction">添加动作</UiButton><UiButton @click="draft.timeline.sort((a,b)=>(rowTime(a)??Infinity)-(rowTime(b)??Infinity))">按时间排序</UiButton><UiButton @click="openTimelineJson">编辑 JSON</UiButton><UiButton @click="openMultiplierPreview">倍率预览</UiButton></div>
         <team-action-timeline v-if="windowsTimeline" :axis="draft" :characters="draftCharacters" :disabled="saving" @update:timeline="draft.timeline=$event"/>
         <div v-else class="team-table-scroll action-timeline">
          <table class="team-data-table" aria-label="动作时间轴">
           <colgroup><col style="width:125px"/><col style="width:115px"/><col style="width:110px"/><col/><col style="width:145px"/></colgroup>
           <thead><tr><th>时间（秒）</th><th>角色</th><th>类型</th><th>技能</th><th>顺序</th></tr></thead>
           <tbody>
            <tr v-for="(row, index) in tableRows" :key="row.id">
             <td><TeamNumberInput :model-value="rowTime(row)/1000" :min="0" :step="0.1" :controls="false" aria-label="时间（秒）" @update:model-value="setRowTime(row,$event)"/></td>
             <td><UiSelect :model-value="row.actor" label="角色" :options="draftMemberOptions" :disabled="saving" @update:model-value="row.actor=$event;changeActor(row)"/></td>
             <td><UiSelect :model-value="row.kind" label="类型" :options="timelineKindOptions" :disabled="saving" @update:model-value="row.kind=$event;changeKind(row)"/></td>
             <td>
              <UiSelect v-if="row.kind==='action'" :model-value="row.action" label="技能" :options="actionsFor(row).map(a=>({value:a.id,label:a.label}))" :disabled="saving" @update:model-value="row.action=$event;changeAction(row)"/>
              <div v-for="field in parametersFor(row)" :key="field.key" class="action-effect">
               <span>{{ field.label }}</span>
               <TeamNumberInput :model-value="row.params?.[field.key]===undefined?undefined:row.params[field.key]/(field.scale||1)" :min="field.min/(field.scale||1)" :max="field.max/(field.scale||1)" :step="field.step" :controls="false" :placeholder="field.placeholder" :aria-label="field.label" @update:model-value="setActionParameter(row,field,$event)"/>
               <small v-if="field.help">{{ field.help }}</small>
              </div>
             </td>
             <td><UiButton size="small" :disabled="index===0" aria-label="上移" @click="moveAction(index,-1)">↑</UiButton><UiButton size="small" :disabled="index===tableRows.length-1" aria-label="下移" @click="moveAction(index,1)">↓</UiButton><UiButton size="small" variant="danger" @click="draft.timeline.splice(draft.timeline.indexOf(row),1)">删除</UiButton></td>
            </tr>
            <tr v-if="!tableRows.length"><td class="team-data-empty" colspan="5">暂无数据</td></tr>
           </tbody>
          </table>
         </div>
        </template>
        <template v-else><div class="timeline-toolbar"><UiButton @click="convertLegacyDraft">转为动作轴</UiButton></div><textarea v-model="timelineText" class="team-textarea" :rows="19" aria-label="动作时间轴 JSON"></textarea></template>
       </TabsContent>
       <TabsContent v-if="!actionDraft" value="coverage"><textarea v-model="coverageText" class="team-textarea" :rows="19" aria-label="BUFF覆盖 JSON"></textarea></TabsContent>
       <TabsContent v-if="!actionDraft" value="actions">
        <div class="team-table-scroll">
         <table class="team-data-table" aria-label="动作支持">
          <colgroup><col style="width:110px"/><col/><col/></colgroup>
          <thead><tr><th>角色</th><th>当前动作模板</th><th>后续动作</th></tr></thead>
          <tbody><tr v-for="row in actionSupport" :key="row.role"><td>{{ row.role }}</td><td>{{ row.supported }}</td><td>{{ row.pending }}</td></tr></tbody>
         </table>
        </div>
       </TabsContent>
      </TabsRoot>
     </fieldset>
     <div class="editor-actions"><UiButton variant="primary" :disabled="saving" @click="saveDraft(false)">保存</UiButton><UiButton :disabled="saving||actionDraft&&draftDurationMs===0" @click="saveDraft(true)">用于计算</UiButton><UiButton :disabled="saving" @click="exportDraft">导出</UiButton><UiButton :disabled="saving" :class="{'share-pending':share.entryStatus(currentEntry || {})==='待更新'}" @click="share.show()">{{ share.entryStatus(currentEntry || {}) || '分享' }}</UiButton><UiButton variant="danger" class="delete-axis" :disabled="saving" @click="confirmRemoveDraft">删除</UiButton></div>
    </section>
    <div v-else class="empty"><UiButton variant="primary" @click="createDraft">新建动作轴</UiButton><UiButton @click="fileInput?.click()">导入计算配置</UiButton></div>
   </div>
  </template>
  <template v-else>
   <div v-if="library.entries.length" class="choose-config" data-tour="team.config-select"><UiSelect :model-value="library.selectedId===null?undefined:String(library.selectedId)" label="选择计算配置" placeholder="选择计算配置" :options="library.entries.map(entry=>({value:String(entry.key),label:entry.axis.title}))" :disabled="saving" @update:model-value="choose(Number($event))"/><UiButton :disabled="saving" @click="fileInput?.click()">导入计算配置</UiButton></div>
   <team-dps-page v-if="selected" data-tour="team.workspace" :key="selected.key+'-'+generation" :configuration="selected.axis" :task-key="selected.key" :tasks="tasks[selected.key]||{}" :axis-file-name="selected.sourceFileName||selected.axis.id+'.mona-axis.json'" :history-detail="historyDetail||undefined" @save-task="saveTask"/>
   <div v-else class="empty" data-tour="team.workspace"><UiButton variant="primary" class="large-button" :disabled="saving" @click="createDraft">新建动作轴</UiButton><UiButton class="large-button" :disabled="saving" @click="fileInput?.click()">导入计算配置</UiButton></div>
  </template>
  <share-axis-dialog v-if="draft && share.open.value" :share="share" :axis="sharePreviewDraft" />
  <team-multiplier-preview v-if="multiplierPreview" :axis="multiplierPreview.axis" :characters="multiplierPreview.characters" @close="multiplierPreview=null"/>
  <ArtifactPromptDialog ref="deletePrompt" />
  <TeamDialog v-model="jsonDialog" title="动作时间轴 JSON" width="min(850px,94vw)">
   <div class="team-dialog-content">
    <p v-if="error" class="team-inline-error" role="alert">{{ error }}</p>
    <textarea v-model="timelineText" class="team-textarea" :rows="20" aria-label="动作时间轴 JSON"></textarea>
   </div>
   <template #footer><div class="team-dialog-actions"><UiButton @click="jsonDialog=false">取消</UiButton><UiButton variant="primary" @click="applyTimelineJson">应用</UiButton></div></template>
  </TeamDialog>
  <TeamDialog v-model="selectingMembers" title="选择队伍角色" width="min(720px,94vw)">
   <UiSearchInput v-model="characterSearch" placeholder="搜索角色"/>
   <div class="member-picker"><button v-for="name in selectableCharacters" :key="name" :class="{selected:newMembers.includes(name)}" :disabled="newMembers.length===4&&!newMembers.includes(name)" :aria-pressed="newMembers.includes(name)" @click="toggleMember(name)"><img :src="characterData[name].avatar" alt=""/><strong>{{ locale[characterData[name].nameLocale] }}</strong><span v-if="newMembers.includes(name)">{{ newMembers.indexOf(name)+1 }}</span></button></div>
   <template #footer><div class="team-dialog-actions"><span class="member-count">{{ newMembers.length }}/4</span><UiButton @click="selectingMembers=false">取消</UiButton><UiButton variant="primary" :disabled="newMembers.length!==4" @click="confirmMembers">创建动作轴</UiButton></div></template>
  </TeamDialog>
 </div>
</template>
<script setup lang="ts">
import PageGuideButton from "@/onboarding/PageGuideButton.vue"
import './team-dps-theme.css'
import './team-dps-night.css'
import {ref,shallowRef,computed,watch,onBeforeUnmount,onActivated} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {calculationHistory,showCalculationNotice} from '@/store/calculation-history'
import {TabsRoot,TabsList,TabsContent,TabsTrigger} from 'radix-vue'
import UiButton from '@/components/ui/UiButton.vue'
import TeamDialog from './TeamDialog.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSearchInput from '@/components/ui/UiSearchInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import ArtifactPromptDialog from '@/pages/ArtifactsPage/ArtifactPromptDialog.vue'
import TeamNumberInput from './TeamNumberInput.vue'
import './team-ui.css'
import 'element-plus/es/components/message/style/css'
import ShareAxisDialog from './ShareAxisDialog.vue'
import {useAxisSharing,shareLoginReturn} from './axis-sharing.mjs'
import TeamDpsPage from './TeamDpsPage.vue'
import TeamMultiplierPreview from './TeamMultiplierPreview.vue'
import TeamActionTimeline from './TeamActionTimeline.vue'
import SimpleLoading from '@/components/loading/SimpleLoading.vue'
import {useAccountStore} from '@/store/pinia/account'
import {useMiyousheStore} from '@/store/pinia/miyoushe'
import backend from '@/store/backend'
import {downloadString} from '@/utils/common'
import {characterData} from '@/assets/character'
import locale from '@/i18n/generated/zh-cn.json'
import {saveTeamDpsTasks,loadTeamDpsLibrary,saveTeamDpsLibrary,emptyTeamDpsLibrary,importTeamDpsConfiguration,updateTeamDpsConfiguration,deleteTeamDpsConfiguration,exportTeamDpsConfiguration} from '../../../beta-data/team-dps-library.mjs'
import {TEAM_ACTION_CATALOG,createActionAxis,actionAxisDurationMs} from '../../../beta-data/team-engine/action-config.mjs'
import {usesPrimaryTime} from '../../../beta-data/team-engine/action-timing.mjs'
import {defaultTeamCharacter} from '../../../beta-data/team-dps-character-rules.mjs'
import {validateTeamDpsConfiguration} from '../../../beta-data/team-dps-config.mjs'
import {legacyActionAxis} from '../../../beta-data/team-engine/legacy-conversion.mjs'
const account=useAccountStore(),mys=useMiyousheStore(),library=ref<any>(emptyTeamDpsLibrary()),managing=ref(false),loading=ref(true),saving=ref(false),error=ref(''),generation=ref(0)
const fileInput=ref<HTMLInputElement|null>(null),editingKey=ref<number|null>(null),draft=ref<any>(null),timelineText=ref(''),coverageText=ref(''),editorTab=ref('timeline')
const tasks=shallowRef<Record<string,any>>({})
const router=useRouter(),route=useRoute(),historyDetail=shallowRef<any>(null),historyId=ref(0)
const jsonDialog=ref(false),actionDraft=computed(()=>draft.value?.format==='mona-action-axis')
const multiplierPreview=ref<any>(null)
const deletePrompt=ref<InstanceType<typeof ArtifactPromptDialog>|null>(null)
const draftMemberOptions=computed(()=>draft.value.members.map((member:any)=>({value:member.slot,label:locale[characterData[member.character].nameLocale]})))
const endHitOptions=[{value:'include',label:'计入'},{value:'exclude',label:'排除'}]
const timelineKindOptions=[{value:'action',label:'动作'},{value:'switch',label:'切换至'}]
const windowsTimeline=/Windows NT/.test(navigator.userAgent)
const draftCharacters=computed(()=>editingKey.value===null?undefined:tasks.value[editingKey.value]?.[mys.selectedUid.value||'']?.fields.members.map((m:any)=>m.character))
const draftProfiles=computed(()=>draft.value?.members.map((m:any,r:number)=>({character:draftCharacters.value?.[r]??defaultTeamCharacter(m.character)})))
const currentEntry=computed(()=>library.value.entries.find((item:any)=>item.key===editingKey.value))
const sharePreviewDraft=computed(()=>{
 try{const axis=currentDraft();return Array.isArray(axis.timeline)?axis:draft.value}catch{return draft.value}
})
const share=useAxisSharing({entry:currentEntry,currentDraft,persist,localAccount:()=>account.currentAccountId.value,
 save:()=>saveDraft(false,true,true),login:async()=>{
    shareLoginReturn.draft={accountId:account.currentAccountId.value,key:editingKey.value,axis:JSON.parse(JSON.stringify(draft.value)),
        timeline:timelineText.value,coverage:coverageText.value,savedDraft}
    await router.push({name:'login'})
 }})
async function resumeShare(){
 if(loading.value||route.path!=='/team-optimization'||route.query.history)return
 const pending=shareLoginReturn.draft
 if(!pending||pending.accountId!==account.currentAccountId.value)return
 shareLoginReturn.draft=null
 const same=library.value.entries.find((e:any)=>e.key===pending.key&&e.axis.id===pending.axis.id)
 editingKey.value=same?.key??null
 draft.value=pending.axis
 timelineText.value=pending.timeline
 coverageText.value=pending.coverage
 savedDraft=pending.savedDraft
 managing.value=true
 await share.show({returning:true})
}
watch(()=>[loading.value,route.fullPath],resumeShare)
const primaryTime=(row:any)=>usesPrimaryTime(draft.value,row,draftProfiles.value)
const rowTime=(row:any)=>primaryTime(row)?row.timeMs:row.when.otherwiseTimeMs
const tableRows=computed(()=>draft.value?.timeline.filter((row:any)=>rowTime(row)!==undefined)??[])
function setRowTime(row:any,seconds:number){if(primaryTime(row))row.timeMs=Math.round(seconds*1000);else row.when.otherwiseTimeMs=Math.round(seconds*1000)}
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
function moveAction(index:number,offset:number){const rows=draft.value.timeline,a=rows.indexOf(tableRows.value[index]),b=rows.indexOf(tableRows.value[index+offset]);[rows[a],rows[b]]=[rows[b],rows[a]]}
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
 if(key<0||account.applyingCloud.value)return;
 if(accountId!==account.currentAccountId.value)return;
 tasks.value={...tasks.value,[key]:{...tasks.value[key],[uid]:state}};
 const storageKey=tasksKey(accountId),snapshot=tasks.value;
 taskWrites=saveTeamDpsTasks(backend,accountId,snapshot).catch(fail);
}
const selected=computed(()=>historyDetail.value?{key:-historyId.value,axis:historyDetail.value.input.team_dps.axis,sourceFileName:historyDetail.value.view.axisFileName}:library.value.entries.find((entry:any)=>entry.key===library.value.selectedId))
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
 try{const text=await file.text();if(task!==sequence)return;const entry=importTeamDpsConfiguration(library.value,text);entry.sourceFileName=file.name;historyDetail.value=null;generation.value++;edit(entry);await persist();if(task===sequence)showCalculationNotice('success', '计算配置已导入')}
 catch(e){if(task===sequence)fail(e);else console.error(e)}finally{if(task===sequence)saving.value=false}
}
async function choose(key:number){historyDetail.value=null;library.value.selectedId=key;generation.value++;saving.value=true;const task=sequence;try{await persist()}catch(e){if(task===sequence)fail(e);else console.error(e)}finally{if(task===sequence)saving.value=false}}
async function saveDraft(use:boolean,automatic=false,forShare=false){
 const task=sequence
 saving.value=true
 error.value=''
 try {
    const axis=JSON.parse(JSON.stringify(currentDraft()))
    if(editingKey.value===null){
        const selectedId=library.value.selectedId
        editingKey.value=importTeamDpsConfiguration(library.value,exportTeamDpsConfiguration(axis)).key
        if(!use)library.value.selectedId=selectedId
    }else updateTeamDpsConfiguration(library.value,editingKey.value,axis)
    if(use)library.value.selectedId=editingKey.value
    generation.value++
    await persist()
    if(task===sequence){
        edit(currentEntry.value)
        if(use)managing.value=false
        if(!automatic)showCalculationNotice('success', share.entryStatus(currentEntry.value)==='待更新'?'已保存到本地，点「分享」可发布更新。':'保存成功')
    }
 }catch(e){
    if(task===sequence)fail(e);else console.error(e)
    if(forShare)throw e
 }finally{if(task===sequence)saving.value=false}
}
async function autoSaveDraft(){if(share.open.value||account.applyingCloud.value||!managing.value||!draft.value||loading.value||saving.value||jsonDialog.value||selectingMembers.value)return;try{if(JSON.stringify(currentDraft())!==savedDraft)await saveDraft(false,true)}catch(e){fail(e)}}
const autosaveTimer=setInterval(autoSaveDraft,15000)
async function exportDraft(){try{const axis=currentDraft();await downloadString(exportTeamDpsConfiguration(axis),'application/json',axis.id+'.mona-axis.json')}catch(e){fail(e)}}
async function confirmRemoveDraft(){
 const item=currentEntry.value
 if(Object.values(item?.shares||{}).some((link:any)=>link.record?.status==='active')){
    try {
        await deletePrompt.value!.confirm('删除本地轴后，原链接继续有效。你可以在「我的分享」中取消分享。','删除本地四人轴',{confirmButtonText:'删除',cancelButtonText:'返回',closeOnClickModal:false})
    }catch(reason){if(reason==='cancel'||reason==='close')return;throw reason}
    if(item!==currentEntry.value)return
 }
 await removeDraft()
}
async function removeDraft(){if(editingKey.value===null){draft.value=null;return}const task=sequence;saving.value=true;const snapshot={...tasks.value};delete snapshot[editingKey.value];tasks.value=snapshot;const storageKey=tasksKey(account.currentAccountId.value);taskWrites=saveTeamDpsTasks(backend,account.currentAccountId.value,snapshot).catch(fail);deleteTeamDpsConfiguration(library.value,editingKey.value);draft.value=null;editingKey.value=null;generation.value++;try{await persist()}catch(e){if(task===sequence)fail(e);else console.error(e)}finally{if(task===sequence)saving.value=false}}
watch(()=>[account.currentAccountId.value,account.reloadGeneration.value],async ([id])=>{
 share.close();const task=++sequence;loading.value=true;saving.value=false;library.value=emptyTeamDpsLibrary();tasks.value={};draft.value=null;editingKey.value=null;selectingMembers.value=false;multiplierPreview.value=null;savedDraft='';error.value='';generation.value++;
 try{await taskWrites;const [saved,personal]=await Promise.all([loadTeamDpsLibrary(backend,id),backend.getItem(tasksKey(id))]);if(task===sequence){library.value=saved??emptyTeamDpsLibrary();tasks.value=personal??{}}}
 catch(e){if(task===sequence)fail(e);else console.error(e)}finally{if(task===sequence)loading.value=false}
},{immediate:true})
onBeforeUnmount(()=>{sequence++;clearInterval(autosaveTimer)})
async function openHistory(){
 const id=String(route.query.history||''),accountId=account.currentAccountId.value;
 if(route.path!=='/team-optimization')return;
 if(!id){historyDetail.value=null;return;}
 try{const detail=await calculationHistory.read(accountId,Number(id));if(accountId===account.currentAccountId.value&&route.path==='/team-optimization'&&String(route.query.history)===id&&detail){historyId.value=Number(id);historyDetail.value=detail;managing.value=false;generation.value++}}catch(e){fail(e)}
}
watch(()=>route.query.history,openHistory)
watch(()=>account.currentAccountId.value,()=>{historyDetail.value=null;openHistory()})
onActivated(openHistory)
</script>
<style scoped>
.share-list-status{display:block;color:var(--cx-gold);font-size:12px}.share-pending{color:var(--cx-gold);border-color:var(--cx-gold-edge)}.editor-actions .delete-axis{margin-left:auto}@media(max-width:800px){.editor-actions .delete-axis{margin-left:0}}

.toolbar-title{display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px}.technical-credit{font-size:14px;color:var(--cx-dim);white-space:nowrap}.technical-credit a{color:var(--cx-gold);text-decoration:none}.technical-credit a:hover{text-decoration:underline}
.action-effect{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;margin-top:8px;color:var(--cx-dim);font-size:13px}.action-effect :deep(.team-number){width:88px;flex:0 0 88px}.action-effect small{flex-basis:100%;line-height:1.5;font-size:12px}.action-effect>span{white-space:nowrap}.action-timeline td{vertical-align:top}
.duration-value{display:flex;align-items:center;min-height:40px;padding:0 14px;border:1px solid var(--cx-step-2);border-radius:8px;background:var(--cx-step);color:var(--cx-gold);font-size:18px;font-weight:600;min-width:100px}.member-picker{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.member-picker button{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 8px;border:1px solid var(--cx-step-2);border-radius:12px;background:var(--cx-card);color:var(--cx-dim);cursor:pointer;font:inherit}.member-picker button img{width:64px;height:64px;object-fit:cover;border-radius:50%}.member-picker button.selected{background:var(--cx-step);border-color:var(--cx-gold);color:var(--cx-gold)}.member-picker button span{position:absolute;top:5px;right:8px;color:var(--cx-gold-on);background:var(--cx-gold);border-radius:50%;width:24px;line-height:24px}.member-picker button:disabled{opacity:.45;cursor:default}.member-count{margin-right:20px;color:var(--cx-dim)}@media(max-width:550px){.member-picker{grid-template-columns:repeat(2,minmax(0,1fr))}}
.timeline-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}.timeline-toolbar .ui-button{margin:0}.timeline-toolbar span{margin-left:auto;color:var(--cx-dim);font-size:14px}.action-timeline :deep(.team-number),.action-timeline :deep(.select-trigger){width:100%}.action-timeline td{padding:8px}.action-timeline .ui-button{padding:6px 8px;margin-left:4px}.action-timeline{max-height:min(55vh,560px)}.action-timeline table{min-width:765px;table-layout:fixed}
.team-configurations{padding:18px}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--cx-step-2)}.toolbar h2{display:flex;align-items:center;gap:12px;margin:0;font-size:25px;font-weight:650;letter-spacing:.02em}.toolbar h2 svg{color:var(--cx-gold);width:24px;height:24px}.empty{display:flex;align-items:center;justify-content:center;min-height:45vh;border:1px dashed var(--cx-step-2);border-radius:16px;background:var(--cx-card)}.choose-config{display:flex;gap:12px;margin:0 0 14px;align-items:center}.choose-config :deep(.select-trigger){width:420px;max-width:65vw}.manager{display:grid;grid-template-columns:230px minmax(0,1fr);gap:14px}.manager aside{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--cx-step-2);border-radius:14px;background:var(--cx-card)}.manager aside .ui-button{margin:0;height:auto;white-space:normal;text-align:left;justify-content:flex-start;padding:12px;line-height:1.5}.editor{padding:18px;border:1px solid var(--cx-step-2);border-radius:14px;background:var(--cx-card);min-width:0}.config-fields{display:flex;gap:12px;flex-wrap:wrap}.config-fields .team-form-item:first-child{flex:1;min-width:220px}.editor-actions{display:flex;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--cx-step-2);flex-wrap:wrap}.editor :deep(textarea){font-family:Consolas,monospace;line-height:1.55;padding:12px;font-size:15px;color:var(--cx-dim)}@media(max-width:800px){.team-configurations{padding:12px}.manager{grid-template-columns:1fr}.toolbar{flex-wrap:wrap}.toolbar h2{font-size:22px}.manager aside{flex-direction:row;overflow:auto}.manager aside .ui-button{flex-shrink:0}.editor{padding:14px}.choose-config{flex-wrap:wrap}.choose-config :deep(.select-trigger){max-width:100%;width:100%}}

.toolbar-actions,.empty{display:flex;gap:12px}.large-button{min-height:40px;padding-inline:19px}.config-fields .team-form-item{margin-bottom:18px}
</style>

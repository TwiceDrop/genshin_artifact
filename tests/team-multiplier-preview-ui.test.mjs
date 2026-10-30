import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {ref,computed,watch,nextTick,effectScope} from 'vue';
import * as libraryApi from '../beta-data/team-dps-library.mjs';import * as actionApi from '../beta-data/team-engine/action-config.mjs';import {validateTeamDpsConfiguration} from '../beta-data/team-dps-config.mjs';
const script=file=>fs.readFileSync(file,'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'');
const run=(code,env)=>{vm.createContext(env);vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.None}}).outputText,env);};
test('preview UI snapshots unsaved axis and current UID characters without writing a task',async()=>{
 const account={currentAccountId:ref(1)},uid=ref('synthetic-a'),scope=effectScope(),data=new Map(),logs=[];let writes=0;
 const env={...libraryApi,...actionApi,validateTeamDpsConfiguration,ref,computed,watch,onBeforeUnmount:()=>{},useAccountStore:()=>account,useMiyousheStore:()=>({selectedUid:uid}),backend:{getItem:async k=>data.get(k),setItem:async()=>writes++},setInterval:()=>1,clearInterval:()=>{},console:{error:e=>logs.push(e.message)},characterData:{},locale:{}};
 scope.run(()=>run(script('src/pages/TeamOptimizationPage/TeamOptimizationWrapper.vue')+'\nglobalThis.ui={draft,editingKey,tasks,openMultiplierPreview,multiplierPreview};',env));await nextTick();await new Promise(r=>setImmediate(r));
 const u=env.ui,axis=actionApi.createActionAxis('draft',['Skirk','Furina','Escoffier','Vodyanitsa']);axis.timeline=[{id:'q',kind:'action',actor:'member1',action:'burst',timeMs:0}];u.draft.value=axis;u.editingKey.value=8;
 const members=axis.members.map(m=>({character:{name:m.character,constellation:6,skill1:12,skill2:9,skill3:9,level:90,ascend:false}}));u.tasks.value={8:{'synthetic-a':{fields:{members}},'synthetic-b':{fields:{members:members.map(m=>({character:{...m.character,constellation:0}}))}}}};
 u.openMultiplierPreview();assert.equal(u.multiplierPreview.value.characters[0].constellation,6);u.draft.value.timeline[0].timeMs=4000;assert.equal(u.multiplierPreview.value.axis.timeline[0].timeMs,0);assert.equal(writes,0);
 uid.value='synthetic-b';u.openMultiplierPreview();assert.equal(u.multiplierPreview.value.characters[0].constellation,0);assert.equal(u.multiplierPreview.value.axis.timeline[0].timeMs,4000);
 account.currentAccountId.value=2;await nextTick();assert.equal(u.multiplierPreview.value,null);assert.equal(writes,0);assert.deepEqual(logs,[]);scope.stop();
});
test('preview component terminates its worker and reports real failures',()=>{
 let mount,unmount,worker;const errors=[],sent=[];class FakeWorker{constructor(){worker=this;this.terminated=0;}postMessage(x){sent.push(x);}terminate(){this.terminated++;}}
 const env={ref,onMounted:f=>mount=f,onBeforeUnmount:f=>unmount=f,defineProps:()=>({axis:{id:'synthetic'},characters:[]}),defineEmits:()=>{},Worker:FakeWorker,URL,console:{error:e=>errors.push(e)}};
 const code=script('src/pages/TeamOptimizationPage/TeamMultiplierPreview.vue').replace('import.meta.url',"'file:///synthetic/preview.vue'")+'\nglobalThis.ui={preview,error};';run(code,env);mount();worker.onmessage({data:{type:'ready'}});assert.equal(sent[0].axis.id,'synthetic');worker.onmessage({data:{type:'error',message:'native preview failed',stack:'synthetic native stack'}});assert.equal(env.ui.error.value,'native preview failed');assert.equal(worker.terminated,1);assert.deepEqual(errors,['synthetic native stack']);unmount();
 mount();worker.onmessage({data:{type:'result',result:{duration:3}}});assert.equal(env.ui.preview.value.duration,3);assert.equal(worker.terminated,1);mount();unmount();assert.equal(worker.terminated,1);
});

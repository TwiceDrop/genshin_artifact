import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {ref,shallowRef,computed,watch,nextTick,effectScope} from 'vue';
import {chars,weapons,sets,fixture} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-config.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
import {actionInput} from './helpers/team-action-configuration.mjs';
import {actionAxisDurationMs,TEAM_ACTION_RULES_VERSION} from '../beta-data/team-engine/action-config.mjs';
import {AUTO_WEAPON_FIELDS,AUTO_ARTIFACT_SETS} from '../beta-data/equipment-axis-rules.mjs';
import * as equipment from '../beta-data/team-dps-equipment-support.mjs';
import * as options from '../beta-data/team-dps-weapon-options.mjs';
import {changeTeamConstellation} from '../beta-data/team-dps-character-rules.mjs';

test('personal task survives remount and UID changes, preserves snapshots and rebases changed axes',async()=>{
 const profiles=TEAM_DPS_ROLES.map(fixture),records={};
 for(const uid of ['a','b'])for(let r=0;r<4;r++)records[uid+r]={name:uid+r,item:{...structuredClone(profiles[r]),artifactIds:profiles[r].artifacts.map(a=>a.id),artifactConfig:{},constraint:{setNames:[]},filter:{}}};
 const presets={presets:ref(records)};presets.allFlat=computed(()=>Object.values(presets.presets.value));
 const inventory={artifacts:ref(new Map(profiles[0].artifacts.map(a=>[a.id,a])))},mys={selectedUid:ref('a'),data:ref({entries:Object.keys(records).map(name=>({uid:name[0],presetName:name}))})};
 const account={currentAccountId:ref(1)},tasks={},saved=JSON.stringify(records);
 let script=fs.readFileSync(new URL('../src/pages/TeamOptimizationPage/TeamDpsPage.vue',import.meta.url),'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'');
 script+='\nglobalThis.ui={members,names,initialHp,budget,count,selectedIndex,output,resultContext,weaponConditions,sortMetric,saveTask,changeTeamConstellation};';
 function mount(axis=importedAxis()){
  const close=[],scope=effectScope(),env={...equipment,...options,changeTeamConstellation,AUTO_WEAPON_FIELDS,AUTO_ARTIFACT_SETS,actionAxisDurationMs,TEAM_ACTION_RULES_VERSION,ref,shallowRef,computed,watch,nextTick,
   defineProps:()=>({configuration:axis,taskKey:7,tasks}),defineEmits:()=>((_,e)=>{assert.equal(e.key,7);assert.equal(e.accountId,1);tasks[e.uid]=structuredClone(e.state);}),
   onBeforeUnmount:f=>close.push(f),onDeactivated:()=>{},usePresetStore:()=>presets,useArtifactStore:()=>inventory,useMiyousheStore:()=>mys,useAccountStore:()=>account,useEnemy:()=>({enemyConfig:ref({level:90})}),
   characterData:chars,weaponData:weapons,artifactsData:sets,locale:[],weaponByType:{Sword:[],Polearm:[],Catalyst:[]},upgradeArtifactConfig:x=>x,convertArtifactName:x=>x,
   ElMessage:{success(){},info(){}},AbortController,performance,setInterval,clearInterval,console};
  vm.createContext(env);scope.run(()=>vm.runInContext(ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.None}}).outputText,env));
  return {u:env.ui,close:()=>{close.forEach(f=>f());scope.stop();}};
 }
 let page=mount();await nextTick();const u=page.u;
 u.changeTeamConstellation(u.members.value[0].character,3);u.members.value[0].constraint.minRecharge=1.8;u.initialHp.value[0]=64;u.budget.value=4321;u.count.value=7;
 u.output.value={results:[{expectation:111,hits:[{time:1}]}]};u.resultContext.value={input:{single_interfaces:structuredClone(profiles)},artifacts:[],items:new Map([[12,{id:12,level:20}]])};
 await nextTick();page.close();assert.equal(tasks.a.fields.members[0].character.skill3,12);
 page=mount();await nextTick();assert.equal(page.u.members.value[0].character.skill3,12);assert.equal(page.u.members.value[0].constraint.minRecharge,1.8);assert.equal(page.u.initialHp.value[0],64);
 assert.equal(page.u.budget.value,4321);assert.equal(page.u.output.value.results[0].expectation,111);assert.equal(page.u.resultContext.value.items.get(12).level,20);
 // Late preset loading leaves the saved personal inputs intact.
 presets.presets.value={...presets.presets.value};await nextTick();assert.equal(page.u.members.value[0].character.skill3,12);
 mys.selectedUid.value='b';await nextTick();assert.equal(page.u.output.value,null);assert.equal(page.u.budget.value,2000);page.u.budget.value=999;await nextTick();
 mys.selectedUid.value='a';await nextTick();assert.equal(page.u.budget.value,4321);assert.equal(page.u.output.value.results[0].expectation,111);page.close();
 const axis=importedAxis();axis.durationMs+=500;page=mount(axis);await nextTick();assert.equal(page.u.budget.value,4321);assert.equal(page.u.output.value,null);assert.equal(page.u.resultContext.value,null);page.close();
 const action=actionInput().team_dps.axis;page=mount(action);await nextTick();page.u.output.value={results:[{expectation:222}]};page.u.resultContext.value={input:{single_interfaces:structuredClone(profiles)},artifacts:[],items:new Map()};await nextTick();page.close();assert.equal(tasks.a.engineRulesVersion,TEAM_ACTION_RULES_VERSION);
 page=mount(action);await nextTick();assert.equal(page.u.output.value.results[0].expectation,222);page.close();
 tasks.a.engineRulesVersion='mona-team-engine/1';page=mount(action);await nextTick();assert.equal(page.u.budget.value,4321);assert.equal(page.u.output.value,null);assert.equal(page.u.resultContext.value,null);page.close();
 assert.equal(JSON.stringify(records),saved);
 fs.mkdirSync('.build-target/team-action-eight-fixes-20261028',{recursive:true});fs.writeFileSync('.build-target/team-action-eight-fixes-20261028/V2-personal-task.json',JSON.stringify({remount:true,uidIsolation:true,latePresetLoad:true,axisChangePreservesSettings:true,axisChangeClearsResults:true,rulesChangeClearsResults:true,presetsUnchanged:true}));
});

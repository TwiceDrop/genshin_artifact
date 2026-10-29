import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {ref,shallowRef,computed,watch,nextTick,effectScope} from 'vue';
import {chars,weapons,sets,fixture} from '../beta-tools/interface-audit-7108.mjs';
import {TEAM_DPS_ROLES} from '../beta-data/team-dps-axis.mjs';
import {importedAxis} from './helpers/team-dps-configuration.mjs';
import {AUTO_WEAPON_FIELDS,AUTO_ARTIFACT_SETS} from '../beta-data/equipment-axis-rules.mjs';
import {teamDpsWeaponAvailable,teamDpsArtifactAvailable,INCOMPLETE_ARTIFACT_SETS} from '../beta-data/team-dps-equipment-support.mjs';
import {MANUAL_WEAPON_OPTIONS,defaultWeaponOptions,WIDSITH_THEMES} from '../beta-data/team-dps-weapon-options.mjs';
import {api} from '../beta-tools/runtime-7106.mjs';
import {optimizeTeamDps} from '../beta-data/team-dps-optimizer.mjs';
import {runTeamDpsWorkers} from '../src/wasm/team-dps-task.mjs';
import {changeTeamConstellation} from '../beta-data/team-dps-character-rules.mjs';
import {teamDpsObjectiveValue} from '../beta-data/team-dps-numeric-rules.mjs';
import {TEAM_DPS_RESULT_VERSION,canRestoreTeamDpsResult,createTeamDpsResultPacker,unpackTeamDpsResult,teamDamageAnalysis,teamProbabilityText} from '../beta-data/team-dps-result-view.mjs';
import {normalizeEnemy} from '../beta-data/enemy-interface.mjs';
import {actionAxisDurationMs,TEAM_ACTION_RULES_VERSION} from '../beta-data/team-engine/action-config.mjs';
import {characterPackages} from '../beta-data/team-engine/character-packages.mjs';
import {FakeTeamWorker as Worker} from './helpers/team-dps-fake-worker.mjs';
const sourceText=relative=>fs.readFileSync(new URL(import.meta.resolve(relative)),'utf8');

test('repair 4: real page state, UID refresh, result snapshots, cancellation and late responses',async()=>{
 const source=sourceText('../src/pages/TeamOptimizationPage/TeamDpsPage.vue');
 let script=source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'');
 script+='\nglobalThis.ui={names,members,editingRole,editingMember,panelProfile,searchAlgorithm,initialHp,selectedHealth,healthBranch,weaponConfigs,availableWeapons,availableSets,availableArtifactSet,rolePresets,weaponConditions,widsithMode,enemyIsSlime,enemyCount,damageScope,narzissenkreuzEnabled,hitBranch,showHitBranch,output,selectedIndex,selected,selectedItems,sortedResults,sortMetric,selectResult,run,minLevel,busy,error,resultContext,resultHasFurina,showMemberSettings,settingsRole,settingsTab,openMemberSettings,showHitAnalysis,activeHit,hitAnalysisComponent,openHitAnalysis,number,progress,progressPercent,saveTask,restoreTask,clearResults,budget,abort:()=>controller.abort()};';
 const profiles=TEAM_DPS_ROLES.map(fixture),builds=profiles.map((p,r)=>p.artifacts.map(a=>({...a,id:a.id+100*r}))),records={};
 for(const group of ['first','second'])for(let r=0;r<4;r++){
  const item={...structuredClone(profiles[r]),artifactIds:builds[r].map(a=>a.id),artifactConfig:{},constraint:{setNames:[],minRecharge:1,minCritical:0,minCriticalDamage:0,minElementalMastery:0},filter:{sandMainStats:[],gobletMainStats:[],headMainStats:[]}};
  if(group==='second'&&r===0)item.weapon.name='CoolSteel';records[group+r]={name:group+r,item};
 }
 const presetStore={presets:ref(records)};presetStore.allFlat=computed(()=>Object.values(presetStore.presets.value));
 const artifactStore={artifacts:ref(new Map(builds.flat().map(a=>[a.id,{...a}])))};
 const mys={selectedUid:ref('first'),data:ref({entries:Object.keys(records).map(name=>({uid:name.startsWith('first')?'first':'second',presetName:name}))})};
 const accountStore={currentAccountId:ref(1)},pending=[],unmount=[],scope=effectScope(),taskRecords={},savedTasks=[];
 const env={ref,shallowRef,computed,watch,nextTick,defineEmits:()=>(_event,data)=>savedTasks.push(data),changeTeamConstellation,defineProps:()=>({configuration:importedAxis(),tasks:taskRecords,taskKey:1}),onBeforeUnmount:f=>unmount.push(f),onDeactivated:f=>unmount.push(f),usePresetStore:()=>presetStore,useArtifactStore:()=>artifactStore,useAccountStore:()=>accountStore,useMiyousheStore:()=>mys,useEnemy:()=>({enemyConfig:ref({level:100})}),characterData:chars,weaponData:weapons,artifactsData:sets,locale:[],upgradeArtifactConfig:x=>x,convertArtifact:x=>x,convertPresetToWasmInterface:x=>({character:x.character,weapon:x.weapon}),teamDps:(input,artifacts,options)=>new Promise((resolve,reject)=>{const request={input,artifacts,options,resolve,reject};pending.push(request);options.signal.addEventListener('abort',()=>{if(!request.ignoreAbort)reject(new DOMException('cancel','AbortError'));});}),ElMessage:{success(){},info(){}},AbortController,DOMException,performance,setInterval,clearInterval,console};
 Object.assign(env,{teamDpsObjectiveValue,TEAM_DPS_RESULT_VERSION,canRestoreTeamDpsResult,createTeamDpsResultPacker,unpackTeamDpsResult,teamDamageAnalysis,teamProbabilityText,normalizeEnemy,actionAxisDurationMs,TEAM_ACTION_RULES_VERSION,characterPackages});
 const converterSource=sourceText('../src/utils/converter.ts').replace(/import type \{[\s\S]*?from "@\/types\/artifact"/,'').replace(/^import .*$/mg,'').replace(/^export /mg,'');
 const converterEnv={artifactsData:sets};vm.createContext(converterEnv);vm.runInContext(ts.transpileModule(converterSource+'\nglobalThis.convertName=convertArtifactName;',{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.None}}).outputText,converterEnv);
 Object.assign(env,{AUTO_WEAPON_FIELDS,AUTO_ARTIFACT_SETS,teamDpsWeaponAvailable,teamDpsArtifactAvailable,INCOMPLETE_ARTIFACT_SETS,MANUAL_WEAPON_OPTIONS,defaultWeaponOptions,WIDSITH_THEMES,convertArtifactName:converterEnv.convertName,weaponByType:Object.fromEntries(['Sword','Polearm','Catalyst'].map(type=>[type,Object.values(weapons).filter(w=>w.type===type)]))});
 env.convertPresetToWasmInterface=x=>({character:x.character,weapon:x.weapon,artifact_config:x.artifactConfig});
 vm.createContext(env);scope.run(()=>vm.runInContext(ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.None}}).outputText,env));
 const u=env.ui;
 try{
  await nextTick();assert.equal(u.names.value[0],'first0');assert.equal(u.members.value[0].weapon.name,records.first0.item.weapon.name);
  assert.deepEqual(Array.from(u.initialHp.value),[100,100,100,100]);u.initialHp.value[0]=65;
  assert.ok(source.includes('title="血量变动"'));assert.equal(source.includes('v-model="fanfare"'),false);
  const presetsBeforeSettings=JSON.stringify(presetStore.presets.value);
  for(let r=0;r<4;r++){
   u.editingRole.value=r;assert.equal(u.editingMember.value,u.members.value[r]);
   u.openMemberSettings(r);assert.equal(u.settingsRole.value,r);assert.equal(u.showMemberSettings.value,true);assert.equal(u.settingsTab.value,'constraints');
   u.members.value[r].constraint.minRecharge=1.1+r*.1;u.members.value[r].filter.sandMainStats=['Recharge'];
   u.settingsTab.value='effects';u.members.value[r].artifactConfig={config_brave_heart:{rate:.1+r*.1}};u.showMemberSettings.value=false;
  }
  for(let r=0;r<4;r++){u.openMemberSettings(r);assert.equal(u.members.value[r].constraint.minRecharge,1.1+r*.1);assert.equal(u.members.value[r].artifactConfig.config_brave_heart.rate,.1+r*.1);assert.deepEqual(Array.from(u.members.value[r].filter.sandMainStats),['Recharge']);}
  u.showMemberSettings.value=false;assert.equal(JSON.stringify(presetStore.presets.value),presetsBeforeSettings);
  u.members.value[0].weapon.name='KeyOfKhajNisut';assert.equal(u.weaponConfigs(0).length,0);
  assert.ok(source.includes(':exclude-sets="excludedArtifactConfigs"'));assert.ok(AUTO_ARTIFACT_SETS.includes('ScrollOfTheHeroOfCinderCity'));
  assert.ok(u.availableWeapons('Skirk').some(w=>w.name==='MoonweaverDawn'));assert.equal(u.availableWeapons('Skirk').some(w=>w.name==='FinaleOfTheDeep'),true);
  assert.equal(u.availableSets.some(s=>s.name2==='EchoesOfAnOffering'),true);assert.ok(u.availableSets.some(s=>s.name2==='ScrollOfTheHeroOfCinderCity'));
  assert.ok(source.includes(':value="s.eng"'));for(const set of u.availableSets)assert.equal(converterEnv.convertName(set.eng),set.name2);
  assert.equal(u.availableArtifactSet('berserker'),true);assert.equal(u.availableArtifactSet('ScrollOfTheHeroOfCinderCity'),true);
  assert.ok(AUTO_ARTIFACT_SETS.includes('Berserker'));
  for(const name of ['BraveHeart','BloodstainedChivalry'])assert.equal(AUTO_ARTIFACT_SETS.includes(name),false);
  for(const name of ['EchoesOfAnOffering','ShimenawasReminiscence','UnfinishedReverie'])assert.ok(AUTO_ARTIFACT_SETS.includes(name));
  const configCode=sourceText('../src/pages/NewArtifactPlanPage/ArtifactConfig.vue').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg,'').replace('export default','globalThis.component =');
  const configEnv={artifactsData:sets,Fuse:{},ItemConfig:{},toSnakeCase:s=>s.replace(/([A-Z])/g,'_$1').slice(1).toLowerCase(),getArtifactThumbnail:()=>''};vm.runInNewContext(configCode,configEnv);
  const fields=configEnv.component.computed.data.call({excludeSets:[...AUTO_ARTIFACT_SETS,...Object.keys(INCOMPLETE_ARTIFACT_SETS)],ta:k=>k});
  assert.equal(fields.some(f=>f.name==='Berserker'),false);
  for(const name of ['BraveHeart','BloodstainedChivalry'])assert.ok(fields.find(f=>f.name===name).config4.some(c=>c.name==='rate'));
  mys.selectedUid.value='second';await nextTick();assert.equal(u.names.value[0],'second0');assert.equal(u.members.value[0].weapon.name,'CoolSteel');
  assert.deepEqual(Array.from(u.initialHp.value),[100,100,100,100]);u.initialHp.value[0]=65;
  presetStore.presets.value.second0={...records.second0,item:{...structuredClone(records.second0.item),weapon:{...records.second0.item.weapon,name:'DullBlade'}}};
  await nextTick();assert.equal(u.members.value[0].weapon.name,'DullBlade');
  const saved=JSON.stringify(presetStore.presets.value);
  const artifacts=builds.map(b=>Object.fromEntries(b.map(a=>[a.slot.toLowerCase(),a.id]))),other=structuredClone(artifacts);
  [other[0].flower,other[1].flower]=[other[1].flower,other[0].flower];
  const makeResult=marker=>({results:[{artifacts,profiles:structuredClone(profiles),enemy:{level:100,cryo_res:.1},hits:[{time:0,role:0,analysis:{normal:{expectation:10}}}],health:[{time:0,fanfare:11,marker}],expectation:10,critical:30,non_critical:2,marker:marker+'0'},{artifacts:other,expectation:20,critical:25,non_critical:4,marker:marker+'1'}]});
  assert.equal('HarbingerOfDawn' in u.weaponConditions.value[0],false);assert.equal('StaffOfHoma' in u.weaponConditions.value[2],false);
  u.weaponConditions.value[0].ToukabouShigure.rate=.37;u.widsithMode.value[3]='t2_rate';u.enemyIsSlime.value=true;u.enemyCount.value=3;u.damageScope.value='all';u.narzissenkreuzEnabled.value=false;
  u.weaponConditions.value[0].AmosBow.stack=3;u.weaponConditions.value[0].Slingshot.close_rate=.4;u.weaponConditions.value[0].UltimateOverlordsMegaMagicSword.rate=.6;
  u.members.value[0].artifactConfig={config_berserker:{rate:.37},config_brave_heart:{rate:.42},config_bloodstained_chivalry:{rate:.61}};
  assert.equal(u.searchAlgorithm.value,'auto');u.searchAlgorithm.value='branch_bound';
  const job=u.run('optimize'),req=pending.shift();assert.equal(req.input.team_dps.axis.id,importedAxis().id);
  assert.equal(req.input.team_dps.search_algorithm,'branch_bound');u.searchAlgorithm.value='auto';assert.equal(req.input.team_dps.search_algorithm,'branch_bound');
  assert.deepEqual(Array.from(req.input.team_dps.initial_hp),[.65,1,1,1]);u.initialHp.value[0]=20;assert.equal(req.input.team_dps.initial_hp[0],.65);assert.equal('fanfare' in req.input.team_dps,false);
  assert.equal(req.input.single_interfaces[0].artifact_config.config_bloodstained_chivalry.rate,.61);
  u.members.value[0].artifactConfig.config_bloodstained_chivalry.rate=.8;assert.equal(req.input.single_interfaces[0].artifact_config.config_bloodstained_chivalry.rate,.61);
  assert.equal(req.input.team_dps.weapon_conditions[0].ToukabouShigure.rate,.37);assert.equal(req.input.team_dps.widsith_mode[3],'t2_rate');assert.equal(req.input.team_dps.enemy_is_slime,true);assert.equal(req.input.team_dps.enemy_count,3);assert.equal(req.input.team_dps.damage_scope,'all');assert.equal(req.input.team_dps.narzissenkreuz_enabled,false);
  u.weaponConditions.value[0].ToukabouShigure.rate=.5;assert.equal(req.input.team_dps.weapon_conditions[0].ToukabouShigure.rate,.37);
  assert.equal(req.input.team_dps.weapon_conditions[0].AmosBow.stack,3);assert.equal(req.input.team_dps.weapon_conditions[0].Slingshot.close_rate,.4);assert.equal(req.input.team_dps.weapon_conditions[0].UltimateOverlordsMegaMagicSword.rate,.6);
  req.options.onProgress({total_teams:3,evaluated_teams:1});assert.equal(u.progressPercent.value,33.33);assert.equal(u.progress.value.evaluated_teams,1);assert.equal(u.progress.value.total_teams,3);
  assert.equal(u.number(1234.56789),'1,234.57');assert.equal(u.number(2),'2');
  req.resolve(makeResult('old'));await job;
  assert.equal(u.resultHasFurina.value,true);const displayedContext=u.resultContext.value;
  u.resultContext.value={...displayedContext,input:{...displayedContext.input,single_interfaces:displayedContext.input.single_interfaces.map(p=>({...p,character:{...p.character,name:p.character.name==='Furina'?'Mona':p.character.name}}))}};
  assert.equal(u.resultHasFurina.value,false);u.resultContext.value=displayedContext;assert.equal(u.resultHasFurina.value,true);
  assert.equal(u.selectedHealth.value[0].marker,'old');
  const withoutBranches=u.output.value;u.output.value={...withoutBranches,results:[{...withoutBranches.results[0],health_branches:[{health:[{fanfare:22}]},{health:[{fanfare:33}]}]},...withoutBranches.results.slice(1)]};u.healthBranch.value=1;assert.equal(u.selectedHealth.value[0].fanfare,33);u.output.value=withoutBranches;
  let shown;u.hitAnalysisComponent.value={setValue(value){shown=value}};
  const oldHit=u.selected.value.hits[0];await u.openHitAnalysis(oldHit);assert.deepEqual(JSON.parse(JSON.stringify(shown)),oldHit.analysis);assert.equal(u.showHitAnalysis.value,true);
  await u.openHitAnalysis({...oldHit,branches:[{analysis:{theme:1}},{analysis:{theme:2}}]});assert.equal(shown.theme,1);u.hitBranch.value=1;u.showHitBranch();assert.equal(shown.theme,2);
  await u.openHitAnalysis(oldHit);
  u.members.value[0].character.level=1;assert.equal(u.activeHit.value.character.level,90);assert.equal(u.activeHit.value.enemy.level,100);
  for(let r=0;r<4;r++){u.editingRole.value=r;assert.equal(u.panelProfile.value,displayedContext.input.single_interfaces[r]);}
  u.editingRole.value=0;assert.equal(u.editingMember.value.character.level,1);assert.equal(u.panelProfile.value.character.level,90);
  u.sortMetric.value='critical';assert.equal(u.sortedResults.value[0].index,0);u.sortMetric.value='expectation';assert.equal(u.sortedResults.value[0].index,1);
  const detail=u.selectResult(1),detailReq=pending.shift();assert.equal(u.members.value[0].artifactIds[0],other[0].flower);
  assert.equal(u.showHitAnalysis.value,false);assert.equal(u.activeHit.value,null);
  assert.equal(detailReq.input.team_dps.initial_ids[0][0],other[0].flower);detailReq.resolve({results:[{...makeResult('old').results[1],hits:[{time:1}]}]});await detail;
  assert.equal(u.selected.value.hits[0].time,1);
  const current=u.run('evaluate'),currentReq=pending.shift();assert.equal(currentReq.input.team_dps.initial_ids[0][0],other[0].flower);u.abort();await current;
  const retained=u.output.value,context=u.resultContext.value;
  u.members.value[0].weapon.name='CoolSteel';u.minLevel.value=20;
  const cancel=u.run('optimize'),cancelReq=pending.shift();assert.equal(cancelReq.input.team_dps.minimum_artifact_level,20);u.abort();await cancel;
  assert.equal(u.output.value,retained);assert.equal(u.resultContext.value,context);assert.equal(u.selectedIndex.value,2);
  const failed=u.run('optimize'),failedReq=pending.shift();failedReq.reject(new Error('Worker test error'));await failed;
  assert.equal(u.error.value,'Worker test error');
  assert.equal(u.output.value,retained);assert.equal(u.resultContext.value,context);assert.equal(JSON.stringify(presetStore.presets.value),saved);
  delete u.output.value.results[1].hits;
  const oldDetail=u.selectResult(1),oldReq=pending.shift();oldReq.ignoreAbort=true;
  assert.equal(oldReq.input.single_interfaces[0].weapon.name,'DullBlade');
  const newer=u.run('evaluate'),newReq=pending.shift();assert.ok(oldReq.options.signal.aborted);
  newReq.resolve(makeResult('new'));await newer;oldReq.resolve({results:[{...makeResult('stale').results[1],hits:[{time:99}]}]});await oldDetail;
  assert.equal(u.output.value.results[1].marker,'new1');
  // A main response that was already queued when cancelled cannot replace the newer batch either.
  const first=u.run('optimize'),firstReq=pending.shift();firstReq.ignoreAbort=true;
  const second=u.run('optimize'),secondReq=pending.shift();secondReq.resolve(makeResult('latest'));await second;
  firstReq.resolve(makeResult('late'));await first;assert.equal(u.output.value.results[0].marker,'latest0');assert.equal(u.busy.value,false);
  const eventBatch=makeResult('events'),state={time:1,role:0,analysis:{atk:{compiled:100,'天赋':20},normal:{expectation:10}}};delete eventBatch.results[0].hits;delete eventBatch.results[0].health;delete eventBatch.results[0].enemy;
  eventBatch.results[0].eventTrace={semantics:'event-local-joint-values',events:[{id:'hit/0',channel:'hits',probability:1,states:[{state:0,probability:.25,value:state},{state:1,probability:.75,value:{...state,time:2}}]}]};
  const eventJob=u.run('evaluate'),eventRequest=pending.shift();eventRequest.resolve(eventBatch);await eventJob;assert.equal(pending.length,0);await u.selectResult(0);assert.equal(pending.length,0);assert.equal(u.selected.value.eventTrace,eventBatch.results[0].eventTrace);
  await u.openHitAnalysis(state,.25);assert.equal(u.activeHit.value.probability,.25);assert.equal(u.activeHit.value.enemy.level,100);assert.equal(shown.atk['未分项合计'],100);assert.equal(shown.atk['天赋'],20);assert.equal(shown.atk.compiled,undefined);assert.equal(state.analysis.atk.compiled,100);
  // Legacy event axes use the same numerical rules and must invalidate stale results too.
  u.saveTask();const currentTask=savedTasks.at(-1).state;assert.equal(currentTask.engineRulesVersion,TEAM_ACTION_RULES_VERSION);
  taskRecords.second={...currentTask,engineRulesVersion:'mona-team-engine/23',fields:{...currentTask.fields,budget:17}};
  u.clearResults();u.restoreTask('second');assert.equal(u.output.value,null);assert.equal(u.budget.value,17);assert.equal(u.members.value[0].weapon.name,'CoolSteel');assert.equal(presetStore.presets.value.second0.item.weapon.name,'DullBlade');
  taskRecords.second=currentTask;u.restoreTask('second');assert.equal(u.output.value.results[0].marker,'events0');assert.equal(u.selected.value.eventTrace.events[0].states[0].probability,.25);
  const display=u.selectedItems.value[0][0],oldLevel=display.level;artifactStore.artifacts.value.get(display.id).level=0;assert.equal(u.selectedItems.value[0][0].level,oldLevel);
  const pendingDetail=u.selectResult(1),accountReq=pending.shift();accountStore.currentAccountId.value=2;await nextTick();await pendingDetail;
  assert.ok(accountReq.options.signal.aborted);assert.equal(u.output.value,null);
  // Account store loads asynchronously after the account id changes.
  presetStore.presets.value={...presetStore.presets.value};await nextTick();assert.equal(u.names.value[0],'second0');
  const last=u.run('evaluate'),lastReq=pending.shift();for(const f of unmount)f();await last;assert.ok(lastReq.options.signal.aborted);
  assert.equal(JSON.stringify(presetStore.presets.value),saved);
  const directory=process.env.TEAM_DPS_TEST_OUTPUT_DIR||'.build-target/team-dps-tests';fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(directory+'/V4.json',JSON.stringify({initialHpDefault:true,initialHpSnapshot:true,uidReset:true,healthSelection:true,cancelPreservesResults:true,presetsUnchanged:true}));
  const x={single_interfaces:profiles,team_dps:{axis:importedAxis(),enemy:{level:100},initial_ids:builds.map(b=>b.map(a=>a.id)),max_evaluations:1,result_count:1}};
  const echoes=builds[0].map(a=>({...a,id:a.id+5000,set_name:'EchoesOfAnOffering'}));x.team_dps.initial_ids[0]=echoes.map(a=>a.id);
  const result=optimizeTeamDps(api,x,[...builds.flat(),...echoes]);assert.ok(result.baseline.hits.some(h=>h.echoes_probability>0));
  assert.ok(Object.values(result.results[0].artifacts[0]).every(id=>id>=5000));assert.equal(JSON.stringify(presetStore.presets.value),saved);
 }finally{for(const f of unmount)f();scope.stop();}
});

test('repair 4: Worker bridge sends a snapshot, delivers progress and terminates on result/cancel/error',async()=>{
 const source=sourceText('../src/wasm/team_dps.js').replace(/^import .*$/mg,'').replace('export function teamDps','function teamDps').replace("new URL('@worker/team_dps.js',import.meta.url)","'team-worker'").replace("new URL('@worker/team_dps_score.js',import.meta.url)","'score-worker'").replace("new URL('@worker/team_dps_gpu.js',import.meta.url)","'gpu-worker'");
 const workers=[];class CountedWorker extends Worker{constructor(){super();workers.push(this);}}
 const env={Worker:CountedWorker,DOMException,Error,runTeamDpsWorkers,navigator:{hardwareConcurrency:2}};vm.createContext(env);vm.runInContext(source+'\nglobalThis.run=teamDps',env);
 const controller=new AbortController(),updates=[],input={team_dps:{metric:'expectation'}},artifacts=[];
 const done=env.run(input,artifacts,{signal:controller.signal,onProgress:p=>updates.push(p)}),w=workers[0];assert.equal(workers.length,2);
 for(const worker of workers)worker.emit({type:'ready'});assert.equal(w.sent[0].input.team_dps.metric,'expectation');input.team_dps.metric='critical';assert.equal(w.sent[0].input.team_dps.metric,'expectation');
 w.emit({type:'progress',data:{evaluated_teams:1,elapsed_ms:1}});w.emit({type:'result',data:{results:[1],elapsed_ms:2}});assert.equal((await done).results[0],1);assert.ok(workers.every(worker=>worker.terminated));assert.equal(updates.length,1);
 const cancel=new AbortController(),p=env.run(input,artifacts,{signal:cancel.signal});cancel.abort();await assert.rejects(p,{name:'AbortError'});assert.ok(workers.at(-1).terminated);
 const failed=env.run(input,artifacts);workers.at(-1).onmessage({data:{type:'error',message:'actual failure',stack:'actual stack'}});await assert.rejects(failed,/actual failure/);assert.ok(workers.at(-1).terminated);
});

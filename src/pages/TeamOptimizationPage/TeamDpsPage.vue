<template>
 <div class="team-dps">
  <section class="dps-card general-card">
   <header class="card-heading"><h3><i-ep-setting/>通用设置</h3><el-button :disabled="busy" @click="showEnemy=true">敌人设置</el-button></header>
   <div class="general-grid">
    <div class="setting-field"><label>角色等级 <span class="role-chip">{{ labels[editingRole] }}</span></label><select-character-level popper-class="team-dps-popper" :model-value="levelString(editingMember.character)" :disabled="busy" @update:model-value="setLevel(editingMember.character,$event)"/></div>
    <div class="setting-field"><label>敌人等级</label><el-input-number v-model="enemyConfig.level" :min="60" :max="120" :disabled="busy"/><el-slider v-model="enemyConfig.level" :min="60" :max="120" :disabled="busy"/></div>
    <div class="setting-field"><label>初始生命值 % <span class="role-chip">{{ labels[editingRole] }}</span></label><el-input-number v-model="initialHp[editingRole]" :min="0" :max="100" :precision="2" :disabled="busy"/><el-slider v-model="initialHp[editingRole]" :min="0" :max="100" :step="0.01" :disabled="busy"/></div>
    <div v-for="(title,k) in ['普通攻击等级','元素战技等级','元素爆发等级']" :key="k" class="setting-field"><label>{{ title }} <span class="role-chip">{{ labels[editingRole] }}</span></label><el-input-number :model-value="editingMember.character['skill'+(k+1)]+1" :min="1" :max="15" :disabled="busy" @update:model-value="editingMember.character['skill'+(k+1)]=$event-1"/><el-slider :model-value="editingMember.character['skill'+(k+1)]+1" :min="1" :max="15" :disabled="busy" @update:model-value="editingMember.character['skill'+(k+1)]=$event-1"/></div>
   </div>
  </section>
  <div class="team-workspace">
   <div class="team-editor">
    <section class="dps-card team-card">
     <header class="card-heading"><h3><i-ep-user-filled/>队伍配置</h3><span class="axis-duration">{{ number(axisDurationMs/1000) }}s</span></header>
     <div class="team-roster">
      <button v-for="(role,r) in roles" :key="role" class="roster-member" :class="{active:editingRole===r}" :style="{'--role-accent':elementColors[characterData[role].element]}" :aria-pressed="editingRole===r" @click="editingRole=r"><img :src="characterData[role].avatar" alt=""/><strong>{{ labels[r] }}</strong><span>C{{ members[r].character.constellation }} · R{{ members[r].weapon.refine }}</span></button>
     </div>
    </section>
    <section class="dps-card member">
     <header class="card-heading"><h3><i-ep-edit/>{{ labels[editingRole] }} · 装备配置</h3><el-button :disabled="busy" @click="openMemberSettings(editingRole)">配装设置</el-button></header>
     <div class="constellation-line"><span>命座</span><button v-for="n in 7" :key="n" :class="{active:editingMember.character.constellation===n-1}" :disabled="busy" :aria-pressed="editingMember.character.constellation===n-1" @click="changeTeamConstellation(editingMember.character,n-1)">C{{ n-1 }}</button></div>
     <el-form label-position="top" :disabled="busy">
      <el-form-item label="角色预设"><el-select popper-class="team-dps-popper" v-model="names[editingRole]" filterable placeholder="选择角色预设"><el-option v-for="p in rolePresets(roles[editingRole])" :key="p.name" :value="p.name" :label="p.name"/></el-select></el-form-item>
      <div class="equipment-grid">
       <el-form-item label="武器" class="weapon-field"><div class="weapon-choice"><img :src="weaponData[editingMember.weapon.name].url" alt=""/><el-select popper-class="team-dps-popper" :model-value="editingMember.weapon.name" @update:model-value="changeWeapon(editingRole,$event)" filterable><el-option v-for="w in availableWeapons(roles[editingRole])" :key="w.name" :value="w.name" :label="locale[w.nameLocale]"/></el-select></div></el-form-item>
       <el-form-item label="精炼"><el-select popper-class="team-dps-popper" v-model="editingMember.weapon.refine"><el-option v-for="n in 5" :key="n" :value="n" :label="'R'+n"/></el-select></el-form-item>
       <el-form-item label="武器等级"><select-weapon-level popper-class="team-dps-popper" :model-value="levelString(editingMember.weapon)" @update:model-value="setLevel(editingMember.weapon,$event)"/></el-form-item>
      </div>
      <item-config v-if="weaponConfigs(editingRole).length" v-model="editingMember.weapon.params" :item-name="editingMember.weapon.name" :configs="weaponConfigs(editingRole)"/>
      <el-form-item v-for="f in manualWeaponConfigs(editingRole)" :key="f.key" :label="f.label"><el-input-number :model-value="weaponConditions[editingRole][editingMember.weapon.name][f.key]*f.scale" :min="f.min" :max="f.max" :precision="2" @update:model-value="weaponConditions[editingRole][editingMember.weapon.name][f.key]=$event/f.scale"/></el-form-item>
      <el-form-item v-if="editingMember.weapon.name==='TheWidsith'" label="流浪乐章曲目"><el-select popper-class="team-dps-popper" v-model="widsithMode[editingRole]"><el-option v-for="[value,label] in WIDSITH_THEMES" :key="value" :value="value" :label="label"/></el-select></el-form-item>
     </el-form>
    </section>
   </div>
   <aside class="dps-card character-panel">
    <header class="card-heading"><h3><i-ep-tickets/>所选搭配面板</h3></header>
    <div class="panel-identity"><img :src="characterData[roles[editingRole]].avatar" alt=""/><div><h3>{{ labels[editingRole] }}</h3><div v-if="panelProfile" class="panel-badges"><span>Lv.{{ panelProfile.character.level }}</span><span>C{{ panelProfile.character.constellation }}</span><span>R{{ panelProfile.weapon.refine }}</span></div></div></div>
    <template v-if="selected"><dl class="panel-stats"><div v-for="[key,title,factor] in panelFields" :key="key"><dt>{{ title }}</dt><dd>{{ number(panelSum(selected.panels[editingRole][key])*factor) }}{{ factor===100?'%':'' }}</dd></div></dl><div class="panel-weapon"><img :src="weaponData[panelProfile.weapon.name].url" alt=""/><span>{{ locale[weaponData[panelProfile.weapon.name].nameLocale] }}</span></div></template>
    <div v-else class="panel-empty">暂无计算结果</div>
   </aside>
  </div>
  <section class="dps-card optimization-card">
  <header class="card-heading"><h3><i-ep-operation/>联合优化</h3></header>
  <div class="controls optimization-fields">
   <label>优化目标 <el-select popper-class="team-dps-popper" v-model="objective" :disabled="busy"><el-option label="总伤最高" value="damage"/><el-option label="总DPS最高" value="dps"/></el-select></label>
   <label>伤害 <el-select popper-class="team-dps-popper" v-model="metric" :disabled="busy"><el-option v-for="[key,title] in damageModes" :key="key" :label="title" :value="key"/></el-select></label>
   <label>搜索算法 <el-select popper-class="team-dps-popper" v-model="searchAlgorithm" :disabled="busy"><el-option label="自动搜索" value="auto"/><el-option label="分支搜索·属性剪枝" value="branch_bound"/></el-select></label>
   <label>计算方式 <el-select popper-class="team-dps-popper" v-model="computeBackend" :disabled="busy"><el-option label="CPU＋GPU" value="gpu"/><el-option label="CPU 多线程" value="cpu"/></el-select></label>
   <label>结果套数 <el-input-number v-model="count" :min="1" :disabled="busy"/></label>
   <label>联合评估预算 <el-input-number v-model="budget" :min="1" :step="100" :disabled="busy"/></label>
   <label>最低圣遗物等级 <el-input-number v-model="minLevel" :min="0" :max="20" :disabled="busy"/></label>
   <el-checkbox v-if="members.some(p=>p.weapon.name==='BlackTassel')" v-model="enemyIsSlime" :disabled="busy">敌人为史莱姆</el-checkbox>
   <el-checkbox v-if="members.some(p=>p.weapon.name==='SwordOfNarzissenkreuz')" v-model="narzissenkreuzEnabled" :disabled="busy">计算水仙十字追加</el-checkbox>
  </div>
  <div class="actions">
   <el-button type="primary" :disabled="busy" @click="run('optimize')">开始计算</el-button>
   <el-button :disabled="busy||!canEvaluate" @click="run('evaluate')">计算当前配装</el-button>
   <el-checkbox v-model="debug">Debug</el-checkbox><el-button v-if="debug&&lastInput" @click="exportDebug">导出Debug</el-button>
  </div>
  </section>
  <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon/>
  <template v-if="output">
   <section class="dps-card result-card">
   <header class="card-heading"><h3><i-ep-data-analysis/>计算结果</h3><el-button @click="showResults=true">查看搭配结果</el-button></header>
   <div class="summary"><div class="metric-total"><span>总伤害</span><strong>{{ number(selected[sortMetric]) }}</strong></div><div class="metric-dps"><span>DPS</span><strong>{{ number(selected[sortMetric]/selected.duration) }}</strong></div><div class="metric-time"><span>轴长</span><strong>{{ number(selected.duration) }}<small>s</small></strong></div></div>
   <div class="result-toolbar"><div class="metric-switch"><button v-for="[key,title] in damageModes" :key="key" :class="{active:sortMetric===key}" :aria-pressed="sortMetric===key" @click="sortMetric=key">{{ title }}</button></div><label class="selection">当前搭配 <el-input-number :model-value="selectedIndex" :min="1" :max="output.results.length" @update:model-value="selectResult($event-1)"/></label></div>
   <div class="result-meta"><span>已评估 {{ output.evaluated_teams }} 组</span><span v-if="output.legal_teams!=null">合法组合 {{ output.legal_teams }} 组</span><span v-else-if="output.feasible_teams!=null">已找到合法组合 {{ output.feasible_teams }} 组</span><span>保留 {{ output.results.length }} 套</span><span v-if="output.search_stats">剪枝 {{ output.search_stats.pruned_nodes }} 个分支 · {{ output.search_complete?'搜索完成':'有限预算结果' }}</span><span v-if="resultHasFurina">最高气氛 {{ number(selected.fanfare) }}</span></div>
   <div class="contribution-list"><div v-for="(role,r) in roles" :key="role" class="contribution-row"><button class="contribution-person" @click="editingRole=r"><img :src="characterData[role].avatar" alt=""/><span>{{ labels[r] }}</span></button><div class="contribution-damage"><div class="contribution-track"><span :style="{width:selected.character_damage[r][sortMetric]/selected[sortMetric]*100+'%',background:elementColors[characterData[role].element]}"/></div><strong>{{ number(selected.character_damage[r][sortMetric]) }} <small>（{{ number(selected.character_damage[r][sortMetric]/selected[sortMetric]*100) }}%）</small></strong></div><div class="contribution-equipment"><span>C{{ selected.profiles[r].character.constellation }} · R{{ selected.profiles[r].weapon.refine }} {{ locale[weaponData[selected.profiles[r].weapon.name].nameLocale] }}</span><span>{{ resultSetLabel(r) }}</span></div></div></div>
   </section>
   <section class="dps-card builds-card"><header class="card-heading"><h3><i-ep-box/>四人装备</h3></header>
   <section v-for="(role,r) in roles" :key="role" class="result-member">
    <h3>{{ labels[r] }} <span class="damage">期望 {{ number(selected.character_damage[r].expectation) }} · 暴击 {{ number(selected.character_damage[r].critical) }} · 非暴击 {{ number(selected.character_damage[r].non_critical) }}</span></h3>
    <div class="build-panel"><span>{{ r===0||r===2?'攻击力':'生命值' }} {{ number(panelSum(selected.panels[r][r===0||r===2?'atk':'hp'])) }}</span><span>暴击率 {{ number(panelSum(selected.panels[r].critical)*100) }}%</span><span>暴击伤害 {{ number(panelSum(selected.panels[r].critical_damage)*100) }}%</span><span>元素充能效率 {{ number(panelSum(selected.panels[r].recharge)*100) }}%</span></div>
    <div class="gear"><artifact-display v-for="a in selectedItems[r]" :key="a.id" :item="a" :buttons="false"/></div>
   </section>
   </section>
   <el-collapse class="dps-card detail-card"><el-collapse-item title="逐段伤害" name="hits"><el-table :data="selected.hits||[]" max-height="500" class="hit-table" @row-click="openHitAnalysis"><el-table-column label="时间"><template #default="{row}">{{ number(row.time) }}</template></el-table-column><el-table-column label="角色"><template #default="{row}">{{ labels[row.role] }}</template></el-table-column><el-table-column prop="label" label="技能"/><el-table-column v-for="[key,title] in damageModes" :key="key" :label="title"><template #default="{row}"><el-button type="text" @click.stop="openHitAnalysis(row)">{{ number(row[key]) }}</el-button></template></el-table-column></el-table></el-collapse-item></el-collapse>
   <el-collapse class="dps-card detail-card"><el-collapse-item title="血量变动" name="health">
    <el-select popper-class="team-dps-popper" v-if="selected.health_branches" v-model="healthBranch"><el-option v-for="(b,i) in selected.health_branches" :key="i" :value="i" :label="`${b.label}（${number(b.probability*100)}%）`"/></el-select>
    <el-table :data="selectedHealth" max-height="500">
     <el-table-column label="时间" width="75"><template #default="{row}">{{ number(row.time) }}</template></el-table-column><el-table-column prop="label" label="事件" min-width="180"/>
     <el-table-column v-for="(label,r) in labels" :key="r" :label="label" min-width="190"><template #default="{row}"><span class="health-values">{{ number(row.hp[r]) }} / {{ number(row.maxHP[r]) }}</span><small class="health-ratio">{{ number(row.ratios[r]*100) }}%</small></template></el-table-column>
     <el-table-column v-if="resultHasFurina" label="气氛" width="80"><template #default="{row}">{{ number(row.fanfare) }}</template></el-table-column><el-table-column v-if="resultHasFurina" label="二命溢出" width="95"><template #default="{row}">{{ number(row.overflow) }}</template></el-table-column>
     <el-table-column label="实际回血" min-width="110"><template #default="{row}"><span v-if="row.healing">{{ number(row.healing.amount) }}</span></template></el-table-column><el-table-column label="溢出治疗" min-width="110"><template #default="{row}"><span v-if="row.healing">{{ number(panelSum(row.healing.overheals)) }}</span></template></el-table-column><el-table-column label="清除生命之契" min-width="120"><template #default="{row}"><span v-if="row.healing">{{ number(panelSum(row.healing.absorbedAmounts)) }}</span></template></el-table-column>
    </el-table>
   </el-collapse-item></el-collapse>
  </template>
  <el-dialog custom-class="team-dps-dialog" v-model="showHitAnalysis" title="伤害构成" width="94%" destroy-on-close>
   <template v-if="activeHit">
    <p>{{ labels[activeHit.hit.role] }} · {{ number(activeHit.hit.time) }}秒 · {{ activeHit.hit.label }} · 第{{ activeHit.hit.part+1 }}段</p>
    <p v-if="resultHasFurina&&activeHitState.fanfare!==undefined">气氛 {{ number(activeHitState.fanfare) }} · 二命溢出 {{ number(activeHitState.furina_overflow) }}</p>
    <el-select popper-class="team-dps-popper" v-if="activeHit.hit.branches" v-model="hitBranch" @change="showHitBranch"><el-option v-for="(b,i) in activeHit.hit.branches" :key="i" :value="i" :label="`${b.label}（${number(b.probability*100)}%）`"/></el-select>
    <damage-analysis ref="hitAnalysisComponent" :enemy-config="activeHit.enemy" :character-level="activeHit.character.level" :character-name="activeHit.character.name"/>
   </template>
  </el-dialog>
  <el-dialog custom-class="team-dps-dialog" v-model="showMemberSettings" :title="labels[settingsRole]+' · 配装设置'" width="min(720px, 94vw)">
   <el-form label-position="top" :disabled="busy" class="member-settings">
    <el-tabs v-model="settingsTab">
     <el-tab-pane label="配装限制" name="constraints">
      <el-form-item label="套装"><el-select popper-class="team-dps-popper" v-model="members[settingsRole].constraint.setNames" multiple :multiple-limit="2" placeholder="任意套装" filterable><el-option v-for="s in availableSets" :key="s.name2" :value="s.eng" :label="locale[s.nameLocale]"/></el-select></el-form-item>
      <el-form-item v-for="[field,pos,title] in mainFilters" :key="field" :label="title"><select-artifact-main-stat popper-class="team-dps-popper" v-model="members[settingsRole].filter[field]" :position="pos" :multiple="true" :include-any="false" placeholder="任意主词条"/></el-form-item>
      <el-form-item v-for="[field,title,factor] in statFilters" :key="field" :label="title"><el-input-number :model-value="members[settingsRole].constraint[field]*factor" :min="0" @update:model-value="members[settingsRole].constraint[field]=$event/factor"/></el-form-item>
     </el-tab-pane>
     <el-tab-pane label="圣遗物效果参数" name="effects"><artifact-config :key="settingsRole" v-model="members[settingsRole].artifactConfig" :exclude-sets="excludedArtifactConfigs"/></el-tab-pane>
    </el-tabs>
   </el-form>
  </el-dialog>
  <el-dialog custom-class="team-dps-dialog" v-model="showEnemy" title="敌人设置" width="650px">
   <enemy-config v-model="enemyConfig"/>
   <div class="controls">
    <el-checkbox v-model="frozen" :disabled="busy">敌人可冻结</el-checkbox>
    <label>敌人数 <el-input-number v-model="enemyCount" :min="1" :precision="0" :disabled="busy"/></label>
    <label>统计目标 <el-select popper-class="team-dps-popper" v-model="damageScope" :disabled="busy"><el-option value="single" label="单个敌人"/><el-option value="all" label="全部敌人"/></el-select></label>
   </div>
  </el-dialog>
  <el-dialog custom-class="team-dps-dialog" :model-value="busy" title="计算进度" width="560px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false">
   <el-progress :percentage="progressPercent"/>
   <p>{{ progress.phase==='compile'?'正在编译整队计算':progress.phase==='bounds'?'正在建立属性上界':'联合搜索' }} · {{ progress.total_teams }}组评估预算</p><p>已评估 {{ progress.evaluated_teams }} 组　剩余预算 {{ progress.remaining_teams }} 组</p>
   <p v-if="progress.visited_nodes">已访问 {{ progress.visited_nodes }} 个节点 · 剪枝 {{ progress.pruned_nodes }} 个分支</p>
   <p>已用时间 {{ duration(elapsed) }}　预计剩余 {{ progress.eta_ms==null?'估算中':duration(progress.eta_ms) }}</p>
   <template #footer><el-button @click="controller?.abort()">取消计算</el-button></template>
  </el-dialog>
  <el-dialog v-model="showResults" title="四人圣遗物搭配结果" width="94%" custom-class="team-dps-dialog team-dps-results">
   <div class="sort-bar"><label>排序 <el-select popper-class="team-dps-popper" v-model="sortMetric"><el-option v-for="[key,title] in damageModes" :key="key" :value="key" :label="title"/></el-select></label><span>共{{ output?.results.length||0 }}套</span></div>
   <div class="result-list">
    <div v-for="row in sortedResults" :key="row.index" class="team-row" :class="{chosen:selectedIndex===row.index+1}" role="button" tabindex="0" @click="selectResult(row.index)" @keydown.enter="selectResult(row.index)">
     <strong>第{{ row.rank }}套</strong><span v-for="[key,title] in damageModes" :key="key">{{ title }} {{ number(row.result[key]) }}</span><span>DPS {{ number(row.result[sortMetric]/row.result.duration) }}</span>
     <el-button @click.stop="selectResult(row.index)">查看详情</el-button>
     <div v-for="(role,r) in roles" :key="role" class="row-member"><b>{{ labels[r] }}</b><span>{{ number(row.result.character_damage[r][sortMetric]) }}</span><span v-for="id in Object.values(row.result.artifacts[r])" :key="id">{{ artifactTitle(Number(id)) }}</span></div>
    </div>
   </div>
  </el-dialog>
 </div>
</template>
<script setup lang="ts">
import './team-dps-theme.css'
import {ref,shallowRef,computed,watch,nextTick,onBeforeUnmount,onDeactivated} from 'vue'
import {ElMessage} from 'element-plus'
import {usePresetStore} from '@/store/pinia/preset'
import {useArtifactStore} from '@/store/pinia/artifact'
import {useAccountStore} from '@/store/pinia/account'
import {useMiyousheStore} from '@/store/pinia/miyoushe'
import {convertPresetToWasmInterface} from '@/utils/preset'
import {AUTO_WEAPON_FIELDS,AUTO_ARTIFACT_SETS} from '../../../beta-data/equipment-axis-rules.mjs'
import {teamDpsWeaponAvailable,teamDpsArtifactAvailable,INCOMPLETE_ARTIFACT_SETS} from '../../../beta-data/team-dps-equipment-support.mjs'
import {MANUAL_WEAPON_OPTIONS,defaultWeaponOptions,WIDSITH_THEMES} from '../../../beta-data/team-dps-weapon-options.mjs'
import {convertArtifact,convertArtifactName} from '@/utils/converter'
import {teamDps} from '@/wasm/team_dps'
import {changeTeamConstellation} from '../../../beta-data/team-dps-character-rules.mjs'
import {useEnemy} from '@/composables/enemy'
import EnemyConfig from '@/pages/NewArtifactPlanPage/EnemyConfig.vue'
import ArtifactConfig from '@/pages/NewArtifactPlanPage/ArtifactConfig.vue'
import {upgradeArtifactConfig} from '@/utils/artifacts'
import ArtifactDisplay from '@/components/display/ArtifactDisplay.vue'
import DamageAnalysis from '@/components/display/DamageAnalysis'
import SelectWeaponLevel from '@/components/select/SelectWeaponLevel.vue'
import SelectCharacterLevel from '@/components/select/SelectCharacterLevel.vue'
import SelectArtifactMainStat from '@/components/select/SelectArtifactMainStat.vue'
import ItemConfig from '@/components/config/ItemConfig.vue'
import {characterData} from '@/assets/character'
import {weaponData,weaponByType} from '@/assets/weapon'
import {artifactsData} from '@/assets/artifacts'
import locale from '@/i18n/generated/zh-cn.json'
import {actionAxisDurationMs,TEAM_ACTION_RULES_VERSION} from '../../../beta-data/team-engine/action-config.mjs'
const props=defineProps<{configuration:any,taskKey:number,tasks:Record<string,any>}>()
const axisDurationMs=computed(()=>props.configuration.format==='mona-action-axis'?actionAxisDurationMs(props.configuration,members.value):props.configuration.durationMs)
const engineRulesVersion=props.configuration.format==='mona-action-axis'?TEAM_ACTION_RULES_VERSION:null
const emit=defineEmits(['save-task'])
const roles=props.configuration.members.map((m:any)=>m.character),labels=roles.map((role:string)=>locale[characterData[role].nameLocale])
const damageModes=[['expectation','期望伤害'],['critical','暴击伤害'],['non_critical','非暴击伤害']]
const statFilters:[string,string,number][]=[['minRecharge','最低充能效率 %',100],['minCritical','最低暴击率 %',100],['minCriticalDamage','最低暴击伤害 %',100],['minElementalMastery','最低元素精通',1]]
const mainFilters=[['sandMainStats','sand','时之沙'],['gobletMainStats','cup','空之杯'],['headMainStats','head','理之冠']]
const elementColors:Record<string,string>={Hydro:'#7eb8ff',Cryo:'#87e4df',Pyro:'#ff9a81',Electro:'#c0a2ff',Anemo:'#77d8bd',Geo:'#e8c77d',Dendro:'#b3d975'}
const panelFields:[string,string,number][]=[['hp','生命值上限',1],['atk','攻击力',1],['def','防御力',1],['elemental_mastery','元素精通',1],['critical','暴击率',100],['critical_damage','暴击伤害',100],['recharge','元素充能效率',100],['healing_bonus','治疗加成',100]]
const presetStore=usePresetStore(),artifactStore=useArtifactStore(),accountStore=useAccountStore(),mys=useMiyousheStore()
const {enemyConfig}=useEnemy(),showEnemy=ref(false),frozen=ref(true),enemyIsSlime=ref(false)
const enemyCount=ref(1),damageScope=ref('single'),narzissenkreuzEnabled=ref(true)
const availableWeapons=(role:string)=>weaponByType[characterData[role].weapon].filter((w:any)=>teamDpsWeaponAvailable(w.name))
const availableSets=Object.values(artifactsData).filter((s:any)=>teamDpsArtifactAvailable(s.name2)).sort((a:any,b:any)=>b.maxStar-a.maxStar)
const availableArtifactSet=(name:string)=>teamDpsArtifactAvailable(convertArtifactName(name))
const excludedArtifactConfigs=[...AUTO_ARTIFACT_SETS,...Object.keys(INCOMPLETE_ARTIFACT_SETS)]
const weaponConditions=ref(roles.map(()=>defaultWeaponOptions())),widsithMode=ref(roles.map(()=>'average'))
const manualWeaponConfigs=(r:number)=>MANUAL_WEAPON_OPTIONS[members.value[r].weapon.name]||[]
const params=(name:string,configs:any[])=>configs?.length?{[name]:Object.fromEntries(configs.map(c=>[c.name,c.default]))}:'NoConfig'
function fresh(role:string){const name=({Skirk:'Azurelight',Furina:'SplendorOfTranquilWaters',Escoffier:'SymphonistOfScents',Vodyanitsa:'HymnOfTheMaelstrom',Mona:'ThrillingTalesOfDragonSlayers',Sandrone:'ATeaspoonOfTranscendence',Odette:'WhitelakeFrostfeather',Alyosha:'FavoniusLance',Qiqi:'SacrificialSword',YaeMiko:'KagurasVerity'} as Record<string,string>)[role];return {character:{name:role,level:90,ascend:false,constellation:0,skill1:9,skill2:9,skill3:9,params:params(role,characterData[role].config)},weapon:{name,level:90,ascend:false,refine:1,params:params(name,weaponData[name].configs)},artifactIds:[],artifactEffectMode:'custom',artifactConfig:upgradeArtifactConfig({}),buffs:[],constraint:{setNames:[],minRecharge:1,minCritical:0,minCriticalDamage:0,minElementalMastery:0},filter:{sandMainStats:[],gobletMainStats:[],headMainStats:[]}}}
const names=ref(['','','','']),members=ref<any[]>(roles.map(fresh))
const editingRole=ref(0),editingMember=computed(()=>members.value[editingRole.value])
const weaponConfigs=(r:number)=>{const name=members.value[r].weapon.name;return (weaponData[name].configs||[]).filter((c:any)=>!AUTO_WEAPON_FIELDS[name]?.includes(c.name))}
const objective=ref('damage'),metric=ref('expectation'),sortMetric=ref('expectation'),count=ref(100),budget=ref(2000),minLevel=ref(0),initialHp=ref([100,100,100,100]),healthBranch=ref(0)
const searchAlgorithm=ref('auto')
const computeBackend=ref('gpu')
const busy=ref(false),error=ref(''),debug=ref(false),output=ref<any>(null),selectedIndex=ref(1),showResults=ref(false)
const resultContext=shallowRef<any>(null)
const resultHasFurina=computed(()=>resultContext.value?.input.single_interfaces.some((p:any)=>p.character.name==='Furina'))
const panelProfile=computed(()=>resultContext.value?.input.single_interfaces[editingRole.value])
const showMemberSettings=ref(false),settingsRole=ref(0),settingsTab=ref('constraints')
function openMemberSettings(r:number){settingsRole.value=r;settingsTab.value='constraints';showMemberSettings.value=true}
const showHitAnalysis=ref(false),activeHit=shallowRef<any>(null),hitBranch=ref(0),hitAnalysisComponent=shallowRef<InstanceType<typeof DamageAnalysis>|null>(null)
const activeHitState=computed(()=>activeHit.value?.hit.branches?activeHit.value.hit.branches[hitBranch.value]:activeHit.value?.hit)
const clock=ref(0),started=ref(0),progress=ref<any>({evaluated_teams:0,total_teams:0,remaining_teams:0,eta_ms:null})
let controller:AbortController|null=null,detailController:AbortController|null=null,timer:ReturnType<typeof setInterval>|null=null,lastInput:any=null,loadedUid:string|null=null
const taskAccount=accountStore.currentAccountId.value
let restoringTask=false,taskRestored=false
const taskFields={names,members,editingRole,enemyConfig,frozen,enemyIsSlime,enemyCount,damageScope,narzissenkreuzEnabled,weaponConditions,widsithMode,objective,metric,sortMetric,count,budget,minLevel,initialHp,searchAlgorithm,computeBackend,selectedIndex,healthBranch,debug}
const clone=(value:any)=>JSON.parse(JSON.stringify(value))
const taskDefaults=clone(Object.fromEntries(Object.entries(taskFields).map(([key,value])=>[key,value.value])))
function saveTask(){
 if(restoringTask||loadedUid===null||accountStore.currentAccountId.value!==taskAccount)return;
 const context=resultContext.value;
 emit('save-task',{key:props.taskKey,accountId:taskAccount,uid:loadedUid,state:clone({axis:props.configuration,engineRulesVersion,fields:Object.fromEntries(Object.entries(taskFields).map(([key,value])=>[key,value.value])),output:output.value,context:context?{...context,items:[...context.items]}:null,lastInput})});
}
function restoreTask(uid:string){
 const saved=props.tasks?.[uid];restoringTask=true;taskRestored=!!saved;
 const fields=clone(saved?saved.fields:taskDefaults);
 for(const [key,value]of Object.entries(taskFields))value.value=fields[key];
 if(saved){
  lastInput=saved.lastInput;
  if(JSON.stringify(saved.axis)===JSON.stringify(props.configuration)&&(!engineRulesVersion||saved.engineRulesVersion===engineRulesVersion)){
   output.value=clone(saved.output);resultContext.value=saved.context?{...clone(saved.context),items:new Map(clone(saved.context.items))}:null;
  }
 }
 restoringTask=false;
}
const rolePresets=(role:string)=>presetStore.allFlat.value.filter(p=>p.item.character.name===role&&teamDpsWeaponAvailable(p.item.weapon.name))
function clearResults(){controller?.abort();detailController?.abort();output.value=null;resultContext.value=null;showResults.value=false;showHitAnalysis.value=false;activeHit.value=null;error.value=''}
function loadPreset(r:number){clearResults();const item=JSON.parse(JSON.stringify(presetStore.presets.value[names.value[r]].item));item.constraint={minRecharge:1,minCritical:0,minCriticalDamage:0,minElementalMastery:0,...item.constraint,setNames:(item.constraint?.setNames||[]).filter(availableArtifactSet)};item.filter={sandMainStats:[],gobletMainStats:[],headMainStats:[],...item.filter};item.artifactConfig=upgradeArtifactConfig(item.artifactConfig||{});item.artifactEffectMode='custom';members.value[r]=item}
function changeWeapon(r:number,name:string){members.value[r].weapon.name=name;members.value[r].weapon.params=params(name,weaponData[name].configs)}
const levelString=(x:any)=>x.level+(x.ascend?'+':'-')
function setLevel(x:any,v:string){x.level=parseInt(v);x.ascend=v.includes('+')}
function autoLoad(){
 const uid=mys.selectedUid.value||'';
 if(loadedUid!==uid){saveTask();clearResults();loadedUid=uid;restoreTask(uid)}
 if(taskRestored)return;
 for(let r=0;r<4;r++){
  if(names.value[r]&&presetStore.presets.value[names.value[r]])continue;
  const presets=rolePresets(roles[r]),entry=mys.data.value.entries.find((e:any)=>String(e.uid)===uid&&presets.some(p=>p.name===e.presetName));
  names.value[r]=entry?.presetName||(!uid?presets[0]?.name:'')||'';
 }
}
const canEvaluate=computed(()=>members.value.every(p=>p.artifactIds?.length===5&&p.artifactIds.every((id:number)=>{const a=artifactStore.artifacts.value.get(id);return a&&availableArtifactSet(a.setName)})))
const selected=computed(()=>output.value?.results[selectedIndex.value-1])
const selectedHealth=computed(()=>selected.value?.health_branches?selected.value.health_branches[healthBranch.value].health:selected.value?.health||[])
const selectedItems=computed(()=>selected.value?selected.value.artifacts.map((b:any)=>['flower','feather','sand','goblet','head'].map(k=>resultContext.value.items.get(b[k]))):[])
function resultSetLabel(r:number){const counts=new Map<string,number>();for(const a of selectedItems.value[r])counts.set(a.setName,(counts.get(a.setName)||0)+1);return [...counts].map(([name,n])=>`${locale[artifactsData[name].nameLocale]} ×${n}`).join(' / ')}
const sortedResults=computed(()=>{const rows=(output.value?.results||[]).map((result:any,index:number)=>({result,index}));rows.sort((a:any,b:any)=>b.result[sortMetric.value]-a.result[sortMetric.value]);return rows.map((row:any,i:number)=>({...row,rank:i+1}))})
const panelSum=(values:any)=>Object.values(values||{}).reduce((n:number,v:any)=>n+v,0)
const number=(n:number)=>n.toLocaleString('zh-CN',{maximumFractionDigits:2})
const duration=(ms:number)=>{const s=Math.max(0,Math.floor(ms/1000));return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`}
const elapsed=computed(()=>clock.value-started.value),progressPercent=computed(()=>progress.value.total_teams?Number(Math.min(100,progress.value.evaluated_teams/progress.value.total_teams*100).toFixed(2)):0)
function artifactTitle(id:number){const a=resultContext.value.items.get(id);return `${locale[artifactsData[a.setName].nameLocale]} +${a.level}`}
async function openHitAnalysis(hit:any){
 const detail={hit,enemy:selected.value.enemy,character:selected.value.profiles[hit.role].character};
 activeHit.value=detail;hitBranch.value=0;showHitAnalysis.value=true;
 await nextTick();
 if(showHitAnalysis.value&&activeHit.value===detail)showHitBranch();
}
function showHitBranch(){const h=activeHit.value.hit;hitAnalysisComponent.value!.setValue(h.branches?h.branches[hitBranch.value].analysis:h.analysis)}
async function selectResult(index:number){
 selectedIndex.value=index+1;healthBranch.value=0;showResults.value=false;showHitAnalysis.value=false;activeHit.value=null;
 const batch=output.value,snapshot=resultContext.value,row=batch.results[index];
 const ids=row.artifacts.map((b:any)=>['flower','feather','sand','goblet','head'].map(k=>b[k]));
 for(let r=0;r<4;r++)members.value[r].artifactIds=[...ids[r]];
 detailController?.abort();
 if(row.hits)return;
 const task=new AbortController();detailController=task;
 const input={...snapshot.input,team_dps:{...snapshot.input.team_dps,initial_ids:ids}};
 try{
  const out:any=await teamDps(input,snapshot.artifacts,{mode:'evaluate',signal:task.signal});
  if(!task.signal.aborted&&output.value===batch&&resultContext.value===snapshot)batch.results[index]=out.results[0];
 }catch(e:any){if(e.name!=='AbortError'){console.error(e);if(output.value===batch)error.value=e.message}}
 finally{if(detailController===task)detailController=null}
}
function allArtifacts(items:any[]=[...artifactStore.artifacts.value.values()]){return items.map(a=>({...convertArtifact(a),omit:a.omit}))}
async function run(mode:string){
 controller?.abort();detailController?.abort();showHitAnalysis.value=false;activeHit.value=null;
 const input=JSON.parse(JSON.stringify({single_interfaces:members.value.map(convertPresetToWasmInterface),team_dps:{axis:props.configuration,initial_ids:members.value.map(p=>p.artifactIds),initial_hp:initialHp.value.map(v=>v/100),enemy:enemyConfig.value,enemy_is_slime:enemyIsSlime.value,enemy_count:enemyCount.value,damage_scope:damageScope.value,narzissenkreuz_enabled:narzissenkreuzEnabled.value,weapon_conditions:weaponConditions.value,widsith_mode:widsithMode.value,frozen:frozen.value,objective:objective.value,metric:metric.value,search_algorithm:searchAlgorithm.value,compute_backend:computeBackend.value,result_count:count.value,max_evaluations:budget.value,minimum_artifact_level:minLevel.value}}))
 const items:any[]=JSON.parse(JSON.stringify([...artifactStore.artifacts.value.values()])),artifacts=allArtifacts(items);
 const snapshot={input,artifacts,items:new Map(items.map(a=>[a.id,a]))};
 lastInput=input;busy.value=true;error.value='';started.value=clock.value=performance.now();progress.value={evaluated_teams:0,total_teams:mode==='evaluate'?1:budget.value,remaining_teams:mode==='evaluate'?1:budget.value,eta_ms:null};const taskTimer=setInterval(()=>clock.value=performance.now(),250);timer=taskTimer
 const task=new AbortController();controller=task
 try{const result:any=await teamDps(input,artifacts,{mode,signal:task.signal,onProgress:(p:any)=>{if(controller===task)progress.value=p}});if(task.signal.aborted||controller!==task)return;resultContext.value=snapshot;output.value=result;sortMetric.value=input.team_dps.metric;await selectResult(0);ElMessage.success(`计算成功，计算时间${duration(performance.now()-started.value)}`)}
 catch(e:any){if(e.name==='AbortError'){if(controller===task)ElMessage.info('计算已取消')}else{console.error(e);if(controller===task)error.value=e.message}}
 finally{clearInterval(taskTimer);if(controller===task){busy.value=false;controller=null;timer=null}}
}
function exportDebug(){const blob=new Blob([JSON.stringify({input:lastInput,result_input:resultContext.value?.input,result:output.value,error:error.value},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='team-dps-debug.json';a.click();URL.revokeObjectURL(url)}
for(let r=0;r<4;r++){
 watch(()=>names.value[r],()=>{if(!restoringTask&&presetStore.presets.value[names.value[r]]?.item)loadPreset(r)},{flush:'sync'});
 watch(()=>presetStore.presets.value[names.value[r]]?.item,(item:any)=>{if(item&&!restoringTask&&!taskRestored)loadPreset(r)},{deep:true,flush:'sync'});
}
watch(()=>[mys.selectedUid.value,presetStore.allFlat.value.map(p=>p.name),mys.data.value.entries],autoLoad,{immediate:true,deep:true})
watch([...Object.values(taskFields),output,resultContext],saveTask,{deep:true,flush:'post'})
watch(()=>accountStore.currentAccountId.value,()=>{clearResults();names.value=['','','',''];members.value=roles.map(fresh);weaponConditions.value=roles.map(()=>defaultWeaponOptions());widsithMode.value=roles.map(()=>'average');loadedUid=null})
const stop=()=>{controller?.abort();detailController?.abort();if(timer)clearInterval(timer);saveTask()}
onBeforeUnmount(stop)
onDeactivated(stop)
</script>
<style scoped>
.team-dps{display:flex;flex-direction:column;gap:14px;padding:0 0 10px;font-variant-numeric:tabular-nums}
.dps-card{background:#fff;border:1px solid #e2e7ef;border-radius:14px;padding:18px;min-width:0;box-shadow:0 8px 24px #24395708}
.card-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.card-heading h3{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:650;margin:0;letter-spacing:.02em}.card-heading h3 svg{color:#568de0;width:22px;height:22px}
.general-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 22px}.setting-field{min-width:0}.setting-field>label{display:flex;align-items:center;flex-wrap:wrap;gap:9px;color:#5d6b81;font-size:16px;font-weight:600;margin-bottom:7px}.setting-field .el-select,.setting-field .el-input-number{width:100%}.setting-field :deep(.el-input__wrapper){min-height:36px}.setting-field :deep(.el-input__inner){text-align:center;font-size:20px;font-weight:650}.setting-field .el-slider{margin-top:2px;height:22px}.role-chip{font-size:13px;color:#3d8d87;border:1px solid #b7dad6;background:#eff9f7;padding:1px 7px;border-radius:20px;font-weight:500}
.team-workspace{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start}.team-editor{display:flex;flex-direction:column;gap:14px;min-width:0}.axis-duration{color:#438e96;font-weight:650;font-size:20px}.team-roster{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.roster-member{display:flex;align-items:center;flex-direction:column;gap:5px;background:transparent;color:#748096;border:1px solid transparent;border-radius:12px;padding:8px 4px;cursor:pointer;font:inherit;transition:background .15s,border-color .15s}.roster-member img{width:80px;height:80px;object-fit:cover;border-radius:50%;background:#f0f4f9;border:2px solid #d7e0ed}.roster-member strong{font-size:17px;white-space:nowrap}.roster-member>span{font-size:14px;color:#758298}.roster-member:hover{background:#f4f7fb}.roster-member.active{background:#eef5ff;border-color:#b5ceee;color:#335b91}.roster-member.active img{border-color:var(--role-accent);box-shadow:0 0 17px color-mix(in srgb,var(--role-accent) 28%,transparent)}
.constellation-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}.constellation-line>span{font-size:16px;color:#748096;margin-right:4px}.constellation-line button{width:38px;height:38px;border:1px solid #dce3ed;background:#f7f9fc;border-radius:50%;color:#79879a;font-weight:650;cursor:pointer;font-size:16px}.constellation-line button.active{border-color:#91c8c8;background:#edf8f7;color:#387f82;box-shadow:0 0 10px #70bdb522}.constellation-line button:disabled{cursor:default;opacity:.65}.member .card-heading{margin-bottom:12px}.member .el-select{width:100%}.member :deep(.el-form-item){margin-bottom:12px}.member form>:last-child{margin-bottom:0}.equipment-grid{display:grid;grid-template-columns:minmax(0,1fr) 96px 120px;gap:10px}.weapon-choice{display:flex;align-items:center;gap:10px;width:100%}.weapon-choice>img{width:48px;height:48px;object-fit:contain;background:#f3f6fb;border-radius:8px}.weapon-choice .el-select{flex:1;min-width:0}
.character-panel{position:sticky;top:12px;padding-bottom:18px}.panel-identity{display:flex;align-items:center;gap:12px;margin:12px 0}.panel-identity>img{height:76px;width:76px;object-fit:cover;border-radius:50%;background:#f3f6fb;border:2px solid #acd8d5}.panel-identity h3{margin:0 0 7px;font-size:22px}.panel-badges{display:flex;gap:6px;flex-wrap:wrap}.panel-badges span{border-radius:14px;background:#f4f6fa;border:1px solid #e2e7ef;padding:2px 7px;font-size:14px;color:#6f7d92}.panel-stats{margin:0}.panel-stats>div{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 5px;border-bottom:1px solid #edf0f5;font-size:16px}.panel-stats>div:nth-child(even){background:#f8fafd}.panel-stats dt{color:#5d6d85}.panel-stats dd{margin:0;font-size:19px;font-weight:650;color:#303e54}.panel-weapon{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:16px;color:#697e9c}.panel-weapon img{width:42px;height:42px;object-fit:contain}.panel-empty{min-height:64px;display:flex;align-items:center;justify-content:center;color:#9ca8ba;font-size:15px}
.controls{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.controls label{display:flex;align-items:center;gap:8px}.optimization-fields{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.optimization-fields>label{display:flex;flex-direction:column;align-items:stretch;font-size:16px;color:#6b7a91;gap:7px}.optimization-fields .el-select,.optimization-fields .el-input-number{width:100%}.actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid #e9edf3}.actions>.el-button{margin:0;height:40px;padding:0 24px}.actions>.el-checkbox{margin-left:auto;margin-right:0}
.summary{display:flex;align-items:baseline;gap:28px;flex-wrap:wrap;margin:16px 0}.summary>div{display:flex;align-items:baseline;gap:12px}.summary span{font-size:16px;color:#67758a}.summary strong{font-size:clamp(32px,3.4vw,44px);font-weight:700;letter-spacing:-.025em}.metric-total strong{color:#e76d76}.metric-dps strong{color:#568ddd}.metric-time strong{color:#4a9f9e}.metric-time strong small{font-size:20px;margin-left:3px}.result-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.metric-switch{display:flex;padding:4px;gap:3px;border:1px solid #d6e3f4;border-radius:24px;background:#f6f9fd}.metric-switch button{padding:8px 14px;border:0;background:transparent;color:#7b8ba2;border-radius:20px;font-size:16px;cursor:pointer}.metric-switch button.active{background:#e4efff;color:#4275b8;font-weight:650}.selection{display:flex;align-items:center;gap:10px;color:#7a8aa0;font-size:15px}.selection .el-input-number{width:130px}.result-meta{display:flex;gap:16px;flex-wrap:wrap;color:#718098;font-size:14px;margin:12px 0}
.contribution-row{display:grid;grid-template-columns:140px minmax(0,1fr) minmax(200px,25%);align-items:center;gap:16px;border-top:1px solid #e9edf3;padding:12px 0}.contribution-person{display:flex;align-items:center;gap:8px;background:transparent;border:0;padding:0;color:#4c5d76;font:inherit;font-size:16px;cursor:pointer}.contribution-person img{height:44px;width:44px;border:1px solid #c1d2e7;border-radius:50%;background:#f2f6fc}.contribution-damage{display:flex;flex-direction:column;gap:6px}.contribution-track{height:11px;border-radius:8px;background:#edf1f6;overflow:hidden}.contribution-track>span{display:block;height:100%;border-radius:8px}.contribution-damage strong{font-size:20px;color:#35445d;font-weight:650}.contribution-damage small{font-size:14px;color:#7f8ba0;font-weight:400}.contribution-equipment{display:flex;flex-direction:column;gap:3px;font-size:14px;line-height:1.45;color:#677d9e}.contribution-equipment>span:last-child{color:#7386a0}
.result-member{margin:14px 0 0;padding-top:14px;border-top:1px solid #e2e7ef}.result-member h3{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 8px;font-size:19px}.damage{font-size:14px;font-weight:400;color:#6f8098}.build-panel{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0 10px;color:#5e85b9;font-size:15px}.gear{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.detail-card{padding:2px 18px}.detail-card :deep(.el-collapse-item__header){height:46px}.detail-card :deep(.el-collapse-item__wrap){border-bottom:0}.hit-table :deep(.el-table__row){cursor:pointer}.health-values{display:block;white-space:nowrap}.health-ratio{color:#8395b0;display:block;margin-top:4px;font-size:14px}.member-settings .el-select{width:100%}
.sort-bar{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:12px;color:#7588a3;font-size:16px}.sort-bar label{display:flex;gap:12px;align-items:center}.sort-bar .el-select{width:170px}.result-list{max-height:65vh;overflow-y:auto}.team-row{padding:16px;border:1px solid #e0e7f1;border-radius:13px;margin-bottom:10px;cursor:pointer;background:#ffffff}.team-row>span{margin-left:14px;font-size:15px;color:#7187a7}.team-row>strong{color:#3c567c}.team-row.chosen{border-color:#a6c7ee;background:#f2f7ff}.row-member{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0;font-size:14px;color:#8194af}.row-member>b{min-width:70px;color:#526f96}.team-row:focus,.roster-member:focus-visible,.constellation-line button:focus-visible,.metric-switch button:focus-visible{outline:2px solid #8bb6ed;outline-offset:3px}
@media(max-width:1200px){.team-workspace{grid-template-columns:minmax(0,1fr) 300px}.dps-card{padding:16px}.equipment-grid{grid-template-columns:minmax(0,1fr) 90px}.weapon-field{grid-column:1/-1}.optimization-fields{grid-template-columns:repeat(3,minmax(0,1fr))}.gear{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}.roster-member img{width:68px;height:68px}.roster-member strong{font-size:16px}.contribution-row{grid-template-columns:130px minmax(0,1fr) 200px}}
@media(max-width:850px){.team-workspace{grid-template-columns:1fr}.character-panel{position:static}.panel-stats{display:grid;grid-template-columns:1fr 1fr;column-gap:20px}.general-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.panel-empty{min-height:40px}.panel-identity{margin:10px 0}.equipment-grid{grid-template-columns:minmax(0,1fr) 100px 130px}.weapon-field{grid-column:auto}.roster-member img{width:76px;height:76px}.contribution-row{grid-template-columns:130px minmax(0,1fr)}.contribution-equipment{grid-column:2}.summary{gap:20px}}
@media(max-width:550px){.team-dps{gap:10px}.dps-card{padding:14px;border-radius:12px}.general-grid{gap:12px}.setting-field>label{font-size:14px}.role-chip{font-size:12px;padding:1px 5px}.roster-member{padding:7px 2px}.roster-member img{width:56px;height:56px}.roster-member strong{font-size:14px}.team-roster{gap:4px}.equipment-grid{grid-template-columns:1fr 1fr}.weapon-field{grid-column:1/-1}.optimization-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.actions>.el-button{padding:0 13px}.actions>.el-checkbox{margin-left:0}.gear{grid-template-columns:1fr}.panel-stats{grid-template-columns:1fr}.card-heading h3{font-size:18px}.constellation-line{gap:7px}.constellation-line>span{width:100%}.constellation-line button{width:34px;height:34px}.metric-switch button{padding:7px 10px;font-size:14px}.contribution-row{grid-template-columns:108px minmax(0,1fr);gap:10px}.contribution-person{gap:6px;font-size:14px}.contribution-person img{width:34px;height:34px}.contribution-damage strong{font-size:17px}.summary strong{font-size:30px}.summary{gap:14px}.team-row>span{display:block;margin:8px 0}.sort-bar{align-items:flex-start}}
</style>

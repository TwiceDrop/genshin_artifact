<template>
    <div class="calculator-page" :class="[`mobile-section-${mobileCalcTab}`, {'review-mode':!editorOpen,'has-candidates':optimizationResults.length>1}]">
        <el-dialog v-model="showOptimizationProgress" :title="optimizationRunning ? '计算进度' : optimizationCancelled ? '计算已取消' : '计算成功'" width="min(520px, 94vw)" :close-on-click-modal="false" :close-on-press-escape="!optimizationRunning" :show-close="!optimizationRunning" class="optimization-progress-dialog">
            <el-progress :percentage="Math.round((optimizationProgress.percent ?? 0) * 10) / 10" :indeterminate="optimizationProgress.percent === null" :status="optimizationRunning ? undefined : optimizationCancelled ? 'warning' : 'success'" />
            <div class="optimization-progress-stats">
                <p v-if="useNewScore && dynamicScoreState.running" role="status">评分 <b>{{ dynamicScoreState.status }}</b></p>
                <p v-if="useNewScore && dynamicScoreState.error" class="score-error" role="alert">评分失败：{{ dynamicScoreState.error }}</p>
                <p>候选搭配空间上限 <b>{{ numberOfGroups(optimizationProgress.candidateSpace) }} 组</b></p>
                <p>已计算 <b>{{ numberOfGroups(optimizationProgress.evaluated) }} 次</b></p>
                <p>剩余搜索分组上限 <b>{{ numberOfGroups(optimizationProgress.remainingGroups) }} 组</b></p>
                <p v-if="optimizationStage">搜索阶段 <b>{{ optimizationStage }}</b></p>
                <p v-if="optimizationRunning">{{ optimizationProgress.etaScope === 'total' ? '预计剩余时间' : '本阶段预计剩余时间' }} <b>{{ formatComputeTime(optimizationRemaining) }}</b></p>
                <p>{{ optimizationRunning || optimizationCancelled ? '已用时间' : '计算时间' }} <b>{{ formatComputeTime(optimizationElapsed) }}</b></p>
            </div>
            <template #footer>
                <template v-if="optimizationRunning">
                    <el-button @click="backgroundOptimization">后台计算</el-button>
                    <el-button type="danger" plain @click="cancelOptimization">取消计算</el-button>
                </template>
                <template v-else>
                    <el-button @click="showOptimizationProgress=false">确定</el-button>
                    <el-button v-if="!optimizationCancelled && optimizationResults.length" type="primary"
                        @click="showOptimizationProgress=false; showOptimizationResults=true">查看搭配</el-button>
                </template>
            </template>
        </el-dialog>
        <optimization-results-dialog v-if="showOptimizationResults && !panelResultSnapshot" v-model="showOptimizationResults" :results="optimizationResults" :input="reviewCandidateInput" :infusion="fumo" :mona="mona" :get-artifact="getResultArtifact" :selected-index="reviewIndex"
            :charge-min="resultSearchInput?.constraint?.recharge_min" :objective-label="resultObjectiveLabel" :objective-before="reviewDsl?.before"
            :baseline-analysis="comparisonDamage.value" :baseline-label="reviewBaselineLabel" :skill-label="reviewSkill" @select="applyReviewCandidate" />
        <panel-results-dialog v-if="showOptimizationResults && panelResultSnapshot" v-model="showOptimizationResults" :results="optimizationResults" :snapshot="panelResultSnapshot" :selected-index="optimizationResultIndex" @select="applyReviewCandidate" />
        <artifact-score-dialog v-if="showArtifactScore" v-model="showArtifactScore"
            :item="artifactItems[scoreArtifactIndex]" :context="artifactScoreContext" :equipped="artifactItems" :dynamic-result="useNewScore ? dynamicScore : null" @dynamic="showArtifactScore=false;openDynamicScore()"
            @replace="replaceScoredArtifact" />
        <el-dialog
            :title="t('calcPage.selectArt')"
            :width="deviceIsPC ? '80%' : '90%'"
            v-model="showSelectArtifactDialog"
        >
            <select-artifact
                :position="selectArtifactSlot"
                @select="handleSelectArtifact"
            ></select-artifact>
        </el-dialog>

<!--        damage analysis-->
        <el-dialog
            v-model="showDamageAnalysisDialog"
            :title="t('calcPage.dmgComp')"
            :width="deviceIsPC ? '90%' : '96%'"
        >
            <damage-analysis
                ref="damageAnalysisComponent"
                :enemy-config="enemyConfig"
                :character-level="characterLevelNumber"
                :character-name="characterName"
            ></damage-analysis>
        </el-dialog>

<!--    select buff    -->
        <el-dialog
            v-model="showSelectBuffDialog"
            :title="t('calcPage.selectBuff')"
            :width="deviceIsPC ? '60%' : '90%'"
        >
            <select-buff
                v-if="showSelectBuffDialog"
                :preferred-uid="comparisonEntry?.uid || miyousheStore.selectedUid.value"
                :selected-names="buffs.map(b => b.name)"
                @select="handleSelectBuff"
            ></select-buff>
        </el-dialog>

<!--    computation setup    -->
        <el-dialog
            v-model="showConstraintDialog"
            :title="t('calcPage.setupCalc')"
            :width="deviceIsPC ? '400px' : '90%'"
        >
            <template v-if="optimizationMode === 'damage'">
            <p class="common-title2">
                {{ t("misc.algo") }}
                <el-tooltip>
                    <i-fa6-solid-circle-question></i-fa6-solid-circle-question>
                    <template #content>
                        <span v-html="t('calcPage.algoDesc')">

                        </span>
<!--                        {{ t("calcPage.algoDesc") }}-->
                    </template>
                </el-tooltip>
            </p>
            <el-alert
                v-if="algorithm === 'Naive'"
                :title="t('calcPage.plzSetConst')"
                type="warning"
                style="margin-bottom: 12px"
            ></el-alert>
            <el-radio-group v-model="algorithm">
                <el-radio label="AStar">{{ t("calcPage.aStar") }}</el-radio>
<!--                <el-radio label="Heuristic">{{t("calcPage.heuristic")}}</el-radio>-->
                <el-radio label="Naive">{{ t("calcPage.naive") }}</el-radio>
            </el-radio-group>
            </template>
            <p class="common-title2">{{ t("calcPage.constSet") }}</p>
            <div style="margin-top: 12px; margin-bottom: 12px">
                <select-artifact-set
                    multiple
                    v-model="constraintArtifactSet"
                    :style="{ width: '100%' }"
                    :placeholder="t('calcPage.constSet')"
                ></select-artifact-set>
            </div>

            <p class="common-title2">{{ t("calcPage.constMain") }}</p>
            <div style="margin-top: 12px; margin-bottom: 12px">
                <div class="constraint-main-stat-item">
                    <span>{{ t("misc.sand") }}</span>
                    <select-artifact-main-stat
                        v-model="constraintSandMainStats"
                        :include-any="false"
                        :multiple="true"
                        position="sand"
                        :style="{ width: 'calc(100% - 48px)' }"
                        :placeholder="t('calcPage.constMain')"
                    ></select-artifact-main-stat>
                </div>
                <div class="constraint-main-stat-item">
                    <span>{{ t("misc.cup") }}</span>
                    <select-artifact-main-stat
                        v-model="constraintGobletMainStats"
                        :include-any="false"
                        :multiple="true"
                        position="cup"
                        :style="{ width: 'calc(100% - 48px)' }"
                        :placeholder="t('calcPage.constMain')"
                    ></select-artifact-main-stat>
                </div>
                <div class="constraint-main-stat-item">
                    <span>{{ t("misc.head") }}</span>
                    <select-artifact-main-stat
                        v-model="constraintHeadMainStats"
                        :include-any="false"
                        :multiple="true"
                        position="head"
                        :style="{ width: 'calc(100% - 48px)' }"
                        :placeholder="t('calcPage.constMain')"
                    ></select-artifact-main-stat>
                </div>
            </div>

            <template v-if="optimizationMode === 'damage'">
            <p class="constraint-title">{{ t("calcPage.constMin") }}</p>
            <div>
                <div class="constraint-min-item">
                    <span class="constraint-min-title">{{ t("stat.recharge") }}</span>
                    <div class="slider-div">
                        <el-slider
                            :min="1"
                            :max="4"
                            :step="0.05"
                            v-model="constraintMinRecharge"
                            :show-input="deviceIsPC"
                        ></el-slider>
                    </div>
                </div>
                <div class="constraint-min-item">
                    <span class="constraint-min-title">{{ t("stat.elementalMastery") }}</span>
                    <div class="slider-div">
                        <el-slider
                            :min="0"
                            :max="2000"
                            :step="10"
                            v-model="constraintMinElementalMastery"
                            :show-input="deviceIsPC"
                        ></el-slider>
                    </div>
                </div>
                <div class="constraint-min-item">
                    <span class="constraint-min-title">{{ t("stat.critical") }}</span>
                    <div class="slider-div">
                        <el-slider
                            :min="0"
                            :max="1"
                            :step="0.01"
                            v-model="constraintMinCritical"
                            :show-input="deviceIsPC"
                        ></el-slider>
                    </div>
                </div>
                <div class="constraint-min-item">
                    <span class="constraint-min-title">{{ t("stat.criticalDamage") }}</span>
                    <div class="slider-div">
                        <el-slider
                            :min="0"
                            :max="4"
                            :step="0.1"
                            v-model="constraintMinCriticalDamage"
                            :show-input="deviceIsPC"
                        ></el-slider>
                    </div>
                </div>
            </div>

            </template>
            <p class="common-title2">{{ t("calcPage.filKumi") }}</p>
            <el-input v-model="filterKumiSearch" :placeholder="t('misc.search')" clearable class="filter-kumi-search" />
            <div style="max-height: 50vh; overflow: auto" class="mona-scroll">
                <el-tree
                    :data="filterKumiTreeData"
                    node-key="id"
                    :default-checked-keys="filteredKumiIds"
                    :filter-node-method="filterKumiNode"
                    show-checkbox
                    ref="filterKumiRef"
                    @check="handleFilterKumiCheck"
                >
                    <template #default="{ data }">
                        <span class="filter-kumi-node">
                            <img v-for="character in data.characters" :key="character.name"
                                :src="character.avatar" :alt="character.label" />
                            <span>{{ data.label }}</span>
                        </span>
                    </template>
                </el-tree>
            </div>
        </el-dialog>

<!--    artifacts analysis    -->
        <el-dialog
            v-model="showArtifactAnalysisDialog"
            :title="t('calcPage.artAnalysis')"
            :width="deviceIsPC ? '60%' : '90%'"
        >
            <artifacts-set-statistics
                :artifact-ids="artifactIds"
            ></artifacts-set-statistics>
        </el-dialog>

<!--    stats marginal bonus    -->
        <el-dialog v-model="showOptimalGainCurve" title="最优词条收益曲线" :width="deviceIsPC ? '85%' : '96%'" destroy-on-close>
            <optimal-stat-gain-curve v-if="showOptimalGainCurve"
                :input="damageAnalysisWasmInterface" :analysis="characterDamageAnalysis" :fumo="fumo" :account-id="accountStore.currentAccountId.value" />
        </el-dialog>
        <el-dialog
            v-model="showArtifactPerBonusDialog"
            :title="t('calcPage.statCurve')"
            :width="deviceIsPC ? '80%' : '90%'"
        >
            <artifact-per-stat-bonus
                :data="miscPerStatBonus"
            ></artifact-per-stat-bonus>
        </el-dialog>

<!--        new artifact kumi-->
        <save-as-kumi
            v-model="showSaveKumiDialog"
            :default-name="kumiDefaultName"
            @confirm="handleSaveAsKumi"
        ></save-as-kumi>

<!--    select artifact kumi    -->
        <el-dialog
            v-model="showUseKumiDialog"
            :title="t('calcPage.selectKumi')"
            :width="deviceIsPC ? '60%' : '90%'"
        >
            <div style="height: 60vh" class="mona-scroll">
                <el-tree
                    :data="kumiTreeDataForElementUI"
                    @node-click="handleUseKumi"
                ></el-tree>
            </div>

        </el-dialog>

<!--        enemy config-->
        <el-dialog
            v-model="showEnemyConfigDialog"
            :title="t('calcPage.setupEnemy')"
            :width="deviceIsPC ? '60%' : '90%'"
        >
            <div class="enemy-infusion">
                <h3 class="common-title2">{{ t("calcPage.fumo") }}</h3>
                <select-element-type
                    v-model="fumo"
                    :aria-label="t('calcPage.fumo')"
                    :elements="['Pyro', 'Electro', 'Hydro', 'Anemo', 'Geo', 'Cryo', 'Dendro', 'None']"
                />
            </div>
            <enemy-config-component
                v-model="enemyConfig"
            ></enemy-config-component>
        </el-dialog>

<!--        artifact config-->
        <el-dialog
            v-model="showConfigArtifactDialog"
            :title="t('calcPage.setupArt')"
            :width="deviceIsPC ? '60%' : '90%'"
        >
            <template v-if="optimizationMode === 'damage'">
            <h3 class="common-title2">{{ t("calcPage.artMode") }}</h3>
            <el-radio-group
                v-model="artifactEffectMode"
            >
                <el-radio label="auto">{{ t("calcPage.modeAuto") }}</el-radio>
                <el-radio label="custom">{{ t("calcPage.modeCustom") }}</el-radio>
            </el-radio-group>
            </template>

            <h3 class="common-title2">{{ t("calcPage.artEffect") }}</h3>
            <artifact-config
                v-model="artifactConfig"
            ></artifact-config>
        </el-dialog>

        <el-dialog v-model="showMiyousheImport" title="导入我的角色" :width="deviceIsPC ? 'min(1000px, 94vw)' : '96%'" destroy-on-close>
            <miyoushe-import v-if="showMiyousheImport" @apply="name => { usePreset(name); showMiyousheImport = false }" />
        </el-dialog>
        <el-dialog v-model="showMyCharacters" title="米游社 · 选择角色" :width="deviceIsPC ? 'min(1000px, 94vw)' : '96%'" destroy-on-close>
            <miyoushe-character-picker v-if="showMyCharacters" @apply="name => { usePreset(name); showMyCharacters = false }" />
        </el-dialog>
        <el-alert v-if="betaCalculationError" type="error" :closable="false" show-icon :title="betaCalculationError" style="margin-bottom:16px" />
        <div class="calc-content" data-theme="mist">
            <div class="calc-command">
            <header class="calc-toolbar">
                <h2><i-ep-data-analysis aria-hidden="true"/>单次计算</h2>
                <div class="preset-actions">
                    <el-dropdown
                        trigger="click"
                        @command="handleCommandPreset"
                        @click="handleSavePreset(miscCurrentPresetName)"
                        split-button
                    >
                        <template v-if="!miscCurrentPresetName">{{ t("calcPage.newPreset") }}</template>
                        <template v-else>{{ t("calcPage.savePreset") }}「{{ miscCurrentPresetName }}」</template>

                        <template #dropdown>
                            <div class="preset-menu">
                                <div class="preset-menu-filters">
                                    <el-select v-model="presetElement" :teleported="false" aria-label="筛选预设元素">
                                        <el-option label="全部元素" value="" />
                                        <el-option v-for="element in presetElements" :key="element" :value="element" :label="t('ele', element)" />
                                    </el-select>
                                    <el-select v-model="presetSort" :teleported="false" aria-label="预设排序">
                                        <el-option label="最近更新" value="recent" />
                                        <el-option label="元素属性" value="element" />
                                    </el-select>
                                </div>
                            <el-dropdown-menu class="preset-menu-list">
                                <el-dropdown-item
                                    v-if="miscCurrentPresetName"
                                    icon="el-icon-s-tools"
                                    command="save-preset"
                                >{{ t("calcPage.saveAsPreset") }}</el-dropdown-item>

                                <el-dropdown-item
                                    v-for="(item, index) in presetMenuEntries"
                                    :divided="index === 0 && !!miscCurrentPresetName"
                                    :key="item.name"
                                    :icon="IconEpMenu"
                                    :command="'apply-' + item.name"
                                >{{ item.name }}</el-dropdown-item>
                            </el-dropdown-menu>
                            </div>
                        </template>
                    </el-dropdown>
                </div>
            </header>
            <div class="calc-action-bar">
                <nav class="calc-jumps" aria-label="计算器分区">
                    <button v-for="entry in sectionLinks" :key="entry[0]" type="button" @click="jumpToSection(entry[0])">{{ entry[1] }}</button>
                </nav>
                <nav class="calc-mobile-tabs" aria-label="计算器分区">
                    <button aria-label="角色与配置" :aria-pressed="mobileCalcTab === 'character'" @click="activateTab('character')">角色<span>与</span><b class="tab-tail">配置</b></button>
                    <button aria-label="圣遗物与伤害" :aria-pressed="mobileCalcTab === 'equipment'" @click="activateTab('equipment')"><span>圣遗物与</span><span class="compact-name">装备</span><b class="tab-tail">伤害</b></button>
                    <button aria-label="面板与曲线" :aria-pressed="mobileCalcTab === 'panel'" @click="activateTab('panel')">面板<span>与</span><b class="tab-tail">曲线</b></button>
                </nav>
                <button ref="targetTrigger" type="button" class="target-trigger" :aria-label="t('misc.tf')"
                    :aria-expanded="targetMenuOpen" aria-haspopup="dialog" aria-controls="calc-target-menu"
                    @click="targetMenuOpen ? closeTargetMenu() : openTargetMenu()">
                    <span class="target-label">{{ t('misc.tf') }}</span><span class="target-compact" aria-hidden="true">目标</span><i-ep-arrow-down aria-hidden="true"/>
                </button>
                <section v-show="targetMenuOpen" id="calc-target-menu" ref="targetMenu"
                    class="calc-card config-target-function target-menu" role="dialog" aria-labelledby="calc-target-title"
                    @keydown.esc="dismissTargetWithEscape">
                    <header class="target-menu-head">
                        <h3 id="calc-target-title" ref="targetTitle" tabindex="-1">{{ t("misc.tf") }}</h3>
                        <button type="button" aria-label="关闭目标函数" @click="closeTargetMenu(true)"><i-ep-close aria-hidden="true"/></button>
                    </header>
                    <el-radio-group v-model="optimizationMode" aria-label="配装模式">
                        <el-radio-button label="damage">伤害配装</el-radio-button>
                        <el-radio-button label="panel">面板配装</el-radio-button>
                    </el-radio-group>
                    <panel-search-config v-if="optimizationMode === 'panel'" v-model="panelSearchOptions" />
                    <el-tabs v-else v-model="miscTargetFunctionTab">
                        <el-tab-pane :label="t('calcPage.tfNormal')" name="normal">
                            <select-target-function
                                v-model="targetFunctionName"
                                :character-name="characterName"
                            ></select-target-function>
                            <div class="target-function-config" v-if="targetFunctionNeedConfig"
                                 style="margin-top: 12px"
                            >
                                <item-config
                                    v-model="targetFunctionConfig"
                                    :item-name="targetFunctionName"
                                    :configs="targetFunctionConfigConfig"
                                ></item-config>
                            </div>

                            <div v-if="targetFunctionDescription" class="target-function-detail">
                                <div class="detail-left">
                                    <img :src="targetFunctionBadge" />
                                </div>
                                <div class="detail-right">
                                    <p
                                        class="target-function-description"
                                        v-html="targetFunctionDescription"
                                    ></p>
                                </div>
                            </div>
                        </el-tab-pane>
                        <el-tab-pane label="MONA-DSL" name="dsl">
                            <el-alert type="warning" :title="t('calcPage.beta')" :closable="false" style="margin-bottom: 8px"></el-alert>
                            <el-input type="textarea" :rows="10" :placeholder="t('misc.code')" v-model="targetFunctionDSLSource" class="code-input"></el-input>
                        </el-tab-pane>
                        <el-tab-pane label="DSL 生成器" name="generator"><dsl-generator v-model="dslGeneratorState" :input="damageAnalysisWasmInterface" :mona="mona" /></el-tab-pane>
                    </el-tabs>


                    <div v-if="optimizationResults.length > 0"
                        style="margin-top: 12px"
                    >
                        <el-alert
                            :title="`保留${optimizationResults.length}组圣遗物搭配`"
                            type="success"
                            style="margin-bottom: 12px"
                        ></el-alert>
                        <el-button @click="closeTargetMenu(); showOptimizationResults=true" style="margin-bottom:12px" class="view-optimization-results">点开查看所有搭配</el-button>
                        <el-input-number
                            :model-value="optimizationResultIndex"
                            @update:modelValue="handleUseNthOptimizationResult"
                            :min="1"
                            :max="optimizationResults.length"
                            style="width: 100%"
                        ></el-input-number>
                        <value-display
                            v-if="!panelResultSnapshot"
                            :value="optimizationResults[optimizationResultIndex - 1].ratio"
                            :extra="optimizationResults[optimizationResultIndex - 1].value.toFixed(1)"
                            style="margin-top: 12px"
                        ></value-display>
                    </div>
                    <div class="optimization-debug-control">
                        <el-switch v-model="optimizationDebugEnabled" active-text="Debug 模式" aria-label="Debug 模式" />
                        <el-button size="small" :disabled="!optimizationDebugRecord" @click="exportOptimizationDebug">导出调试包</el-button>
                        <span v-if="optimizationDebugRecord"> {{ optimizationDebugRecord.status === 'failed' ? '计算失败' : optimizationDebugRecord.status === 'completed' ? '计算完成' : optimizationDebugRecord.status === 'cancelled' ? '计算已取消' : '记录中' }} · 候选 {{ optimizationDebugRecord.summary?.candidateCount ?? 0 }} 件</span>
                        <el-alert v-if="optimizationError" type="error" :closable="false" title="配装计算未完成" :description="optimizationError" show-icon />
                        <details v-if="optimizationDebugRecord?.events.length"><summary>查看调试阶段与错误详情</summary><pre>{{ optimizationDebugDetail }}</pre></details>
                    </div>

                    <div class="artifact-borrowing-control">
                        <label><span>是否允许替换其他角色已穿戴的圣遗物</span><el-switch v-model="allowBorrowEquipped" aria-label="是否允许替换其他角色已穿戴的圣遗物" /></label>
                    </div>
                    <div class="optimization-actions">
                        <el-button-group>

                            <el-button
                                :icon="IconEpTools"
                                @click="closeTargetMenu(); handleClickSetupOptimization()"
                            >{{ t("calcPage.setupCalc") }}</el-button>

                            <el-button
                                :icon="IconEpTools"
                                @click="closeTargetMenu(); handleClickArtifactConfig()"
                            >{{ t("calcPage.setupArt") }}</el-button>
                        </el-button-group>
                    </div>
                </section>
                <el-button class="calc-run" type="primary" :icon="IconEpCaretRight" :loading="optimizationRunning || dynamicScoreState.running"
                    @click="closeTargetMenu(); handleOptimizeArtifact()">{{ optimizationRunning || dynamicScoreState.running ? '计算中' : t('calcPage.start') }}</el-button>
            </div>
            </div>
            <single-result-workbench v-if="!editorOpen" :character="characterLocale" :skill="reviewSkill"
                :items="artifactItems" :baseline="comparisonBaseline" :changes="artifactChanges" :baseline-label="reviewBaselineLabel"
                :analysis="characterDamageAnalysis" :previous="comparisonDamage.value" :panel-data="attributeFromWasm"
                :count="optimizationResults.length" :index="reviewIndex" :dsl="reviewDsl" :metric-error="comparisonDamage.error"
                :recharge-min="optimizationMode==='damage'?constraintMinRecharge:0" @candidates="showOptimizationResults=true"
                :score="displayedPieceScore" :score-label="displayedScoreLabel" :total-label="displayedTotalLabel" :total="displayedScoreTotal"
                @replace="handleGotoSelectArtifact" @score="i=>{scoreArtifactIndex=i;showArtifactScore=true}"
                @analysis="handleClickArtifactAnalysis" @panel="jumpToSection('panel-card')" @details="jumpToSection('damage-card')"
                @equipment="jumpToSection('artifacts-card')" @curve="showOptimalGainCurve=true">
                <template #scoring><artifact-score-mode v-model="dynamicScoreEnabled" :disabled="optimizationRunning || dynamicScoreState.running" @settings="openScoreSettings" /></template>
                <template v-if="useNewScore" #score-basis><el-button v-if="dynamicScore" size="small" @click="openScoreBasis">评分依据</el-button><span v-else-if="dynamicScoreState.running" role="status">{{ dynamicScoreState.status }}</span><span v-else-if="dynamicScoreState.error" class="score-error" role="alert">{{ dynamicScoreState.error }}</span></template>
                <template #baseline><artifact-comparison-controls v-model:enabled="comparisonEnabled" v-model:mode="comparisonMode"
                    v-model:history-id="comparisonHistoryId" :history="comparisonHistory" @save="saveComparisonHistory" />
                    <el-alert v-if="comparisonDamage.error" :title="comparisonDamage.error" type="warning" :closable="false" />
                </template>
            </single-result-workbench>
            <dynamic-artifact-score ref="dynamicScoreController" integrated :input="dynamicScoreInput" :analysis="characterDamageAnalysis" :infusion="fumo" :constraints="constraintInterface"
                :account-id="accountStore.currentAccountId.value" :character-label="characterLocale" :weapon-label="artifactScoreContext.options.weaponName" :skill-label="reviewSkill" :selected-slot="scoreArtifactIndex"
                @state="dynamicScoreState=$event" @result="dynamicScore=$event" @close="dynamicScoreEnabled=false;dynamicScore=null" @inspect="i=>{scoreArtifactIndex=i;showArtifactScore=true}" />
            <el-button v-if="editorOpen && optimizationResults.length" class="return-to-result" @click="showResult">返回配装结果</el-button>
            <div v-show="editorOpen" ref="workspace" class="calc-workspace">
                <div class="calc-editor">
                    <section class="calc-card identity-card setup-section">
                            <header class="card-heading"><h3><i-ep-user-filled aria-hidden="true"/>角色与武器</h3>
                                <div class="card-actions"><el-button @click="showMiyousheImport = true">账号导入</el-button><el-button @click="showMyCharacters = true">我的角色</el-button></div>
                            </header>
                        <div class="identity-row">
                        <section class="config-character setup-section">
                            <div class="character-fields">
                                <div class="calc-field"><span>{{ t('misc.character') }}</span><select-character v-model="characterName" :aria-label="t('misc.character')" /></div>
                                <div class="calc-field"><span>角色等级</span><select-character-level v-model="characterLevel" aria-label="角色等级" /></div>
                            </div>
                            <fieldset class="talent-fields">
                                <legend>天赋等级</legend>
                                <div class="talent-row"><span>{{ t('skillType.a') }}</span><el-input-number v-model="characterSkill1" :label="t('skillType.a')" :min="1" :max="15" /></div>
                                <div class="talent-row"><span>{{ t('skillType.e') }}</span><el-input-number v-model="characterSkill2" :label="t('skillType.e')" :min="1" :max="15" /></div>
                                <div class="talent-row"><span>{{ t('skillType.q') }}</span><el-input-number v-model="characterSkill3" :label="t('skillType.q')" :min="1" :max="15" /></div>
                            </fieldset>
                            <div class="constellation-line" role="group" :aria-label="t('misc.conste')">
                                <span>{{ t('misc.conste') }}</span>
                                <button v-for="n in 7" :key="n" type="button" :aria-pressed="characterConstellation === n-1" @click="characterConstellation = n-1">C{{ n-1 }}</button>
                            </div>
                            <div class="character-extra-config" v-if="characterNeedConfig">
                                <item-config
                                    v-model="characterConfig"
                                    :item-name="characterName"
                                    :configs="characterConfigConfig"
                                ></item-config>
                            </div>
                        </section>
                        <section class="config-weapon setup-section">
                            <div class="weapon-fields">
                                <div class="calc-field"><span>{{ t('misc.weapon') }}</span><select-weapon :type="characterWeaponType" v-model="weaponName" :aria-label="t('misc.weapon')" /></div>
                                <div class="calc-field"><span>武器等级</span><select-weapon-level v-model="weaponLevel" aria-label="武器等级" /></div>
                                <label class="calc-field"><span>{{ t('misc.refine') }}</span><el-input-number v-model="weaponRefine" controls-position="right" :min="1" :max="weaponMaxRefine" :aria-label="t('misc.refine')" /></label>
                            </div>
                            <weapon-display :weapon-name="weaponName" />
                            <div class="weapon-extra-config" v-if="weaponNeedConfig">
                                <item-config
                                    v-model="weaponConfig"
                                    :item-name="weaponName"
                                    :configs="weaponConfigConfig"
                                ></item-config>
                            </div>
                        </section>
                        </div>
                    </section>
                        <section class="calc-card artifacts-card equipment-section">
                            <header class="card-heading"><h3><i-ep-collection aria-hidden="true"/>{{ t("misc.artifact") }}</h3>
                                <artifact-score-mode v-model="dynamicScoreEnabled" :disabled="optimizationRunning || dynamicScoreState.running" @settings="openScoreSettings" />
                                <div class="artifact-grade-summary" aria-label="角色圣遗物评分">
                                    <div v-if="useNewScore"><span>{{ artifactScoreContext.label }} · 新评分 · 单件合计</span><strong class="miao-score" :data-grade="dynamicTotalGrade">{{ displayedScoreTotal }}</strong></div>
                                    <div v-else><span>{{ artifactScoreContext.label }} · 喵喵总分</span><strong class="miao-score" :data-grade="artifactBuildScore.grade">{{ artifactBuildScore.total === null ? '—' : artifactBuildScore.total.toFixed(1) }}</strong><b class="miao-score" :data-grade="artifactBuildScore.grade">{{ artifactBuildScore.grade }}</b></div>
                                </div>
                            </header>
                            <div class="artifacts" :class="{ 'gear-empty': !artifactCount }">
                                <div
                                    v-for="(id, index) in artifactIds"
                                    :key="index"
                                    class="artifact-item-or-button"
                                >
                                    <span class="slot-name"><img :src="slotIcons[positions[index]]" alt="" />{{ t("misc", positions[index]) }}</span>
                                    <artifact-display
                                        v-if="artifactItems[index]"
                                        :item="artifactItems[index]"
                                        :locked="artifactStore.getArtifact(id)?.omit"
                                        :lock-button="!!artifactStore.getArtifact(id)"
                                        selectable
                                        :buttons="true"
                                        :delete-button="true"
                                        @delete="removeArtifact(index)"
                                        @toggle="artifactStore.toggleArtifact(artifactItems[index].id)"
                                        @click="scoreArtifactIndex = index; showArtifactScore = true"
                                        class="artifact-display"
                                    >
                                        <template #footer><div class="artifact-piece-score"><span v-if="useNewScore">新评分：<span class="miao-score" :data-grade="dynamicPieceGrade(index)">{{ displayedPieceScore(index) }}</span></span><span v-else>喵喵评分：<span class="miao-score" :data-grade="artifactPieceScore(index).split(' ').pop()">{{ artifactPieceScore(index) }}</span></span><span v-if="artifactChanges[index]" class="artifact-change-marker">{{ artifactChanges[index] }}</span></div></template>
                                    </artifact-display>
                                    <button v-else type="button" class="add-button"
                                        :aria-label="'选择圣遗物：' + t('misc', positions[index])"
                                        @click="handleGotoSelectArtifact(index)">
                                        <i-ep-plus aria-hidden="true" /><span>选择圣遗物</span>
                                    </button>
                                    <span v-if="!artifactItems[index] && artifactChanges[index]" class="artifact-change-marker">{{ artifactChanges[index] }}</span>
                                </div>
                            </div>
                            <div class="artifact-tool">
                                <el-button-group>
                                    <el-button
                                        :icon="IconEpHistogram"
                                        @click="handleClickArtifactAnalysis"
                                    >{{ t("calcPage.statAnalysis") }}</el-button>
                                    <el-button
                                        :icon="IconEpStarFilled"
                                        @click="handleClickSaveAsKumi"
                                    >{{ t("calcPage.saveKumi") }}</el-button>
                                    <el-button
                                        :icon="IconEpFolder"
                                        @click="handleClickUseKumi"
                                    >{{ t("calcPage.useKumi") }}</el-button>
                                    <el-button
                                        v-show="artifactCount > 0"
                                        :icon="isAllLocked ? IconEpUnlock : IconEpLock"
                                        @click="() => { isAllLocked ? handleUnlockAll() : handleLockAll() }"
                                    >{{ isAllLocked ? t("calcPage.unlockAll") : t("calcPage.lockAll") }}</el-button>
                                    <el-button :disabled="artifactCount === 0" @click="clearArtifacts">清空已选</el-button>
                                </el-button-group>
                                <el-button v-if="useNewScore && dynamicScore" class="score-basis-button" size="small" @click="openScoreBasis">评分依据</el-button>
                                <span v-else-if="useNewScore && dynamicScoreState.running" class="score-status" role="status">{{ dynamicScoreState.status }}</span>
                                <span v-else-if="useNewScore && dynamicScoreState.error" class="score-error" role="alert">{{ dynamicScoreState.error }}</span>
                            </div>
                            <artifact-comparison-controls v-model:enabled="comparisonEnabled" v-model:mode="comparisonMode"
                                v-model:history-id="comparisonHistoryId" :history="comparisonHistory"
                                @save="saveComparisonHistory" />
                            <div v-if="artifactNeedConfig2" style="margin-top: 16px">
                                <p class="common-description">
                                    <span class="effect2">{{ t("calcPage.effect2") }}</span>
                                    <span v-html="artifactEffect2Text"></span>
                                </p>
                                <item-config
                                    v-if="artifactSingleConfig"
                                    v-model="artifactSingleConfig"
                                    :item-name="artifactConfigItemName"
                                    :configs="artifactConfig2Configs"
                                ></item-config>
                            </div>

                            <div v-if="artifactNeedConfig4" style="margin-top: 16px">
                                <p class="common-description">
                                    <span class="effect4">{{ t("calcPage.effect4") }}</span>
                                    <span v-html="artifactEffect4Text"></span>
                                </p>
                                <item-config
                                    v-if="artifactSingleConfig"
                                    v-model="artifactSingleConfig"
                                    :item-name="artifactConfigItemName"
                                    :configs="artifactConfig4Configs"
                                ></item-config>
                            </div>
                        </section>
                        <section class="calc-card damage-card equipment-section">
                            <header class="card-heading"><h3><i-ep-data-analysis aria-hidden="true"/>{{ t("calcPage.dmg") }}</h3>
                                <div class="card-actions">
                                    <el-button-group>
                                        <el-button
                                            :icon="IconEpHistogram"
                                            @click="handleDisplayAnalysis"
                                        >{{ t("calcPage.detail") }}</el-button>
                                        <el-button
                                            :icon="IconEpTools"
                                            @click="handleClickEnemyConfig"
                                        >{{ t("calcPage.setupEnemy") }}</el-button>
                                    </el-button-group>
                                </div>
                            </header>
                            <div class="damage-skill">
                                <h3 class="common-title2">{{ t("calcPage.skill") }}</h3>
                                <select-character-skill
                                    v-model="characterSkillIndex"
                                    :character-name="characterName"
                                />
                            </div>
                            <div class="damage-analysis-div">
                                <el-alert v-if="comparisonDamage.error" :title="comparisonDamage.error" type="warning" :closable="false" />
                                <damage-panel v-if="!betaCalculationError && characterDamageAnalysis"
                                    :analysis-from-wasm="characterDamageAnalysis" :baseline="comparisonDamage.value"
                                ></damage-panel>
                            </div>
                            <div v-if="characterNeedSkillConfig" style="margin-bottom: 16px;">
                                <h3 class="common-title2">{{ t("calcPage.skillConfig") }}</h3>
                                <item-config
                                    v-model="characterSkillConfig"
                                    :item-name="characterName"
                                    :configs="characterSkillConfigConfig"
                                ></item-config>
                            </div>

                            <details class="transformative-damage" @toggle="showTransformativeDamage = ($event.target as HTMLDetailsElement).open">
                                <summary class="common-title2">{{ t("calcPage.dmg2") }}</summary>
                                <transformative-damage v-if="showTransformativeDamage && !betaCalculationError && characterTransformativeDamage"
                                    :data="characterTransformativeDamage"
                                ></transformative-damage>
                            </details>
                        </section>
                        <section class="calc-card config-buff setup-section">
                            <header class="card-heading"><h3><i-ep-magic-stick aria-hidden="true"/>BUFF</h3><el-button :icon="IconEpPlus" @click="handleClickAddBuff" title="添加BUFF">添加BUFF</el-button></header>
                            <selected-buff-groups class="buffs" :buffs="otherBuffs">
                                <template #character-controls>
                            <div class="team-context-control">
                                <h3 class="common-title2">队友来源（可选）</h3>
                                <el-select v-model="selectedTeamPresetNames" multiple filterable clearable
                                    placeholder="选择已保存的队友预设" style="width:100%">
                                    <el-option v-for="entry in availableTeamPresets" :key="entry.name"
                                        :label="`${entry.name} · ${teamCharacterLabel(entry.item.character.name)}`"
                                        :value="entry.name" />
                                </el-select>
                                <template v-if="teamContextSources.length">
                                    <div class="team-context-row">
                                        <span>受益伤害模式</span>
                                        <el-radio-group v-model="teamContextStellarMode" size="small">
                                            <el-radio-button :label="false">普通伤害</el-radio-button>
                                            <el-radio-button :label="true">星扩散</el-radio-button>
                                        </el-radio-group>
                                    </div>
                                    <div v-for="source in teamContextSources" :key="source.presetName" class="team-source-card">
                                        <strong>{{ source.presetName }} · {{ teamCharacterLabel(presetStore.presets.value[source.presetName]?.item.character.name) }}</strong>
                                        <span class="team-source-gear">{{ teamSourceGearLabel(source.presetName) }}</span>
                                        <label class="team-source-id">来源 ID
                                            <el-input v-model="source.sourceId" size="small" aria-label="BUFF 来源 ID" />
                                        </label>
                                        <el-switch v-model="source.triggers.recipientOnField" active-text="受益角色在前台" />
                                        <template v-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Vodyanitsa'">
                                            <div class="team-trigger-grid">
                                                <el-switch v-model="source.triggers.eActive" active-text="战技命中" />
                                                <el-switch v-model="source.triggers.songActive" active-text="歌声状态" />
                                                <el-switch v-model="source.triggers.a1Active" active-text="流荡风旋已触发" />
                                                <el-switch v-model="source.triggers.a4Active" active-text="领唱／重唱已触发" />
                                                <el-switch v-if="presetStore.presets.value[source.presetName]?.item.character.constellation >= 1"
                                                    v-model="source.triggers.c1Active" active-text="一命条件" />
                                                <el-switch v-if="presetStore.presets.value[source.presetName]?.item.character.constellation >= 2"
                                                    v-model="source.triggers.c2Active" active-text="二命角笛命中" />
                                            </div>
                                            <div v-if="presetStore.presets.value[source.presetName]?.item.weapon.name === 'HymnOfTheMaelstrom'" class="team-context-row">
                                                <span>专武层数</span>
                                                <el-input-number v-model="source.triggers.signatureStacks" :min="0" :max="3" size="small" />
                                                <el-switch v-model="source.triggers.signatureBoosted" active-text="强化状态" />
                                                <el-switch v-model="source.triggers.signatureOnField" active-text="专武对当前角色生效" />
                                            </div>
                                        </template>
                                        <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Vesna'">
                                            <div class="team-trigger-grid">
                                                <el-switch v-model="source.triggers.vesnaRadiance" active-text="辉映已触发" />
                                                <el-switch v-model="source.triggers.vesnaTalentActive" active-text="队友星耀祝礼已触发" />
                                            </div>
                                            <div class="team-context-row">
                                                <span>星耀祝礼平均覆盖率</span>
                                                <el-input-number v-model="source.triggers.vesnaTalentCoverage" :min="0" :max="1" :step="0.1" :precision="2" size="small" />
                                            </div>
                                        </template>
                                        <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Odette'">
                                            <div class="team-context-row">
                                                <span>奥黛塔辉映</span>
                                                <el-select v-model="source.triggers.odetteRadianceMode" size="small">
                                                    <el-option :value="0" label="未触发" /><el-option :value="1" label="星超导" /><el-option :value="2" label="星扩散" />
                                                </el-select>
                                                <el-switch v-model="source.triggers.odetteBlessing" active-text="星耀祝礼生效" />
                                            </div>
                                            <div class="team-context-row">
                                                <el-switch v-model="source.triggers.odetteSplendor" active-text="受益角色已获得华彩" />
                                                <span>受益华彩层数</span><el-input-number v-model="source.triggers.odetteStacks" :min="0" :max="presetStore.presets.value[source.presetName]?.item.character.constellation >= 1 ? 6 : 4" size="small" />
                                            </div>
                                            <el-switch v-model="source.triggers.odetteDouble" active-text="独舞倒影在场（二命）" />
                                            <el-switch v-model="source.triggers.odetteDream" active-text="雪鹄之梦已触发（四命）" />
                                        </template>
                                        <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Qiqi'">
                                            <el-switch v-model="source.triggers.qiqiTalisman" active-text="辉映·星烁：度厄真符条件已触发" />
                                            <el-switch v-model="source.triggers.qiqiC6" active-text="六命增益已触发" />
                                        </template>
                                        <template v-else-if="presetStore.presets.value[source.presetName]?.item.character.name === 'Sandrone'">
                                            <el-switch v-model="source.triggers.sandroneBlessing" active-text="星耀祝礼·星扩散已触发" />
                                            <el-switch v-model="source.triggers.sandroneC1" active-text="一命队友星扩散增益已触发" />
                                        </template>
                                    </div>
                                    <el-alert v-for="issue in teamContextResult.issues" :key="issue" type="error" :closable="false" :title="issue" />
                                </template>
                            </div>
                            <div class="polestar-field-control">
                                <el-switch v-model="polestarEnabled" active-text="启用极星辉域" />
                                <div class="polestar-field-stacks"><span>极星辉域层数</span>
                                    <!-- This Element Plus version sets aria-disabled only on mount. -->
                                    <el-input-number :key="String(polestarEnabled)" v-model="polestarStacks" :min="0" :max="12" :step="1" :precision="0" :disabled="!polestarEnabled" label="极星辉域层数" />
                                </div>
                            </div>
                                </template>
                                <template #default="{ buff }">
                                <buff-item
                                    :key="buff.id"
                                    :buff="buff"
                                    v-model:buffConfig="buff.config"
                                    @delete="handleClickDeleteBuff(buff.id)"
                                    @toggle="handleClickToggleBuff(buff.id)"
                                ></buff-item>
                                <label v-if="teamContextSources.length" class="manual-buff-source">手动 BUFF 来源
                                    <el-select v-model="buff.source_id" clearable placeholder="未关联队友" size="small">
                                        <el-option v-for="source in teamContextSources" :key="source.sourceId"
                                            :label="source.presetName" :value="source.sourceId" />
                                    </el-select>
                                </label>
                                </template>
                            </selected-buff-groups>
                        </section>
                </div>
                <aside class="calc-card panel-card">
                    <header class="panel-cover">
                        <div class="panel-identity">
                            <img class="panel-portrait" :src="scoreCharacters[characterName].avatar" alt="" />
                            <div class="panel-name">
                                <h3>{{ t("calcPage.panel") }}</h3>
                                <strong>{{ characterLocale }}</strong>
                                <div class="panel-badges"><span>Lv.{{ characterLevel }}</span><span>C{{ characterConstellation }}</span><span>R{{ weaponRefine }}</span></div>
                            </div>
                        </div>
                        <img v-if="elementIcons[scoreCharacters[characterName].element]" class="panel-seal"
                            :src="elementIcons[scoreCharacters[characterName].element]" :alt="t('ele',scoreCharacters[characterName].element)" />
                    </header>
                    <el-alert v-if="comparisonAttribute.error" :title="comparisonAttribute.error" type="warning" :closable="false" />
                    <attribute-panel v-if="!betaCalculationError"
                        :attribute="attributeFromWasm"
                        :baseline="comparisonAttribute.value"
                    ></attribute-panel>
                    <div class="panel-actions">
                        <el-button type="primary" :icon="IconEpHistogram" @click="showOptimalGainCurve = true" :disabled="!!betaCalculationError">最优收益曲线 · 0～20 条</el-button>
                        <el-button
                            :icon="IconEpHistogram"
                            @click="handleClickAttributeAnalysis"
                        >{{ t("calcPage.statCurve") }}</el-button>
                    </div>
                </aside>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import targets from '@/assets/_gen_tf'
import {dslObjective} from '@/algorithms/single-result-comparison.mjs'
import DynamicArtifactScore from '@/components/display/DynamicArtifactScore.vue'
import ArtifactScoreMode from '@/components/display/ArtifactScoreMode.vue'
import SingleResultWorkbench from './SingleResultWorkbench.vue'
import ArtifactScoreDialog from '@/components/display/ArtifactScoreDialog.vue'
import ArtifactComparisonControls from '@/components/display/ArtifactComparisonControls.vue'
import { useArtifactComparison, snapshotEquipment } from '@/composables/artifactComparison.mjs'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { createMysConverter } from '@/import/miyoushe.mjs'
import scoreCharacters from '@/assets/_gen_character'
import {characterByElement} from '@/assets/character'
import scoreWeapons from '@/assets/_gen_weapon'
import scoreLocale from '@/i18n/generated/zh-cn.json'
import { scoreBuild, scoreSetNames, panelScoreAttributes, getMarkClass } from '@/algorithms/artifact-score/score.mjs'
import {convertArtifact} from "@util/converter"
import {mergeArtifactConfig, newDefaultArtifactConfigForWasm} from "@util/artifacts"
import {deepCopy, downloadString} from "@/utils/common"
import {createOptimizationDebug} from "@/wasm/optimization-debug.mjs"
import {wasmSingleOptimize} from "@/wasm/single_optimize"
import {wasmPanelOptimize} from '@/wasm/panel_optimize'
import {newPanelSearchOptions,readPanel} from '../../../beta-data/panel-search.mjs'
import PanelSearchConfig from './PanelSearchConfig.vue'
import PanelResultsDialog from './PanelResultsDialog.vue'
import {createComputeResult} from "@/api/misc"
import {deviceIsPC} from "@util/device"
import SelectArtifact from "@/components/select/SelectArtifact.vue"
import SelectArtifactSet from "@c/select/SelectArtifactSet"
import SelectCharacter from "@/components/select/SelectCharacter.vue"
import SelectCharacterLevel from "@/components/select/SelectCharacterLevel.vue"
import SelectWeapon from "@/components/select/SelectWeapon.vue"
import SelectWeaponLevel from "@/components/select/SelectWeaponLevel.vue"
import SelectTargetFunction from "@/components/select/SelectTargetFunction.vue"
import SelectCharacterSkill from "@/components/select/SelectCharacterSkill.vue"
import SelectBuff from "@/components/select/SelectBuff.vue"
import ArtifactDisplay from "@c/display/ArtifactDisplay"
import slotIcons from "@/assets/artifacts/icons"
import elementIcons from "@/assets/element-icons"
import DamagePanel from "./DamagePanel"
import AttributePanel from "@c/display/AttributePanel"
import ItemConfig from "@c/config/ItemConfig"
import BuffItem from "./BuffItem"
import SelectedBuffGroups from '@/components/display/SelectedBuffGroups.vue'
import { otherCharacterArtifactIds, artifactGroupCharacterNames } from '@/algorithms/artifact-ownership.mjs'
import { createTeamContextSource, deriveSingleTeamContext } from '@/algorithms/single-team-context.mjs'
import WeaponDisplay from "@/components/display/WeaponDisplay.vue"
import SaveAsKumi from "./SaveAsKumi.vue"
import TransformativeDamage from "./TransformativeDamage"
import ValueDisplay from "./ValueDisplay"
import EnemyConfigComponent from "./EnemyConfig"
import SelectArtifactMainStat from "@c/select/SelectArtifactMainStat"
import ArtifactConfig from "./ArtifactConfig.vue"
import DamageAnalysis from "@/components/display/DamageAnalysis"
import {useCharacter, useCharacterSkill} from "@/composables/character"
import {useEnemy} from "@/composables/enemy"
import {useWeapon} from "@/composables/weapon"
import OptimizationResultsDialog from './OptimizationResultsDialog.vue'
import {formatComputeTime} from '@/algorithms/optimization-results.mjs'
import {remainingOptimizationTime} from '../../../beta-data/optimizer-progress.mjs'
import DslGenerator from './DslGenerator.vue'
import {generateDsl} from '@/algorithms/dsl-generator.mjs'
import {useTargetFunction} from "@/composables/targetFunction"
import type {ArtifactPosition, IArtifact, IArtifactWasm} from "@/types/artifact"
import IconEpCaretRight from "~icons/ep/caret-right"
import IconEpTools from "~icons/ep/tools"
import IconEpPlus from "~icons/ep/plus"
import IconEpMenu from "~icons/ep/menu"
import IconEpHistogram from "~icons/ep/histogram"
import IconEpStarFilled from "~icons/ep/star-filled"
import IconEpFolder from "~icons/ep/folder"
import IconEpLock from "~icons/ep/lock"
import IconEpUnlock from "~icons/ep/unlock"
import {useComputeConstraint} from "@/composables/constraint"
import {BuffEntry, useBuff} from "@/composables/buff"
import {type PresetEntry, usePresetStore} from "@/store/pinia/preset"
import {useArtifactStore} from "@/store/pinia/artifact"
import type {IPreset, ITeamContextSource} from "@/types/preset"
import {RandomIDProvider} from "@/utils/idProvider"
import {use5Artifacts} from "@/composables/artifact"
import {positions} from "@/constants/artifact"
import {positionToIndex} from "@/utils/artifacts"
import {useMona} from "@/wasm/mona"
import {useKumiStore} from "@/store/pinia/kumi"
import SimpleLoading from "@/components/loading/SimpleLoading.vue"
import SimpleError from "@/components/loading/SimpleError.vue"
import {useRoute} from "vue-router"
import {useI18n} from "@/i18n/i18n"
import {useAccountStore} from "@/store/pinia/account"
import {artifactsData} from "@/assets/artifacts"

import {ElMessage,ElMessageBox} from "element-plus"
import {buffData} from '@buff'
import {onDeactivated} from 'vue'
import {calculationHistory,calculationState} from '@/store/calculation-history'
import {historyMembers,buildIds} from '@/algorithms/calculation-history.mjs'
import "element-plus/es/components/message/style/css"
import SelectElementType from "@/components/select/SelectElementType.vue";

// stores
const presetStore = usePresetStore()
const artifactStore = useArtifactStore()
const miyousheStore = useMiyousheStore()
const MiyousheImport = defineAsyncComponent(() => import('@/components/import/MiyousheImport.vue'))
const showMiyousheImport = ref(false)
const MiyousheCharacterPicker = defineAsyncComponent(() => import('@/components/import/MiyousheCharacterPicker.vue'))
const showMyCharacters = ref(false)
const mobileCalcTab = ref('equipment')
const editorOpen = ref(true)
function showResult() { editorOpen.value=false; mobileCalcTab.value='equipment'; window.scrollTo(0,0) }
function activateTab(tab:string) { mobileCalcTab.value=tab;editorOpen.value=true;window.scrollTo(0,0) }
const targetMenuOpen = ref(false)
const targetTrigger = ref<HTMLButtonElement | null>(null)
const targetMenu = ref<HTMLElement | null>(null)
const targetTitle = ref<HTMLElement | null>(null)
function fitTargetMenu() {
    const menu = targetMenu.value
    if (menu) menu.style.setProperty('--target-top', Math.ceil(menu.getBoundingClientRect().top) + 'px')
}
async function openTargetMenu() {
    targetMenuOpen.value = true
    await nextTick()
    fitTargetMenu()
    targetMenu.value?.scrollTo(0, 0)
    targetTitle.value?.focus({ preventScroll: true })
}
function closeTargetMenu(restoreFocus = false) {
    targetMenuOpen.value = false
    if (restoreFocus) targetTrigger.value?.focus({ preventScroll: true })
}
function dismissTargetWithEscape(event: KeyboardEvent) {
    if (event.defaultPrevented) return
    event.stopPropagation()
    closeTargetMenu(true)
}
watch(targetMenuOpen, (open, _, onCleanup) => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
        const el = event.target
        if (!(el instanceof Element) || targetMenu.value?.contains(el) || targetTrigger.value?.contains(el)) return
        // Nested selectors and the DSL editor can render their interactive layer outside this panel.
        if (el.closest('.el-popper, .el-overlay, .m-sheet, .m-sheet-overlay, [data-radix-popper-content-wrapper]')) return
        closeTargetMenu()
    }
    window.addEventListener('resize', fitTargetMenu)
    window.addEventListener('scroll', fitTargetMenu, { passive: true })
    document.addEventListener('pointerdown', onPointerDown, true)
    onCleanup(() => {
        window.removeEventListener('resize', fitTargetMenu)
        window.removeEventListener('scroll', fitTargetMenu)
        document.removeEventListener('pointerdown', onPointerDown, true)
    })
}, { flush: 'post' })
onDeactivated(() => closeTargetMenu())
const workspace = ref<HTMLElement | null>(null)
async function jumpToSection(name: string) {
    mobileCalcTab.value=name==='panel-card'?'panel':name.startsWith('config-')&&name!=='config-weapon'?'character':'equipment'
    editorOpen.value=true
    await nextTick()
    workspace.value?.querySelector('.' + name)?.scrollIntoView({block: 'start'})
}
const kumiStore = useKumiStore()
const accountStore = useAccountStore()

// mona
const mona = await useMona()

// router
const route = useRoute()
const restoredTeamContext = shallowRef<any>(null)
let restoringHistory = false

// i18n
const { t, ta } = useI18n()
const sectionLinks = computed(() => [
    ['config-character', t('misc.character')], ['config-weapon', t('misc.weapon')],
    ['artifacts-card', t('misc.artifact')], ['damage-card', t('calcPage.dmg')],
    ['config-buff', 'BUFF'],
])


//////////////////////////////////////////////////////////
// set preset from other place
async function setPresetFromRoute() {
    if (optimizationRunning.value) return
    if (route.query.history) { await restoreCalculationHistory(String(route.query.history)); return }
    const presetName = route.query.preset || route.params.presetName
    if (presetName && typeof presetName === "string") {
        usePreset(presetName)
    }
}

onActivated(setPresetFromRoute)

onMounted(setPresetFromRoute)


////////////////////////////////////////////////////////
// enemy
const {
    enemyConfig,
    enemyInterface
} = useEnemy()
const showEnemyConfigDialog = ref(false)

function handleClickEnemyConfig() {
    showEnemyConfigDialog.value = true
}


////////////////////////////////////////////////////////
// character
const {
    characterName,
    characterLevel,
    characterConfig,
    characterSkill1,
    characterSkill2,
    characterSkill3,
    characterConstellation,
    characterWeaponType,
    characterLevelNumber,
    characterAscend,
    characterNeedConfig,
    characterConfigConfig,
    characterInterface,
    characterLocale,
} = useCharacter()

const {
    characterSkillConfig,
    characterSkillIndex,
    characterNeedSkillConfig,
    characterSkillConfigConfig,
    characterSkillInterface,
} = useCharacterSkill(characterName)

let modeConfirmationOpen = false
watch([characterName,characterSkillIndex,()=>characterConfig.value?.Mitya?.core_mode],async ([name,index,actual]) => {
    const required = [7,8].includes(Number(index)) ? 2 : [11,12,13].includes(Number(index)) ? 1 : null
    if (restoringHistory || name !== 'Mitya' || !required || ![1,2].includes(Number(actual)) || required === actual || modeConfirmationOpen) return
    const labels = ['', '稳态', '过载']
    modeConfirmationOpen = true
    try {
        await ElMessageBox.confirm(`当前选中伤害类型为${labels[required]}，但角色类型实际为${labels[Number(actual)]}，是否切换至${labels[required]}？`,'炉心模式不一致',{confirmButtonText:'是',cancelButtonText:'否',type:'warning'})
        if (characterName.value === name && characterSkillIndex.value === index && characterConfig.value.Mitya.core_mode === actual) characterConfig.value.Mitya.core_mode = required
    } catch (action) { if (action !== 'cancel' && action !== 'close') ElMessage.error(String(action)) }
    finally { modeConfirmationOpen = false }
})

const fumo = ref("None")


//////////////////////////////////////////////////////////////
// weapon
const {
    weaponName,
    weaponLevel,
    weaponRefine,
    weaponMaxRefine,
    weaponConfig,
    weaponLevelNumber,
    weaponAscend,
    weaponSplash,
    weaponNeedConfig,
    weaponConfigConfig,
    weaponInterface,
    weaponLocale
} = useWeapon(characterWeaponType)

watch(characterName, name => {
    if (name === 'Vodyanitsa') weaponName.value = 'HymnOfTheMaelstrom' as any
    else if (name === 'Vesna') weaponName.value = 'BeyondTheChrysalis' as any
}, { flush: 'sync' })


//////////////////////////////////////////////////////////////
// target function
const {
    targetFunctionName,
    targetFunctionConfig,
    targetFunctionUseDSL,
    targetFunctionDSLSource,
    targetFunctionBadge,
    targetFunctionDescription,
    targetFunctionNeedConfig,
    targetFunctionConfigConfig,
    targetFunctionInterface
} = useTargetFunction(characterName)
const miscTargetFunctionTab = ref<"normal" | "dsl" | "generator">("normal")
const optimizationMode = ref<'damage'|'panel'>('damage')
const panelSearchOptions = ref(newPanelSearchOptions())


const dslGeneratorState = ref({character: characterName.value, entries: [] as any[]})
const generatedDsl = computed(() => generateDsl(dslGeneratorState.value))
watch(characterName, name => { dslGeneratorState.value = {character:name,entries:[]} }, {flush:'sync'})
watch([miscTargetFunctionTab, generatedDsl], ([mode, source]) => {
    targetFunctionUseDSL.value = mode !== 'normal'
    if (mode === 'generator') targetFunctionDSLSource.value = source
}, {flush:'sync'})


//////////////////////////////////////////////////////////
// artifacts
const {
    artifactIds,
    artifactCount,
    artifactSingleConfig,
    artifactWasmFormat,

    artifactItems,
    artifactSnapshot,
    artifactSetCount,
    artifactNeedConfig4,
    artifactNeedConfig2,
    artifactConfigItemName,
    artifactEffect4Text,
    artifactEffect2Text,
    artifactConfig4Configs,
    artifactConfig2Configs,
    artifactConfigForCalculator,

    setArtifact,
    removeArtifact,
    clearArtifacts,
} = use5Artifacts()

const showSelectArtifactDialog = ref(false)
const showArtifactScore = ref(false)
const scoreArtifactIndex = ref(0)
function replaceScoredArtifact() {
    showArtifactScore.value = false
    handleGotoSelectArtifact(scoreArtifactIndex.value)
}
const selectArtifactSlot = ref<ArtifactPosition>("flower")

function handleGotoSelectArtifact(index: number) {
    const slotName = positions[index]
    showSelectArtifactDialog.value = true
    selectArtifactSlot.value = slotName
}

function handleSelectArtifact(id: number) {
    const index = positionToIndex(selectArtifactSlot.value)
    setArtifact(index, id)

    showSelectArtifactDialog.value = false
}

function handleLockAll() {
    for (const id of artifactIds.value) {
        artifactStore.lockArtifact(id)
    }
}

function handleUnlockAll() {
    for (const id of artifactIds.value) {
        artifactStore.unlockArtifact(id)
    }
}

const isAllLocked = computed(() => {
    for (const id of artifactIds.value) {
        let artifact = artifactStore.getArtifact(id)
        if (artifact) {
            if (!artifact.omit) {
                return false
            }
        }
    }
    return true
})


//////////////////////////////////////////////////////////////
// optimization setup
const showConstraintDialog = ref(false)
const {
    algorithm,
    constraintArtifactSet,
    constraintSandMainStats,
    constraintGobletMainStats,
    constraintHeadMainStats,
    constraintMinRecharge,
    constraintMinElementalMastery,
    constraintMinCritical,
    constraintMinCriticalDamage,

    constraintSetMode,
    constraintInterface,
} = useComputeConstraint()
const filterKumiRef = ref<InstanceType<typeof ElTree> | null>(null)
const filterKumiSearch = ref("")
const filteredKumiIds = ref<number[]>([])

function handleClickSetupOptimization() {
    showConstraintDialog.value = true
}


//////////////////////////////////////////////////////////////
// artifact config
const showConfigArtifactDialog = ref(false)
const artifactEffectMode = ref<"auto" | "custom">("auto")
const artifactConfig = ref(newDefaultArtifactConfigForWasm())

function handleClickArtifactConfig() {
    showConfigArtifactDialog.value = true
}


///////////////////////////////////////////////////////////////
// save and use presets
const miscCurrentPresetName = ref<null | string>(null)
const presetElement = ref("")
const presetSort = ref("recent")
const presetElements = Object.keys(characterByElement)
const presetMenuEntries = computed(() => {
    const entries = presetStore.allFlat.value.filter(entry =>
        !presetElement.value || scoreCharacters[entry.item.character.name].element === presetElement.value)
    return entries.sort((a, b) => {
        const recent = (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
        if (presetSort.value === "recent") return recent
        return presetElements.indexOf(scoreCharacters[a.item.character.name].element)
            - presetElements.indexOf(scoreCharacters[b.item.character.name].element) || recent
    })
})
const presetDefaultName = computed((): string => {
    const cName = characterLocale.value
    const wName = weaponLocale.value
    return `${cName}-${wName}`
})

function handleCommandPreset(cmd: string) {
    if (cmd === "save-preset") {
        handleClickSaveOptimizeConfig()
    } else {
        if (cmd.startsWith("apply-")) {
            const name = cmd.slice(6)

            usePreset(name)
        }
    }
}

function handleSavePreset(name: string) {
    if (!name) {
        handleClickSaveOptimizeConfig()
    } else {
        const item = getPresetItem()
        // console.log(item)
        item.name = name
        const sourceKey = presetStore.getPreset(name)?.item.miyousheKey
        if (sourceKey) {
            item.miyousheKey = sourceKey
            item.artifactIds = [...artifactIds.value]
        }
        presetStore.addOrOverwrite(name, item)

        ElMessage.success({
            message: "已保存"
        })
    }
}

function handleClickSaveOptimizeConfig() {
    const item = getPresetItem()

    ElMessageBox.prompt("输入名称（重复名称将覆盖）", "存为预设", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        inputPattern: /[^\s]+$/,
        inputValue: presetDefaultName.value
    }).then(({ value }) => {
        item.name = value
        presetStore.addOrOverwrite(value, item)
        miscCurrentPresetName.value = value
        ElMessage.success({
            message: "保存成功"
        })
    })
}

function getPresetItem() {
    type BuffType = Omit<BuffEntry, "id">
    let buffsToBeSaved: BuffType[] = []
    for (let buff of buffs.value) {
        buffsToBeSaved.push({
            name: buff.name,
            config: deepCopy(buff.config),
            lock: buff.lock,
            source_id: (buff as any).source_id,
            source_effect: (buff as any).source_effect,
        })
    }

    const item = {
        // buffs: deepCopy(config.buffs),
        buffs: buffsToBeSaved,
        artifactIds: [...artifactIds.value],
        teamContext: deepCopy(teamContextSources.value),
        teamContextStellarMode: teamContextStellarMode.value,
        character: deepCopy(characterInterface.value),
        weapon: deepCopy(weaponInterface.value),
        targetFunction: deepCopy(targetFunctionInterface.value),
        constraint: {
            setNames: deepCopy(constraintArtifactSet.value),
            minRecharge: constraintMinRecharge.value,
            minCritical: constraintMinCritical.value,
            minCriticalDamage: constraintMinCriticalDamage.value,
            minElementalMastery: constraintMinElementalMastery.value
        },
        filter: {
            sandMainStats: deepCopy(constraintSandMainStats.value),
            gobletMainStats: deepCopy(constraintGobletMainStats.value),
            headMainStats: deepCopy(constraintHeadMainStats.value),
        },
        artifactConfig: deepCopy(artifactConfig.value),
        algorithm: algorithm.value,
        artifactEffectMode: artifactEffectMode.value,
        useDSL: miscTargetFunctionTab.value !== "normal",
        targetMode: miscTargetFunctionTab.value,
        optimizationMode: optimizationMode.value,
        panelSearch: deepCopy(panelSearchOptions.value),
        dslGenerator: deepCopy(dslGeneratorState.value),
        dslSource: targetFunctionDSLSource.value,
        name: ""
    } as IPreset
    return item
}

function usePreset(name: string, historyItem?: IPreset) {
    const entry: PresetEntry = presetStore.presets.value[name]
    if (!historyItem && (!entry || !entry.item)) {
        return
    }

    resetArtifactComparison()

    const item: IPreset = deepCopy(historyItem || entry.item)
    optimizationMode.value = item.optimizationMode ?? 'damage'
    panelSearchOptions.value = item.panelSearch ? deepCopy(item.panelSearch) : newPanelSearchOptions()
    if (item.artifactIds) {
        artifactIds.value = [0, 1, 2, 3, 4].map(i => historyItem || artifactStore.getArtifact(item.artifactIds![i]) ? item.artifactIds![i] : -1)
    }

    const idGenerator = new RandomIDProvider()

    // use buffs
    if (item.buffs) {
        const newBuffs: BuffItem[] = []
        for (let buff of item.buffs) {
            const newBuff: BuffEntry = {
                id: idGenerator.generateId(),
                name: buff.name,
                config: buff.config,
                lock: buff.lock,
                source_id: buff.source_id,
                source_effect: buff.source_effect,
            }
            newBuffs.push(newBuff)
        }
        buffs.value = newBuffs
    }
    teamContextSources.value = Array.isArray(item.teamContext) ? deepCopy(item.teamContext) : []
    teamContextStellarMode.value = item.teamContextStellarMode === true

    // use character
    const c = item.character
    if (c) {
        // this.characterName = c.name
        characterName.value = c.name
        characterLevel.value = c.level.toString() + (c.ascend ? "+" : "-")
        characterConstellation.value = c.constellation ?? 0
        characterSkill1.value = c.skill1 + 1
        characterSkill2.value = c.skill2 + 1
        characterSkill3.value = c.skill3 + 1
        characterConfig.value = c.params
    }

    // use weapon
    const w = item.weapon
    if (w) {
        weaponName.value = w.name
        weaponLevel.value = w.level.toString() + (w.ascend ? "+" : "-")
        weaponRefine.value = w.refine
        weaponConfig.value = w.params
    }

    // use target function
    const tf = item.targetFunction
    if (tf) {
        targetFunctionName.value = tf.name
        targetFunctionConfig.value = tf.params
    }

    // is DSL?
    const use_dsl = !!item.useDSL
    if (use_dsl) {
        targetFunctionDSLSource.value = item.dslSource ?? ""
        if (item.dslGenerator) dslGeneratorState.value = deepCopy(item.dslGenerator)
        miscTargetFunctionTab.value = item.targetMode === 'generator' ? 'generator' : 'dsl'
    } else {
        miscTargetFunctionTab.value = "normal"
    }


    // use constraint
    const constraint = item.constraint
    if (constraint) {
        constraintArtifactSet.value = constraint.setNames ?? []
        constraintMinCriticalDamage.value = constraint.minCriticalDamage ?? 0
        constraintMinCritical.value = constraint.minCritical ?? 0
        constraintMinElementalMastery.value = constraint.minElementalMastery ?? 0
        constraintMinRecharge.value = constraint.minRecharge ?? 1.0
    }

    // use filter
    const filter = item.filter
    if (filter) {
        constraintSandMainStats.value = filter.sandMainStats ?? []
        constraintGobletMainStats.value = filter.gobletMainStats ?? []
        constraintHeadMainStats.value = filter.headMainStats ?? []
    }

    // use compute mode
    algorithm.value = item.algorithm ?? "AStar"
    // disable heuristic algorithm in 5.11
    if (algorithm.value === "Heuristic") {
        algorithm.value = "AStar"
    }

    // use artifact effect mode
    artifactEffectMode.value = item.artifactEffectMode ?? "auto"

    // use artifact config
    if (item.artifactConfig) {
        artifactConfig.value = mergeArtifactConfig(item.artifactConfig)
    } else {
        artifactConfig.value = newDefaultArtifactConfigForWasm()
    }

    miscCurrentPresetName.value = name
    if (item.miyousheKey) miyousheStore.selectedUid.value = item.miyousheKey.split(':')[0]
}


///////////////////////////////////////////////////////////
// buffs
const {
    buffs,
    buffsInterface,
    polestarEnabled,
    polestarStacks,
    addBuff,
    deleteBuff,
    toggleBuff
} = useBuff()
const otherBuffs = computed(() => buffs.value.filter(buff => buff.name !== 'ResonancePolestarField'))
const teamContextSources = ref<ITeamContextSource[]>([])
const teamContextStellarMode = ref(false)
const availableTeamPresets = computed(() => presetStore.allFlat.value.filter(entry =>
    ['Vodyanitsa', 'Vesna', 'Odette', 'Qiqi', 'Sandrone'].includes(entry.item?.character?.name)
    && entry.item.character.name !== characterName.value
    && entry.name !== miscCurrentPresetName.value))
const selectedTeamPresetNames = computed<string[]>({
    get: () => teamContextSources.value.map(source => source.presetName),
    set: names => {
        teamContextSources.value = names.map(name => teamContextSources.value.find(source => source.presetName === name)
            || createTeamContextSource(name, presetStore.presets.value[name]))
    },
})
function teamCharacterLabel(name?: string) {
    return ({Vodyanitsa:'沃雅妮莎',Vesna:'薇斯纳',Odette:'奥黛塔',Qiqi:'七七',Sandrone:'桑多涅'} as Record<string,string>)[name || ''] || '未知角色'
}
function teamSourceGearLabel(name: string) {
    const ids = presetStore.presets.value[name]?.item.artifactIds
    if (!Array.isArray(ids)) return '未保存当前装备'
    return `当前装备 ${ids.filter(id => id >= 0 && !!artifactStore.getArtifact(id)).length}/5 件`
}
const selectedTeamArtifactIds = computed(() => new Set(teamContextSources.value.flatMap(source =>
    (presetStore.presets.value[source.presetName]?.item.artifactIds || []).filter(id => Number.isInteger(id) && id >= 0))))
const teamContextResult = computed(() => deriveSingleTeamContext(mona, {
    character: characterInterface.value,
    weapon: weaponInterface.value,
    target_function: targetFunctionInterface.value,
    equipped_artifact_ids: artifactIds.value,
    artifacts: artifactWasmFormat.value,
    buffs: buffsInterface.value,
    team_effects: {stellar_mode:teamContextStellarMode.value ? 'stellar' : 'ordinary'},
}, teamContextSources.value, presetStore.presets.value,
id => artifactStore.getArtifact(id), convertArtifact))
const effectiveBuffs = computed(() => teamContextResult.value.buffs)
const teamContextError = computed(() => teamContextResult.value.issues.join(' '))
const teamContextKey = computed(() => JSON.stringify([
    teamContextSources.value, teamContextStellarMode.value,
    teamContextResult.value.automatic, teamContextResult.value.issues,
    [...selectedTeamArtifactIds.value],
]))

const showSelectBuffDialog = ref(false)

function handleClickAddBuff() {
    showSelectBuffDialog.value = true
}

function handleClickDeleteBuff(id: number) {
    deleteBuff(id)
}

function handleClickToggleBuff(id: number) {
    toggleBuff(id)
}

async function handleSelectBuff(name: string, options?: { config?: any, keepOpen: boolean }) {
    const title = ta(buffData[name].nameLocale)
    if (buffs.value.some(b => b.name === name)) {
        try { await ElMessageBox.confirm(`当前已添加${title}，是否重复添加？`,'提示',{confirmButtonText:'是',cancelButtonText:'否',type:'warning'}) }
        catch (action) { if (action !== 'cancel' && action !== 'close') ElMessage.error(String(action)); return }
    }
    if (!options?.keepOpen) showSelectBuffDialog.value = false
    addBuff(name, options?.config)
    ElMessage.success(`已添加${title}`)
}


////////////////////////////////////////////////////////////////////////
// damage
const showDamageAnalysisDialog = ref(false)
const damageAnalysisComponent = ref<null | InstanceType<typeof DamageAnalysis>>(null)

const damageAnalysisWasmInterface = computed(() => {
    // console.log("123")
    return {
        character: characterInterface.value,
        weapon: weaponInterface.value,
        buffs: effectiveBuffs.value,
        ...(restoredTeamContext.value ? {team_context:restoredTeamContext.value} : teamContextSources.value.length ? {team_context:teamContextResult.value.team_context} : {}),
        artifacts: artifactWasmFormat.value,
        artifact_config: artifactConfigForCalculator.value,
        skill: characterSkillInterface.value,
        enemy: enemyInterface.value,
    }
})

const damageCalculation = computed(() => {
    try {
    let fumo2 = null
    if (fumo.value !== "None") {
        fumo2 = fumo.value
    }
    const temp = mona.CalculatorInterface.get_damage_analysis(damageAnalysisWasmInterface.value, fumo2)
    // console.log(temp)
    return { value: temp, error: '' }
    } catch (error: any) { return { value: null, error: error.message || String(error) } }
})
const characterDamageAnalysis = computed(() => damageCalculation.value.value)

const showTransformativeDamage = ref(false)
const transformativeCalculation = computed(() => {
    if (!showTransformativeDamage.value) return { value: null, error: '' }
    try { return { value: mona.CalculatorInterface.get_transformative_damage(damageAnalysisWasmInterface.value), error: '' } }
    catch (error: any) { return { value: null, error: error.message || String(error) } }
})
const characterTransformativeDamage = computed(() => transformativeCalculation.value.value)

function handleDisplayAnalysis() {
    if (betaCalculationError.value) return ElMessage.error(betaCalculationError.value)
    showDamageAnalysisDialog.value = true

    nextTick(() => {
        if (damageAnalysisComponent.value) {
            const component = damageAnalysisComponent.value

            component.setValue(characterDamageAnalysis.value)
        }
    })
}


//////////////////////////////////////////////////////////////////
// attribute
const getAttributeWasmInterface = computed(() => {
    return {
        character: characterInterface.value,
        weapon: weaponInterface.value,
        buffs: effectiveBuffs.value,
        ...(restoredTeamContext.value ? {team_context:restoredTeamContext.value} : teamContextSources.value.length ? {team_context:teamContextResult.value.team_context} : {}),
        artifacts: artifactWasmFormat.value,
        artifact_config: artifactConfigForCalculator.value,
    }
})

const attributeCalculation = computed(() => {
    try { return { value: mona.CommonInterface.get_attribute(getAttributeWasmInterface.value), error: '' } }
    catch (error: any) { return { value: null, error: error.message || String(error) } }
})
const attributeFromWasm = computed(() => attributeCalculation.value.value || {})

const betaCalculationError = computed(() => teamContextError.value || attributeCalculation.value.error || damageCalculation.value.error || transformativeCalculation.value.error)

const artifactScoreContext = computed(() => {
    const c = scoreCharacters[characterName.value]
    const label = scoreLocale[c.nameLocale]
    const name = /^(Aether|Lumine)/.test(characterName.value) ? '旅行者' : label
    return { name, label, options: {
        elem: c.element.toLowerCase(), cons: characterConstellation.value,
        scoreMode: characterName.value === 'Vesna' && characterConfig.value?.Vesna?.radiance ? 'stellar' : 'normal',
        weaponName: scoreLocale[scoreWeapons[weaponName.value].nameLocale], weaponAffix: weaponRefine.value,
        charAttrs: panelScoreAttributes(attributeFromWasm.value),
        artisSets: scoreSetNames(artifactItems.value, artifactsData, scoreLocale)
    } }
})
const dynamicScoreEnabled=ref(false),dynamicScore=shallowRef<any>(null)
const dynamicScoreController=ref<any>(null)
const dynamicScoreState=ref({running:false,status:'准备计算',error:''})
const useNewScore=computed(()=>dynamicScoreEnabled.value)
const displayedPieceScore=(i:number)=>useNewScore.value?(dynamicScore.value?dynamicPieceScore(i):dynamicScoreState.value.running?'计算中':'待计算'):artifactPieceScore(i)
const displayedScoreLabel=computed(()=>useNewScore.value?'新评分':'喵喵评分')
const displayedTotalLabel=computed(()=>useNewScore.value?'新评分 · 单件合计':'喵喵总分')
const displayedScoreTotal=computed(()=>useNewScore.value?(dynamicScore.value?(dynamicScore.value.qualityTotal?.toFixed(1)??'不可定义')+' / 350 '+dynamicTotalGrade.value:dynamicScoreState.value.running?'计算中':'待计算'):(artifactBuildScore.value.total?.toFixed(1)??'—')+' '+artifactBuildScore.value.grade)
const dynamicTotalGrade=computed(()=>dynamicScore.value?.qualityTotal==null?'':getMarkClass(dynamicScore.value.qualityTotal/5))
function dynamicPieceGrade(index:number){const score=dynamicScore.value?.rows[index]?.score;return score==null?'':getMarkClass(score)}
function openScoreSettings(){dynamicScoreController.value?.openSettings()}
function openScoreBasis(){dynamicScoreController.value?.openBasis()}
function openDynamicScore(){dynamicScoreEnabled.value=true;nextTick(()=>{dynamicScore.value?openScoreBasis():openScoreSettings()})}
const dynamicScoreInput=computed(()=>({...damageAnalysisWasmInterface.value,target_function:targetFunctionInterface.value}))
function dynamicPieceScore(index:number){const row=dynamicScore.value?.rows[index];return row?.score==null?'不可定义':row.score.toFixed(1)+' '+getMarkClass(row.score)}
const artifactBuildScore = computed(() => scoreBuild(artifactItems.value, artifactScoreContext.value))
function artifactPieceScore(index: number) {
    const score = artifactBuildScore.value.artifacts.find(a => a.pos === index)
    return score ? `${score.score.toFixed(1)} ${score.grade}` : '待适配'
}


//////////////////////////////////////////////////////////////////
// bonus analysis
const showOptimalGainCurve = ref(false)
const OptimalStatGainCurve = defineAsyncComponent(() => import('@/components/display/OptimalStatGainCurve.vue'))
const miscPerStatBonus = ref<any>({})
const showArtifactPerBonusDialog = ref(false)

const bonusPerStatWasmInterface = computed(() => {
    return {
        character: characterInterface.value,
        weapon: weaponInterface.value,
        artifacts: artifactWasmFormat.value,
        tf: targetFunctionInterface.value,
        buffs: effectiveBuffs.value,
        ...(restoredTeamContext.value ? {team_context:restoredTeamContext.value} : teamContextSources.value.length ? {team_context:teamContextResult.value.team_context} : {}),
        enemy: enemyInterface.value,
        artifacts_config: artifactConfigForCalculator.value
    }
})

function handleClickAttributeAnalysis() {
    if (betaCalculationError.value) return ElMessage.error(betaCalculationError.value)
    try {
        miscPerStatBonus.value = mona.BonusPerStat.bonus_per_stat(bonusPerStatWasmInterface.value)
        showArtifactPerBonusDialog.value = true
    } catch (error: any) {
        ElMessage.error(error.message || String(error))
    }
}

const ArtifactPerStatBonus = defineAsyncComponent({
    loader: () => import("@/components/display/ArtifactPerStatBonus.vue")
})


/////////////////////////////////////////////////////////////////////////
// kumi
const showSaveKumiDialog = ref(false)
const showUseKumiDialog = ref(false)

interface Node {
    label: string,
    children?: Node[],
    id: number,
}

interface FilterKumiNode extends Node {
    characters: { name: string, label: string, avatar: string }[],
    children?: FilterKumiNode[],
}

const kumiDefaultName = computed((): string => {
    let name = characterLocale.value
    for (const setName in artifactSetCount.value) {
        if (artifactSetCount.value[setName] >= 2) {
            name += '-' + ta(artifactsData[setName].nameLocale)
        }
    }
    return name
})

const kumiTreeDataForElementUI = computed(() => {
    const data: Node[] = []
    for (const item of kumiStore.dirs.value) {
        const children = item.children ?? []

        if (children.length > 0) {
            const temp: Node[] = []
            for (let childId of children) {
                const item = kumiStore.kumiById.value.get(childId)
                if (item) {
                    temp.push({
                        label: item.title,
                        id: item.id
                    })
                }
            }

            const node = {
                label: item.title,
                children: temp,
                id: item.id
            }
            data.push(node)
        }
    }

    return data
})

const filterKumiTreeData = computed((): FilterKumiNode[] => {
    const compare = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' }).compare
    const sortNodes = (a: Node, b: Node) => compare(a.label, b.label) || a.id - b.id
    return kumiTreeDataForElementUI.value.map(dir => ({
        ...dir,
        characters: [],
        children: dir.children!.map(node => {
            const group = kumiStore.kumiById.value.get(node.id)!
            const names = artifactGroupCharacterNames(group, presetStore.allFlat.value, artifactStore.artifacts.value)
            return { id: node.id, label: node.label, characters: names.map(name => ({
                name, label: ta(scoreCharacters[name].nameLocale), avatar: scoreCharacters[name].avatar,
            })) }
        }).sort(sortNodes),
    })).sort(sortNodes)
})

function filterKumiNode(value: string, data: FilterKumiNode, node: any): boolean {
    const query = value.trim().toLowerCase()
    const matches = (item: FilterKumiNode) => `${item.label} ${item.characters.map(character =>
        `${character.name} ${character.label}`).join(' ')}`.toLowerCase().includes(query)
    return matches(data) || (node.parent.level > 0 && matches(node.parent.data))
}

function handleFilterKumiCheck(_node: FilterKumiNode, checked: { checkedNodes: FilterKumiNode[] }) {
    filteredKumiIds.value = checked.checkedNodes.filter(node => !node.children).map(node => node.id)
}

watch([filterKumiSearch, filterKumiTreeData], () => {
    nextTick(() => filterKumiRef.value?.filter(filterKumiSearch.value))
}, { flush: 'post' })

function handleClickSaveAsKumi() {
    showSaveKumiDialog.value = true
}

function handleSaveAsKumi({ dirIds, name }: { dirIds: number[], name: string }) {
    showSaveKumiDialog.value = false

    for (const dirId of dirIds) {
        let kumiId = kumiStore.createKumi(dirId, name, characterName.value)
        if (kumiId) {
            for (const artifactId of artifactIds.value) {
                if (artifactId >= 0) {
                    kumiStore.addArtifact(kumiId, artifactId)
                }
            }
        }
    }
}

function handleClickUseKumi() {
    showUseKumiDialog.value = true
}

function handleUseKumi(node: Node) {
    const item = kumiStore.kumiById.value.get(node.id)
    if (!item || item.dir || !item.artifactIds) {
        return
    }

    showUseKumiDialog.value = false
    for (let i = 0; i < 5; i++) {
        const artifactId = item.artifactIds[i]
        if (artifactId !== null) {
            artifactIds.value[i] = artifactId
        } else {
            artifactIds.value[i] = -1
        }
    }
}


///////////////////////////////////////////////////////////////////////////////
// artifact analysis
const showArtifactAnalysisDialog = ref(false)

const ArtifactsSetStatistics = defineAsyncComponent({
    loader: () => import("@/components/display/ArtifactsSetStatistics"),
    loadingComponent: SimpleLoading,
    errorComponent: SimpleError,
})

function handleClickArtifactAnalysis() {
    showArtifactAnalysisDialog.value = true
}


////////////////////////////////////////////////////////////////////////////////
// optimization
interface ResultEntry {
    flower: null | number,
    feather: null | number,
    sand: null | number,
    goblet: null | number,
    head: null | number,
    value: number,
    ratio: number,
}

const optimizationResults = ref<ResultEntry[]>([])
const panelResultSnapshot = shallowRef<any>(null)
const optimizationResultIndex = ref(0)
const resultSearchInput=shallowRef<any>(null)
const reviewIndex=computed(()=>{
    const matches=(r:ResultEntry)=>buildIds(r).every((id:number|null,i:number)=>(id??-1)===artifactIds.value[i])
    const current=optimizationResults.value[optimizationResultIndex.value-1]
    if(current&&matches(current))return optimizationResultIndex.value
    return optimizationResults.value.findIndex(matches)+1
})
const resultObjectiveLabel=computed(()=>{
    const tf=resultSearchInput.value?.target_function
    return tf?.use_dsl?'DSL 组合目标':tf?ta(targets[tf.name].nameLocale):'优化目标'
})
const comparisonEntry = computed(() => {
    const currentPreset = presetStore.getPreset(miscCurrentPresetName.value || '')?.item
    const currentKey = currentPreset?.character.name === characterName.value ? currentPreset.miyousheKey : undefined
    return miyousheStore.data.value.entries.find((entry: any) => currentKey ? entry.key === currentKey
        : entry.uid === miyousheStore.selectedUid.value && presetStore.getPreset(entry.presetName)?.item.character.name === characterName.value)
})
const comparisonKey = computed(() => comparisonEntry.value?.key || `manual:${characterName.value}`)
const ownershipUid = computed(() => comparisonEntry.value?.uid || miyousheStore.selectedUid.value)
const allowBorrowEquipped = computed({
    get: () => miyousheStore.data.value.allowBorrowEquipped === true,
    set: value => { miyousheStore.data.value.allowBorrowEquipped = value },
})
const reservedArtifactIds = computed(() => otherCharacterArtifactIds(
    miyousheStore.data.value.entries, ownershipUid.value, comparisonEntry.value?.key, artifactStore.artifacts.value))
const ownershipFilterKey = computed(() => JSON.stringify([ownershipUid.value, comparisonKey.value,
    allowBorrowEquipped.value, allowBorrowEquipped.value ? [] : [...reservedArtifactIds.value].sort((a,b) => a-b),
    [...selectedTeamArtifactIds.value].sort((a,b) => a-b),teamContextKey.value]))
watch(ownershipFilterKey, () => { optimizationResults.value = []; optimizationResultIndex.value = 0 }, { flush: 'sync' })
const comparisonStorage = computed({
    get: () => miyousheStore.data.value.artifactComparison || {},
    set: value => { miyousheStore.data.value.artifactComparison = value },
})
const gameArtifactConverter = createMysConverter({ artifacts: artifactsData, locale: scoreLocale })
const gameEquipment = computed(() => {
    const entry = comparisonEntry.value
    if (!entry) return null
    let gear = entry.equippedArtifacts
    if (!gear) {
        const raw = miyousheStore.data.value.snapshots[entry.uid]?.characters.find((raw: any) => `${entry.uid}:${raw.base?.id}:${raw.base?.element || ''}` === entry.key)
        if (!Array.isArray(raw?.relics)) return null
        try { gear = raw.relics.map(gameArtifactConverter.artifact) }
        catch { return { items: null, description: '游戏内圣遗物记录无法解析，请重新同步该 UID' } }
    }
    const items = positions.map((position, i) => {
        const artifact = gear.find((a: any) => a.position === position)
        return artifact ? { ...artifact, id: entry.artifactIds?.[i] } : null
    })
    return { items, description: `游戏内穿戴 · UID ${entry.uid} · 最近同步：${entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : '时间未知'}` }
})
const {
    enabled: comparisonEnabled, mode: comparisonMode, history: comparisonHistory, historyId: comparisonHistoryId,
    baseline: comparisonBaseline, changes: artifactChanges, record: recordComparisonHistory,
    begin: beginArtifactComparison, restore: restoreSessionBaseline, reset: resetComparisonBaseline,
} = useArtifactComparison({ storage: comparisonStorage, settings: miyousheStore.comparisonSettings, key: comparisonKey, items: artifactItems, gameBaseline: gameEquipment })
const reviewSkill = computed(() => {
    const c = scoreCharacters[characterName.value]
    for (const [k,label] of [['skillMap1','普通攻击'],['skillMap2','元素战技'],['skillMap3','元素爆发']]) {
        const found=c[k].find((row:any)=>row.index===characterSkillIndex.value)
        if(found)return label+' · '+ta(found.text)
    }
    return ''
})
const reviewBaselineLabel=computed(()=>!comparisonEnabled.value?'未启用对比':comparisonMode.value==='history'?
    '对比历史 / '+(comparisonHistory.value.find((r:any)=>r.id===comparisonHistoryId.value)?.label||'未选择'):
    comparisonMode.value==='game'?'游戏内穿戴':'此次计算前')
// Snapshot IDs refer to the live inventory and can be -1 after import. A single
// build evaluation only needs unique unsigned IDs for its own occupied slots.
const comparisonArtifactsWasm = computed(() => comparisonBaseline.value?.flatMap((item: IArtifact | null, slot: number) =>
    item ? [{ ...convertArtifact(item), id: slot }] : []))
const reviewDsl=computed(()=>{
    if(optimizationMode.value!=='damage'||!targetFunctionUseDSL.value)return null
    const input=getOptimizeArtifactWasmInterface()
    let current=null,before=null,error=''
    try {current=dslObjective(mona,input,artifactWasmFormat.value)
        if(comparisonBaseline.value)before=dslObjective(mona,input,comparisonArtifactsWasm.value)
    } catch(e:any){error=e.message||String(e)}
    return {current,before,error}
})
const reviewCandidateInput=computed(()=>({
    ...damageAnalysisWasmInterface.value,
    artifact_config:artifactSingleConfig.value,
}))
const comparisonAttribute = computed(() => {
    if (!comparisonBaseline.value) return { value: null, error: '' }
    try {
        return { value: mona.CommonInterface.get_attribute({ ...reviewCandidateInput.value,
            artifacts: comparisonArtifactsWasm.value }), error: '' }
    } catch (error: any) { return { value: null, error: `对比基准面板无法计算：${error.message || error}` } }
})
const comparisonDamage = computed(() => {
    if (!comparisonBaseline.value) return { value: null, error: '' }
    try {
        const input = { ...reviewCandidateInput.value, artifacts: comparisonArtifactsWasm.value }
        return { value: mona.CalculatorInterface.get_damage_analysis(input, fumo.value === 'None' ? null : fumo.value), error: '' }
    } catch (error: any) { return { value: null, error: `对比基准伤害无法计算：${error.message || error}` } }
})
function saveComparisonHistory() {
    const id = recordComparisonHistory('手动保存')
    ElMessage[id ? 'success' : 'warning'](id ? '已保存当前角色配装到对比历史' : '当前没有穿戴圣遗物')
}
function resetArtifactComparison() {
    resetComparisonBaseline()
    artifactSnapshot.value = null
    restoredTeamContext.value = null
    panelResultSnapshot.value = null
    optimizationResults.value = []
    optimizationResultIndex.value = 0
}
watch(characterName, resetArtifactComparison)

async function applyReviewCandidate(n: number) { await handleUseNthOptimizationResult(n);showCalculatedEquipment() }
function showCalculatedEquipment(){if(useNewScore.value)jumpToSection('artifacts-card');else showResult()}

async function handleUseNthOptimizationResult(n: number) {
    const result = optimizationResults.value[n - 1]
    if (!result) return
    const m = (x: null | number) => {
        if (x !== null) {
            return x
        } else {
            return -1
        }
    }

    let temp: number[] = []
    temp.push(m(result.flower))
    temp.push(m(result.feather))
    temp.push(m(result.sand))
    temp.push(m(result.goblet))
    temp.push(m(result.head))

    if (panelResultSnapshot.value) artifactSingleConfig.value = deepCopy(panelResultSnapshot.value.input.artifact_config)
    artifactIds.value = temp
    recordComparisonHistory(`计算结果 ${n}`)

    optimizationResultIndex.value = n
    await nextTick()
    if (useNewScore.value) await dynamicScoreController.value?.start()
}

function getOptimizeArtifactWasmInterface() {
    let artifact_config: any = null
    if (artifactEffectMode.value === "custom") {
        artifact_config = artifactConfig.value
    }

    const i = {
        character: characterInterface.value,
        weapon: weaponInterface.value,
        target_function: targetFunctionInterface.value,
        constraint: constraintInterface.value,
        enemy: enemyInterface.value,
        buffs: effectiveBuffs.value,
        ...(restoredTeamContext.value ? {team_context:restoredTeamContext.value} : teamContextSources.value.length ? {team_context:teamContextResult.value.team_context} : {}),
        artifact_config,
        algorithm: algorithm.value,
    }

    // some values may be under a proxy, which cannot be passed to web worker
    // use deep copy to remove proxy
    return deepCopy(i)
}

function getPanelOptimizeInterface() {
    return deepCopy({
        character: characterInterface.value,
        weapon: weaponInterface.value,
        buffs: effectiveBuffs.value,
        ...(restoredTeamContext.value ? {team_context:restoredTeamContext.value} : teamContextSources.value.length ? {team_context:teamContextResult.value.team_context} : {}),
        artifact_config: artifactConfig.value,
        constraint: {set_mode:constraintSetMode.value},
        panel_search: panelSearchOptions.value,
    })
}

function getAllArtifactsFiltered(): IArtifact[] {
    // s is artifact ids to be filtered
    let s = new Set([...(allowBorrowEquipped.value ? [] : reservedArtifactIds.value), ...selectedTeamArtifactIds.value])

    // filter kumi
    const currentArtifactIds = new Set(artifactIds.value)
    for (const kumiId of filteredKumiIds.value) {
        const kumiItem = kumiStore.kumiById.value.get(kumiId)
        if (kumiItem && kumiItem.artifactIds) {
            const sources = artifactGroupCharacterNames(kumiItem, presetStore.allFlat.value, artifactStore.artifacts.value)
            const ownGroup = sources.length === 1 && sources[0] === characterName.value
            for (const artifactId of kumiItem.artifactIds) {
                if (!ownGroup || !currentArtifactIds.has(artifactId as number)) {
                    s.add(artifactId)
                }
            }
        }
    }

    // filter main stat
    for (let artifact of artifactStore.artifacts.value.values()) {
        const position = artifact.position
        const mainStatName = artifact.mainTag.name
        const id = artifact.id
        if (position === "sand") {
            if (constraintSandMainStats.value.length > 0) {
                const index = constraintSandMainStats.value.indexOf(mainStatName)
                if (index === -1) {
                    s.add(id)
                }
            }
        } else if (position === "cup") {
            if (constraintGobletMainStats.value.length > 0) {
                const index = constraintGobletMainStats.value.indexOf(mainStatName)
                if (index === -1) {
                    s.add(id)
                }
            }
        } else if (position === "head") {
            if (constraintHeadMainStats.value.length > 0) {
                const index = constraintHeadMainStats.value.indexOf(mainStatName)
                if (index === -1) {
                    s.add(id)
                }
            }
        }
    }

    let filtered = []

    for (let artifact of artifactStore.artifacts.value.values()) {
        if (!artifact.omit && !s.has(artifact.id)) {
            filtered.push(artifact)
        }
    }

    return filtered.filter(a => !a.omit)
}

function getAllArtifactsFilteredWasm(): IArtifactWasm[] {
    return getAllArtifactsFiltered().map(x => convertArtifact(x))
}

function getArtifactsToBeCalculated(): IArtifactWasm[] {
    const artifacts = getAllArtifactsFilteredWasm()
    const artifacts16 = artifacts.filter(x => x.level >= (optimizationMode.value === 'panel' ? panelSearchOptions.value.minArtifactLevel : 16))

    return artifacts16
}

const showOptimizationResults = ref(false)
const getResultArtifact = (id: number) => artifactSnapshot.value ? artifactSnapshot.value[id] : artifactStore.artifacts.value.get(id)
const showOptimizationProgress = ref(false)
const optimizationRunning = ref(false)
const activeOptimizationMode = ref<'damage'|'panel'|null>(null)
const optimizationCancelled = ref(false)
let calculationPageActive = true, optimizationInBackground = false
function backgroundOptimization() { optimizationInBackground=true;showOptimizationProgress.value=false }
onDeactivated(()=>{calculationPageActive=false;if(optimizationRunning.value)backgroundOptimization()})
onActivated(()=>{calculationPageActive=true})
let optimizationAbortController: AbortController | undefined
const cancelOptimization = () => { optimizationAbortController?.abort();if(useNewScore.value)dynamicScoreController.value?.cancel() }
const optimizationElapsed = ref(0)
const optimizationProgress = ref<any>({percent:null,candidateSpace:null,evaluated:0,remainingGroups:null,etaMs:null})
const optimizationProgressReceivedElapsed = ref(0)
const optimizationRemaining = computed(() => remainingOptimizationTime(optimizationProgress.value, Math.max(0,optimizationElapsed.value-optimizationProgressReceivedElapsed.value)))
const optimizationStage = computed(() => ({set4:'四件套',set22:'二加二',set2:'两件套',any:'不限套装',enumeration:'逐组搜索',panelCompile:'面板构图'} as Record<string,string>)[optimizationProgress.value.searchStage] || '')
const numberOfGroups = (value: number | null) => value == null ? '统计中' : value.toLocaleString('zh-CN')
let optimizationClock: ReturnType<typeof setInterval> | undefined
onBeforeUnmount(() => { calculationPageActive=false;optimizationInBackground=true;clearInterval(optimizationClock) })
const optimizationDebugEnabled = ref(false)
const optimizationDebugRecord = shallowRef<any>(null)
const optimizationError = ref('')
const optimizationDebugDetail = computed(() => JSON.stringify({events:optimizationDebugRecord.value?.events,error:optimizationDebugRecord.value?.error},null,2))
async function exportOptimizationDebug() {
    if (!optimizationDebugRecord.value) return
    try { await downloadString(JSON.stringify(optimizationDebugRecord.value,null,2),'application/json',`mona-debug-${optimizationDebugRecord.value.version || process.env.MONA_VERSION}-${Date.now()}.json`) }
    catch (error: any) { ElMessage.error('调试包导出失败：' + (error.message || String(error))) }
}
function handleOptimizeArtifact() {
    if (optimizationRunning.value || dynamicScoreState.value.running) return
    if (calculationState.active) { ElMessage.info('当前有计算线程正在进行'); return }
    optimizationError.value = ''
    const debug = optimizationDebugEnabled.value ? createOptimizationDebug({version:process.env.MONA_VERSION,environment:{userAgent:navigator.userAgent,language:navigator.language,hardwareConcurrency:navigator.hardwareConcurrency,crossOriginIsolated:globalThis.crossOriginIsolated,wasmAvailable:typeof WebAssembly!=='undefined'}}) : null
    optimizationDebugRecord.value = debug?.record || null
    const debugEvent = (event: any) => { debug?.event(event); triggerRef(optimizationDebugRecord) }
    const reportError = (error: any) => { optimizationError.value=error?.message||String(error); debug?.fail(error); triggerRef(optimizationDebugRecord); ElMessage.error(optimizationError.value) }

    const start = new Date()
    const originalEquipment = snapshotEquipment(artifactItems.value)
    const originalKey = comparisonKey.value, originalAccount = accountStore.currentAccountId.value
    const originalOwnershipFilter = ownershipFilterKey.value
    const panelMode = optimizationMode.value === 'panel'
    let panelSnapshot: any

    let optimizeInterface: any, artifacts: IArtifactWasm[]
    try {
        if (teamContextError.value) throw new Error(teamContextError.value)
        if (panelMode && (!Number.isInteger(panelSearchOptions.value.resultLimit) || panelSearchOptions.value.resultLimit < 1)) throw new Error('保留套数必须为正整数')
        if (panelMode && (!Number.isInteger(panelSearchOptions.value.minArtifactLevel) || panelSearchOptions.value.minArtifactLevel < 0 || panelSearchOptions.value.minArtifactLevel > 20)) throw new Error('圣遗物最低等级必须为0至20的整数')
        optimizeInterface = panelMode ? getPanelOptimizeInterface() : getOptimizeArtifactWasmInterface()
        artifacts = getArtifactsToBeCalculated()
        if (panelMode) panelSnapshot = {
            input: optimizeInterface, options: deepCopy(panelSearchOptions.value),
            baseline: readPanel(mona,optimizeInterface,artifactWasmFormat.value),
            items: Object.fromEntries(artifacts.map(a=>[a.id,deepCopy(artifactStore.getArtifact(a.id))])),
        }
        debug?.capture(optimizeInterface,artifacts,{allowBorrowEquipped:allowBorrowEquipped.value,minimumArtifactLevel:panelMode?panelSearchOptions.value.minArtifactLevel:16,sandMainStats:constraintSandMainStats.value,gobletMainStats:constraintGobletMainStats.value,headMainStats:constraintHeadMainStats.value,reservedOtherCharacterCount:reservedArtifactIds.value.size})
        debugEvent({phase:'parameters-prepared'})
        if (!artifacts.length) throw new Error('没有符合条件的圣遗物，请检查仓库、主词条筛选及其他角色穿戴保护开关')
    } catch (error: any) { reportError(error); return }


    optimizationProgress.value={percent:null,candidateSpace:null,evaluated:0,remainingGroups:null,etaMs:null}
    optimizationElapsed.value=0
    optimizationCancelled.value=false
    optimizationProgressReceivedElapsed.value=0
    optimizationInBackground=false
    showOptimizationProgress.value=true
    optimizationRunning.value=true
    activeOptimizationMode.value=panelMode?'panel':'damage'
    optimizationClock=setInterval(()=>{optimizationElapsed.value=Date.now()-start.getTime()},250)

    const runOptimize = panelMode ? wasmPanelOptimize : wasmSingleOptimize
    const items=Object.fromEntries([...artifactStore.artifacts.value.values()].map(a=>[a.id,deepCopy(a)]))
    const historyDetail={input:optimizeInterface,items,artifacts,view:{preset:getPresetItem(),skill:deepCopy(characterSkillInterface.value),enemy:deepCopy(enemyConfig.value),infusion:fumo.value,singleConfig:deepCopy(artifactSingleConfig.value)}}
    const job=calculationHistory.start({accountId:originalAccount,kind:'single',label:characterLocale.value,members:historyMembers([optimizeInterface],items,[[]])},historyDetail,async ({signal,onProgress}:any)=>{
        const results=await runOptimize(optimizeInterface,artifacts,{signal,onDebug:debug?debugEvent:undefined,onProgress:(progress:any)=>{onProgress(progress);optimizationProgress.value=progress;optimizationProgressReceivedElapsed.value=Date.now()-start.getTime()}})
        return {detail:{...historyDetail,results,panelSnapshot:panelMode?panelSnapshot:null},summary:{members:historyMembers([optimizeInterface],items,[results.length?buildIds(results[0]):[]])}}
    })
    const controller=job.controller
    optimizationAbortController=controller
    job.promise.then(async ({detail}:any) => {
        const results=detail.results
        if (controller.signal.aborted) return
        debug?.complete(results); triggerRef(optimizationDebugRecord)
        if (optimizationInBackground || !calculationPageActive) return
        if (originalKey !== comparisonKey.value || originalAccount !== accountStore.currentAccountId.value || originalOwnershipFilter !== ownershipFilterKey.value) { showOptimizationProgress.value=false; return }
        if (JSON.stringify(panelMode?getPanelOptimizeInterface():getOptimizeArtifactWasmInterface()) !== JSON.stringify(optimizeInterface) || JSON.stringify(getArtifactsToBeCalculated()) !== JSON.stringify(artifacts)) { showOptimizationProgress.value=false; return }
        const end = new Date()
        // @ts-ignore
        console.log(`time: ${(end - start) / 1000}s`)

        if (results.length === 0) {
            showOptimizationProgress.value=false
            ElMessage.error({
                message: "没有符合条件的圣遗物"
            })
            return
        }
        resultSearchInput.value=panelMode?null:optimizeInterface
        optimizationResults.value = results
        artifactSnapshot.value = null
        panelResultSnapshot.value = panelMode ? panelSnapshot : null
        beginArtifactComparison(originalEquipment)
        await handleUseNthOptimizationResult(1)
        if (controller.signal.aborted) { optimizationCancelled.value=true; return }
        if (optimizationInBackground || !calculationPageActive) return
        showCalculatedEquipment()

        // report best result to server, only report player whose 20 artifacts count is above 100
        if (!panelMode && !debug && !process.env.MONA_MOBILE && artifactStore.artifacts20Count.value >= 100 && process.env.NODE_ENV === 'production') {
            let result_artifacts_wasm_format: any[] = []
            let first_result = results[0]
            result_artifacts_wasm_format.push(first_result.flower)
            result_artifacts_wasm_format.push(first_result.feather)
            result_artifacts_wasm_format.push(first_result.sand)
            result_artifacts_wasm_format.push(first_result.goblet)
            result_artifacts_wasm_format.push(first_result.head)
            result_artifacts_wasm_format = result_artifacts_wasm_format
                .filter(v => v !== null && v !== undefined)
                .map(id => artifactStore.artifacts.value.get(id))
                .filter(a => !!a)
                .map(a => convertArtifact(a))

            // the return value can be omitted, because there's nothing valuable
            createComputeResult(
                characterInterface.value,
                weaponInterface.value,
                effectiveBuffs.value,
                targetFunctionInterface.value,
                result_artifacts_wasm_format
            )
        }
    }).catch(e => {
        if (e.name==='AbortError') { optimizationCancelled.value=true; debug?.cancel(); triggerRef(optimizationDebugRecord); return }
        showOptimizationProgress.value=false
        reportError(e)
    }).finally(() => {
        clearInterval(optimizationClock)
        optimizationAbortController=undefined
        optimizationElapsed.value=Date.now()-start.getTime()
        optimizationRunning.value=false
        activeOptimizationMode.value=null
    })
}

const panelSettingsKey = computed(() => JSON.stringify([
    optimizationMode.value,characterInterface.value,weaponInterface.value,effectiveBuffs.value,teamContextKey.value,
    artifactConfig.value,panelSearchOptions.value,constraintSetMode.value,
    constraintSandMainStats.value,constraintGobletMainStats.value,constraintHeadMainStats.value,
    filteredKumiIds.value,allowBorrowEquipped.value,
]))
function invalidatePanelResults() {
    if (restoringHistory) return
    if (panelResultSnapshot.value) {
        showOptimizationResults.value=false
        panelResultSnapshot.value=null
        optimizationResults.value=[]
        optimizationResultIndex.value=0
    }
}
function invalidateDamageResults(){
    if(restoringHistory||!resultSearchInput.value||panelResultSnapshot.value)return
    resultSearchInput.value=null;optimizationResults.value=[];optimizationResultIndex.value=0;showOptimizationResults.value=false
}
watch(()=>resultSearchInput.value?JSON.stringify(getOptimizeArtifactWasmInterface()):'',key=>{
    if(resultSearchInput.value && (optimizationMode.value!=='damage'||key!==JSON.stringify(resultSearchInput.value)))invalidateDamageResults()
})
watch(optimizationMode,()=>{if(optimizationMode.value!=='damage')invalidateDamageResults()})
watch(()=>artifactStore.artifacts.value,()=>{if(!artifactSnapshot.value)invalidateDamageResults()},{deep:true})
watch(panelSettingsKey,invalidatePanelResults)
watch(() => artifactStore.artifacts.value,invalidatePanelResults,{deep:true})

watch(() => [accountStore.currentAccountId.value, accountStore.reloadGeneration.value], () => {
    backgroundOptimization()
    resetComparisonBaseline()
    optimizationResults.value = []
    panelResultSnapshot.value = null
    optimizationResultIndex.value = 0
    miscCurrentPresetName.value = null
    artifactIds.value = [-1, -1, -1, -1, -1]
    artifactSnapshot.value = null
    restoredTeamContext.value = null
})

async function restoreCalculationHistory(id:string) {
    if (restoringHistory) return
    restoringHistory = true
    const accountId=accountStore.currentAccountId.value
    try {
        const detail=await calculationHistory.read(accountId,Number(id))
        if (!detail || accountId!==accountStore.currentAccountId.value || String(route.query.history)!==id) return
        usePreset('',{...detail.view.preset,buffs:detail.input.buffs,teamContext:[]})
        characterSkillIndex.value=detail.view.skill.index
        characterSkillConfig.value=deepCopy(detail.view.skill.config)
        enemyConfig.value=deepCopy(detail.view.enemy)
        fumo.value=detail.view.infusion
        artifactSingleConfig.value=deepCopy(detail.view.singleConfig)
        await nextTick()
        restoredTeamContext.value=deepCopy(detail.input.team_context||null)
        artifactSnapshot.value=deepCopy(detail.items)
        resultSearchInput.value=detail.panelSnapshot?null:deepCopy(detail.input)
        if(detail.view.preset.artifactIds)restoreSessionBaseline(detail.view.preset.artifactIds.map((id:number)=>detail.items[id]||null))
        optimizationResults.value=deepCopy(detail.results||[])
        panelResultSnapshot.value=deepCopy(detail.panelSnapshot||null)
        if (optimizationResults.value.length) {
            artifactIds.value=buildIds(optimizationResults.value[0])
            if (panelResultSnapshot.value) artifactSingleConfig.value=deepCopy(panelResultSnapshot.value.input.artifact_config)
            optimizationResultIndex.value=1
        }
        showResult()
        await nextTick()
    } catch(error:any) { ElMessage.error('读取计算历史失败：'+error.message) }
    finally { restoringHistory=false }
}
watch(()=>route.query.history,()=>{if(route.path==='/calculate'&&route.query.history)restoreCalculationHistory(String(route.query.history))})
</script>

<style lang="scss" scoped>
.return-to-result{margin:0 0 10px}
.calculator-page.review-mode.has-candidates .calc-command .calc-run{background:#fff;color:#305472;border:1px solid #a6bfd5}
@media(max-width:700px){
 .review-mode .calc-toolbar .preset-actions{max-width:54%}
 .review-mode .preset-actions :deep(.m-button-group){display:flex;flex-wrap:nowrap;align-items:center;gap:2px}
 .review-mode .preset-actions :deep(.m-button-group button){min-width:0;min-height:36px;min-inline-size:0;margin:0;padding:0 8px;white-space:nowrap}
}

.calc-content {
    container: single-calculator / inline-size;
    padding: clamp(10px, 1.3vw, 18px);
    border-radius: 16px;
    background: #f6f8fb;
    color: #303849;
    font-family: system-ui, "Microsoft YaHei", sans-serif;
    font-variant-numeric: tabular-nums;
    --el-component-size: 36px;
}
.calc-toolbar, .card-heading, .card-actions, .panel-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
}
.calc-toolbar, .card-heading { justify-content: space-between; }
.calc-toolbar { padding-bottom: 14px; border-bottom: 1px solid #e4e9f2; }
.calc-toolbar h2, .card-heading h3 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-weight: 650;
    letter-spacing: .02em;
    line-height: 1.35;
}
.calc-toolbar h2 { font-size: 25px; }
.card-heading { margin-bottom: 16px; }
.card-heading h3 { font-size: 20px; }
.calc-toolbar h2 svg, .card-heading h3 svg { color: #568de0; width: 1.1em; height: 1.1em; }
.preset-actions, .preset-actions :deep(.el-dropdown), .preset-actions :deep(.el-button-group) { min-width: 0; max-width: 100%; }
.preset-actions :deep(.el-button-group) { display: flex; }
.preset-actions :deep(.el-button:first-child) { min-width: 0; }
.preset-actions :deep(.el-button:first-child > span) { overflow: hidden; text-overflow: ellipsis; display: block; }
.calc-action-bar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 0;
    background: #f6f8fb;
}
.calc-jumps, .calc-mobile-tabs { display: flex; gap: 6px; }
.calc-run { flex-shrink: 0; margin: 0; border-radius: 8px; font-weight: 600; }
.calc-jumps button, .calc-mobile-tabs button {
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 7px 12px;
    background: transparent;
    color: #526985;
    font: inherit;
    font-size: 15px;
    cursor: pointer;
}
.calc-jumps button:hover, .calc-mobile-tabs button[aria-pressed=true] { border-color: #c5d8f1; color: #386da9; background: #e7f1ff; }
.calc-mobile-tabs { display: none; }
.calc-mobile-tabs .compact-name { display: none; }
/* Configure from top to bottom while the live panel stays in view. */
.calc-workspace { --side-width: clamp(280px,24cqi,420px); display: grid; grid-template-columns: minmax(0,1fr) var(--side-width); gap: 14px; align-items: start; }
.calc-editor, .identity-row { min-width: 0; display: grid; gap: 14px; align-content: start; }
.calc-editor { grid-template-columns: minmax(0,1fr); }
.identity-row { grid-template-columns: minmax(0,0.9fr) minmax(0,1.1fr); align-items: start; gap: 20px; }
.config-character, .config-weapon { min-width: 0; }
.config-weapon { border-left: 1px solid var(--hairline); padding-left: 20px; }
.config-buff { container: buff-board / inline-size; display: flex; flex-direction: column; max-height: min(600px,70dvh); box-sizing: border-box; }
.config-buff > .card-heading { flex-shrink: 0; }
.config-buff .buffs { min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-gutter: stable; scrollbar-width: thin; scrollbar-color: var(--rule) transparent; padding-right: 8px; }
.config-weapon { container: single-weapon / inline-size; }
.config-weapon :deep(.detail-body) { min-width: 0; }
.config-weapon :deep(.detail .image) { flex-shrink: 0; }
.config-weapon :deep(.detail .name) { font-size: 15px; margin: 0 0 4px; }
.config-weapon :deep(.detail .description) { font-size: 15px; line-height: 1.65; word-break: normal; overflow-wrap: anywhere; }
.config-character .constellation-line { display: grid; grid-template-columns: repeat(7,minmax(0,1fr)); column-gap: 4px; }
.config-character .constellation-line > span { grid-column: 1/-1; }
.config-character .constellation-line button { min-width: 0; min-height: 40px; padding-inline: 0; }
.artifacts-card { container: single-gear / inline-size; }
.damage-analysis-div :deep(.el-table .cell) { padding-inline: 4px; }
.calc-card { min-width: 0; padding: 18px; background: white; border: 1px solid #e2e7ef; border-radius: 14px; box-shadow: 0 8px 24px #24395708; scroll-margin-top: 58px; }
.calc-field { display: flex; flex-direction: column; min-width: 0; gap: 6px; }
.calc-field > span, .constellation-line > span { font-size: 15px; font-weight: 600; color: #5d6b81; }
.character-fields, .weapon-fields { display: grid; gap: 12px; align-items: start; }
.character-fields { grid-template-columns: 2fr 1fr; }
.talent-fields { min-width: 0; margin: 16px 0 10px; padding: 0; border: 0; }
.talent-fields legend { padding: 0; margin-bottom: 4px; font-size: 15px; font-weight: 600; color: #5d6b81; }
.talent-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 5px 0; }
.talent-row + .talent-row { border-top: 1px solid #edf0f5; }
.talent-row > span { font-size: 15px; color: #35465d; }
.talent-row .el-input-number { width: 120px; max-width: 55%; }
.talent-row :deep(.el-input__wrapper) { padding-inline: 34px; }
.talent-row :deep(.el-input-number__decrease), .talent-row :deep(.el-input-number__increase) { width: 32px; border: 0; background: #eff4fa; color: #476584; }
.talent-row :deep(input) { font-weight: 600; font-variant-numeric: tabular-nums; }
.weapon-fields { grid-template-columns: 2fr 1fr 1fr; margin-bottom: 14px; }
.enemy-infusion { max-width: 560px; margin-bottom: 16px; container: enemy-infusion / inline-size; }
.enemy-infusion :deep(.el-radio-group) { display: grid; grid-template-columns: repeat(8,minmax(0,1fr)); }
.enemy-infusion :deep(.el-radio-button__inner) { display: block; width: 100%; box-sizing: border-box; padding-inline: 3px; }
@container enemy-infusion (max-width: 410px) {
    .enemy-infusion :deep(.el-radio-group) { grid-template-columns: repeat(4,minmax(0,1fr)); }
}
.damage-skill { margin-bottom: 14px; }
.enemy-infusion .common-title2, .damage-skill .common-title2 { margin-top: 0; }
.calc-field > :last-child, .damage-skill :deep(.el-select) { width: 100%; min-width: 0; }
.constellation-line, .panel-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.constellation-line { border-top: 1px solid #e9edf3; padding-top: 12px; }
.constellation-line > span { margin-right: 5px; }
.constellation-line button { font: inherit; font-size: 15px; font-weight: 600; background: #fff; border: 1px solid #dce4ef; color: #637690; border-radius: 8px; min-width: 38px; min-height: 36px; cursor: pointer; }
.constellation-line button[aria-pressed=true] { color: #356da9; background: #e7f1ff; border-color: #88afe0; }
.character-extra-config, .weapon-extra-config { margin-top: 14px; }
.calc-card :deep(.config-root) { background: #f4f8fe; border: 1px solid #e1eaf5; border-radius: 10px; }
.calc-card :deep(.el-table) { --el-table-header-bg-color: #f6f8fc; --el-table-row-hover-bg-color: #f0f6ff; }
.calc-card :deep(.el-input__wrapper) { border-radius: 8px; }
.calc-content .el-button + .el-button { margin-left: 0; }
.card-actions :deep(.el-button-group), .artifact-tool :deep(.el-button-group), .optimization-actions :deep(.el-button-group) { display: flex; flex-wrap: wrap; gap: 6px; }
.calc-card .el-button { border-radius: 8px; }
.optimization-actions { border-top: 1px solid #e9edf3; padding-top: 14px; }
.artifacts { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit,minmax(min(100%,200px),1fr)); grid-auto-rows: minmax(64px,auto); }
@container single-gear (min-width: 555px) { .artifacts { grid-template-columns: repeat(3,minmax(0,1fr)); } }
@container single-gear (min-width: 910px) { .artifacts { grid-template-columns: repeat(5,minmax(0,1fr)); } }
.artifact-item-or-button { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.slot-name { color: #526985; font-size: 14px; font-weight: 600; }
.artifact-tool { margin: 14px 0 10px; display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
.score-basis-button,.score-status{margin-left:auto}.score-error{color:var(--el-color-danger);overflow-wrap:anywhere}
.artifacts-card .artifact-comparison-controls { margin: 0; }
.artifacts :deep(.artifact .up .buttons button) { margin-left: 3px; }
.artifacts :deep(.artifact .down .sec-tag) { font-size: 13px; color: #637187; }
.artifacts :deep(.artifact .down .main-tag) { font-size: 14px; }
.artifacts :deep(.artifact .up .name) { font-size: 13px; }
.artifacts .add-button { flex: 1; min-height: 64px; }
.artifact-item-or-button .add-button, .artifact-item-or-button .artifact-display { box-sizing: border-box; width: 100%; }
.panel-identity { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.panel-identity img { width: 48px; height: 48px; object-fit: cover; border: 1px solid #ccdae9; border-radius: 50%; background: #f2f6fc; }
.panel-identity strong { font-size: 20px; }
.panel-badges { margin-top: 5px; }
.panel-badges span { font-size: 13px; font-weight: 600; padding: 2px 8px; border-radius: 12px; color: #526f96; background: #edf3fb; }
.panel-card { position: sticky; top: 54px; max-height: calc(100dvh - 64px); overflow-y: auto; box-sizing: border-box; }
.panel-actions { gap: 8px; margin-top: 14px; }
.panel-card :deep(.class) { color: #536680; margin: 12px 0 4px; font-size: 16px; }
.panel-card :deep(.attribute-item) { padding: 4px 0; line-height: 1.45; border-bottom: 1px solid #edf0f5; }
.panel-card :deep(.attribute-item .title) { color: #65758a; font-weight: 500; }
.panel-card :deep(.attribute-item .value) { font-weight: 650; }
@container single-weapon (max-width: 480px) {
    .weapon-fields { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .weapon-fields > :first-child { grid-column: 1/-1; }
}
@container single-calculator (max-width: 820px) {
    .calc-action-bar { z-index: 100; }
    .calc-jumps { display: none; }
    .calc-mobile-tabs { display: flex; flex: 1; min-width: 0; }
    .calc-mobile-tabs button { flex: 1; padding: 6px 4px; min-height: 42px; font-size: 14px; background: #fff; border-color: #dce4ef; }
    .calc-run { min-height: 42px; padding-inline: 12px; }
    .calc-workspace { grid-template-columns: minmax(0,1fr); }
    .calc-card { padding: 14px; }
    .panel-card { position: static; max-height: none; overflow: visible; }
    .identity-row { grid-template-columns: minmax(0,1fr); }
    .config-weapon { border-left: 0; padding: 16px 0 0; border-top: 1px solid var(--hairline); }
    .mobile-section-character .equipment-section, .mobile-section-equipment .setup-section,
    .mobile-section-character .panel-card, .mobile-section-equipment .panel-card, .mobile-section-panel .calc-editor { display: none; }
}
@media (max-width: 767px) {
    .calc-action-bar { top: 48px; }
}
@container single-calculator (max-width: 520px) {
    .calc-mobile-tabs span { display: none; }
    .calc-mobile-tabs .compact-name { display: inline; }
    .calc-toolbar h2 { font-size: 22px; }
    .card-heading h3 { font-size: 18px; }
    .constellation-line > span { width: 100%; }
    .constellation-line button { flex: 1; min-width: 30px; min-height: 40px; padding: 0 3px; }

    .panel-card :deep(.attribute-item .value > span) { white-space: normal; }
}

.transformative-damage{margin-top:24px}.transformative-damage summary{cursor:pointer}
.optimization-progress-stats p{display:flex;justify-content:space-between;gap:16px;margin:16px 0}.optimization-progress-stats b{color:var(--el-color-primary)}
.filter-kumi-search { margin-bottom: 12px; }
.filter-kumi-node { display: flex; align-items: center; gap: 6px; min-width: 0; }
.filter-kumi-node img { width: 24px; height: 24px; border-radius: 50%; }
.filter-kumi-node > span { overflow: hidden; text-overflow: ellipsis; }
.preset-menu { width: 360px; max-width: calc(100vw - 32px); }
.preset-menu-filters { display: flex; gap: 8px; padding: 12px; border-bottom: 1px solid var(--el-border-color-light); }
.preset-menu-filters .el-select { flex: 1; min-width: 0; }
.preset-menu-list { max-height: min(55vh, 480px); overflow-y: auto; }
.preset-menu-list :deep(.el-dropdown-menu__item) { white-space: normal; overflow-wrap: anywhere; }

.optimization-debug-control{margin:12px 0;padding:12px;border:1px solid #dcdfe6;border-radius:5px}.optimization-debug-control .el-alert{margin-top:10px}.optimization-debug-control details{margin-top:10px}.optimization-debug-control pre{max-height:280px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}

.team-context-control{padding:12px;margin:0 0 14px;border:1px solid #e4e7ed;border-radius:6px;background:#f8faff}.team-context-control :deep(.el-alert){margin-top:8px}.team-source-card{display:flex;flex-direction:column;gap:9px;padding:12px;margin-top:10px;border:1px solid #e0e7f0;border-radius:6px;background:white;font-size:13px}.team-source-gear{color:#667085;font-size:12px}.team-source-id{display:flex;align-items:center;gap:10px}.team-source-id :deep(.el-input){flex:1}.team-trigger-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.team-context-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:13px}
.manual-buff-source{display:flex;align-items:center;gap:8px;padding:0 8px 8px;color:#667085;font-size:12px}.manual-buff-source :deep(.el-select){min-width:130px;flex:1}
.artifact-borrowing-control{padding:12px;margin-bottom:12px;border:1px solid #e4e7ed;border-radius:6px;background:#f5f8fc}.artifact-borrowing-control label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;line-height:1.6}.artifact-borrowing-control .el-switch{flex-shrink:0}
.artifact-grade-summary{padding:4px 10px;background:var(--el-color-primary-light-9);border-radius:6px;color:var(--el-text-color-primary)}
.artifact-grade-summary>div{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px}.artifact-grade-summary strong{font-size:20px;color:var(--el-color-primary)}.artifact-grade-summary b{font-size:19px;color:var(--el-color-primary)}
.artifact-piece-score{padding:7px 8px;border-top:1px solid var(--el-border-color-lighter);font-size:12px;color:var(--el-color-primary);display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap}
.artifact-change-marker{display:inline-block;border-radius:3px;padding:2px 6px;background:var(--el-color-warning-light-9);color:var(--el-color-warning-dark-2);font-size:12px;line-height:1.4}
.polestar-field-control {
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    .polestar-field-stacks { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; font-size: 14px; }
    .el-input-number { width: 100%; }
}
.config-target-function {
    .target-function-detail {
        display: flex;
        //align-items: top;
        margin-top: 16px;

        .detail-left {
            width: 64px;
            margin-right: 16px;

            img {
                height: 64px;
                width: 64px;
                border-radius: 50%;
            }
        }

        .detail-right {
            .target-function-description {
                margin: 0;
                font-size: 14px;
                color: #555555;
            }
        }
    }
}

.common-title2, .constraint-title {
    margin: 14px 0 7px;
    color: #5d6b81;
    font-size: 15px;
    font-weight: 600;
}

.common-description {
    font-size: 0.7rem;
    color: #606266;
}

 //artifact effect description title
.effect4, .effect2 {
    color: #6eb7ff;
}

.constraint-main-stat-item {
    display: flex;
    align-items: center;
    margin-bottom: 12px;

    &:last-of-type {
        margin-bottom: 0;
    }

    span {
        width: 48px;
        font-size: 0.7rem;
    }
}

//@media only screen and (min-width: 992px) {
//    .constraint-min-item {
//        display: flex;
//        align-items: center;
//
//        .constraint-min-title {
//            font-size: 0.7rem;
//            width: 7vw;
//        }
//    }
//}
//
//@media only screen and (max-width: 992px) {
//    .constraint-min-item {
//        .constraint-min-title {
//            font-size: 0.7rem;
//            display: block;
//        }
//    }
//}

.constraint-min-item {
    .constraint-min-title {
        font-size: 0.7rem;
        display: block;
    }

    .slider-div {
        width: 100%;
    }
}
</style>

<style scoped src="./calculation-workbench.css"></style>

<style scoped src="../../styles/artifact-score.css"></style>

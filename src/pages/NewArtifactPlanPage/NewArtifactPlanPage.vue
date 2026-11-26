<template>
    <div class="calculator-page">
        <el-dialog :model-value="!!pendingDraft" title="是否恢复上次单次计算进度？" width="min(440px, 94vw)" custom-class="cx-scope"
            :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false">
            <div v-if="pendingDraft">上次计算角色：<strong>{{ ta(scoreCharacters[pendingDraft.preset.character.name].nameLocale) }}</strong></div>
            <template #footer>
                <el-button :disabled="resumingDraft" @click="discardDraft">重新开始</el-button>
                <el-button type="primary" :loading="resumingDraft" @click="resumeDraft">恢复进度</el-button>
            </template>
        </el-dialog>
        <RosterEditDialog ref="saveGameDialog" :character="characterLocale" />
        <el-dialog v-model="showOptimizationProgress" :title="optimizationRunning ? '计算进度' : optimizationCancelled ? '计算已取消' : '计算成功'" width="min(520px, 94vw)" :close-on-click-modal="false" :close-on-press-escape="!optimizationRunning" :show-close="!optimizationRunning" class="optimization-progress-dialog" custom-class="cx-scope">
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
        <optimization-results-dialog v-if="showOptimizationResults && !panelResultSnapshot" v-model="showOptimizationResults" :results="optimizationResults" :input="damageAnalysisWasmInterface" :infusion="fumo" :mona="mona" :get-artifact="getResultArtifact" :selected-index="reviewIndex"
            :charge-min="resultSearchInput?.constraint?.recharge_min" :objective-label="resultObjectiveLabel" :objective-before="reviewDsl?.before"
            :baseline-analysis="comparisonDamage.value" :baseline-label="reviewBaselineLabel" :skill-label="reviewSkill" @select="applyReviewCandidate" />
        <panel-results-dialog v-if="showOptimizationResults && panelResultSnapshot" v-model="showOptimizationResults" :results="optimizationResults" :snapshot="panelResultSnapshot" :selected-index="optimizationResultIndex" @select="applyReviewCandidate" />
        <artifact-score-dialog v-if="showArtifactScore" v-model="showArtifactScore"
            :item="artifactItems[scoreArtifactIndex]" :context="artifactScoreContext" :equipped="artifactItems" :dynamic-result="useNewScore ? dynamicScore : null" @dynamic="showArtifactScore=false;openDynamicScore()"
            @replace="replaceScoredArtifact" />
        <el-dialog
            :title="t('calcPage.selectArt')"
            :width="deviceIsPC ? '80%' : '90%'"
            custom-class="cx-scope"
            v-model="showSelectArtifactDialog"
        >
            <select-artifact
                :position="selectArtifactSlot"
                :highlight-tags="characterArtifactHighlights(characterName)"
                @select="handleSelectArtifact"
            ></select-artifact>
        </el-dialog>

<!--        damage analysis-->
        <el-dialog custom-class="cx-scope"
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
        <el-dialog custom-class="cx-scope viewport-dialog"
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

        <CalcErrorDialog v-model="optimizationErrorDialog" :message="optimizationError" @export="exportOptimizationDebug" />

<!--    computation setup    -->
        <el-dialog custom-class="cx-scope viewport-dialog"
            v-model="showConstraintDialog"
            :title="t('calcPage.setupCalc')"
            :width="deviceIsPC ? '400px' : '90%'"
        >

            <div class="optimization-debug-control">
                <el-switch v-model="optimizationDebugEnabled" active-text="Debug 模式" aria-label="Debug 模式" />
                <el-button size="small" :disabled="!optimizationDebugRecord" @click="exportOptimizationDebug">导出调试包</el-button>
                <span v-if="optimizationDebugRecord"> {{ optimizationDebugRecord.status === 'failed' ? '计算失败' : optimizationDebugRecord.status === 'completed' ? '计算完成' : optimizationDebugRecord.status === 'cancelled' ? '计算已取消' : '记录中' }} · 候选 {{ optimizationDebugRecord.summary?.candidateCount ?? 0 }} 件</span>
                <el-alert v-if="optimizationError" type="error" :closable="false" title="配装计算未完成" :description="optimizationError" show-icon />
                <details v-if="optimizationDebugRecord?.events.length"><summary>查看调试阶段与错误详情</summary><pre>{{ optimizationDebugDetail }}</pre></details>
            </div>
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
                <select-artifact-set multiple v-model="constraintArtifactSet"
                    :style="{ width: '100%' }" :placeholder="t('calcPage.constSet')" />
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
        <el-dialog custom-class="cx-scope"
            v-model="showArtifactAnalysisDialog"
            :title="t('calcPage.artAnalysis')"
            :width="deviceIsPC ? '60%' : '90%'"
        >
            <artifacts-set-statistics
                :artifact-ids="artifactIds"
            ></artifacts-set-statistics>
        </el-dialog>

<!--    stats marginal bonus    -->
        <el-dialog custom-class="cx-scope viewport-dialog condition-settings-dialog" modal-class="condition-settings-overlay" append-to-body
            v-model="showOptimalGainCurve" title="最优词条收益曲线" width="min(1100px, 94vw)" destroy-on-close>
            <optimal-stat-gain-curve v-if="showOptimalGainCurve"
                :input="damageAnalysisWasmInterface" :analysis="characterDamageAnalysis" :fumo="fumo" :account-id="accountStore.currentAccountId.value" />
        </el-dialog>
        <el-dialog custom-class="cx-scope viewport-dialog condition-settings-dialog" modal-class="condition-settings-overlay" append-to-body
            v-model="showArtifactPerBonusDialog"
            :title="t('calcPage.statCurve')"
            width="min(1100px, 94vw)"
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
        <el-dialog custom-class="cx-scope"
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


<!--        artifact config-->
        <el-dialog custom-class="cx-scope viewport-dialog"
            v-model="showConfigArtifactDialog"
            :title="t('calcPage.setupArt')"
            :width="deviceIsPC ? '60%' : '90%'"
        >
            <PresetExclusionFilter v-model="miyousheStore.data.value.excludedArtifactPresets" :groups="exclusionGroups" />
            <h3 class="common-title2">{{ t("calcPage.artMode") }}</h3>
            <el-radio-group v-model="artifactEffectMode" :aria-label="t('calcPage.artMode')">
                <el-radio-button label="auto">{{ t('calcPage.modeAuto') }}</el-radio-button>
                <el-radio-button label="custom">{{ t('calcPage.modeCustom') }}</el-radio-button>
            </el-radio-group>
            <artifact-config
                v-model="artifactConfig"
                v-if="artifactEffectMode === 'custom'"
            ></artifact-config>
        </el-dialog>

        <el-dialog v-model="showDefaultCharacters" custom-class="cx-scope viewport-dialog" title="默认角色" :width="deviceIsPC ? 'min(1000px, 94vw)' : '96%'" destroy-on-close>
            <default-character-picker v-if="showDefaultCharacters" @select="name => pendingCharacterSwitch = { source: 'default', name }" />
        </el-dialog>
        <el-dialog v-model="showMyCharacters" custom-class="cx-scope viewport-dialog" title="选择角色预设" :width="deviceIsPC ? 'min(1000px, 94vw)' : '96%'" destroy-on-close>
            <miyoushe-character-picker v-if="showMyCharacters" @apply="(name, loadout) => pendingCharacterSwitch = { source: 'saved', name, loadout }" />
        </el-dialog>
        <el-dialog :model-value="!!pendingCharacterSwitch" @update:model-value="open => { if (!open) pendingCharacterSwitch = null }"
            custom-class="cx-scope" title="切换角色" width="min(400px, 92vw)">
            是否保留当前 BUFF、圣遗物等计算条件？
            <template #footer>
                <el-button @click="finishCharacterSwitch(false)">{{ pendingCharacterSwitch?.source === 'saved' ? '否，使用角色预设' : '否，清空' }}</el-button>
                <el-button type="primary" @click="finishCharacterSwitch(true)">是，保留</el-button>
            </template>
        </el-dialog>
        <el-alert v-if="betaCalculationError" type="error" :closable="false" show-icon :title="betaCalculationError" style="margin-bottom:16px" />
        <div class="calc-content cx-scope" data-theme="mist">
            <calc-top-bar :target-label="optimizeTargetLabel" :running="optimizationRunning || dynamicScoreState.running"
                @target="optimizeSettingsOpen = true" @calculation-settings="handleClickSetupOptimization"
                @artifact-settings="handleClickArtifactConfig"
                @run="optimizeSettingsOpen = false; handleOptimizeArtifact()">
                <template #preset>
                    <div class="preset-actions">
                        <el-dropdown split-button trigger="click" @click="handleSavePreset(miscCurrentPresetName)" @command="handleClickSaveOptimizeConfig()">
                            <template v-if="!miscCurrentPresetName">{{ t("calcPage.newPreset") }}</template>
                            <template v-else>{{ t("calcPage.savePreset") }}「{{ presetStore.displayName(miscCurrentPresetName) }}」</template>
                            <template #dropdown><el-dropdown-menu>
                                <el-dropdown-item command="save-as">{{ t('calcPage.saveAsPreset') }}</el-dropdown-item>
                            </el-dropdown-menu></template>
                        </el-dropdown>
                    </div>
                </template>
            </calc-top-bar>
            <el-dialog v-model="optimizeSettingsOpen" title="配装设置" width="min(560px, 94vw)"
                custom-class="cx-scope optimization-target-dialog" modal-class="optimization-target-overlay" append-to-body>
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
                        <el-button @click="optimizeSettingsOpen = false; showOptimizationResults=true" style="margin-bottom:12px" class="view-optimization-results">点开查看所有搭配</el-button>
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

            </el-dialog>
            <el-dialog v-model="characterDrawerOpen" title="角色" width="min(640px, 94vw)"
                custom-class="cx-scope viewport-dialog condition-settings-dialog" modal-class="condition-settings-overlay" append-to-body destroy-on-close>
                <div class="condition-settings-content" data-theme="mist">
                        <section class="config-character setup-section">
                            <div class="calc-field"><span>角色等级</span><select-character-level v-model="characterLevel" aria-label="角色等级" /></div>
                            <div class="character-progress">
                                <CharacterTalentCards :entry="characterCardEntry">
                                    <template #editor>
                                        <div class="talent-editor">
                                            <div class="calc-field"><span>{{ t('skillType.a') }}</span><el-input-number v-model="characterSkill1" :label="t('skillType.a')" :min="1" :max="15" /></div>
                                            <div class="calc-field"><span>{{ t('skillType.e') }}</span><el-input-number v-model="characterSkill2" :label="t('skillType.e')" :min="1" :max="15" /></div>
                                            <div class="calc-field"><span>{{ t('skillType.q') }}</span><el-input-number v-model="characterSkill3" :label="t('skillType.q')" :min="1" :max="15" /></div>
                                        </div>
                                    </template>
                                </CharacterTalentCards>
                                <CharacterConstellation :entry="characterCardEntry" direct-selection @change-rank="characterConstellation = $event" />
                            </div>
                            <div class="character-extra-config" v-if="characterNeedConfig">
                                <item-config
                                    v-model="characterConfig"
                                    :item-name="characterName"
                                    :configs="characterConfigConfig"
                                ></item-config>
                            </div>
                            <fieldset v-if="isTraveler(characterName)" class="traveler-resonance">
                                <legend>旅行者共鸣元素 · 真实之月</legend>
                                <el-checkbox-group v-model="travelerResonance" aria-label="旅行者共鸣元素">
                                    <el-checkbox v-for="element in travelerElements" :key="element" :label="element">{{ t('ele', element) }}</el-checkbox>
                                </el-checkbox-group>
                            </fieldset>
                        </section>
                </div>
            </el-dialog>
            <el-dialog v-model="weaponDrawerOpen" :close-on-press-escape="!weaponPickerOpen" title="武器" width="min(760px, 94vw)"
                custom-class="cx-scope viewport-dialog condition-settings-dialog" modal-class="condition-settings-overlay" append-to-body>
                <div class="condition-settings-content" data-theme="mist">
                        <section class="config-weapon setup-section">
                            <div class="weapon-fields">
                                <div class="calc-field"><span>武器等级</span><select-weapon-level v-model="weaponLevel" aria-label="武器等级" /></div>
                                <label class="calc-field"><span>{{ t('misc.refine') }}</span><el-input-number v-model="weaponRefine" controls-position="right" :min="1" :max="weaponMaxRefine" :aria-label="t('misc.refine')" /></label>
                            </div>
                            <weapon-display :weapon="weaponInterface">
                                <template #image="{ src }">
                                    <button ref="weaponPickerTrigger" type="button" class="weapon-picker-trigger"
                                        aria-label="选择武器" aria-haspopup="dialog" @click="weaponPickerOpen = true">
                                        <img :src="src" alt="" />
                                    </button>
                                </template>
                            </weapon-display>
                            <div class="weapon-extra-config" v-if="weaponNeedConfig">
                                <item-config
                                    v-model="weaponConfig"
                                    :item-name="weaponName"
                                    :configs="weaponConfigConfig"
                                ></item-config>
                            </div>
                        </section>
                </div>
            </el-dialog>
            <CharacterWeaponPicker v-model="weaponPickerOpen" :character-label="characterLocale" :weapon-type="characterWeaponType"
                :weapon-key="weaponName" :weapon="weaponInterface" :signatures="characterSignatureWeapons(characterName)"
                :return-focus="() => weaponPickerTrigger?.focus()" @select="applyPickedWeapon" />
            <el-dialog v-model="artifactsDrawerOpen" title="圣遗物" width="min(1000px, 94vw)"
                custom-class="cx-scope viewport-dialog condition-settings-dialog" modal-class="condition-settings-overlay" append-to-body>
                <div class="condition-settings-content" data-theme="mist">
                        <section class="drawer-section artifacts-card">
                            <div v-if="artifactDiffs.length" class="artifact-diffs">
                                <section v-for="diff in artifactDiffs" :key="diff.index" class="artifact-diff">
                                    <table>
                                        <caption>{{ t("misc", positions[diff.index]) }} · 装备差异</caption>
                                        <thead><tr><th scope="col">变动词条</th><th scope="col">旧件 · {{ diff.oldTitle }}</th><th scope="col">新件 · {{ diff.newTitle }}</th></tr></thead>
                                        <tbody>
                                            <tr v-for="(row, n) in diff.rows" :key="n">
                                                <th scope="row">{{ row.label }}</th><td>{{ row.old }}</td><td :class="row.trend">{{ row.now }}</td>
                                            </tr>
                                            <tr v-if="!diff.rows.length"><td colspan="3">装备不同，主副词条一致</td></tr>
                                        </tbody>
                                    </table>
                                </section>
                            </div>


                            <artifact-comparison-controls v-if="!heroResult" v-model:enabled="comparisonEnabled" v-model:mode="comparisonMode"
                            v-model:history-id="comparisonHistoryId" :history="comparisonHistory"
                            @save="saveComparisonHistory" />
                            <el-radio-group v-if="artifactNeedConfig2 || artifactNeedConfig4" v-model="artifactEffectMode" :aria-label="t('calcPage.artMode')">
                                <el-radio-button label="auto">{{ t('calcPage.modeAuto') }}</el-radio-button>
                                <el-radio-button label="custom">{{ t('calcPage.modeCustom') }}</el-radio-button>
                            </el-radio-group>
                            <div v-if="artifactNeedConfig2" style="margin-top: 16px">
                                <p class="common-description">
                                    <span class="effect2">{{ t("calcPage.effect2") }}</span>
                                    <span v-html="artifactEffect2Text"></span>
                                </p>
                                <item-config
                                    v-if="artifactEffectMode === 'custom'"
                                    v-model="artifactConfig"
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
                                    v-if="artifactEffectMode === 'custom'"
                                    v-model="artifactConfig"
                                    :item-name="artifactConfigItemName"
                                    :configs="artifactConfig4Configs"
                                ></item-config>
                            </div>
                        </section>
                </div>
            </el-dialog>
            <el-dialog v-model="attributesDrawerOpen" title="全部属性" width="min(760px, 94vw)"
                custom-class="cx-scope viewport-dialog condition-settings-dialog" modal-class="condition-settings-overlay" append-to-body>
                <div class="attributes-body condition-settings-content" data-theme="mist">
                    <el-alert v-if="comparisonAttribute.error" :title="comparisonAttribute.error" type="warning" :closable="false" />
                    <attribute-panel
                        :attribute="displayAttributes"
                        :baseline="comparisonAttribute.value"
                    ></attribute-panel>
                    <div class="panel-actions">
                        <el-button type="primary" :icon="IconEpHistogram" @click="showOptimalGainCurve = true" :disabled="!!betaCalculationError">最优收益曲线 · 0～20 条</el-button>
                        <el-button
                            :icon="IconEpHistogram"
                            @click="handleClickAttributeAnalysis"
                        >{{ t("calcPage.statCurve") }}</el-button>
                    </div>
                </div>
            </el-dialog>
            <el-dialog v-model="buffDrawerOpen" title="BUFF" width="min(1000px, 94vw)"
                custom-class="cx-scope viewport-dialog condition-settings-dialog" modal-class="condition-settings-overlay" append-to-body>
                <div class="condition-settings-content" data-theme="mist">
                <div class="condition-settings-actions"><el-button type="primary" :icon="IconEpPlus" @click="handleClickAddBuff">添加BUFF</el-button></div>
                            <div class="polestar-field-control">
                                <el-switch v-model="polestarEnabled" active-text="启用极星辉域" />
                                <div class="polestar-field-stacks"><span>极星辉域层数</span>
                                    <!-- This Element Plus version sets aria-disabled only on mount. -->
                                    <el-input-number :key="String(polestarEnabled)" v-model="polestarStacks" :min="0" :max="12" :step="1" :precision="0" :disabled="!polestarEnabled" label="极星辉域层数" />
                                </div>
                            </div>
                            <selected-buff-groups class="buffs" :buffs="otherBuffs">
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
                                            :label="characterPresetLabel(source.presetName)" :value="source.sourceId" />
                                    </el-select>
                                </label>
                                </template>
                            </selected-buff-groups>
                </div>
            </el-dialog>
            <el-dialog v-model="teammateDrawerOpen" title="队友" width="min(760px, 94vw)"
                custom-class="cx-scope viewport-dialog condition-settings-dialog" modal-class="condition-settings-overlay" append-to-body>
                <div class="condition-settings-content" data-theme="mist">
                            <team-buff-sources v-model="teamContextSources" v-model:stellar-mode="teamContextStellarMode"
                                :character="characterName" :preset-name="miscCurrentPresetName" :issues="teamContextResult.issues" />

                </div>
            </el-dialog>
            <el-dialog v-model="enemyDrawerOpen" :title="t('calcPage.setupEnemy')" width="min(760px, 94vw)"
                custom-class="cx-scope viewport-dialog condition-settings-dialog" modal-class="condition-settings-overlay" append-to-body>
                <div class="condition-settings-content" data-theme="mist">
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
                </div>
            </el-dialog>
            <dynamic-artifact-score ref="dynamicScoreController" integrated :input="dynamicScoreInput" :analysis="characterDamageAnalysis" :infusion="fumo" :constraints="constraintInterface"
                :account-id="accountStore.currentAccountId.value" :character-label="characterLocale" :weapon-label="artifactScoreContext.options.weaponName" :skill-label="reviewSkill" :selected-slot="scoreArtifactIndex"
                @state="dynamicScoreState=$event" @result="dynamicScore=$event" @close="dynamicScoreEnabled=false;dynamicScore=null" @inspect="i=>{scoreArtifactIndex=i;showArtifactScore=true}" />
            <div class="calc-workspace">
                <character-hero-card class="hero-row" data-tour="calc.character-gear" :character-name="characterName" :name="characterLocale" :element-icon="elementIcons[scoreCharacters[characterName].element]"
                    :element-label="t('ele', scoreCharacters[characterName].element)" :avatar="scoreCharacters[characterName].avatar"
                    :splash="scoreCharacters[characterName].splash" :level="characterLevel" :constellation="characterConstellation"
                    :talents="[characterSkill1, characterSkill2, characterSkill3]" :weapon="heroWeapon"
                    :stats="heroStats" :result="heroResult" @open="openHeroSection" @result="handleResultAction"
                    @my-characters="showMyCharacters = true" @default-characters="showDefaultCharacters = true">
                    <template #comparison>
                        <artifact-comparison-controls inline v-model:enabled="comparisonEnabled" v-model:mode="comparisonMode"
                            v-model:history-id="comparisonHistoryId" :history="comparisonHistory"
                            @save="saveComparisonHistory" />
                    </template>
                    <template #artifacts>
                        <section class="artifacts-card hero-equipment">
                            <header class="card-heading"><button type="button" class="artifact-drawer-trigger" @click="artifactsDrawerOpen = true"><i-ep-collection aria-hidden="true"/>{{ t("misc.artifact") }} <i-ep-arrow-right aria-hidden="true" /></button>
                                <div class="artifact-toolbar">
                                    <artifact-score-mode v-model="dynamicScoreEnabled" :disabled="optimizationRunning || dynamicScoreState.running"
                                        @settings="openScoreSettings" />
                                    <div class="artifact-tool">
                                        <preset-picker :character="characterName" @select="applyArtifactsToPreset" @create="createPresetFromResult" />

                                        <el-button v-if="useNewScore && dynamicScore" class="score-basis-button" size="small" @click="openScoreBasis">评分依据</el-button>
                                        <span v-else-if="useNewScore && dynamicScoreState.running" class="score-status" role="status">{{ dynamicScoreState.status }}</span>
                                        <span v-else-if="useNewScore && dynamicScoreState.error" class="score-error" role="alert">{{ dynamicScoreState.error }}</span>
                                    </div>
                                </div>
                                <div class="artifact-score-summary">
                                    <el-button v-if="useNewScore" class="calculate-artifact-score" type="primary" size="small"
                                        :disabled="optimizationRunning || dynamicScoreState.running" :loading="dynamicScoreState.running"
                                        @click="dynamicScoreController?.start()">计算当前圣遗物新评分</el-button>
                                    <div class="artifact-grade-summary" aria-label="角色圣遗物评分">
                                        <div v-if="useNewScore"><span>{{ artifactScoreContext.label }} · 新评分 · 单件合计</span><strong class="miao-score" :data-grade="dynamicTotalGrade">{{ displayedScoreTotal }}</strong></div>
                                        <div v-else><span>{{ artifactScoreContext.label }} · 喵喵总分</span><strong class="miao-score" :data-grade="artifactBuildScore.grade">{{ artifactBuildScore.total === null ? '—' : artifactBuildScore.total.toFixed(1) }}</strong><b class="miao-score" :data-grade="artifactBuildScore.grade">{{ artifactBuildScore.grade }}</b></div>
                                    </div>
                                </div>
                            </header>
                            <div class="artifacts" :class="{ 'gear-empty': !artifactCount }">
                                <div
                                    v-for="(id, index) in artifactIds"
                                    :key="index"
                                    class="artifact-item-or-button"
                                    :data-slot="index"
                                >
                                    <span class="slot-name"><img :src="slotIcons[positions[index]]" alt="" />{{ t("misc", positions[index]) }}</span>
                                    <artifact-display
                                        v-if="artifactItems[index]"
                                        :item="artifactItems[index]"
                                        :character-name="characterName"
                                        :locked="artifactStore.getArtifact(id)?.omit"
                                        :lock-button="!!artifactStore.getArtifact(id)"
                                        selectable
                                        two-column
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
                            <div class="artifact-bottom-actions">
                                <el-button size="small"
                                :icon="IconEpHistogram"
                                @click="handleClickArtifactAnalysis"
                                >{{ t("calcPage.statAnalysis") }}</el-button>
                                <el-button size="small"
                                :icon="IconEpStarFilled"
                                @click="handleClickSaveAsKumi"
                                >{{ t("calcPage.saveKumi") }}</el-button>
                                <el-button size="small"
                                :icon="IconEpFolder"
                                @click="handleClickUseKumi"
                                >{{ t("calcPage.useKumi") }}</el-button>
                                <el-button size="small"
                                v-show="artifactCount > 0"
                                :icon="isAllLocked ? IconEpUnlock : IconEpLock"
                                @click="() => { isAllLocked ? handleUnlockAll() : handleLockAll() }"
                                >{{ isAllLocked ? t("calcPage.unlockAll") : t("calcPage.lockAll") }}</el-button>
                                <el-button size="small" :disabled="artifactCount === 0" @click="clearArtifacts(); recordUsage('action.clear-selected')">清空已选</el-button>
                            </div>
                        </section>
                    </template>
                </character-hero-card>
                <div class="calc-editor">
                        <damage-result-card class="damage-card" v-model="characterSkillIndex" :groups="damageSkillGroups" :direct-reaction-skills="directReactionSkills" @details="handleDisplayAnalysis">
                            <template v-if="damageMode" #actions>
                                <button type="button" class="damage-mode" @click="openHeroSection('character')">当前模式：{{ damageMode.label }}（点击切换）</button>
                            </template>
                            <el-alert v-if="comparisonDamage.error" :title="comparisonDamage.error" type="warning" :closable="false" />
                            <damage-panel v-if="!betaCalculationError && characterDamageAnalysis" layout="feature"
                                :analysis-from-wasm="characterDamageAnalysis" :baseline="comparisonDamage.value"
                            ></damage-panel>
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
                        </damage-result-card>
                        <calc-conditions-card class="conditions-card" data-tour="calc.conditions" :rows="conditionRows" @open="openCondition" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import targets from '@/assets/_gen_tf'
import {dslObjective, changedAffixes, affixTrend} from '@/algorithms/single-result-comparison.mjs'
import DynamicArtifactScore from '@/components/display/DynamicArtifactScore.vue'
import ArtifactScoreMode from '@/components/display/ArtifactScoreMode.vue'
import PresetPicker from '@/components/preset/PresetPicker.vue'
import TeamBuffSources from '@/components/preset/TeamBuffSources.vue'
import {applyPresetIdentity, restorePresetConfiguration} from '@/utils/preset-view'
import {useSingleCalculationRecovery} from '@/composables/singleCalculationRecovery'
import {characterArtifactHighlights} from '@/utils/character-artifact-highlights'
import {snapshotPreset, customPresetNameError, assertPresetArtifacts, presetEquipmentChanges} from '@/utils/preset-workflow.mjs'
import RosterEditDialog from '@/components/import/RosterEditDialog.vue'
import {presetForRosterLoadout} from '@/import/roster-equipment.mjs'
import {rosterCharacterMeta} from '@/import/character-summary.mjs'
import {artifactExclusionGroups, connectSavedRolePresets} from '@/import/role-presets'
import PresetExclusionFilter from './PresetExclusionFilter.vue'
import ArtifactScoreDialog from '@/components/display/ArtifactScoreDialog.vue'
import ArtifactComparisonControls from '@/components/display/ArtifactComparisonControls.vue'
import { useArtifactComparison, snapshotEquipment } from '@/composables/artifactComparison.mjs'
import { useMiyousheStore } from '@/store/pinia/miyoushe'
import { BREAKS, createMysConverter } from '@/import/miyoushe.mjs'
import scoreCharacters from '@/assets/_gen_character'
import {singleSearchArtifactConfig} from '@/algorithms/single-artifact-effects.mjs'
import scoreWeapons from '@/assets/_gen_weapon'
import scoreLocale from '@/i18n/generated/zh-cn.json'
import { scoreBuild, equippedScoreContext, getMarkClass } from '@/algorithms/artifact-score/score.mjs'
import {convertArtifact} from "@util/converter"
import {deepCopy, downloadString} from "@/utils/common"
import {createOptimizationDebug} from "@/wasm/optimization-debug.mjs"
import CalcErrorDialog from "@/components/CalcErrorDialog.vue"
import {usageStatsDebugInfo, recordUsage, recordUsageUnlessCancelled, recordCharacterUsage} from "@/usage-stats/index.mjs"
import {patchDebugInfo} from "@/platform/patch-info.mjs"
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
import CharacterWeaponPicker from "@/components/select/CharacterWeaponPicker.vue"
import {characterSignatureWeapons} from '@/utils/weapon'
import type {IWeapon} from '@/types/weapon'
import SelectWeaponLevel from "@/components/select/SelectWeaponLevel.vue"
import SelectTargetFunction from "@/components/select/SelectTargetFunction.vue"
import SelectBuff from "@/components/select/SelectBuff.vue"
import ArtifactDisplay from "@c/display/ArtifactDisplay"
import slotIcons from "@/assets/artifacts/icons"
import elementIcons from "@/assets/element-icons"
import DamagePanel from "./DamagePanel"
import AttributePanel from "@c/display/AttributePanel"
import ItemConfig from "@c/config/ItemConfig"
import BuffItem from "./BuffItem"
import SelectedBuffGroups from '@/components/display/SelectedBuffGroups.vue'
import { excludedPresetArtifactIds, artifactGroupCharacterNames } from '@/algorithms/artifact-ownership.mjs'
import { deriveSingleTeamContext } from '@/algorithms/single-team-context.mjs'
import WeaponDisplay from "@/components/display/WeaponDisplay.vue"
import {weaponEffectSummary} from '@/algorithms/weapon-effect-summary.mjs'
import SaveAsKumi from "./SaveAsKumi.vue"
import TransformativeDamage from "./TransformativeDamage"
import ValueDisplay from "./ValueDisplay"
import EnemyConfigComponent from "./EnemyConfig"
import SelectArtifactMainStat from "@c/select/SelectArtifactMainStat"
import ArtifactConfig from "./ArtifactConfig.vue"
import DamageAnalysis from "@/components/display/DamageAnalysis"
import {useCharacter, useCharacterSkill} from "@/composables/character"
import {isTraveler, travelerElements} from '../../../beta-data/traveler-model.mjs'
import {newEnemyConfig, useEnemy} from "@/composables/enemy"
import {useCharacterWeapon} from "@/composables/weapon"
import OptimizationResultsDialog from './OptimizationResultsDialog.vue'
import {formatComputeTime} from '@/algorithms/optimization-results.mjs'
import {remainingOptimizationTime} from '../../../beta-data/optimizer-progress.mjs'
import DslGenerator from './DslGenerator.vue'
import CalcTopBar from './CalcTopBar.vue'
import CharacterHeroCard from './CharacterHeroCard.vue'
import CharacterTalentCards from '@/components/import/CharacterTalentCards.vue'
import CharacterConstellation from '@/components/import/CharacterConstellation.vue'
import DamageResultCard from './DamageResultCard.vue'
import CalcConditionsCard from './CalcConditionsCard.vue'
import {buffColumnKey, BUFF_COLUMNS} from '@/algorithms/buff-groups/index.mjs'
import {characterData} from '@character'
import {previewDefaults} from '../../../beta-data/preview-7201-config.mjs'
import {characterSkillGroups} from '@/utils/character-skill-groups'
import {weaponData} from '@weapon'
import {attributeComparison} from '@/algorithms/attribute-comparison.mjs'
import {rosterAttributes} from '@/algorithms/roster-attributes.mjs'
import {generateDsl} from '@/algorithms/dsl-generator.mjs'
import {directReactionSkillIndices} from '@/algorithms/direct-reaction-skills.mjs'
import type {ComputedRef} from 'vue'
import {useTargetFunction} from "@/composables/targetFunction"
import type {ArtifactPosition, IArtifact, IArtifactWasm} from "@/types/artifact"
import IconEpCaretRight from "~icons/ep/caret-right"
import IconEpPlus from "~icons/ep/plus"
import IconEpMenu from "~icons/ep/menu"
import IconEpHistogram from "~icons/ep/histogram"
import IconEpStarFilled from "~icons/ep/star-filled"
import IconEpFolder from "~icons/ep/folder"
import IconEpLock from "~icons/ep/lock"
import IconEpUnlock from "~icons/ep/unlock"
import {useComputeConstraint} from "@/composables/constraint"
import {useBuff} from "@/composables/buff"
import {type PresetEntry, usePresetStore} from "@/store/pinia/preset"
import {useCharacterPresetLabel} from '@/composables/character-preset-label'
import {useArtifactStore} from "@/store/pinia/artifact"
import type {IDslGeneratorState, IPreset, ITeamContextSource} from "@/types/preset"
import {RandomIDProvider} from "@/utils/idProvider"
import {use5Artifacts} from "@/composables/artifact"
import {positions} from "@/constants/artifact"
import {positionToIndex, displayedTag, displayedTagParts, newDefaultArtifactConfigForWasm} from "@/utils/artifacts"
import {useMona} from "@/wasm/mona"
import {useKumiStore} from "@/store/pinia/kumi"
import SimpleLoading from "@/components/loading/SimpleLoading.vue"
import SimpleError from "@/components/loading/SimpleError.vue"
import {useRoute, useRouter} from "vue-router"
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
const characterPresetLabel = useCharacterPresetLabel()
const artifactStore = useArtifactStore()
const miyousheStore = useMiyousheStore()
const DefaultCharacterPicker = defineAsyncComponent(() => import('@/components/select/DefaultCharacterPicker.vue'))
const MiyousheCharacterPicker = defineAsyncComponent(() => import('@/components/import/MiyousheCharacterPicker.vue'))
const showMyCharacters = ref(false)
const showDefaultCharacters = ref(false)
const pendingCharacterSwitch = ref<{ source: 'default' | 'saved', name: string, loadout?: Parameters<typeof usePreset>[3] } | null>(null)
// 配装前穿着的五件（圣遗物 ID），供「恢复原装备」使用；从计算历史恢复的结果没有这份记录
const preOptimizationIds = ref<number[] | null>(null)
const optimizeSettingsOpen = ref(false)
const characterDrawerOpen = ref(false)
const weaponDrawerOpen = ref(false)
const weaponPickerOpen = ref(false)
const weaponPickerTrigger = ref<HTMLButtonElement | null>(null)
const artifactsDrawerOpen = ref(false)
const attributesDrawerOpen = ref(false)
const buffDrawerOpen = ref(false)
const teammateDrawerOpen = ref(false)
onDeactivated(() => {
    optimizeSettingsOpen.value = characterDrawerOpen.value = weaponDrawerOpen.value = weaponPickerOpen.value = false
    artifactsDrawerOpen.value = attributesDrawerOpen.value = false
    buffDrawerOpen.value = teammateDrawerOpen.value = enemyDrawerOpen.value = false
    pendingCharacterSwitch.value = null
    showMyCharacters.value = showDefaultCharacters.value = false
})
// 角色卡各入口打开对应抽屉；圣遗物卡片直接打开评分详情。
function openHeroSection(section: string) {
    if (section === 'character') characterDrawerOpen.value = true
    else if (section === 'weapon') weaponDrawerOpen.value = true
    else if (section === 'attributes') attributesDrawerOpen.value = true
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


//////////////////////////////////////////////////////////
// set preset from other place
let deferredPresetRoute = ''
async function setPresetFromRoute() {
    if (optimizationRunning.value) {
        deferredPresetRoute = route.query.preset ? route.fullPath : ''
        return
    }
    deferredPresetRoute = ''
    if (route.query.history) { await restoreCalculationHistory(String(route.query.history)); return }
    const presetName = route.query.preset || route.params.presetName
    if (presetName && typeof presetName === "string") {
        if (typeof route.query.loadout === 'string') {
            const key = miyousheStore.data.value.entries.find((row: any) => row.presetName === presetName)?.key
            const loadout = key && miyousheStore.data.value.rosterLoadouts?.[key]?.configs.find((c: {name: string}) => c.name === route.query.loadout)
            if (loadout) usePreset(presetName, undefined, 'preset', loadout)
            return
        }
        usePreset(presetName)
    }
}

const emit = defineEmits(['restart'])
const calculatorRouter = useRouter()


////////////////////////////////////////////////////////
// enemy
const {
    enemyConfig,
    enemyInterface
} = useEnemy()
const enemyDrawerOpen = ref(false)

function handleClickEnemyConfig() {
    enemyDrawerOpen.value = true
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
    travelerResonance,
    characterWeaponType,
    characterLevelNumber,
    characterAscend,
    characterNeedConfig,
    characterConfigConfig,
    characterInterface,
    characterLocale,
} = useCharacter()
const characterCardEntry = computed(() => ({
    characterName: characterName.value,
    element: characterData[characterName.value].element,
    constellation: characterConstellation.value,
    talentLevels: [characterSkill1.value, characterSkill2.value, characterSkill3.value],
}))

function finishCharacterSwitch(keepConditions: boolean) {
    const selection = pendingCharacterSwitch.value
    if (!selection) return
    if (!keepConditions) {
        buffs.value = []
        teamContextSources.value = []
        teamContextStellarMode.value = false
        restoredTeamContext.value = null
        enemyConfig.value = newEnemyConfig()
        fumo.value = 'None'
        clearArtifacts()
        artifactConfig.value = newDefaultArtifactConfigForWasm()
        artifactEffectMode.value = 'auto'
    }
    if (selection.source === 'saved') {
        usePreset(selection.name, undefined, keepConditions ? 'current' : 'preset', selection.loadout)
    } else {
        prepareCharacterSwitch(selection.name, keepConditions)
        characterName.value = selection.name
        characterConstellation.value = 0
        characterSkill1.value = characterSkill2.value = characterSkill3.value = 8
    }
    pendingCharacterSwitch.value = null
    showMyCharacters.value = showDefaultCharacters.value = false
}

const {
    characterSkillConfig,
    characterSkillIndex,
    characterNeedSkillConfig,
    characterSkillConfigConfig,
    characterSkillInterface,
} = useCharacterSkill(characterName)


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
} = useCharacterWeapon(characterName, characterWeaponType)

function applyPickedWeapon(weapon: IWeapon) {
    weaponName.value = weapon.name
    const atBoundary = BREAKS.includes(weapon.level) || weapon.level === 90
    weaponLevel.value = String(weapon.level) + (weapon.ascend ? '+' : atBoundary ? '-' : '')
    weaponRefine.value = weapon.refine
    weaponConfig.value = weapon.params
}




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


const dslGeneratorState = ref<IDslGeneratorState>({character: characterName.value, entries: []})
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
    artifactSingleConfig: artifactConfig,
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

    setArtifact,
    removeArtifact,
    clearArtifacts,
} = use5Artifacts()
const artifactEffectMode = ref<'auto' | 'custom'>('auto')

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
    presetConstraint,
    presetFilter,
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

function handleClickArtifactConfig() {
    showConfigArtifactDialog.value = true
}


///////////////////////////////////////////////////////////////
// save and use presets
const miscCurrentPresetName = ref<null | string>(null)
const saveGameDialog = ref<InstanceType<typeof RosterEditDialog> | null>(null)
watch(characterName, name => {
    const current = presetStore.getPreset(miscCurrentPresetName.value || '')?.item
    if (current?.miyousheKey && current.character.name !== name) miscCurrentPresetName.value = null
}, {flush: 'sync'})
const presetDefaultName = computed((): string => {
    const cName = characterLocale.value
    const wName = weaponLocale.value
    return `${cName}-${wName}`
})

function calculatorRosterKey(): string | undefined {
    const name = miscCurrentPresetName.value
    const data = miyousheStore.data.value
    if (name && presetStore.getPreset(name)?.item.character.name === characterName.value) {
        const owner = data.entries.find((row: any) => row.presetName === name || data.rosterCharacterPresets?.[row.key]?.names.includes(name))
        if (owner) return owner.key
    }
    return data.entries.find((row: any) => row.uid === miyousheStore.selectedUid.value &&
        rosterCharacterMeta(row, presetStore.getPreset(row.presetName)?.item, null, scoreCharacters, scoreLocale)?.name === characterName.value)?.key
}

function saveCalculatorCopy(name: string, item: IPreset, roleKey?: string) {
    presetStore.createCustom(name, item)
    if (roleKey) miyousheStore.linkCharacterPreset(roleKey, name)
    else connectSavedRolePresets()
    miscCurrentPresetName.value = name
    recordUsage('action.preset-save')
    ElMessage.success('保存成功')
}

function handleSavePreset(name: string | null) {
    if (!name) return handleClickSaveOptimizeConfig()
    const item = getPresetItem()
    item.name = name
    const saved = presetStore.getPreset(name)?.item
    const save = (copyName: string | null) => {
        if (copyName) return saveCalculatorCopy(copyName, item, saved?.miyousheKey)
        if (saved?.miyousheKey) item.miyousheKey = saved.miyousheKey
        presetStore.addOrOverwrite(name, item)
        recordUsage('action.preset-save')
        ElMessage.success('已保存')
    }
    const changes = saved?.miyousheKey ? presetEquipmentChanges(saved, item) : []
    if (changes.length) saveGameDialog.value!.request('保存预设', `已更改${changes.join('、')}。要新建角色预设吗？`, true, save)
    else save(null)
}

async function handleClickSaveOptimizeConfig(fromResult = false) {
    const item = getPresetItem()
    const roleKey = calculatorRosterKey()
    const displayed = deepCopy(artifactItems.value)
    try {
        if (fromResult) assertPresetArtifacts(item.artifactIds!, displayed, artifactStore.artifacts.value)
        const {value} = await ElMessageBox.prompt('预设名称', '新建自定义预设', {
            confirmButtonText: '确定', cancelButtonText: '取消', inputValue: presetDefaultName.value,
            inputValidator: value => customPresetNameError(presetStore.presets.value, value) || true,
        })
        if (fromResult) assertPresetArtifacts(item.artifactIds!, displayed, artifactStore.artifacts.value)
        saveCalculatorCopy(value, item, roleKey)
    } catch (error: any) {
        if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || String(error))
    }
}

function createPresetFromResult() { handleClickSaveOptimizeConfig(true) }

function applyArtifactsToPreset(name: string) {
    try {
        presetStore.applyArtifacts(name, artifactIds.value, artifactItems.value)
        recordUsage('action.preset-save')
        ElMessage.success('已应用圣遗物到预设。')
    } catch (error: any) { ElMessage.error(error.message) }
}

function getPresetItem() {
    const item = {
        buffs: buffs.value,
        enemy: enemyConfig.value, infusion: fumo.value,
        skill: characterSkillInterface.value, singleConfig: artifactConfig.value,
        artifactIds: [...artifactIds.value],
        teamContext: deepCopy(teamContextSources.value),
        teamContextStellarMode: teamContextStellarMode.value,
        character: deepCopy(characterInterface.value),
        weapon: deepCopy(weaponInterface.value),
        targetFunction: deepCopy(targetFunctionInterface.value),
        constraint: presetConstraint.value,
        filter: presetFilter.value,
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
    return snapshotPreset(item) as IPreset
}

function usePreset(name: string, historyItem?: IPreset, conditions: 'preset' | 'current' = 'preset', loadout?: { ids: number[], constellation?: number, weapon?: IPreset['weapon'] }) {
    const entry: PresetEntry = presetStore.presets.value[name]
    if (!historyItem && (!entry || !entry.item)) {
        return
    }

    const saved = historyItem || entry.item
    const item = restorePresetConfiguration(loadout ? presetForRosterLoadout(saved, loadout) : saved)
    prepareCharacterSwitch(item.character.name, conditions === 'current')
    optimizationMode.value = item.optimizationMode ?? 'damage'
    panelSearchOptions.value = item.panelSearch ? deepCopy(item.panelSearch) : newPanelSearchOptions()
    if (conditions === 'preset') {
        artifactEffectMode.value = item.artifactEffectMode ?? (saved.artifactConfig || saved.singleConfig ? 'custom' : 'auto')
        artifactConfig.value = item.singleConfig
        if (item.artifactIds) {
            artifactIds.value = [0, 1, 2, 3, 4].map(i => historyItem || artifactStore.getArtifact(item.artifactIds![i]) ? item.artifactIds![i] : -1)
        }
        if (item.buffs) {
            const idGenerator = new RandomIDProvider()
            buffs.value = item.buffs.map(buff => ({...buff, id: idGenerator.generateId()}))
        }
        teamContextSources.value = Array.isArray(item.teamContext) ? deepCopy(item.teamContext) : []
        teamContextStellarMode.value = item.teamContextStellarMode === true
        enemyConfig.value = item.enemy!
        fumo.value = item.infusion!
    }

    applyPresetIdentity(item, {
        characterName, characterLevel, characterConstellation, characterSkill1, characterSkill2, characterSkill3, characterConfig, travelerResonance,
    }, {weaponName, weaponLevel, weaponRefine, weaponConfig})
    characterSkillIndex.value = item.skill!.index
    characterSkillConfig.value = item.skill!.config

    // use target function
    const tf = item.targetFunction
    if (tf) {
        targetFunctionName.value = tf.name
        targetFunctionConfig.value = tf.params
    }

    // is DSL?
    const use_dsl = item.useDSL ?? tf?.use_dsl
    if (use_dsl) {
        const source = item.dslSource ?? tf?.dsl_source ?? ''
        dslGeneratorState.value = deepCopy(item.dslGenerator ?? {character: item.character.name, entries: []})
        miscTargetFunctionTab.value = item.targetMode === 'generator' && generatedDsl.value === source ? 'generator' : 'dsl'
        targetFunctionDSLSource.value = source
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

    miscCurrentPresetName.value = loadout ? null : name
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
const effectiveArtifactConfig = computed(() => artifactEffectMode.value === 'auto'
    ? singleSearchArtifactConfig(artifactConfig.value, characterName.value, effectiveBuffs.value, teamContextResult.value.sources)
    : artifactConfig.value)
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

const damageAnalysisContext = computed(() => {
    // console.log("123")
    return {
        character: characterInterface.value,
        weapon: weaponInterface.value,
        buffs: effectiveBuffs.value,
        ...(restoredTeamContext.value ? {team_context:restoredTeamContext.value} : teamContextSources.value.length ? {team_context:teamContextResult.value.team_context} : {}),
        artifacts: artifactWasmFormat.value,
        artifact_config: effectiveArtifactConfig.value,
        enemy: enemyInterface.value,
    }
})

const damageAnalysisWasmInterface = computed(() => ({...damageAnalysisContext.value, skill: characterSkillInterface.value}))

function calculateSkillDamage(index: number) {
    try {
        const input = {...damageAnalysisContext.value, skill: {index, config: characterSkillConfig.value}}
        const value = mona.CalculatorInterface.get_damage_analysis(input, fumo.value === 'None' ? null : fumo.value)
        return {value, error: ''}
    } catch (error: any) {
        return {value: null, error: error.message || String(error)}
    }
}

// The list and the selected result share each hit's analysis. Changing the selection reuses it.
const skillCalculations = new Map<number, ComputedRef<ReturnType<typeof calculateSkillDamage>>>()
function skillCalculation(index: number) {
    let calculation = skillCalculations.get(index)
    if (!calculation) {
        calculation = computed(() => calculateSkillDamage(index))
        skillCalculations.set(index, calculation)
    }
    return calculation.value
}
const damageCalculation = computed(() => skillCalculation(characterSkillIndex.value))
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
        artifact_config: effectiveArtifactConfig.value,
    }
})

const attributeCalculation = computed(() => {
    try { return { value: mona.CommonInterface.get_attribute(getAttributeWasmInterface.value), error: '' } }
    catch (error: any) { return { value: null, error: error.message || String(error) } }
})
const attributeFromWasm = computed(() => attributeCalculation.value.value || {})
const displayAttributes = computed(() => rosterAttributes({
    character: characterInterface.value, weapon: weaponInterface.value, artifacts: artifactWasmFormat.value,
}))

const betaCalculationError = computed(() => teamContextError.value || attributeCalculation.value.error || damageCalculation.value.error || transformativeCalculation.value.error)

const artifactScoreContext = computed(() => {
    const c = scoreCharacters[characterName.value]
    return equippedScoreContext({
        character: characterInterface.value, label: scoreLocale[c.nameLocale], element: c.element,
        weaponName: scoreLocale[scoreWeapons[weaponName.value].nameLocale], weaponAffix: weaponRefine.value,
        panel: attributeFromWasm.value, items: artifactItems.value, sets: artifactsData, locale: scoreLocale
    })
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
        artifacts_config: effectiveArtifactConfig.value
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
    if (dirIds.length) recordUsage('action.kumi-save')
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
const resultHistoryId = ref<number | null>(null)
const resultSearchInput=shallowRef<any>(null)
const reviewIndex=computed(()=>{
    const matches=(r:ResultEntry)=>buildIds(r).every((id:number|null,i:number)=>(id??-1)===artifactIds.value[i])
    const current=optimizationResults.value[optimizationResultIndex.value-1]
    if(current&&matches(current))return optimizationResultIndex.value
    return optimizationResults.value.findIndex(matches)+1
})
// 角色卡数据
const ELEMENT_BONUS: Record<string, [string, string]> = {
    Pyro: ['bonus_pyro', 'stat.fireBonus'], Hydro: ['bonus_hydro', 'stat.waterBonus'], Dendro: ['bonus_dendro', 'stat.dendroBonus'],
    Electro: ['bonus_electro', 'stat.thunderBonus'], Anemo: ['bonus_anemo', 'stat.windBonus'], Cryo: ['bonus_cryo', 'stat.iceBonus'],
    Geo: ['bonus_geo', 'stat.rockBonus'],
}
const heroStats = computed(() => {
    const attribute = displayAttributes.value
    const baseline: any = comparisonAttribute.value.value
    const element = ELEMENT_BONUS[scoreCharacters[characterName.value].element] ?? ['bonus_physical', 'stat.physicalBonus']
    const rows: [string, string, boolean, boolean][] = [
        ['hp', 'stat.lifeStatic', false, false], ['atk', 'stat.attackStatic', false, false], ['def', 'stat.defendStatic', false, false],
        ['elemental_mastery', 'stat.elementalMastery', false, false], ['critical', 'stat.critical', true, true],
        ['critical_damage', 'stat.criticalDamage', true, true], ['recharge', 'stat.recharge', true, false],
        [element[0], element[1], true, false],
    ]
    return rows.map(([key, label, percentage, highlight]) => {
        const c = attributeComparison(attribute[key], baseline?.[key], percentage)
        return {
            key, label: t(label), percentage, highlight, composition: attribute[key], baseline: baseline?.[key],
            current: String(c.current), before: c.before === null ? null : String(c.before), direction: c.direction,
        }
    })
})
const heroWeapon = computed(() => {
    const data = weaponData[weaponName.value]
    const effect = data.effect ? weaponEffectSummary(ta(data.effect), weaponRefine.value) : ''
    return { name: weaponLocale.value, icon: data.url, level: weaponLevel.value, refine: weaponRefine.value, effect, equipment: weaponInterface.value }
})
// 计算条件卡的三行摘要
const conditionRows = computed(() => {
    const counts: Record<string, number> = { Character: 0, Weapon: 0, Artifact: 0, Common: 0 }
    for (const buff of otherBuffs.value) counts[buffColumnKey(buffData[buff.name]?.genre)]++
    const buffSummary = BUFF_COLUMNS.filter(([key]) => key !== 'Common' || counts.Common)
        .map(([key, label]) => `${label} ${counts[key]}`).join(' · ')
    const teammates = teamContextSources.value.map((source: any) => characterPresetLabel(source.presetName)).join('、') || '未选队友预设'
    const polestar = polestarEnabled.value ? ` · 极星辉域 ${polestarStacks.value} 层` : ''
    const enemy: any = enemyConfig.value
    const res = Object.keys(enemy).filter(key => key.endsWith('_res')).map(key => Math.round(enemy[key] * 100))
    const resText = Math.min(...res) === Math.max(...res) ? `全元素抗性 ${res[0]}%` : `抗性 ${Math.min(...res)}%～${Math.max(...res)}%`
    const infusion = fumo.value === 'None' ? '无附魔' : `${t('ele', fumo.value)}元素附魔`
    return [
        { key: 'buff', title: 'BUFF', action: '添加', summary: buffSummary + polestar },
        { key: 'teammate', title: '队友', action: '选择', summary: teammates },
        { key: 'enemy', title: '敌人', action: '修改', summary: `Lv ${enemy.level} · ${resText} · ${infusion}` },
    ]
})
function openCondition(key: string) {
    if (key === 'buff') buffDrawerOpen.value = true
    else if (key === 'teammate') teammateDrawerOpen.value = true
    else enemyDrawerOpen.value = true
}

// 伤害卡左侧的技能列表
function isMityaHitAvailable(index: number, {core_mode, beacons}: {core_mode: number, beacons: number}, constellation: number) {
    if (index === 7 || index === 8) return core_mode === 2 && beacons > 0
    if (index === 11 || index === 12) return core_mode === 1
    if (index === 13) return core_mode === 1 && beacons > 0
    if (index === 15) return core_mode !== 0 && constellation >= 4
    return true
}
const damageMode = computed(() => {
    if (characterName.value !== 'Mitya') return null
    const settings = {...previewDefaults.Mitya, ...characterConfig.value?.Mitya}
    const mode = settings.core_mode
    const field = characterData.Mitya.config.find((field: any) => field.name === 'core_mode')
    const constellation = characterConstellation.value
    return {
        label: field.options[mode],
        preferredHit: [0, 11, 7][mode],
        available: (index: number) => isMityaHitAvailable(index, settings, constellation),
    }
})
const damageSkillGroups = computed(() => {
    const groups = characterSkillGroups(characterData[characterName.value], ta)
    const mode = damageMode.value
    if (!mode) return groups
    return groups.map(group => ({
        ...group,
        items: group.items.filter(hit => mode.available(hit.index)),
    })).filter(group => group.items.length)
})
const directReactionSkills = computed(() => directReactionSkillIndices(
    characterName.value, damageSkillGroups.value, (index: number) => skillCalculation(index).value,
))
watch([damageSkillGroups, characterSkillIndex], ([groups, index]) => {
    const mode = damageMode.value
    if (!mode || groups.some(group => group.items.some(hit => hit.index === index))) return
    characterSkillIndex.value = mode.available(mode.preferredHit) ? mode.preferredHit : groups[0].items[0].index
}, {immediate: true})

// 顶部条「配装目标」按钮上显示的名字
const optimizeTargetLabel = computed(() => {
    if (optimizationMode.value === 'panel') return '面板配装'
    if (miscTargetFunctionTab.value !== 'normal') return '自定义 DSL'
    return ta(targets[targetFunctionName.value].nameLocale)
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
const exclusionGroups = computed(() => artifactExclusionGroups(miyousheStore.data.value, presetStore.presets.value))
const excludedPresets = computed(() => exclusionGroups.value.flatMap(group =>
    group.choices.filter(choice => miyousheStore.data.value.excludedArtifactPresets?.[group.key]?.includes(choice.key))))
const reservedArtifactIds = computed(() => excludedPresetArtifactIds(excludedPresets.value, artifactStore.artifacts.value))
const ownershipFilterKey = computed(() => JSON.stringify([ownershipUid.value, comparisonKey.value,
    [...reservedArtifactIds.value].sort((a,b) => a-b),
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
// 抽屉里的「装备差异」：只列与对比基准相比换了的部位，每行一条变动词条（旧值 → 新值）
const artifactDiffs = computed(() => {
    const baseline = comparisonBaseline.value
    if (!baseline) return []
    const title = (a: IArtifact | null) => a ? ta((artifactsData as any)[a.setName][a.position].text) + ' +' + a.level : '未装备'
    const shown = (s: any, kind: string) => s ? (kind === '主词条' ? displayedTag(s.name, s.value) : displayedTagParts(s.name, s.value)[1]) : '—'
    return artifactChanges.value.flatMap((change: string, i: number) => {
        if (!change) return []
        const old = baseline[i] ?? null, now = artifactItems.value[i] ?? null
        const rows = changedAffixes(old, now).map((line: any) => {
            const stat = line.old || line.now
            return {
                label: line.kind === '副词条' ? '副词条 · ' + displayedTagParts(stat.name, stat.value)[0] : '主词条',
                old: shown(line.old, line.kind), now: shown(line.now, line.kind), trend: affixTrend(line),
            }
        })
        return [{ index: i, oldTitle: title(old), newTitle: title(now), rows }]
    })
})
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
const comparisonAttribute = computed(() => {
    if (!comparisonBaseline.value) return { value: null, error: '' }
    try {
        return { value: rosterAttributes({ character: characterInterface.value, weapon: weaponInterface.value,
            artifacts: comparisonArtifactsWasm.value }), error: '' }
    } catch (error: any) { return { value: null, error: `对比基准面板无法计算：${error.message || error}` } }
})
const comparisonDamage = computed(() => {
    if (!comparisonBaseline.value) return { value: null, error: '' }
    try {
        const input = { ...damageAnalysisWasmInterface.value, artifacts: comparisonArtifactsWasm.value }
        return { value: mona.CalculatorInterface.get_damage_analysis(input, fumo.value === 'None' ? null : fumo.value), error: '' }
    } catch (error: any) { return { value: null, error: `对比基准伤害无法计算：${error.message || error}` } }
})
function saveComparisonHistory() {
    const id = recordComparisonHistory('手动保存')
    ElMessage[id ? 'success' : 'warning'](id ? '已保存当前角色配装到对比历史' : '当前没有穿戴圣遗物')
}
function resetCharacterResults() {
    resetComparisonBaseline()
    preOptimizationIds.value = null
    resultSearchInput.value = null
    showOptimizationResults.value = false
    panelResultSnapshot.value = null
    optimizationResults.value = []
    optimizationResultIndex.value = 0
}
watch(characterName, resetCharacterResults, { flush: 'sync' })

function prepareCharacterSwitch(nextName: string, keepConditions: boolean) {
    // Reapplying the same character or another preset for them does not trigger the name watcher.
    if (nextName === characterName.value) resetCharacterResults()
    if (!keepConditions) {
        artifactSnapshot.value = null
        restoredTeamContext.value = null
    }
}

const heroResult = computed(() => {
    const count = optimizationResults.value.length
    if (!count) return null
    const changed = artifactChanges.value.filter(Boolean).length
    const parts = ['目标：' + (panelResultSnapshot.value ? '面板配装' : resultObjectiveLabel.value)]
    parts.push(changed ? `换了 ${changed} 件` : '五件未变')
    const details: string[] = []
    const dsl = reviewDsl.value
    if (dsl && Number.isFinite(dsl.current)) details.push('目标值 ' + (Number.isFinite(dsl.before) ? `${dsl.before.toFixed(1)} → ` : '') + dsl.current.toFixed(1))
    const rechargeMin = optimizationMode.value === 'damage' ? constraintMinRecharge.value : 0
    if (rechargeMin > 1) details.push(`充能要求 ≥ ${(rechargeMin * 100).toFixed(1)}%`)
    return { index: reviewIndex.value, count, note: parts.join(' · '), detail: details.join(' · '), error: dsl?.error || comparisonDamage.value.error,
        canRestore: !!preOptimizationIds.value, busy: optimizationRunning.value || dynamicScoreState.value.running }
})
async function handleResultAction(action: string) {
    if (action === 'compare') showOptimizationResults.value = true
    else if (action === 'restore' && preOptimizationIds.value) artifactIds.value = [...preOptimizationIds.value]
    else if (action === 'prev' || action === 'next') {
        const current = reviewIndex.value || (action === 'next' ? 0 : 2)
        await applyReviewCandidate(current + (action === 'next' ? 1 : -1))
    }
}
async function applyReviewCandidate(n: number) { await handleUseNthOptimizationResult(n);showCalculatedEquipment() }
// 配装结果直接显示在角色卡上，回到页面顶部即可看到
function showCalculatedEquipment(){window.scrollTo(0,0)}

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

    artifactIds.value = temp
    recordComparisonHistory(`计算结果 ${n}`)

    optimizationResultIndex.value = n
    await nextTick()
}

function getOptimizeArtifactWasmInterface() {
    const i = {
        character: characterInterface.value,
        weapon: weaponInterface.value,
        target_function: targetFunctionInterface.value,
        constraint: constraintInterface.value,
        enemy: enemyInterface.value,
        buffs: effectiveBuffs.value,
        ...(restoredTeamContext.value ? {team_context:restoredTeamContext.value} : teamContextSources.value.length ? {team_context:teamContextResult.value.team_context} : {}),
        artifact_config: effectiveArtifactConfig.value,
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
        artifact_config: effectiveArtifactConfig.value,
        constraint: {set_mode:constraintSetMode.value},
        panel_search: panelSearchOptions.value,
    })
}

function getAllArtifactsFiltered(): IArtifact[] {
    // s is artifact ids to be filtered
    let s = new Set([...reservedArtifactIds.value, ...selectedTeamArtifactIds.value])

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
watch(optimizationRunning, running => {
    if (!running && deferredPresetRoute && route.fullPath === deferredPresetRoute) setPresetFromRoute()
})
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
onBeforeUnmount(() => { calculationPageActive=false;optimizationInBackground=true;optimizationAbortController=undefined;clearInterval(optimizationClock) })
const optimizationDebugEnabled = ref(false)
const optimizationDebugRecord = shallowRef<any>(null)
const optimizationError = ref('')
const optimizationErrorDialog = ref(false)
const optimizationDebugDetail = computed(() => JSON.stringify({events:optimizationDebugRecord.value?.events,error:optimizationDebugRecord.value?.error},null,2))
async function exportOptimizationDebug() {
    if (!optimizationDebugRecord.value) return
    // Usage stats state is read at export time so the latest send failure is included.
    const record = {...optimizationDebugRecord.value, environment: {...optimizationDebugRecord.value.environment, usageStats: usageStatsDebugInfo(), contentPatch: patchDebugInfo()}}
    try { recordUsageUnlessCancelled(await downloadString(JSON.stringify(record,null,2),'application/json',`mona-debug-${optimizationDebugRecord.value.version || process.env.MONA_VERSION}-${Date.now()}.json`), 'action.debug-export') }
    catch (error: any) { ElMessage.error('调试包导出失败：' + (error.message || String(error))) }
}
function handleOptimizeArtifact() {
    if (optimizationRunning.value || dynamicScoreState.value.running) return
    if (calculationState.active) { ElMessage.info('当前有计算线程正在进行'); return }
    optimizationError.value = ''
    const newDebug = () => createOptimizationDebug({version:process.env.MONA_VERSION,environment:{userAgent:navigator.userAgent,language:navigator.language,hardwareConcurrency:navigator.hardwareConcurrency,crossOriginIsolated:globalThis.crossOriginIsolated,wasmAvailable:typeof WebAssembly!=='undefined'}})
    const debug = optimizationDebugEnabled.value ? newDebug() : null
    optimizationDebugRecord.value = debug?.record || null
    const debugEvent = (event: any) => { debug?.event(event); triggerRef(optimizationDebugRecord) }
    const reportError = (error: any) => {
        optimizationError.value=error?.message||String(error)
        // Without Debug mode there is no record yet; keep one holding only the failure so the error report can still be exported.
        const failed = debug || newDebug()
        failed.fail(error)
        optimizationDebugRecord.value = failed.record
        triggerRef(optimizationDebugRecord)
        optimizationErrorDialog.value = true
    }

    const start = new Date()
    const originalEquipment = snapshotEquipment(artifactItems.value)
    const originalIds = [...artifactIds.value]
    const originalKey = comparisonKey.value, originalAccount = accountStore.currentAccountId.value
    const originalGeneration = accountStore.reloadGeneration.value
    const originalPreset = miscCurrentPresetName.value
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
        debug?.capture(optimizeInterface,artifacts,{excludedArtifactPresets:miyousheStore.data.value.excludedArtifactPresets,minimumArtifactLevel:panelMode?panelSearchOptions.value.minArtifactLevel:16,sandMainStats:constraintSandMainStats.value,gobletMainStats:constraintGobletMainStats.value,headMainStats:constraintHeadMainStats.value,reservedPresetArtifactCount:reservedArtifactIds.value.size})
        debugEvent({phase:'parameters-prepared'})
        if (!artifacts.length) throw new Error('没有符合条件的圣遗物，请检查仓库、主词条筛选及圣遗物替换设置')
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
    const historyDetail={input:optimizeInterface,items,artifacts,view:{preset:getPresetItem(),skill:deepCopy(characterSkillInterface.value),enemy:deepCopy(enemyConfig.value),infusion:fumo.value,singleConfig:deepCopy(artifactConfig.value)}}
    const job=calculationHistory.start({accountId:originalAccount,kind:'single',label:characterLocale.value,members:historyMembers([optimizeInterface],items,[[]])},historyDetail,async ({signal,onProgress}:any)=>{
        const results=await runOptimize(optimizeInterface,artifacts,{signal,onDebug:debug?debugEvent:undefined,onProgress:(progress:any)=>{onProgress(progress);optimizationProgress.value=progress;optimizationProgressReceivedElapsed.value=Date.now()-start.getTime()}})
        return {detail:{...historyDetail,results,panelSnapshot:panelMode?panelSnapshot:null},summary:{members:historyMembers([optimizeInterface],items,[results.length?buildIds(results[0]):[]])}}
    })
    const controller=job.controller
    optimizationAbortController=controller
    job.promise.then(async ({detail, entry}:any) => {
        const results=detail.results
        if (controller.signal.aborted) return
        debug?.complete(results); triggerRef(optimizationDebugRecord)
        recordUsage('action.single-optimize')
        recordCharacterUsage('action.single-optimize', [optimizeInterface.character.name])
        // A background damage search still updates its matching calculator, including a cached page.
        if (controller !== optimizationAbortController || (panelMode && optimizationInBackground)) return
        if (optimizationInBackground && (originalGeneration !== accountStore.reloadGeneration.value ||
            originalPreset !== miscCurrentPresetName.value || optimizationMode.value !== 'damage' ||
            originalIds.some((id, index) => id !== artifactIds.value[index]))) return
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
        resultHistoryId.value = entry.id
        optimizationResults.value = results
        artifactSnapshot.value = null
        panelResultSnapshot.value = panelMode ? panelSnapshot : null
        beginArtifactComparison(originalEquipment)
        preOptimizationIds.value = originalIds
        await handleUseNthOptimizationResult(1)
        if (controller.signal.aborted) { optimizationCancelled.value=true; return }
        if (optimizationInBackground || !calculationPageActive) {
            saveBackgroundResult()
            return
        }
        showCalculatedEquipment()

        // report best result to server, only report player whose 20 artifacts count is above 100
        if (!panelMode && !debug && artifactStore.artifacts20Count.value >= 100 && process.env.NODE_ENV === 'production') {
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
    effectiveArtifactConfig.value,panelSearchOptions.value,constraintSetMode.value,
    constraintSandMainStats.value,constraintGobletMainStats.value,constraintHeadMainStats.value,
    filteredKumiIds.value,
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
        usePreset('',{
            ...detail.view.preset,
            singleConfig:detail.view.singleConfig ?? detail.view.preset.singleConfig,
            ...(detail.input.artifact_config ? {artifactConfig:detail.input.artifact_config,artifactEffectMode:'custom'} : {}),
            buffs:detail.input.buffs,teamContext:[]
        })
        characterSkillIndex.value=detail.view.skill.index
        characterSkillConfig.value=deepCopy(detail.view.skill.config)
        enemyConfig.value=deepCopy(detail.view.enemy)
        fumo.value=detail.view.infusion
        await nextTick()
        restoredTeamContext.value=deepCopy(detail.input.team_context||null)
        artifactSnapshot.value=deepCopy(detail.items)
        resultSearchInput.value=detail.panelSnapshot?null:deepCopy(detail.input)
        if(detail.view.preset.artifactIds)restoreSessionBaseline(detail.view.preset.artifactIds.map((id:number)=>detail.items[id]||null))
        resultHistoryId.value=Number(id)
        optimizationResults.value=deepCopy(detail.results||[])
        panelResultSnapshot.value=deepCopy(detail.panelSnapshot||null)
        if (optimizationResults.value.length) {
            artifactIds.value=buildIds(optimizationResults.value[0])
            optimizationResultIndex.value=1
        }
        preOptimizationIds.value=null
        showCalculatedEquipment()
        await nextTick()
    } catch(error:any) { ElMessage.error('读取计算历史失败：'+error.message) }
    finally { restoringHistory=false }
}
watch(()=>route.query.history,()=>{if(route.path==='/calculate'&&route.query.history)restoreCalculationHistory(String(route.query.history))})

function captureDraft() {
    return {
        preset: getPresetItem(), name: miscCurrentPresetName.value, equipment: snapshotEquipment(artifactItems.value),
        filteredKumi: [...filteredKumiIds.value], team: restoredTeamContext.value,
        historyId: optimizationResults.value.length ? resultHistoryId.value : null,
        candidate: optimizationResultIndex.value, originalIds: preOptimizationIds.value,
        frozen: !!artifactSnapshot.value,
    }
}
async function restoreDraft(draft: ReturnType<typeof captureDraft>) {
    const owner = accountStore.currentAccountId.value
    const detail = draft.historyId == null ? null : await calculationHistory.read(owner, draft.historyId)
    if (owner !== accountStore.currentAccountId.value || route.name !== 'calculate') return
    if (draft.historyId != null && !detail) throw new Error('找不到上次配装结果的计算历史')
    restoringHistory = true
    try {
        usePreset('', draft.preset)
        miscCurrentPresetName.value = draft.name && presetStore.getPreset(draft.name) ? draft.name : null
        filteredKumiIds.value = draft.filteredKumi
        restoredTeamContext.value = draft.team
        const equipped = draft.equipment.filter(Boolean)
        if (detail || draft.frozen || equipped.some((piece: any) => JSON.stringify(artifactStore.getArtifact(piece.id)) !== JSON.stringify(piece))) {
            artifactSnapshot.value = { ...detail?.items, ...Object.fromEntries(equipped.map((piece: any) => [piece.id, piece])) }
        }
        await nextTick()
        if (detail) {
            resultHistoryId.value = draft.historyId
            resultSearchInput.value = detail.panelSnapshot ? null : detail.input
            panelResultSnapshot.value = detail.panelSnapshot || null
            optimizationResults.value = detail.results
            optimizationResultIndex.value = draft.candidate
            preOptimizationIds.value = draft.originalIds
            restoreSessionBaseline((draft.originalIds || detail.view.preset.artifactIds || []).map((id:number) => detail.items[id] || null))
            await nextTick()
        }
    } finally { restoringHistory = false }
}
const { pending: pendingDraft, restoring: resumingDraft, resume: resumeDraft, restart: discardDraft, saveBackgroundResult } = useSingleCalculationRecovery({
    account: () => accountStore.currentAccountId.value, capture: captureDraft, restore: restoreDraft,
    running: () => optimizationRunning.value, openRoute: setPresetFromRoute,
    restart: async () => {
        if (route.query.history || route.query.preset || route.params.presetName) await calculatorRouter.replace({name:'calculate'})
        emit('restart')
    },
})
</script>

<style lang="scss" scoped>
@media(max-width:700px){
   }

.calc-content {
    container: single-calculator / inline-size;
    padding: clamp(10px, 1.3vw, 18px);
    border-radius: var(--cx-radius);
    background: var(--cx-ground);
    color: var(--cx-letter);
    font-family: system-ui, "Microsoft YaHei", sans-serif;
    font-variant-numeric: tabular-nums;
    --el-component-size: 36px;
}
.card-heading, .card-actions, .panel-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
}
.card-heading { justify-content: space-between; }
.card-heading h3 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-weight: 650;
    letter-spacing: .02em;
    line-height: 1.35;
}
.card-heading { margin-bottom: 16px; }
.card-heading h3 { font-size: 20px; }
.card-heading h3 svg { color: var(--cx-gold); width: 1.1em; height: 1.1em; }
.preset-actions, .preset-actions :deep(.el-dropdown), .preset-actions :deep(.el-button-group) { min-width: 0; max-width: 100%; }
.preset-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; }
.preset-actions :deep(.el-dropdown) { flex:1; }
.preset-actions > :deep(button) { margin:0; flex-shrink:0; }
.preset-actions :deep(.el-button-group) { display: flex; }
.preset-actions :deep(.m-button-group) { display:flex; flex-wrap:nowrap; gap:0; width:100%; }
.preset-actions :deep(.m-button-group button:first-child) { flex:1; min-inline-size:0; min-width:0; }
.preset-actions :deep(.m-button-group button + button) { flex-shrink:0; }
.preset-actions :deep(.el-button:first-child) { min-width: 0; }
.preset-actions :deep(.el-button:first-child > span) { overflow: hidden; text-overflow: ellipsis; display: block; }
/* Configure from top to bottom while the live panel stays in view. */
.calc-editor { display: grid; grid-template-columns: minmax(0,1fr) 360px; gap: 20px; align-items: start; }
@container single-calculator (max-width: 1100px) { .calc-editor { grid-template-columns: minmax(0,1fr); } }
/* 顶部条里的预设：保存按钮和角色预设选择并排，各占一半 */
.calc-top-bar .preset-actions { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 8px; max-width: 100%; }
.calc-top-bar .preset-actions :deep(.el-dropdown) { flex: 0 1 auto; max-width: min(26em, 100%); }
.calc-top-bar .preset-actions > :deep(button) { flex: none; }
.calc-top-bar .preset-actions :deep(.el-button-group) { width: 100%; }
.calc-top-bar .preset-actions :deep(.el-button-group > .el-button:first-child) { flex: 1; }
.calc-workspace { display: grid; grid-template-columns: minmax(0,1fr); gap: 20px; align-items: start; }
.calc-editor { min-width: 0; display: grid; gap: 14px; align-content: start; }
.config-character, .config-weapon { min-width: 0; }
.config-weapon { border-left: 1px solid var(--hairline); padding-left: 20px; }
.config-weapon { container: single-weapon / inline-size; }
.config-weapon :deep(.detail-body) { min-width: 0; }
.config-weapon :deep(.detail .image) { flex-shrink: 0; }
.config-weapon :deep(.detail .name) { font-size: 15px; margin: 0 0 4px; }
.config-weapon :deep(.detail .description) { font-size: 15px; line-height: 1.65; word-break: normal; overflow-wrap: anywhere; }
.artifacts-card { container: single-gear / inline-size; }
.calc-field { display: flex; flex-direction: column; min-width: 0; gap: 6px; }
.calc-field > span { font-size: 15px; font-weight: 600; color: var(--cx-dim); }
.config-character { display: grid; gap: 12px; }
.character-progress { display: grid; gap: 8px; min-width: 0; padding: 8px; border-radius: 16px; background: var(--cx-ground); }
.talent-editor { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.talent-editor .calc-field > span { font-size: 12px; }
.talent-editor :deep(.el-input-number__decrease), .talent-editor :deep(.el-input-number__increase) { width: 24px; }
.talent-editor :deep(.el-input__wrapper) { padding-inline: 25px; }
@container buff-board (max-width: 360px) { .talent-editor { grid-template-columns: minmax(0, 1fr); } }
.traveler-resonance { min-width: 0; margin: 4px 0 10px; padding: 0; border: 0; }
.traveler-resonance legend { padding: 0; margin-bottom: 4px; font-size: 15px; font-weight: 600; color: var(--cx-dim); }
.weapon-fields { display: grid; gap: 12px; align-items: start; }
.weapon-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 14px; }
.weapon-picker-trigger { flex: none; width: 64px; height: 64px; padding: 2px; border: 1px dashed var(--cx-dim); border-radius: 10px; background: transparent; cursor: pointer; }
.weapon-picker-trigger img { width: 100%; height: 100%; object-fit: contain; }
.weapon-picker-trigger:hover, .weapon-picker-trigger:focus-visible { background: var(--cx-step); border-color: var(--cx-gold); }
.enemy-infusion { max-width: 560px; margin-bottom: 16px; container: enemy-infusion / inline-size; }
.enemy-infusion :deep(.el-radio-group) { display: grid; grid-template-columns: repeat(8,minmax(0,1fr)); }
.enemy-infusion :deep(.el-radio-button__inner) { display: block; width: 100%; box-sizing: border-box; padding-inline: 3px; }
@container enemy-infusion (max-width: 410px) {
    .enemy-infusion :deep(.el-radio-group) { grid-template-columns: repeat(4,minmax(0,1fr)); }
}
.enemy-infusion .common-title2 { margin-top: 0; }
.calc-field > :last-child { width: 100%; min-width: 0; }
.weapon-extra-config { margin-top: 14px; }
.calc-content .el-button + .el-button { margin-left: 0; }
.card-actions :deep(.el-button-group), .artifact-tool :deep(.el-button-group) { display: flex; flex-wrap: wrap; gap: 6px; }
.artifacts { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit,minmax(min(100%,200px),1fr)); grid-auto-rows: minmax(64px,auto); }
@container single-gear (min-width: 555px) { .artifacts { grid-template-columns: repeat(3,minmax(0,1fr)); } }
@container single-gear (min-width: 910px) { .artifacts { grid-template-columns: repeat(5,minmax(0,1fr)); } }
.artifact-item-or-button { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.slot-name { color: var(--cx-dim); font-size: 14px; font-weight: 600; }
.artifact-tool { margin: 14px 0 10px; display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
.score-basis-button,.score-status{margin-left:auto}.score-error{color:var(--el-color-danger);overflow-wrap:anywhere}
.artifacts-card .artifact-comparison-controls { margin: 0; }
.artifacts :deep(.artifact .up .buttons button) { margin-left: 3px; }
.artifacts :deep(.artifact .down .sec-tag) { font-size: 13px; color: var(--cx-dim); }
.artifacts :deep(.artifact .down .main-tag) { font-size: 14px; }
.artifacts :deep(.artifact .up .name) { font-size: 13px; }
.artifacts .add-button { flex: 1; min-height: 64px; }
.artifact-item-or-button .add-button, .artifact-item-or-button .artifact-display { box-sizing: border-box; width: 100%; }
.panel-actions { gap: 8px; margin-top: 14px; }
.attributes-body :deep(.class) { color: var(--cx-dim); margin: 12px 0 4px; font-size: 16px; }
.attributes-body :deep(.attribute-item) { padding: 4px 0; line-height: 1.45; border-bottom: 1px solid var(--cx-step-2); }
.attributes-body :deep(.attribute-item .title) { color: var(--cx-dim); font-weight: 500; }
.attributes-body :deep(.attribute-item .value) { font-weight: 650; }
@container single-weapon (max-width: 480px) {
}
@container single-calculator (max-width: 820px) {
    .calc-workspace { grid-template-columns: minmax(0,1fr); }
    .config-weapon { border-left: 0; padding: 16px 0 0; border-top: 1px solid var(--hairline); }
}
@container single-calculator (max-width: 520px) {
    .card-heading h3 { font-size: 18px; }
    .attributes-body :deep(.attribute-item .value > span) { white-space: normal; }
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

.optimization-debug-control{margin:12px 0;padding:12px;border:1px solid var(--cx-step-2);border-radius:5px}.optimization-debug-control .el-alert{margin-top:10px}.optimization-debug-control details{margin-top:10px}.optimization-debug-control pre{max-height:280px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}

.manual-buff-source{display:flex;align-items:center;gap:8px;padding:0 8px 8px;color:var(--cx-dim);font-size:12px}.manual-buff-source :deep(.el-select){min-width:130px;flex:1}
.artifact-grade-summary{padding:4px 10px;background:var(--el-color-primary-light-9);border-radius:6px;color:var(--el-text-color-primary)}
.artifact-grade-summary>div{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px}.artifact-grade-summary strong{font-size:20px;color:var(--el-color-primary)}.artifact-grade-summary b{font-size:19px;color:var(--el-color-primary)}
.artifact-piece-score{padding:7px 8px;border-top:1px solid var(--el-border-color-lighter);font-size:12px;color:var(--el-color-primary);display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap}
.artifact-change-marker{display:inline-block;border-radius:3px;padding:2px 6px;background:var(--el-color-warning-light-9);color:var(--el-color-warning-dark-2);font-size:12px;line-height:1.4}
/* 装备差异：换了的部位各一张小表；数值变多用 --cx-up、变少用 --cx-down（与伤害涨跌同色） */
.artifact-diffs { display: grid; gap: 8px; margin-top: 12px; }
.artifact-diff { padding: 10px 12px; border-radius: 12px; background: var(--cx-step); }
.artifact-diff table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; line-height: 1.5; }
.artifact-diff caption { text-align: left; padding-bottom: 6px; color: var(--cx-letter); font-size: 13px; font-weight: 700; }
.artifact-diff th, .artifact-diff td { padding: 3px 4px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
.artifact-diff thead th { color: var(--cx-dim); font-weight: 400; }
.artifact-diff tbody th { color: var(--cx-dim); font-weight: 400; }
.artifact-diff tbody td { color: var(--cx-letter); font-variant-numeric: tabular-nums; }
.artifact-diff tbody tr + tr { box-shadow: 0 -1px 0 var(--cx-step-2); }
.artifact-diff td.up { color: var(--cx-up); font-weight: 600; }
.artifact-diff td.down { color: var(--cx-down); font-weight: 600; }
.condition-settings-content { container: buff-board / inline-size; }
.condition-settings-content .config-weapon { border: 0; padding: 0; }
.condition-settings-actions { display: flex; justify-content: flex-end; margin-bottom: 16px; }
.polestar-field-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    .polestar-field-stacks { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 14px; }
    .el-input-number { width: 130px; }
}
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
            color: var(--cx-dim);
        }
    }
}

.common-title2, .constraint-title {
    margin: 14px 0 7px;
    color: var(--cx-dim);
    font-size: 15px;
    font-weight: 600;
}

.common-description {
    font-size: 0.7rem;
    color: var(--cx-dim);
}

 //artifact effect description title
.effect4, .effect2 {
    color: var(--cx-gold);
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

<style>
/* 目的：配装目标和计算条件居中展示，长内容在窗口内滚动。 */
.optimization-target-overlay .optimization-target-dialog { margin: 0; max-height: calc(100vh - 32px); display: flex; flex-direction: column; }
.optimization-target-dialog .el-dialog__body { min-height: 0; overflow-y: auto; }
</style>

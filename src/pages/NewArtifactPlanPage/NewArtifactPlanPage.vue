<template>
    <div class="calculator-page">
        <UiDialog :model-value="!!pendingDraft" title="是否恢复上次单次计算进度？" width="min(440px, 94vw)"
            prevent-outside hide-close @escape-key-down="$event.preventDefault()">
            <div v-if="pendingDraft">上次计算角色：<strong>{{ ta(scoreCharacters[pendingDraft.preset.character.name].nameLocale) }}</strong></div>
            <template #footer>
                <div class="calculation-dialog-actions">
                    <UiButton :disabled="resumingDraft" @click="discardDraft">重新开始</UiButton>
                    <UiButton variant="primary" :loading="resumingDraft" @click="resumeDraft">恢复进度</UiButton>
                </div>
            </template>
        </UiDialog>
        <ArtifactPromptDialog :controller="calculationPrompt" />
        <RosterEditDialog ref="saveGameDialog" :character="characterLocale" />
        <UiDialog v-model="showOptimizationProgress" :title="optimizationRunning ? '计算进度' : optimizationCancelled ? '计算已取消' : '计算成功'"
            width="min(520px, calc(100vw - 24px))" prevent-outside :hide-close="optimizationRunning"
            :initial-focus="focusProgressAction"
            @escape-key-down="optimizationRunning && $event.preventDefault()">
            <template #title-icon>
                <span class="optimization-status-dot" :data-tone="optimizationTone" aria-hidden="true"></span>
            </template>
            <div class="optimization-progress-meter" :data-tone="optimizationTone">
                <ProgressRoot class="optimization-progress-track" aria-label="计算进度" :model-value="optimizationPercent">
                    <ProgressIndicator class="optimization-progress-fill"
                        :style="optimizationPercent === null ? undefined : { width: optimizationPercent + '%' }" />
                </ProgressRoot>
                <b v-if="optimizationPercent !== null" aria-hidden="true">{{ optimizationPercent }}%</b>
            </div>
            <div v-if="useNewScore && (dynamicScoreState.running || dynamicScoreState.error)" class="optimization-score-status">
                <p v-if="dynamicScoreState.running" role="status">评分 <b>{{ dynamicScoreState.status }}</b></p>
                <p v-if="dynamicScoreState.error" class="score-error" role="alert">评分失败：{{ dynamicScoreState.error }}</p>
            </div>
            <dl class="optimization-progress-stats">
                <div><dt>候选搭配空间上限</dt><dd>{{ numberOfGroups(optimizationProgress.candidateSpace) }} 组</dd></div>
                <div><dt>已计算</dt><dd>{{ numberOfGroups(optimizationProgress.evaluated) }} 次</dd></div>
                <div><dt>剩余搜索分组上限</dt><dd>{{ numberOfGroups(optimizationProgress.remainingGroups) }} 组</dd></div>
                <div v-if="optimizationStage"><dt>搜索阶段</dt><dd>{{ optimizationStage }}</dd></div>
                <div v-if="optimizationRunning"><dt>{{ optimizationProgress.etaScope === 'total' ? '预计剩余时间' : '本阶段预计剩余时间' }}</dt><dd>{{ formatComputeTime(optimizationRemaining) }}</dd></div>
                <div><dt>{{ optimizationRunning || optimizationCancelled ? '已用时间' : '计算时间' }}</dt><dd>{{ formatComputeTime(optimizationElapsed) }}</dd></div>
            </dl>
            <template #footer>
                <div v-if="optimizationRunning" class="optimization-progress-actions in-progress">
                    <UiButton variant="danger" @click="cancelOptimization">取消计算</UiButton>
                    <UiButton ref="backgroundButton" variant="primary" @click="backgroundOptimization">后台计算</UiButton>
                </div>
                <div v-else class="optimization-progress-actions">
                    <UiButton ref="progressConfirmButton" :variant="!optimizationCancelled && optimizationResults.length ? 'outline' : 'primary'"
                        @click="showOptimizationProgress=false">确定</UiButton>
                    <UiButton v-if="!optimizationCancelled && optimizationResults.length" ref="progressResultButton" variant="primary"
                        @click="showOptimizationProgress=false; showOptimizationResults=true">查看搭配</UiButton>
                </div>
            </template>
        </UiDialog>
        <optimization-results-dialog v-if="showOptimizationResults && !panelResultSnapshot" v-model="showOptimizationResults" :results="optimizationResults" :input="damageAnalysisWasmInterface" :infusion="fumo" :mona="mona" :get-artifact="getResultArtifact" :selected-index="reviewIndex"
            :charge-min="resultSearchInput?.constraint?.recharge_min" :objective-label="resultObjectiveLabel" :objective-before="reviewDsl?.before"
            :baseline-analysis="comparisonDamage.value" :baseline-label="reviewBaselineLabel" :skill-label="reviewSkill" @select="applyReviewCandidate" />
        <panel-results-dialog v-if="showOptimizationResults && panelResultSnapshot" v-model="showOptimizationResults" :results="optimizationResults" :snapshot="panelResultSnapshot" :selected-index="optimizationResultIndex" @select="applyReviewCandidate" />
        <artifact-score-dialog v-if="showArtifactScore" v-model="showArtifactScore"
            :item="artifactItems[scoreArtifactIndex]" :context="artifactScoreContext" :equipped="artifactItems" :dynamic-result="useNewScore ? dynamicScore : null" @dynamic="showArtifactScore=false;openDynamicScore()"
            @replace="replaceScoredArtifact" />
        <UiDialog
            :title="t('calcPage.selectArt')"
            width="min(1380px, 94vw)"
            v-model="showSelectArtifactDialog"
        >
            <select-artifact shadcn
                :position="selectArtifactSlot"
                :state="artifactPickerState"
                :highlight-tags="characterArtifactHighlights(characterName)"
                @select="handleSelectArtifact"
            ></select-artifact>
        </UiDialog>

<!--        damage analysis-->
        <UiDialog
            v-model="showDamageAnalysisDialog"
            :title="t('calcPage.dmgComp')"
            width="min(1440px, 96vw)"
        >
            <damage-analysis shadcn
                ref="damageAnalysisComponent"
                :enemy-config="enemyConfig"
                :character-level="characterLevelNumber"
                :character-name="characterName"
            ></damage-analysis>
        </UiDialog>

<!--    select buff    -->
        <UiDialog
            v-model="showSelectBuffDialog"
            :title="t('calcPage.selectBuff')"
            width="min(864px, 94vw)"
        >
            <select-buff shadcn
                v-if="showSelectBuffDialog"
                :preferred-uid="comparisonEntry?.uid || miyousheStore.selectedUid.value"
                :selected-names="buffs.map(b => b.name)"
                @select="handleSelectBuff"
            ></select-buff>
        </UiDialog>

        <CalcErrorDialog v-model="optimizationErrorDialog" :message="optimizationError" @export="exportOptimizationDebug" />

        <UiDialog v-model="showConstraintDialog" :title="t('calcPage.setupCalc')" width="min(400px, calc(100vw - 24px))"
            @escape-key-down="showPanelRangeDialog && $event.preventDefault()">
            <div class="calculation-settings">
                <section class="calculation-settings-debug">
                    <div class="calculation-debug-toolbar">
                        <label class="calculation-debug-toggle" for="calculation-debug-switch">
                            <UiSwitch id="calculation-debug-switch" v-model="optimizationDebugEnabled" />
                            <strong>Debug 模式</strong>
                        </label>
                        <UiButton size="small" :disabled="!optimizationDebugRecord" @click="exportOptimizationDebug">导出调试包</UiButton>
                    </div>
                    <span v-if="optimizationDebugRecord" class="calculation-debug-summary">
                        {{ optimizationDebugRecord.status === 'failed' ? '计算失败' : optimizationDebugRecord.status === 'completed' ? '计算完成' : optimizationDebugRecord.status === 'cancelled' ? '计算已取消' : '记录中' }} · 候选 {{ optimizationDebugRecord.summary?.candidateCount ?? 0 }} 件
                    </span>
                    <div v-if="optimizationError" class="calculation-settings-alert" data-tone="error" role="alert">
                        <b>配装计算未完成</b>
                        <p tabindex="0">{{ optimizationError }}</p>
                    </div>
                    <details v-if="optimizationDebugRecord?.events.length">
                        <summary>查看调试阶段与错误详情</summary>
                        <pre>{{ optimizationDebugDetail }}</pre>
                    </details>
                </section>
                <section v-if="optimizationMode === 'damage'" class="calculation-settings-section">
                    <h3 class="calculation-settings-heading">
                        {{ t('misc.algo') }}
                        <UiHoverDetails enabled :tap-label="t('misc.algo')">
                            <template #trigger>
                                <UiButton size="small" class="calculation-algorithm-help" :aria-label="t('misc.algo')"><i-ep-question-filled aria-hidden="true" /></UiButton>
                            </template>
                            <span v-html="t('calcPage.algoDesc')"></span>
                        </UiHoverDetails>
                    </h3>
                    <UiSegmentedControl :model-value="algorithm" :label="t('misc.algo')"
                        :options="[{ value: 'AStar', label: t('calcPage.aStar') }, { value: 'Naive', label: t('calcPage.naive') }]"
                        @update:model-value="algorithm = $event as 'AStar' | 'Naive'" />
                    <p v-if="algorithm === 'Naive'" class="calculation-settings-alert" role="alert">{{ t('calcPage.plzSetConst') }}</p>
                </section>
                <section class="calculation-settings-section">
                    <h3>{{ t('calcPage.constSet') }}</h3>
                    <select-artifact-set shadcn multiple v-model="constraintArtifactSet" :placeholder="t('calcPage.constSet')" />
                    <h3>{{ t('calcPage.constMain') }}</h3>
                    <div class="calculation-stat-row">
                        <span>{{ t('misc.sand') }}</span>
                        <select-artifact-main-stat shadcn v-model="constraintSandMainStats" :include-any="false" multiple position="sand"
                            :placeholder="t('calcPage.constMain')" />
                    </div>
                    <div class="calculation-stat-row">
                        <span>{{ t('misc.cup') }}</span>
                        <select-artifact-main-stat shadcn v-model="constraintGobletMainStats" :include-any="false" multiple position="cup"
                            :placeholder="t('calcPage.constMain')" />
                    </div>
                    <div class="calculation-stat-row">
                        <span>{{ t('misc.head') }}</span>
                        <select-artifact-main-stat shadcn v-model="constraintHeadMainStats" :include-any="false" multiple position="head"
                            :placeholder="t('calcPage.constMain')" />
                    </div>
                    <UiButton v-if="optimizationMode === 'damage'" ref="panelRangeTrigger" aria-haspopup="dialog" @click="showPanelRangeDialog = true">
                        {{ t('calcPage.panelRangeSettings') }}
                    </UiButton>
                </section>
                <section class="calculation-settings-section">
                    <h3>{{ t('calcPage.filKumi') }}</h3>
                    <ArtifactGroupFilter v-model="filteredKumiIds" v-model:query="filterKumiSearch" :groups="filterKumiTreeData" />
                </section>
            </div>
        </UiDialog>
        <UiDialog v-model="showPanelRangeDialog" :title="t('calcPage.panelRangeSettings')" width="440px"
            :return-focus="() => panelRangeTrigger?.$el.focus()">
            <PanelRangeFields v-model="panelBounds" />
            <p v-if="invalidPanelRange" class="panel-range-error" role="alert">{{ t('calcPage.invalidPanelRange') }}</p>
        </UiDialog>

<!--    artifacts analysis    -->
        <UiDialog
            v-model="showArtifactAnalysisDialog"
            :title="t('calcPage.artAnalysis')"
            width="min(1000px, 94vw)"
        >
            <artifacts-set-statistics
                :artifact-ids="artifactIds"
            ></artifacts-set-statistics>
        </UiDialog>

<!--    stats marginal bonus    -->
        <UiDialog v-model="showOptimalGainCurve" title="最优词条收益曲线" width="min(1100px, 94vw)">
            <optimal-stat-gain-curve v-if="showOptimalGainCurve"
                :input="damageAnalysisWasmInterface" :analysis="characterDamageAnalysis" :fumo="fumo" :account-id="accountStore.currentAccountId.value" />
        </UiDialog>
        <UiDialog
            v-model="showArtifactPerBonusDialog"
            :title="t('calcPage.statCurve')"
            width="min(1100px, 94vw)"
        >
            <artifact-per-stat-bonus
                :data="miscPerStatBonus"
            ></artifact-per-stat-bonus>
        </UiDialog>

<!--        new artifact kumi-->
        <save-as-kumi
            v-model="showSaveKumiDialog"
            :default-name="kumiDefaultName"
            @confirm="handleSaveAsKumi"
        ></save-as-kumi>

<!--    select artifact kumi    -->
        <UiDialog v-model="showUseKumiDialog" :title="t('calcPage.selectKumi')" width="min(620px, 94vw)">
            <div class="kumi-picker">
                <CollapsibleRoot v-for="folder in kumiTreeData" :key="folder.id" class="kumi-folder" :open="expandedKumiFolders.has(folder.id)"
                    @update:open="open => open ? expandedKumiFolders.add(folder.id) : expandedKumiFolders.delete(folder.id)">
                    <CollapsibleTrigger as-child>
                        <UiButton class="kumi-folder-trigger"><i-ep-folder aria-hidden="true" /><span>{{ folder.label }}</span><i-ep-arrow-down aria-hidden="true" /></UiButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent class="kumi-folder-items">
                        <UiButton v-for="item in folder.children" :key="item.id" @click="handleUseKumi(item)">{{ item.label }}</UiButton>
                    </CollapsibleContent>
                </CollapsibleRoot>
                <p v-if="!kumiTreeData.length" class="kumi-empty">{{ locale === 'en' ? 'No Data' : '暂无数据' }}</p>
            </div>
        </UiDialog>


        <UiDialog v-model="showConfigArtifactDialog" :title="t('calcPage.setupArt')" width="min(780px, calc(100vw - 24px))">
            <template #toolbar>
                <div class="artifact-settings-toolbar">
                    <div class="artifact-settings-actions">
                        <div class="artifact-settings-mode">
                            <h3>{{ t('calcPage.artMode') }}</h3>
                            <UiSegmentedControl :model-value="artifactEffectMode" :label="t('calcPage.artMode')"
                                :options="[{ value: 'auto', label: t('calcPage.modeAuto') }, { value: 'custom', label: t('calcPage.modeCustom') }]"
                                @update:model-value="artifactEffectMode = $event as 'auto' | 'custom'" />
                        </div>
                        <PresetExclusionFilter v-model="miyousheStore.data.value.excludedArtifactPresets" :groups="exclusionGroups" />
                    </div>
                    <UiSearchInput v-if="artifactEffectMode === 'custom'" v-model="artifactConfigSearch" :placeholder="t('misc.search')" />
                </div>
            </template>
            <artifact-config v-if="artifactEffectMode === 'custom'" v-model="artifactConfig" :search="artifactConfigSearch" />
        </UiDialog>

        <UiDialog v-model="showDefaultCharacters" title="默认角色" width="min(1000px, 96vw)">
            <default-character-picker v-if="showDefaultCharacters" @select="name => pendingCharacterSwitch = { source: 'default', name }" />
        </UiDialog>
        <UiDialog v-model="showMyCharacters" title="选择角色预设" width="min(1000px, 96vw)">
            <miyoushe-character-picker v-if="showMyCharacters" shadcn @apply="(name, loadout) => pendingCharacterSwitch = { source: 'saved', name, loadout }" />
        </UiDialog>
        <UiDialog :model-value="!!pendingCharacterSwitch" @update:model-value="open => { if (!open) pendingCharacterSwitch = null }"
            title="切换角色" width="min(400px, 92vw)">
            是否保留当前 BUFF、圣遗物等计算条件？
            <template #footer>
                <div class="calculation-dialog-actions">
                    <UiButton @click="finishCharacterSwitch(false)">{{ pendingCharacterSwitch?.source === 'saved' ? '否，使用角色预设' : '否，清空' }}</UiButton>
                    <UiButton variant="primary" @click="finishCharacterSwitch(true)">是，保留</UiButton>
                </div>
            </template>
        </UiDialog>
        <UiAlert v-if="betaCalculationError" tone="error" class="calculation-page-error">{{ betaCalculationError }}</UiAlert>
        <div class="calc-content cx-scope" data-theme="mist">
            <calc-top-bar :target-label="optimizeTargetLabel" :running="optimizationRunning || dynamicScoreState.running"
                @target="optimizeSettingsOpen = true" @calculation-settings="handleClickSetupOptimization"
                @artifact-settings="handleClickArtifactConfig"
                @run="optimizeSettingsOpen = false; handleOptimizeArtifact()">
                <template #preset>
                    <div class="preset-actions">
                        <UiButton class="preset-save" @click="handleSavePreset(miscCurrentPresetName)">
                            <span v-if="!miscCurrentPresetName">{{ t('calcPage.newPreset') }}</span>
                            <span v-else>{{ t('calcPage.savePreset') }}「{{ presetStore.displayName(miscCurrentPresetName) }}」</span>
                        </UiButton>
                        <UiDropdownMenu>
                            <template #trigger>
                                <UiButton class="preset-menu-trigger" :aria-label="t('calcPage.savePreset')"><i-ep-arrow-down aria-hidden="true" /></UiButton>
                            </template>
                            <UiDropdownMenuItem @select="handlePresetCommand('share')">分享当前预设</UiDropdownMenuItem>
                            <UiDropdownMenuItem @select="handlePresetCommand('save-as')">{{ t('calcPage.saveAsPreset') }}</UiDropdownMenuItem>
                        </UiDropdownMenu>
                    </div>
                </template>
            </calc-top-bar>
            <UiDialog v-model="optimizeSettingsOpen" title="配装设置" :width="optimizationTargetWidth" animate-width>
                    <RadioGroupRoot v-model="optimizationMode" class="optimization-switcher" aria-label="配装模式">
                        <RadioGroupItem value="damage">伤害配装</RadioGroupItem>
                        <RadioGroupItem value="panel">面板配装</RadioGroupItem>
                    </RadioGroupRoot>
                    <template v-if="optimizationMode === 'panel'">
                        <panel-search-config v-model="panelSearchOptions" class="optimization-mode-panel" />
                        <p v-if="invalidPanelSearchRange" class="panel-range-error" role="alert">{{ t('calcPage.invalidPanelRange') }}</p>
                    </template>
                    <TabsRoot v-else v-model="optimizationTargetTab" class="optimization-tabs">
                        <TabsList class="optimization-switcher" aria-label="目标函数">
                            <TabsTrigger value="normal">{{ t('calcPage.tfNormal') }}</TabsTrigger>
                            <TabsTrigger value="dsl">MONA-DSL</TabsTrigger>
                            <TabsTrigger value="saved">已保存手法</TabsTrigger>
                            <TabsTrigger value="generator">DSL 生成器</TabsTrigger>
                        </TabsList>
                        <TabsContent value="normal">
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
                        </TabsContent>
                        <TabsContent value="dsl">
                            <p class="optimization-notice" role="note">{{ t('calcPage.beta') }}</p>
                            <textarea v-model="targetFunctionDSLSource" :placeholder="t('misc.code')" :aria-label="t('misc.code')"
                                rows="10" spellcheck="false" class="optimization-code-input"></textarea>
                            <UiButton :disabled="!targetFunctionDSLSource.trim()" @click="shareDsl(targetFunctionDSLSource)">分享 DSL</UiButton>
                        </TabsContent>
                        <TabsContent value="saved">
                            <div class="optimization-saved" :aria-busy="savedTargetsLoading ? 'true' : undefined">
                                <p v-if="savedTargetsError" class="optimization-saved-error" role="alert">{{ savedTargetsError }}</p>
                                <div v-if="savedTargets.length > 0" class="optimization-saved-list">
                                    <UiButton
                                        v-for="entry in savedTargets"
                                        :key="entry.id"
                                        class="optimization-saved-item"
                                        :class="{ 'is-selected': savedTargetId === entry.id }"
                                        :aria-pressed="savedTargetId === entry.id"
                                        @click="selectSavedTarget(entry.id)"
                                    >
                                        <span class="optimization-saved-name">{{ entry.name }}</span>
                                        <span v-if="entry.description" class="optimization-saved-desc">{{ entry.description }}</span>
                                    </UiButton>
                                </div>
                                <div v-else-if="!savedTargetsLoading && !savedTargetsError" class="optimization-saved-empty">
                                    <RouterLink to="/dsl-management" class="optimization-saved-link">DSL管理</RouterLink>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="generator" force-mount v-show="optimizationTargetTab === 'generator'">
                            <dsl-generator v-model="dslGeneratorState" :input="damageAnalysisWasmInterface" :mona="mona"
                                :wide="wideDslGenerator" :active="optimizeSettingsOpen && optimizationTargetTab === 'generator'" />
                            <UiButton :disabled="!dslGeneratorState.entries.length" @click="shareDsl(generatedDsl)">分享 DSL</UiButton>
                        </TabsContent>
                    </TabsRoot>


                    <div v-if="optimizationResults.length > 0" class="optimization-result-summary">
                        <UiAlert tone="success">保留{{ optimizationResults.length }}组圣遗物搭配</UiAlert>
                        <UiButton class="view-optimization-results" @click="optimizeSettingsOpen = false; showOptimizationResults = true">点开查看所有搭配</UiButton>
                        <UiNumberField
                            :model-value="optimizationResultIndex"
                            label="配装结果"
                            :min="1"
                            :max="optimizationResults.length"
                            @update:model-value="$event !== null && handleUseNthOptimizationResult($event)"
                        />
                        <value-display
                            v-if="!panelResultSnapshot"
                            class="optimization-result-value"
                            :value="optimizationResults[0].value > 0 ? optimizationResults[optimizationResultIndex - 1].ratio : null"
                            :extra="optimizationResults[optimizationResultIndex - 1].value.toFixed(1)"
                        ></value-display>
                    </div>

            </UiDialog>
            <UiDialog v-model="characterDrawerOpen" title="角色" width="min(640px, 94vw)">
                <div class="condition-settings-content" data-theme="mist">
                        <section class="config-character setup-section">
                            <div class="calc-field"><span>角色等级</span><select-character-level v-model="characterLevel" use-ui-select /></div>
                            <div class="character-progress">
                                <CharacterTalentCards :entry="characterCardEntry">
                                    <template #editor>
                                        <div class="talent-editor">
                                            <div v-for="talent in characterTalentFields" :key="talent.key" class="calc-field">
                                                <span>{{ t(talent.key) }}</span>
                                                <UiSelect :model-value="String(talent.level.value)" :label="t(talent.key)" :options="characterTalentLevels"
                                                    @update:model-value="talent.level.value = Number($event)" />
                                            </div>
                                        </div>
                                    </template>
                                </CharacterTalentCards>
                                <CharacterConstellation :entry="characterCardEntry" direct-selection @change-rank="characterConstellation = $event" />
                            </div>
                            <DslParamFields v-if="characterNeedConfig" class="character-extra-config" :configs="characterConfigConfig"
                                :model-value="characterConfig[characterName]" @update:model-value="characterConfig = { [characterName]: $event }" />
                            <fieldset v-if="isTraveler(characterName)" class="traveler-resonance">
                                <legend>旅行者共鸣元素 · 真实之月</legend>
                                <div class="traveler-resonance-options">
                                    <UiCheckbox v-for="element in travelerElements" :key="element" :model-value="travelerResonance.includes(element)"
                                        @update:model-value="setTravelerResonance(element, $event)">{{ t('ele', element) }}</UiCheckbox>
                                </div>
                            </fieldset>
                        </section>
                </div>
            </UiDialog>
            <UiDialog v-model="weaponDrawerOpen" title="武器" width="min(760px, 94vw)"
                @escape-key-down="weaponPickerOpen && $event.preventDefault()">
                <div class="condition-settings-content" data-theme="mist">
                        <section class="config-weapon setup-section">
                            <div class="weapon-fields">
                                <div class="calc-field"><span>武器等级</span><select-weapon-level v-model="weaponLevel" use-ui-select /></div>
                                <div class="calc-field">
                                    <span>{{ t('misc.refine') }}</span>
                                    <UiSelect :model-value="String(weaponRefine)" :label="t('misc.refine')" :options="weaponRefineOptions"
                                        @update:model-value="weaponRefine = Number($event)" />
                                </div>
                            </div>
                            <weapon-display :weapon="weaponInterface">
                                <template #image="{ src }">
                                    <UiButton ref="weaponPickerTrigger" class="weapon-picker-trigger"
                                        aria-label="选择武器" aria-haspopup="dialog" @click="weaponPickerOpen = true">
                                        <img :src="src" alt="" />
                                    </UiButton>
                                </template>
                            </weapon-display>
                            <DslParamFields v-if="weaponNeedConfig" class="weapon-extra-config" :configs="weaponConfigConfig"
                                :model-value="weaponConfig[weaponName]" @update:model-value="weaponConfig = { [weaponName]: $event }" />
                        </section>
                </div>
            </UiDialog>
            <CharacterWeaponPicker v-model="weaponPickerOpen" :character-label="characterLocale" :weapon-type="characterWeaponType"
                :weapon-key="weaponName" :weapon="weaponInterface" :signatures="characterSignatureWeapons(characterName)"
                :return-focus="() => weaponPickerTrigger?.$el.focus()" @select="applyPickedWeapon" />
            <UiDialog v-model="artifactsDrawerOpen" title="圣遗物" width="min(1000px, 94vw)">
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
                            <UiSegmentedControl v-if="artifactNeedConfig2 || artifactNeedConfig4" :model-value="artifactEffectMode" :label="t('calcPage.artMode')"
                                :options="[{ value: 'auto', label: t('calcPage.modeAuto') }, { value: 'custom', label: t('calcPage.modeCustom') }]"
                                @update:model-value="artifactEffectMode = $event as 'auto' | 'custom'" />
                            <div v-if="artifactNeedConfig2" style="margin-top: 16px">
                                <p class="common-description">
                                    <span class="effect2">{{ t("calcPage.effect2") }}</span>
                                    <span v-html="artifactEffect2Text"></span>
                                </p>
                                <item-config shadcn
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
                                <item-config shadcn
                                    v-if="artifactEffectMode === 'custom'"
                                    v-model="artifactConfig"
                                    :item-name="artifactConfigItemName"
                                    :configs="artifactConfig4Configs"
                                ></item-config>
                            </div>
                        </section>
                </div>
            </UiDialog>
            <UiDialog v-model="attributesDrawerOpen" title="全部属性" width="min(760px, 94vw)">
                <div class="attributes-body condition-settings-content" data-theme="mist">
                    <UiAlert v-if="comparisonAttribute.error" tone="warning">{{ comparisonAttribute.error }}</UiAlert>
                    <attribute-panel shadcn
                        :attribute="displayAttributes"
                        :baseline="comparisonAttribute.value"
                    ></attribute-panel>
                    <div class="panel-actions">
                        <UiButton variant="primary" @click="showOptimalGainCurve = true" :disabled="!!betaCalculationError"><i-ep-histogram aria-hidden="true" />最优收益曲线 · 0～20 条</UiButton>
                        <UiButton @click="handleClickAttributeAnalysis"><i-ep-histogram aria-hidden="true" />{{ t('calcPage.statCurve') }}</UiButton>
                    </div>
                </div>
            </UiDialog>
            <UiDialog v-model="buffDrawerOpen" title="BUFF" width="min(1560px, max(94vw, calc(100vw - 32px)))">
                <template #toolbar>
                    <div class="condition-settings-actions"><UiButton variant="primary" @click="handleClickAddBuff"><i-ep-plus aria-hidden="true" />添加BUFF</UiButton></div>
                </template>
                <div class="condition-settings-content" data-theme="mist">
                    <div class="polestar-field-control">
                        <label class="polestar-field-toggle" for="polestar-field-switch">
                            <UiSwitch id="polestar-field-switch" v-model="polestarEnabled" />启用极星辉域
                        </label>
                        <div class="polestar-field-stacks">
                            <span>极星辉域层数</span>
                            <UiNumberField :model-value="polestarStacks" :min="0" :max="12" :disabled="!polestarEnabled"
                                label="极星辉域层数" @update:model-value="$event !== null && (polestarStacks = $event)" />
                        </div>
                    </div>
                    <selected-buff-groups shadcn compact-empty-columns v-model:collapsed-groups="collapsedBuffGroups" class="buffs" :buffs="otherBuffs">
                        <template #default="{ buff }">
                            <buff-item shadcn
                                :key="buff.id"
                                :buff="buff"
                                v-model:buffConfig="buff.config"
                                @delete="handleClickDeleteBuff(buff.id)"
                                @toggle="handleClickToggleBuff(buff.id)"
                            />
                            <div v-if="teamContextSources.length" class="manual-buff-source">
                                <span>手动 BUFF 来源</span>
                                <UiSelect :model-value="buff.source_id" label="手动 BUFF 来源" placeholder="未关联队友"
                                    :options="manualBuffSourceOptions" @update:model-value="buff.source_id = $event === 'unlinked' ? undefined : $event" />
                            </div>
                        </template>
                    </selected-buff-groups>
                </div>
            </UiDialog>
            <UiDialog v-model="teammateDrawerOpen" title="队友" width="min(760px, 94vw)">
                <div class="condition-settings-content" data-theme="mist">
                    <team-buff-sources shadcn v-model="teamContextSources" v-model:stellar-mode="teamContextStellarMode"
                        :character="characterName" :preset-name="miscCurrentPresetName" :issues="teamContextResult.issues" />
                </div>
            </UiDialog>
            <UiDialog v-model="enemyDrawerOpen" :title="t('calcPage.setupEnemy')" width="min(760px, 94vw)">
                <div class="condition-settings-content" data-theme="mist">
                    <div class="enemy-infusion">
                        <h3 class="common-title2">{{ t('calcPage.fumo') }}</h3>
                        <select-element-type shadcn v-model="fumo" :label="t('calcPage.fumo')"
                            :elements="['Pyro', 'Electro', 'Hydro', 'Anemo', 'Geo', 'Cryo', 'Dendro', 'None']" />
                    </div>
                    <enemy-config-component shadcn v-model="enemyConfig" />
                </div>
            </UiDialog>
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
                                        <preset-picker shadcn :character="characterName" @select="applyArtifactsToPreset" @create="createPresetFromResult" />
                                        <UiButton class="export-artifact-loadout" size="small" :disabled="!canExportLoadout" @click="exportArtifactLoadout">导出圣遗物配装JSON</UiButton>

                                        <UiButton v-if="useNewScore && dynamicScore" class="score-basis-button" size="small" @click="openScoreBasis">评分依据</UiButton>
                                        <span v-else-if="useNewScore && dynamicScoreState.running" class="score-status" role="status">{{ dynamicScoreState.status }}</span>
                                        <span v-else-if="useNewScore && dynamicScoreState.error" class="score-error" role="alert">{{ dynamicScoreState.error }}</span>
                                    </div>
                                </div>
                                <div class="artifact-score-summary">
                                    <UiButton v-if="useNewScore" class="calculate-artifact-score" variant="primary" size="small"
                                        :disabled="optimizationRunning || dynamicScoreState.running" :loading="dynamicScoreState.running"
                                        @click="dynamicScoreController?.start()">计算当前圣遗物新评分</UiButton>
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
                                    <artifact-display shadcn
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
                                <UiButton size="small" @click="handleClickArtifactAnalysis"><i-ep-histogram aria-hidden="true" />{{ t('calcPage.statAnalysis') }}</UiButton>
                                <UiButton size="small" @click="handleClickSaveAsKumi"><i-ep-star-filled aria-hidden="true" />{{ t('calcPage.saveKumi') }}</UiButton>
                                <UiButton size="small" @click="handleClickUseKumi"><i-ep-folder aria-hidden="true" />{{ t('calcPage.useKumi') }}</UiButton>
                                <UiButton v-show="artifactCount > 0" size="small" @click="isAllLocked ? handleUnlockAll() : handleLockAll()">
                                    <i-ep-unlock v-if="isAllLocked" aria-hidden="true" /><i-ep-lock v-else aria-hidden="true" />
                                    {{ isAllLocked ? t('calcPage.unlockAll') : t('calcPage.lockAll') }}
                                </UiButton>
                                <UiButton size="small" :disabled="artifactCount === 0" @click="clearArtifacts(); recordUsage('action.clear-selected')">清空已选</UiButton>
                            </div>
                        </section>
                    </template>
                </character-hero-card>
                <div class="calc-editor">
                        <damage-result-card class="damage-card" v-model="characterSkillIndex" :groups="damageSkillGroups" :direct-reaction-skills="directReactionSkills" @details="handleDisplayAnalysis">
                            <template v-if="damageMode" #actions>
                                <button type="button" class="damage-mode" @click="openHeroSection('character')">当前模式：{{ damageMode.label }}（点击切换）</button>
                            </template>
                            <UiAlert v-if="comparisonDamage.error" tone="warning">{{ comparisonDamage.error }}</UiAlert>
                            <damage-panel v-if="!betaCalculationError && characterDamageAnalysis" layout="feature"
                                :analysis-from-wasm="characterDamageAnalysis" :baseline="comparisonDamage.value"
                            ></damage-panel>
                            <div v-if="characterNeedSkillConfig" style="margin-bottom: 16px;">
                                <h3 class="common-title2">{{ t("calcPage.skillConfig") }}</h3>
                                <item-config shadcn
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
import ArtifactPromptDialog from '@/pages/ArtifactsPage/ArtifactPromptDialog.vue'
import { createArtifactPrompt } from '@/pages/ArtifactsPage/artifact-prompt'
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
import {canExportArtifactLoadout, createArtifactLoadout} from '@/algorithms/artifact-loadout-export.mjs'
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
import PanelRangeFields from './PanelRangeFields.vue'
import PanelResultsDialog from './PanelResultsDialog.vue'
import {createComputeResult} from "@/api/misc"
import {useMediaQuery} from "@vueuse/core"
import SelectArtifact from "@/components/select/SelectArtifact.vue"
import SelectArtifactSet from "@c/select/SelectArtifactSet"
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
import { presetPreview } from '@/components/share/preset-preview.mjs'
import { openContentShare } from '@/components/share/content-share.mjs'
import DslGenerator from './DslGenerator.vue'
import { useSavedDslTarget } from './useSavedDslTarget'
import UiButton from '@/components/ui/UiButton.vue'
import UiAlert from '@/components/ui/UiAlert.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiDropdownMenu from '@/components/ui/UiDropdownMenu.vue'
import UiDropdownMenuItem from '@/components/ui/UiDropdownMenuItem.vue'
import UiHoverDetails from '@/components/ui/UiHoverDetails.vue'
import UiNumberField from '@/components/ui/UiNumberField.vue'
import UiSearchInput from '@/components/ui/UiSearchInput.vue'
import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import UiSwitch from '@/components/ui/UiSwitch.vue'
import ArtifactGroupFilter from './ArtifactGroupFilter.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import DslParamFields from './DslParamFields.vue'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, ProgressIndicator, ProgressRoot, RadioGroupItem, RadioGroupRoot, TabsContent, TabsList, TabsRoot, TabsTrigger } from 'radix-vue'
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
import type {ArtifactMainStatName, ArtifactPosition, ArtifactSetName, IArtifact, IArtifactWasm} from "@/types/artifact"
import {useComputeConstraint} from "@/composables/constraint"
import {useBuff} from "@/composables/buff"
import {type PresetEntry, usePresetStore} from "@/store/pinia/preset"
import {useCharacterPresetLabel} from '@/composables/character-preset-label'
import {useArtifactStore} from "@/store/pinia/artifact"
import type {IDslGeneratorState, IPreset, ITeamContextSource, PanelBounds} from "@/types/preset"
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

import {buffData} from '@buff'
import {onDeactivated, reactive} from 'vue'
import {calculationHistory,calculationState,showCalculationNotice} from '@/store/calculation-history'
import {historyMembers,buildIds} from '@/algorithms/calculation-history.mjs'
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
const calculationPrompt = createArtifactPrompt()
// 配装前穿着的五件（圣遗物 ID），供「恢复原装备」使用；从计算历史恢复的结果没有这份记录
const preOptimizationIds = ref<number[] | null>(null)
const optimizeSettingsOpen = ref(false)
const characterDrawerOpen = ref(false)
const weaponDrawerOpen = ref(false)
const weaponPickerOpen = ref(false)
const weaponPickerTrigger = ref<InstanceType<typeof UiButton> | null>(null)
const artifactsDrawerOpen = ref(false)
const attributesDrawerOpen = ref(false)
const buffDrawerOpen = ref(false)
const teammateDrawerOpen = ref(false)
onDeactivated(() => {
    calculationPrompt.cancel('close')
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
const { t, ta, locale } = useI18n()


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
function countedLevelOptions(max: number) {
    return Array.from({ length: max }, (_, index) => {
        const value = String(index + 1)
        return { value, label: value }
    })
}
const characterTalentLevels = countedLevelOptions(15)
const characterTalentFields = [
    { key: 'skillType.a', level: characterSkill1 },
    { key: 'skillType.e', level: characterSkill2 },
    { key: 'skillType.q', level: characterSkill3 },
]
function setTravelerResonance(element: string, selected: boolean) {
    travelerResonance.value = selected ? [...travelerResonance.value, element] : travelerResonance.value.filter(value => value !== element)
}
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
const weaponRefineOptions = computed(() => countedLevelOptions(weaponMaxRefine.value))

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
const {
    optimizationTargetTab, savedTargets, savedTargetId, savedTargetsLoading, savedTargetsError,
    activeSavedTarget, selectSavedTarget, forgetSavedTarget,
} = useSavedDslTarget({
    open: computed(() => optimizeSettingsOpen.value && optimizationMode.value === 'damage'),
    character: characterName,
    accountId: accountStore.currentAccountId,
    reloadGeneration: accountStore.reloadGeneration,
    mode: miscTargetFunctionTab,
    source: targetFunctionDSLSource,
})
const wideDslGenerator = useMediaQuery('(min-width: 1100px)')
const optimizationTargetWidth = computed(() =>
    optimizationMode.value === 'damage' && optimizationTargetTab.value === 'generator' && wideDslGenerator.value
        ? 'min(1320px, 94vw)'
        : 'min(560px, 94vw)')


const dslGeneratorState = ref<IDslGeneratorState>({character: characterName.value, entries: []})
function handlePresetCommand(command: 'share' | 'save-as') {
    if (command !== 'share') return handleClickSaveOptimizeConfig()
    const preset = getPresetItem(), name = miscCurrentPresetName.value
    const title = name && !presetStore.getPreset(name)?.item.miyousheKey ? name : characterLocale.value+'预设'
    const {content,equipment} = presetPreview(preset,title,artifactItems.value,(key:string)=>t('stat',key))
    openContentShare('preset',content,equipment,{ shadcn: true })
}
function shareDsl(source: string) {
    optimizeSettingsOpen.value = false
    openContentShare('dsl',{ character:characterName.value,title:characterLocale.value+' · MONA-DSL',source },[],{ shadcn: true })
}
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
const canExportLoadout = computed(() => canExportArtifactLoadout(artifactItems.value))

async function exportArtifactLoadout() {
    if (!canExportLoadout.value) return
    try {
        const plan = createArtifactLoadout({
            character: characterInterface.value,
            name: scoreLocale[scoreCharacters[characterName.value].nameLocale],
            weapon: weaponInterface.value,
            items: artifactItems.value,
            artifacts: artifactWasmFormat.value,
            setLabel: (setName: string) => scoreLocale[artifactsData[setName].nameLocale],
        })
        await downloadString(JSON.stringify(plan, null, 2), 'application/json', 'plan.json')
    } catch (error: any) {
        showCalculationNotice('error', error.message || String(error))
    }
}

const artifactEffectMode = ref<'auto' | 'custom'>('auto')

const showSelectArtifactDialog = ref(false)
const showArtifactScore = ref(false)
const scoreArtifactIndex = ref(0)
function replaceScoredArtifact() {
    showArtifactScore.value = false
    handleGotoSelectArtifact(scoreArtifactIndex.value)
}
const selectArtifactSlot = ref<ArtifactPosition>("flower")
const artifactPickerState = reactive({ page: 1, mainTag: 'any' as ArtifactMainStatName | 'any', setName: 'any' as ArtifactSetName | 'any' })

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
const showPanelRangeDialog = ref(false)
const panelRangeTrigger = ref<{ $el: HTMLButtonElement } | null>(null)
const {
    algorithm,
    constraintArtifactSet,
    constraintSandMainStats,
    constraintGobletMainStats,
    constraintHeadMainStats,
    panelBounds,
    restorePanelBounds,

    constraintSetMode,
    constraintInterface,
    presetConstraint,
    presetFilter,
} = useComputeConstraint()
const hasInvalidRange = (bounds: PanelBounds) => Object.values(bounds).some(range =>
    range?.min != null && range.max != null && range.min > range.max)
const invalidPanelRange = computed(() => hasInvalidRange(panelBounds.value))
const invalidPanelSearchRange = computed(() => hasInvalidRange(panelSearchOptions.value.bounds))
const filterKumiSearch = ref("")
const filteredKumiIds = ref<number[]>([])

function handleClickSetupOptimization() {
    showConstraintDialog.value = true
}


//////////////////////////////////////////////////////////////
// artifact config
const showConfigArtifactDialog = ref(false)
const artifactConfigSearch = ref('')
watch(artifactEffectMode, () => { artifactConfigSearch.value = '' })

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
    showCalculationNotice('success', '保存成功')
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
        showCalculationNotice('success', '已保存')
    }
    const changes = saved?.miyousheKey ? presetEquipmentChanges(saved, item) : []
    if (changes.length) saveGameDialog.value!.request('保存预设', `已更改${changes.join('、')}。要新建角色预设吗？`, true, save)
    else save(null)
}

async function handleClickSaveOptimizeConfig(fromResult = false) {
    if (calculationPrompt.request.value) return
    const item = getPresetItem()
    const roleKey = calculatorRosterKey()
    const displayed = deepCopy(artifactItems.value)
    try {
        if (fromResult) assertPresetArtifacts(item.artifactIds!, displayed, artifactStore.artifacts.value)
        const {value} = await calculationPrompt.prompt('预设名称', '新建自定义预设', {
            confirmButtonText: '确定', cancelButtonText: '取消', inputValue: presetDefaultName.value,
            inputValidator: value => customPresetNameError(presetStore.presets.value, value) || true,
        })
        if (fromResult) assertPresetArtifacts(item.artifactIds!, displayed, artifactStore.artifacts.value)
        saveCalculatorCopy(value, item, roleKey)
    } catch (error: any) {
        if (error !== 'cancel' && error !== 'close') showCalculationNotice('error', error.message || String(error))
    }
}

function createPresetFromResult() { handleClickSaveOptimizeConfig(true) }

function applyArtifactsToPreset(name: string) {
    try {
        presetStore.applyArtifacts(name, artifactIds.value, artifactItems.value)
        recordUsage('action.preset-save')
        showCalculationNotice('success', '已应用圣遗物到预设。')
    } catch (error: any) { showCalculationNotice('error', error.message || String(error)) }
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
    forgetSavedTarget()
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
    }
    restorePanelBounds(constraint)

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
const collapsedBuffGroups = ref<string[]>([])
const manualBuffSourceOptions = computed(() => [
    { value: 'unlinked', label: '未关联队友' },
    ...teamContextSources.value.map(source => ({ value: source.sourceId, label: characterPresetLabel(source.presetName) })),
])
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
        if (calculationPrompt.request.value) return
        try { await calculationPrompt.confirm(`当前已添加${title}，是否重复添加？`, '提示', { confirmButtonText: '是', cancelButtonText: '否', type: 'warning' }) }
        catch (action) { if (action !== 'cancel' && action !== 'close') showCalculationNotice('error', String(action)); return }
    }
    if (!options?.keepOpen) showSelectBuffDialog.value = false
    addBuff(name, options?.config)
    showCalculationNotice('success', `已添加${title}`)
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
    if (betaCalculationError.value) return showCalculationNotice('error', betaCalculationError.value)
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
    if (betaCalculationError.value) return showCalculationNotice('error', betaCalculationError.value)
    try {
        miscPerStatBonus.value = mona.BonusPerStat.bonus_per_stat(bonusPerStatWasmInterface.value)
        showArtifactPerBonusDialog.value = true
    } catch (error: any) {
        showCalculationNotice('error', error.message || String(error))
    }
}

const ArtifactPerStatBonus = defineAsyncComponent({
    loader: () => import("@/components/display/ArtifactPerStatBonus.vue")
})


/////////////////////////////////////////////////////////////////////////
// kumi
const showSaveKumiDialog = ref(false)
const showUseKumiDialog = ref(false)
const expandedKumiFolders = reactive(new Set<number>())

interface KumiChoice {
    label: string,
    id: number,
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

const kumiTreeData = computed(() => {
    const data: Array<KumiChoice & { children: KumiChoice[] }> = []
    for (const item of kumiStore.dirs.value) {
        const children = item.children ?? []

        if (children.length > 0) {
            const temp: KumiChoice[] = []
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

const filterKumiTreeData = computed(() => {
    const compare = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' }).compare
    const sortNodes = (a: KumiChoice, b: KumiChoice) => compare(a.label, b.label) || a.id - b.id
    return kumiTreeData.value.map(dir => ({
        ...dir,
        children: dir.children.map(node => {
            const group = kumiStore.kumiById.value.get(node.id)!
            const names = artifactGroupCharacterNames(group, presetStore.allFlat.value, artifactStore.artifacts.value)
            return { id: node.id, label: node.label, characters: names.map(name => ({
                name, label: ta(scoreCharacters[name].nameLocale), avatar: scoreCharacters[name].avatar,
            })) }
        }).sort(sortNodes),
    })).sort(sortNodes)
})

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

function handleUseKumi(node: KumiChoice) {
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
    ratio: number | null,
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
    if (miscTargetFunctionTab.value !== 'normal') return activeSavedTarget.value?.name ?? '自定义 DSL'
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
const exclusionGroups = computed(() => artifactExclusionGroups(miyousheStore.data.value, presetStore.presets.value, ownershipUid.value))
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
    showCalculationNotice(id ? 'success' : 'warning', id ? '已保存当前角色配装到对比历史' : '当前没有穿戴圣遗物')
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
    const rechargeMin = optimizationMode.value === 'damage' ? (panelBounds.value.recharge?.min ?? 0) : 0
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
const backgroundButton = ref<InstanceType<typeof UiButton> | null>(null)
const progressConfirmButton = ref<InstanceType<typeof UiButton> | null>(null)
const progressResultButton = ref<InstanceType<typeof UiButton> | null>(null)
const optimizationRunning = ref(false)
function focusProgressAction() {
    const button = optimizationRunning.value ? backgroundButton.value : progressResultButton.value ?? progressConfirmButton.value
    button?.$el.focus({ preventScroll: true })
}
watch(optimizationRunning, running => {
    if (!running && deferredPresetRoute && route.fullPath === deferredPresetRoute) setPresetFromRoute()
    if (!running && showOptimizationProgress.value) nextTick(focusProgressAction)
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
const optimizationTone = computed(() => optimizationRunning.value ? 'running' : optimizationCancelled.value ? 'cancelled' : 'success')
const optimizationPercent = computed(() => {
    if (optimizationTone.value === 'success') return 100
    const percent = optimizationProgress.value.percent
    return percent === null ? null : Math.round(percent * 10) / 10
})
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
    catch (error: any) { showCalculationNotice('error', '调试包导出失败：' + (error.message || String(error))) }
}
function handleOptimizeArtifact() {
    if (optimizationRunning.value || dynamicScoreState.value.running) return
    if (calculationState.active) { showCalculationNotice('info', '当前有计算线程正在进行'); return }
    const invalidBounds = optimizationMode.value === 'panel'
        ? invalidPanelSearchRange.value : invalidPanelRange.value
    if (invalidBounds) {
        showCalculationNotice('error', t('calcPage.invalidPanelRange'))
        return
    }
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
        if (!artifacts.length) throw new Error('没有符合条件的圣遗物，请检查仓库、主词条筛选及圣遗物保护设置')
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
            showCalculationNotice('error', '没有符合条件的圣遗物')
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
    } catch(error:any) { showCalculationNotice('error', '读取计算历史失败：'+error.message) }
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
.preset-actions { display: flex; align-items: stretch; min-width: 0; }
.preset-save[data-slot="button"] { flex: 1; min-width: 0; border-start-end-radius: 0; border-end-end-radius: 0; }
.preset-save span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preset-menu-trigger[data-slot="button"] { flex: none; width: 34px; padding: 0; border-inline-start: 0; border-start-start-radius: 0; border-end-start-radius: 0; }
.preset-menu-trigger[data-state="open"] { background: var(--cx-step-2); }
.preset-actions [data-slot="button"]:focus-visible { z-index: 1; }
/* Configure from top to bottom while the live panel stays in view. */
.calc-editor { display: grid; grid-template-columns: minmax(0,1fr) 360px; gap: 20px; align-items: start; }
@container single-calculator (max-width: 1100px) { .calc-editor { grid-template-columns: minmax(0,1fr); } }
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
@container buff-board (max-width: 360px) { .talent-editor { grid-template-columns: minmax(0, 1fr); } }
.traveler-resonance { min-width: 0; margin: 4px 0 10px; padding: 0; border: 0; }
.traveler-resonance legend { padding: 0; margin-bottom: 4px; font-size: 15px; font-weight: 600; color: var(--cx-dim); }
.traveler-resonance-options { display: flex; flex-wrap: wrap; gap: 8px 16px; }
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
.character-extra-config, .weapon-extra-config { margin-top: 14px; padding: 12px; border-radius: 8px; background: var(--cx-step); }
.weapon-extra-config { grid-template-columns: minmax(0, 1fr); }
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
.preset-menu { width: 360px; max-width: calc(100vw - 32px); }
.preset-menu-filters { display: flex; gap: 8px; padding: 12px; border-bottom: 1px solid var(--el-border-color-light); }
.preset-menu-filters .el-select { flex: 1; min-width: 0; }
.preset-menu-list { max-height: min(55vh, 480px); overflow-y: auto; }
.manual-buff-source { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 0 8px 8px; color: var(--cx-dim); font-size: 12px; }
.manual-buff-source :deep(.select-trigger) { min-width: min(130px, 100%); flex: 1; }
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
.condition-settings-actions { display: flex; justify-content: flex-end; }
.calculation-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.calculation-page-error { margin-bottom: 16px; }
.optimization-result-summary { display: grid; justify-items: start; gap: 10px; margin-top: 16px; }
.optimization-result-summary :deep(.ui-alert) { width: 100%; box-sizing: border-box; }
.optimization-result-value { justify-self: stretch; }
.kumi-picker { display: grid; gap: 8px; }
.kumi-folder { min-width: 0; border: 1px solid var(--cx-step-2); border-radius: 10px; padding: 6px; }
.kumi-folder-trigger[data-slot="button"] { width: 100%; justify-content: flex-start; text-align: start; }
.kumi-folder-trigger span { flex: 1; overflow-wrap: anywhere; }
.kumi-folder-trigger svg { flex: none; }
.kumi-folder-trigger[data-state="open"] svg:last-child { transform: rotate(180deg); }
.kumi-folder-items { display: grid; gap: 4px; padding: 6px 2px 0 22px; }
.kumi-folder-items[hidden] { display: none; }
.kumi-folder-items [data-slot="button"] { justify-content: start; text-align: start; background: transparent; overflow-wrap: anywhere; }
.kumi-folder-items [data-slot="button"]:hover { background: var(--cx-step); }
.kumi-empty { margin: 0; padding: 16px 0; text-align: center; color: var(--cx-dim); font-size: 13px; }
.polestar-field-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--cx-step-2);
    border-radius: 10px;
    .polestar-field-stacks, .polestar-field-toggle { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 14px; }
    .polestar-field-toggle { cursor: pointer; }
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

.common-title2 {
    margin: 14px 0 7px;
    color: var(--cx-dim);
    font-size: 15px;
    font-weight: 600;
}


.panel-range-error {
    color: var(--el-color-danger);
}

.common-description {
    font-size: 0.7rem;
    color: var(--cx-dim);
}

 //artifact effect description title
.effect4, .effect2 {
    color: var(--cx-gold);
}


</style>

<style scoped src="./calculation-workbench.css"></style>


<style scoped src="../../styles/artifact-score.css"></style>

<style>
/* 目的：配装目标和计算条件居中展示，长内容在窗口内滚动。 */
.optimization-tabs { display: grid; gap: 12px; margin-top: 12px; }
.optimization-switcher { display: flex; flex-wrap: wrap; gap: 3px; width: fit-content; max-width: 100%; padding: 3px; border-radius: 8px; background: var(--cx-step); }
.optimization-switcher button { min-height: 30px; padding: 4px 10px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--cx-dim); font: inherit; font-size: 13px; cursor: pointer; }
.optimization-switcher button:is([data-state="active"], [data-state="checked"]) { border-color: var(--cx-step-2); background: var(--cx-card); color: var(--cx-letter); font-weight: 650; }
.optimization-switcher button:focus-visible, .optimization-code-input:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.optimization-notice { margin: 0 0 8px; color: var(--cx-gold); font-size: 13px; }
.optimization-code-input { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid var(--cx-step-2); border-radius: 8px; background: var(--cx-step); color: var(--cx-letter); font: 13px/1.55 ui-monospace, Consolas, monospace; resize: vertical; }
.optimization-saved { display: grid; gap: 8px; }
.optimization-saved-list { display: grid; gap: 8px; }
.optimization-saved-item { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--cx-step-2); border-radius: 8px; background: var(--cx-step); color: var(--cx-letter); text-align: left; white-space: normal; }
.optimization-saved-item.is-selected { border-color: var(--cx-gold); background: var(--cx-card); }
.optimization-saved-item:focus-visible, .optimization-saved-link:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: 2px; }
.optimization-saved-name { font-weight: 600; overflow-wrap: anywhere; }
.optimization-saved-desc { color: var(--cx-dim); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
.optimization-saved-error { margin: 0; color: var(--cx-gold); font-size: 13px; }
.optimization-saved-empty { display: flex; align-items: center; padding: 8px 0; }
.optimization-saved-link { color: var(--cx-gold); font-size: 13px; text-decoration: underline; }
@media (prefers-reduced-motion: no-preference) {
    .optimization-switcher button {
        transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
    }

    .optimization-mode-panel,
    .optimization-tabs,
    .optimization-tabs > [data-state="active"] {
        animation: optimization-content-enter 160ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    @keyframes optimization-content-enter {
        from {
            opacity: 0;
            transform: translateY(4px);
        }

        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
}
</style>

<style scoped src="./calculation-dialogs.css"></style>

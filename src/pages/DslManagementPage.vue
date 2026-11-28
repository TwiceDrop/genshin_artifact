<template>
  <main ref="pageRoot" class="dsl-page cx-scope cx-page-frame" :aria-busy="vm.loading">
    <section class="cx-panel" aria-labelledby="dsl-page-title">
      <header class="cx-panel-heading cx-panel-heading--page">
        <h1 id="dsl-page-title" class="cx-panel-title">{{ t('nav.dslManagement') }}</h1>
      </header>
      <div class="dsl-toolbar cx-panel-body">
        <div class="dsl-select-wrap">
          <CharacterAvatarPicker
            :model-value="vm.character"
            :options="vm.characterOptions"
            title="选择角色"
            placeholder="角色"
            @update:model-value="vm.selectCharacter"
          />
        </div>
        <div class="dsl-actions">
          <UiButton
            variant="primary"
            :disabled="vm.loading || vm.busy"
            data-dsl-add
            @click="openFrom($event, vm.openNew)"
          >
            新建手法
          </UiButton>
          <UiButton
            variant="outline"
            :disabled="vm.loading || vm.busy"
            @click="triggerImport"
          >
            导入文件
          </UiButton>
          <UiButton variant="outline" :disabled="vm.loading || vm.busy" @click="openFrom($event, vm.openLinkImport)">
            导入链接
          </UiButton>
          <UiButton variant="outline" :disabled="vm.loading || vm.busy" @click="vm.updateOnline">
            在线更新
          </UiButton>
          <span role="status">{{ vm.onlineStatus }}</span>
          <input
            ref="fileInputRef"
            type="file"
            accept=".json,application/json"
            class="dsl-file-input"
            tabindex="-1"
            aria-hidden="true"
            @change="onFileChange"
          />
        </div>
      </div>
    </section>

    <p v-if="vm.error && !vm.draft && !vm.deleteTarget && !vm.linkImportOpen" class="dsl-error" role="alert">
      {{ vm.error }}
    </p>
    <section :key="vm.defaultFunction.name" class="cx-panel dsl-default" aria-label="默认">
      <header class="cx-panel-heading">
        <h2 class="cx-panel-title">{{ vm.defaultFunction.title }}</h2>
        <span class="dsl-default-badge">默认</span>
      </header>
      <div class="cx-panel-body dsl-item-main">
        <div v-if="vm.defaultFunction.description" class="dsl-item-desc" v-html="vm.defaultFunction.description"></div>
        <DslEntryPreview :title="vm.defaultFunction.title" :hits="vm.defaultFunction.hits"
          :source="vm.defaultFunction.source" :language="vm.defaultFunction.language" />
      </div>
    </section>

    <ul v-if="vm.entries.length" class="dsl-list">
      <li v-for="entry in vm.entries" :key="entry.id" class="cx-panel dsl-item">
        <header class="cx-panel-heading">
          <h2 class="cx-panel-title">{{ entry.name }}</h2>
          <span v-if="entry.distribution">在线手法</span>
        </header>
        <div class="cx-panel-body dsl-item-main">
          <p v-if="entry.description?.trim()" class="dsl-item-desc dsl-item-desc--multiline">{{ entry.description }}</p>
          <DslEntryPreview :title="entry.name" :hits="entry.generator?.entries" :source="entry.source" />
          <div class="dsl-item-actions">
            <UiButton variant="outline" size="small" :disabled="vm.busy" :aria-label="'分享 ' + entry.name" @click="vm.shareEntry(entry)">
              在线分享
            </UiButton>
            <UiButton
              v-if="!entry.distribution"
              variant="outline"
              size="small"
              :disabled="vm.busy"
              :aria-label="'编辑 ' + entry.name"
              @click="openFrom($event, () => vm.openEdit(entry))"
            >
              编辑
            </UiButton>
            <UiButton
              variant="outline"
              size="small"
              :disabled="vm.busy"
              :aria-label="'导出 ' + entry.name"
              @click="vm.exportEntry(entry)"
            >
              导出
            </UiButton>
            <UiButton
              v-if="!entry.distribution"
              variant="danger"
              size="small"
              :disabled="vm.busy"
              :aria-label="'删除 ' + entry.name"
              @click="openFrom($event, () => vm.askDelete(entry))"
            >
              删除
            </UiButton>
          </div>
        </div>
      </li>
    </ul>

    <UiDialog
      v-if="pageActive"
      :model-value="vm.linkImportOpen"
      title="导入分享链接"
      width="min(460px, 96vw)"
      prevent-outside
      :return-focus="returnFocus"
      @update:model-value="!$event && vm.closeLinkImport()"
    >
      <form class="dsl-field" @submit.prevent="vm.importLink()">
        <label class="dsl-label" for="dsl-share-link">分享链接</label>
        <input id="dsl-share-link" v-model.trim="vm.shareLink" class="dsl-input" type="url"
          name="shareLink" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"
          enterkeyhint="done" required :disabled="vm.busy" :aria-invalid="vm.error ? true : undefined"
          :aria-describedby="vm.error ? 'dsl-share-link-error' : undefined" @input="vm.error = ''" />
        <p v-if="vm.error" id="dsl-share-link-error" class="dsl-error" role="alert">{{ vm.error }}</p>
        <div class="dsl-dialog-footer">
          <UiButton :disabled="vm.busy" @click="vm.closeLinkImport()">取消</UiButton>
          <UiButton variant="primary" type="submit" :loading="vm.busy">导入</UiButton>
        </div>
      </form>
    </UiDialog>

    <UiDialog
      v-if="pageActive"
      :model-value="Boolean(vm.draft)"
      :title="editorTitle"
      width="min(1320px, 96vw)"
      prevent-outside
      :return-focus="returnFocus"
      @update:model-value="onEditorToggle"
    >
      <div v-if="vm.draft" class="dsl-editor">
        <p v-if="vm.error" class="dsl-error" role="alert">
          {{ vm.error }}
        </p>

        <div class="dsl-field">
          <label class="dsl-label" for="dsl-draft-name">名称</label>
          <input
            id="dsl-draft-name"
            v-model="vm.draft.name"
            type="text"
            class="dsl-input"
            :disabled="vm.busy"
            @keydown.enter="saveFromName"
          />
        </div>

        <div class="dsl-field">
          <label class="dsl-label" for="dsl-draft-description">描述</label>
          <textarea
            id="dsl-draft-description"
            v-model="vm.draft.description"
            class="dsl-textarea dsl-textarea--compact"
            rows="2"
            :disabled="vm.busy"
          />
        </div>

        <details class="cx-panel dsl-details">
          <summary class="cx-panel-heading dsl-summary">高级选项</summary>
          <div class="cx-panel-body">
            <fieldset class="dsl-field dsl-mode-group">
              <legend class="dsl-label">来源</legend>
              <div class="dsl-radios">
                <label class="dsl-radio">
                  <input
                    v-model="vm.draft.mode"
                    type="radio"
                    name="dsl-draft-mode"
                    value="source"
                    :disabled="vm.busy"
                  />
                  <span>MONA-DSL</span>
                </label>
                <label class="dsl-radio">
                  <input
                    v-model="vm.draft.mode"
                    type="radio"
                    name="dsl-draft-mode"
                    value="generator"
                    :disabled="vm.busy"
                  />
                  <span>DSL 生成器</span>
                </label>
              </div>
            </fieldset>
          </div>
        </details>

        <details v-if="vm.draft.mode === 'generator'" class="cx-panel dsl-details">
          <summary class="cx-panel-heading dsl-summary">BUFF / 武器</summary>
          <div class="cx-panel-body">
            <DslInputs :vm="vm" />
          </div>
        </details>

        <div v-if="vm.draft.mode === 'source'" class="cx-panel">
          <div class="cx-panel-heading">
            <label class="cx-panel-title" for="dsl-draft-source">MONA-DSL</label>
          </div>
          <div class="cx-panel-body">
            <textarea
              id="dsl-draft-source"
              v-model="vm.draft.source"
              class="dsl-textarea"
              rows="12"
              spellcheck="false"
              :disabled="vm.busy"
            />
          </div>
        </div>

        <div v-else class="dsl-generator-wrap">
          <DslGenerator
            v-if="vm.mona"
            v-model="vm.draft.generator"
            :mona="vm.mona"
            :input="vm.generatorInput"
            :available-buffs="vm.availableBuffs"
            :wide="vm.wide"
            :hide-source-by-default="true"
            active
          />
        </div>
      </div>

      <template #footer>
        <div class="dsl-dialog-footer">
          <UiButton variant="outline" :disabled="vm.busy" @click="vm.closeEditor()">
            关闭
          </UiButton>
          <UiButton
            variant="primary"
            :disabled="vm.busy || !vm.canSave"
            @click="vm.save()"
          >
            保存
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <UiDialog
      v-if="pageActive"
      :model-value="Boolean(vm.deleteTarget)"
      title="删除"
      width="min(420px, 96vw)"
      :return-focus="returnFocus"
      @update:model-value="onDeleteToggle"
    >
      <div class="dsl-delete-body">
        <p v-if="vm.error" class="dsl-error" role="alert">
          {{ vm.error }}
        </p>
        <p class="dsl-delete-name">{{ vm.deleteTarget?.name }}</p>
      </div>

      <template #footer>
        <div class="dsl-dialog-footer">
          <UiButton variant="outline" :disabled="vm.busy" @click="vm.closeDelete()">
            取消
          </UiButton>
          <UiButton variant="danger" :disabled="vm.busy" @click="vm.confirmDelete()">
            删除
          </UiButton>
        </div>
      </template>
    </UiDialog>
  </main>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, watch } from 'vue'
import { useI18n } from '@/i18n/i18n'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import DslGenerator from './NewArtifactPlanPage/DslGenerator.vue'
import CharacterAvatarPicker from '@/components/select/CharacterAvatarPicker.vue'
import DslInputs from './dsl-management/DslInputs.vue'
import DslEntryPreview from './dsl-management/DslEntryPreview.vue'
import { useDslManagement } from './dsl-management/useDslManagement'

const { t } = useI18n()
const vm = useDslManagement()
const fileInputRef = ref<HTMLInputElement | null>(null)
const pageRoot = ref<HTMLElement | null>(null)
const pageActive = ref(true)
let opener: HTMLElement | null = null

onActivated(() => {
  pageActive.value = true
})

onDeactivated(() => {
  pageActive.value = false
})

watch(() => Boolean(vm.draft || vm.deleteTarget || vm.linkImportOpen), open => {
  if (!open) returnFocus()
}, { flush: 'post' })

const editorTitle = computed(() => {
  if (!vm.draft) return '新建手法'
  return vm.draft.existing ? '编辑' : '新建手法'
})

function triggerImport() {
  fileInputRef.value?.click()
}

function openFrom(event: MouseEvent, open: () => void) {
  opener = event.currentTarget as HTMLElement
  open()
}

function returnFocus() {
  if (!pageActive.value) return
  const previous = opener
  if (!previous) return
  opener = null
  requestAnimationFrame(() => {
    if (!pageActive.value || vm.draft || vm.deleteTarget || vm.linkImportOpen) return
    const element = previous?.isConnected ? previous : pageRoot.value?.querySelector<HTMLElement>('[data-dsl-add]')
    element?.focus()
  })
}

function saveFromName(event: KeyboardEvent) {
  if (event.isComposing || !vm.canSave || vm.busy) return
  event.preventDefault()
  void vm.save()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) {
    vm.importFile(file)
  }
}

function onEditorToggle(open: boolean) {
  if (!open && !vm.busy) {
    vm.closeEditor()
  }
}

function onDeleteToggle(open: boolean) {
  if (!open && !vm.busy) {
    vm.closeDelete()
  }
}
</script>

<style scoped>
.dsl-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 14px;
}

.dsl-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dsl-select-wrap :deep(.character-picker-controls) {
  width: 100%;
}

.dsl-select-wrap {
  width: min(100%, 220px);
}

.dsl-actions,
.dsl-item-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dsl-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.dsl-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid var(--cx-up);
  background: var(--cx-step);
  color: var(--cx-up);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.dsl-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dsl-item {
  display: flex;
  flex-direction: column;
}

.dsl-default {
  background: var(--cx-step);
}

.dsl-default .cx-panel-heading {
  box-shadow: inset 3px 0 var(--cx-gold);
}

.dsl-default-badge {
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--cx-gold);
  color: var(--cx-gold-on);
  font-size: 12px;
  font-weight: 600;
}

.dsl-item-desc {
  color: var(--cx-dim);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.dsl-item-desc--multiline {
  margin: 0;
  white-space: pre-wrap;
}

.dsl-item-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dsl-item-actions {
  justify-content: flex-end;
  margin-top: auto;
}

.dsl-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dsl-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}

.dsl-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--cx-dim);
}

.dsl-input,
.dsl-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  background: var(--cx-step);
  color: var(--cx-letter);
  border: 1px solid var(--cx-step-2);
  border-radius: 6px;
  font-size: 14px;
}

.dsl-textarea {
  display: block;
  min-height: 220px;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dsl-textarea--compact {
  min-height: 0;
  font-family: inherit;
}

.dsl-input:focus-visible,
.dsl-textarea:focus-visible,
.dsl-summary:focus-visible,
.dsl-radio input:focus-visible {
  outline: 2px solid var(--cx-gold);
  outline-offset: 2px;
}

.dsl-radios {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.dsl-radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--cx-letter);
  font-size: 14px;
}

.dsl-radio input {
  accent-color: var(--cx-gold);
}

.dsl-summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.dsl-details:not([open]) .dsl-summary {
  border-bottom: 0;
  border-radius: 15px;
}

.dsl-generator-wrap {
  min-width: 0;
}

.dsl-delete-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dsl-delete-name {
  margin: 0;
  font-weight: 600;
  color: var(--cx-letter);
  overflow-wrap: anywhere;
}

.dsl-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 640px) {
  .dsl-select-wrap {
    width: 100%;
  }
}
</style>

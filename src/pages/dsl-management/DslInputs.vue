<script setup lang="ts">
import { ref } from 'vue'
import type { useDslManagement } from './useDslManagement'
import UiButton from '@/components/ui/UiButton.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import DslParamFields from '../NewArtifactPlanPage/DslParamFields.vue'

const props = defineProps<{ vm: ReturnType<typeof useDslManagement> }>()
const pendingBuff = ref('')

function onAddBuff() {
  if (!pendingBuff.value) return
  props.vm.addBuff(pendingBuff.value)
  pendingBuff.value = ''
}
</script>

<template>
  <section v-if="vm.draft?.mode === 'generator'" class="dsl-inputs">
    <div class="dsl-inputs-row">
      <span class="dsl-inputs-label">武器</span>
      <UiSelect
        class="dsl-inputs-control"
        label="武器" :model-value="vm.draft.weapon"
        :options="vm.weaponOptions"
        @update:model-value="vm.selectWeapon"
      />
    </div>

    <div class="dsl-inputs-row">
      <span class="dsl-inputs-label">BUFF</span>
      <div class="dsl-inputs-add">
        <UiSelect
          v-model="pendingBuff" label="添加 BUFF"
          class="dsl-inputs-control"
          :options="vm.buffOptions"
        />
        <UiButton :disabled="!pendingBuff" @click="onAddBuff">添加</UiButton>
      </div>
    </div>

    <div v-if="vm.draft.buffs.length" class="dsl-buff-list">
      <div
        v-for="(buff, index) in vm.draft.buffs"
        :key="`${buff.name}-${index}`"
        class="dsl-buff-item"
      >
        <div class="dsl-buff-head">
          <span class="dsl-buff-name">{{ vm.buffLabel(buff.name) }}</span>
          <UiButton size="small" variant="danger" :aria-label="'删除 ' + vm.buffLabel(buff.name)" @click="vm.removeBuff(index)">删除</UiButton>
        </div>
        <DslParamFields
          v-if="vm.buffConfigs(buff.name).length"
          :configs="vm.buffConfigs(buff.name)"
          :model-value="buff.config[buff.name]"
          @update:model-value="vm.updateBuff(index, $event)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.dsl-inputs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dsl-inputs-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dsl-inputs-label {
  flex: 0 0 52px;
  font-size: 13px;
}

.dsl-inputs-control {
  flex: 1;
  min-width: 0;
}

.dsl-inputs-add {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 6px;
}

.dsl-buff-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dsl-buff-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--cx-step-2);
  border-radius: 6px;
}

.dsl-buff-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dsl-buff-name {
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

@media (max-width: 520px) {
  .dsl-inputs-row {
    flex-direction: column;
    align-items: stretch;
  }

  .dsl-inputs-label {
    flex: none;
  }
}
</style>

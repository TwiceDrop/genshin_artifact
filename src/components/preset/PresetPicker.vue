<template>
    <component :is="shadcn ? UiButton : ElButton" @click="open = true" aria-haspopup="dialog">{{ title }} <i-ep-arrow-down aria-hidden="true" /></component>
    <component :is="shadcn ? UiDialog : ElDialog" v-model="open" :title="title" width="min(640px, 94vw)"
        v-bind="shadcn ? {} : { customClass: 'cx-scope viewport-dialog', destroyOnClose: true }">
        <PresetBrowser v-if="open" v-model="source" :shadcn="shadcn" :character="character" :roster="roster" @select="select" />
        <template v-if="!roster" #footer>
            <UiButton v-if="shadcn" variant="primary" @click="create">新建自定义预设</UiButton>
            <ElButton v-else type="primary" @click="create">新建自定义预设</ElButton>
        </template>
    </component>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import { ElButton, ElDialog } from 'element-plus'
import PresetBrowser from './PresetBrowser.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
const props = defineProps<{roster?: boolean, character?: string, shadcn?: boolean}>()
const emit = defineEmits(['select', 'create'])
const open = ref(false), source = ref('game')
const title = computed(() => props.roster ? '导入角色预设' : '应用圣遗物到预设')
function select(name: string, loadout?: object) { emit('select', name, loadout); open.value = false }
function create() { open.value = false; emit('create') }
</script>

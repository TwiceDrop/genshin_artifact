<template>
    <el-button @click="open = true" aria-haspopup="dialog">{{ title }} <i-ep-arrow-down aria-hidden="true" /></el-button>
    <el-dialog v-model="open" :title="title" width="min(640px, 94vw)" custom-class="cx-scope viewport-dialog" destroy-on-close>
        <preset-browser v-if="open" v-model="source" :character="character" :roster="roster" @select="select" />
        <template v-if="!roster" #footer>
            <el-button @click="open = false; $emit('create')" type="primary">新建自定义预设</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import PresetBrowser from './PresetBrowser.vue'
const props = defineProps<{roster?: boolean, character?: string}>()
const emit = defineEmits(['select', 'create'])
const open = ref(false), source = ref('game')
const title = computed(() => props.roster ? '导入角色预设' : '应用圣遗物到预设')
function select(name: string, loadout?: object) { emit('select', name, loadout); open.value = false }
</script>

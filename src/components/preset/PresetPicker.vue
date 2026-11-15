<template>
    <el-button @click="open = true" aria-haspopup="dialog">{{ title }} <i-ep-arrow-down aria-hidden="true" /></el-button>
    <el-dialog v-model="open" :title="title" width="min(640px, 94vw)" destroy-on-close>
        <preset-browser v-if="open" v-model="source" :character="character" @select="select" />
        <template v-if="apply" #footer>
            <el-button @click="open = false; $emit('create')" type="primary">新建自定义预设</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import PresetBrowser from './PresetBrowser.vue'
const props = defineProps<{apply?: boolean, character?: string}>()
const emit = defineEmits(['select', 'create'])
const open = ref(false), source = ref('game')
const title = computed(() => props.apply ? '应用圣遗物到预设' : '导入角色预设')
function select(name: string) { emit('select', name); open.value = false }
</script>

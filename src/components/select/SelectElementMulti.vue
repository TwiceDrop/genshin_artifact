<template>
    <div v-if="shadcn" class="element-options" role="group" :aria-label="label">
        <UiButton v-for="element in orderedElements" :key="element" size="small" :variant="modelValue.includes(element) ? 'primary' : 'outline'"
            :aria-pressed="modelValue.includes(element)" @click="$emit('update:modelValue', modelValue.includes(element)
                ? modelValue.filter(value => value !== element) : [...modelValue, element])">
            <img v-if="elementIcons[element]" :src="elementIcons[element]" alt="" />
            {{ labels[element] }}
        </UiButton>
    </div>
    <el-checkbox-group
        v-else
        :model-value="modelValue"
        @update:modelValue="$emit('update:modelValue', $event)"
    >
        <el-checkbox-button v-if="eleMap.has('Pyro')" label="Pyro">火</el-checkbox-button>
        <el-checkbox-button v-if="eleMap.has('Electro')" label="Electro">雷</el-checkbox-button>
        <el-checkbox-button v-if="eleMap.has('Hydro')" label="Hydro">水</el-checkbox-button>
        <el-checkbox-button v-if="eleMap.has('Anemo')" label="Anemo">风</el-checkbox-button>
        <el-checkbox-button v-if="eleMap.has('Geo')" label="Geo">岩</el-checkbox-button>
        <el-checkbox-button v-if="eleMap.has('Cryo')" label="Cryo">冰</el-checkbox-button>
        <el-checkbox-button v-if="eleMap.has('Dendro')" label="Dendro">草</el-checkbox-button>
        <el-checkbox-button v-if="eleMap.has('Physical')" label="Physical">物理</el-checkbox-button>
    </el-checkbox-group>
</template>

<script>
import UiButton from '@/components/ui/UiButton.vue'
import elementIcons from '@/assets/element-icons'

const labels = { Pyro: '火', Electro: '雷', Hydro: '水', Anemo: '风', Geo: '岩', Cryo: '冰', Dendro: '草', Physical: '物理' }
const indexMap = {
    "Electro": 0,
    "Pyro": 1,
    "Cryo": 2,
    "Dendro": 3,
    "Geo": 4,
    "Anemo": 5,
    "Hydro": 6,
    "Physical": 7
}
const indexMapReverse = ["Electro", "Pyro", "Cryo", "Dendro", "Geo", "Anemo", "Hydro", "Physical"]

export default {
    name: "SelectElementMulti",
    components: { UiButton },
    emits: ["update:modelValue"],
    props: {
        modelValue: {
            type: Array,
            default: () => {
                return [false, false, false, false, false, false, false, false]
            }
        },
        elements: {
            default: () => {
                return ["Pyro", "Electro", "Hydro", "Anemo", "Geo", "Cryo", "Dendro", "Physical"];
            }
        },
        shadcn: Boolean,
        label: String,
    },
    data() { return { labels, elementIcons } },
    computed: {
        eleMap() {
            let temp = new Set();
            for (let ele of this.elements) {
                temp.add(ele);
            }
            return temp;
        },
        orderedElements() {
            return Object.keys(labels).filter(element => this.eleMap.has(element))
        },
    },
}
</script>

<style scoped>
.element-options { display: flex; flex-wrap: wrap; gap: 4px; }
.element-options img { width: 15px; height: 15px; object-fit: contain; }
</style>

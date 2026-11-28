<template>
    <div class="select-buff-root">
        <template v-if="shadcn">
            <UiSearchInput v-model="searchString" class="buff-search-input" :placeholder="t('misc.search')" />
            <TabsRoot v-model="activeTab" class="buff-selection">
                <TabsList class="buff-tab-list" aria-label="BUFF">
                    <TabsTrigger v-for="genre in genres" :key="genre" :value="genre" class="buff-tab">{{ t('buffGenre', genre) }}</TabsTrigger>
                </TabsList>
                <TabsContent v-for="genre in genres" :key="genre" :value="genre" force-mount
                    class="tab-pane buff-tab-pane mona-scroll" :hidden="activeTab !== genre">
                    <CharacterBuffGroups v-if="genre === 'Character'" shadcn :buffs="buffsFlatWithLocale" :search="searchString"
                        :preferred-uid="preferredUid" :selected-names="selectedNames" @select="(name, options) => emits('select', name, options)" />
                    <template v-else>
                        <UiButton v-for="buff in buffByGenre[genre]" :key="buff.name" class="buff-item buff-choice" @click="handleClick(buff.name)">
                            <img :src="buff.badge" alt="" class="buff-image" loading="lazy" />
                            <span class="detail-right">
                                <span class="buff-name">{{ buff.title }}</span>
                                <span v-if="buff.description" class="buff-description" v-html="buff.description" />
                            </span>
                        </UiButton>
                    </template>
                </TabsContent>
            </TabsRoot>
        </template>
        <template v-else>
        <el-input
            v-model="searchString"
            class="buff-search-input"
            :placeholder="t('misc.search')"
            clearable
        >
            <template #prefix>
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                </svg>
            </template>
        </el-input>
        <el-tabs v-model="activeTab" class="buff-tabs">
            <template
                v-for="genre in genres"
                :key="genre"
            >
                <el-tab-pane
                    :label="t('buffGenre', genre)"
                    :name="genre"
                    class="tab-pane mona-scroll"
                >
                    <character-buff-groups v-if="genre === 'Character'" :buffs="buffsFlatWithLocale" :search="searchString" :preferred-uid="preferredUid" :selected-names="selectedNames" @select="(name, options) => emits('select', name, options)" />
                    <div
                        v-else
                        v-for="buff in buffByGenre[genre]"
                        :key="buff.name"
                        class="buff-item"
                        @click="handleClick(buff.name)"
                    >
                        <img :src="buff.badge" class="buff-image" loading="lazy">
                        <div class="detail-right">
                            <p class="buff-name">{{ buff.title }}</p>
                            <p v-if="buff.description" class="buff-description" v-html="buff.description"></p>
                        </div>
                    </div>
                </el-tab-pane>
            </template>
        </el-tabs>
        </template>
    </div>
</template>

<script setup lang="ts">
import { buffFlat } from "@buff"
import Fuse from "fuse.js"
import {useI18n} from "@/i18n/i18n";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'radix-vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSearchInput from '@/components/ui/UiSearchInput.vue'
import CharacterBuffGroups from './CharacterBuffGroups.vue'
defineProps<{ preferredUid?: string, selectedNames?: string[], shadcn?: boolean }>()

const genres = [
    "Character",
    "Weapon",
    "Artifact",
    "Resonance",
    "Common",
]


// interface Props {
//     selectable: boolean,
// }
//
// const props = withDefaults(defineProps<Props>(), {
//     selectable: false
// })

interface Emits {
    (e: "select", buffName: string, options?: { config?: any, keepOpen: boolean }): void
}

const emits = defineEmits<Emits>()

const { t, ta } = useI18n()


// tab
const activeTab = ref("Character")

// buffs
interface BuffInterface {
    name: string,
    description: string,
    title: string,
    genre: string,
    badge: string,
}

const buffsFlatWithLocale = computed((): BuffInterface[] => {
    let result: BuffInterface[] = []
    for (const item of buffFlat) {
        result.push({
            name: item.name,
            title: ta(item.nameLocale),
            description: item.description ? ta(item.description) : "",
            genre: item.genre,
            badge: item.badge
        })
    }

    return result
})

const searchString = ref("")

const filteredBuffFlat = computed((): BuffInterface[] => {
    if (searchString.value === "") {
        return buffsFlatWithLocale.value
    }
    const fuse = new Fuse(buffsFlatWithLocale.value, {
        keys: ["title", "description"]
    })
    const filtered = fuse.search(searchString.value)
    return filtered.map(x => x.item) as any
})

const buffByGenre = computed(() => {
    let temp: Record<string, BuffInterface[]> = {}
    for (let item of filteredBuffFlat.value) {
        if (!Object.prototype.hasOwnProperty.call(temp, item.genre)) {
            temp[item.genre] = []
        }
        temp[item.genre].push(item)
    }
    return temp
})

function handleClick(name: string) {
    // if (!props.selectable) {
        emits("select", name, { keepOpen: true })
    // }
}
</script>

<style lang="scss" scoped>
.buff-tab-list { display: flex; overflow-x: auto; margin-bottom: 15px; border-bottom: 1px solid var(--cx-step-2); }
.buff-tab { flex: none; height: 39px; padding: 0 20px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--cx-dim); font: inherit; cursor: pointer; }
.buff-tab:first-child { padding-inline-start: 0; }
.buff-tab:last-child { padding-inline-end: 0; }
.buff-tab:hover { color: var(--cx-letter); }
.buff-tab[data-state="active"] { border-bottom-color: var(--cx-gold); color: var(--cx-gold); font-weight: 600; }
@media (max-width: 767px) {
    .buff-tab-list { flex-wrap: wrap; gap: 2px 4px; overflow: visible; }
    .buff-tab, .buff-tab:is(:first-child, :last-child) { height: 34px; padding-inline: 7px; font-size: 13px; white-space: nowrap; }
}
.buff-tab:focus-visible, .buff-tab-pane:focus-visible { outline: 2px solid var(--cx-gold); outline-offset: -2px; }
.buff-tab-pane { overflow: auto; }
.buff-tab-pane[hidden] { display: none; }
.buff-choice { width: 100%; justify-content: flex-start; background: var(--cx-card); text-align: start; font-weight: 400; }
.buff-choice .buff-name, .buff-choice .buff-description { display: block; }

.buff-search-input {
    margin-bottom: 12px;
}

.search-icon {
    width: 15px;
    height: 15px;
    color: var(--cx-dim);
}

.tab-pane {
    max-height: min(62vh, 560px);
}

.buff-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    margin-bottom: 6px;
    border-radius: 10px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: background-color 140ms ease, border-color 140ms ease;

    &:hover {
        background: var(--cx-step);
        border-color: var(--cx-step-2);
    }

    .buff-image {
        height: 44px;
        width: 44px;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--cx-step-2);
        object-fit: contain;
    }

    .detail-right {
        min-width: 0;
        flex: 1;
    }

    .buff-name {
        margin: 0;
        font-weight: 600;
        color: var(--cx-letter);
    }

    .buff-description {
        margin: 4px 0 0;
        font-size: 12px;
        line-height: 1.6;
        color: var(--cx-dim);
    }
}
</style>

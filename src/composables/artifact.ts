import {useArtifactStore} from "@/store/pinia/artifact"
import type {ArtifactSetName, IArtifact, IArtifactWasm} from "@/types/artifact"
// @ts-ignore
import {artifactsData} from "@artifact"
import {convertArtifact, convertArtifactName} from "@/utils/converter"
import {toSnakeCase} from "@/utils/common"
import {newDefaultArtifactConfigForWasm} from "@/utils/artifacts"
import {useI18n} from "@/i18n/i18n"

export function use5Artifacts() {
    const { t, ta } = useI18n()
    const artifactStore = useArtifactStore()

    const artifactIds = ref([-1, -1, -1, -1, -1])
    // artifact set 2/4 config
    // Keep each set's controls independently. Clearing the two-piece selection
    // must not erase the new four-piece set's configuration during a gear swap.
    const artifactConfigValues = ref<any>(newDefaultArtifactConfigForWasm())
    const artifactSingleConfig = computed({
        get: () => artifactConfigValues.value,
        // ItemConfig emits only the edited set; retain the other sets' controls.
        set: value => { artifactConfigValues.value = { ...artifactConfigValues.value, ...value } }
    })

    const artifactItems = computed(() => {
        let temp: (IArtifact | null)[] = []
        for (let id of artifactIds.value) {
            if (id >= 0) {
                const a = artifactStore.artifacts.value.get(id)
                if (a) {
                    temp.push(a)
                } else {
                    temp.push(null)
                }
            } else {
                temp.push(null)
            }
        }
        return temp
    })

    const artifactSetCount = computed(() => {
        let temp: Record<ArtifactSetName, number> = {}
        for (let artifact of artifactItems.value) {
            if (!artifact) {
                continue
            }
            const setName = artifact.setName
            if (!Object.prototype.hasOwnProperty.call(temp, setName)) {
                temp[setName] = 0
            }
            temp[setName] += 1
        }
        return temp
    })

    const artifactNeedConfig4 = computed((): ArtifactSetName | null => {
        for (let setName in artifactSetCount.value) {
            const count = artifactSetCount.value[setName]
            if (count >= 4) {
                const data = artifactsData[setName]
                if (data.config4 && data.config4.length > 0) {
                    return setName
                }
            }
        }

        return null
    })

    const artifactNeedConfig2 = computed((): ArtifactSetName | null => {
        for (let setName in artifactSetCount.value) {
            const count = artifactSetCount.value[setName]
            if (count >= 2) {
                const data = artifactsData[setName]
                if (data.config2 && data.config2.length > 0) {
                    return setName
                }
            }
        }

        return null
    })

    const artifactConfigItemName = computed((): string | null => {
        if (artifactNeedConfig4.value || artifactNeedConfig2.value) {
            let setNameWasm;
            if (artifactNeedConfig4.value) {
                setNameWasm = convertArtifactName(artifactNeedConfig4.value)
            } else if (artifactNeedConfig2.value) {
                setNameWasm = convertArtifactName(artifactNeedConfig2.value);
            }
            return `config_${toSnakeCase(setNameWasm)}`
        }
        return null
    })

    const artifactEffect4Text = computed((): string => {
        if (!artifactNeedConfig4.value) {
            return ""
        }
        const data = artifactsData[artifactNeedConfig4.value]
        return ta(data.effect4)
    })

    const artifactEffect2Text = computed((): string => {
        if (!artifactNeedConfig2.value) {
            return ""
        }
        const data = artifactsData[artifactNeedConfig2.value]
        return ta(data.effect2)
    })

    const artifactConfig4Configs = computed(() => {
        if (artifactNeedConfig4.value) {
            const data = artifactsData[artifactNeedConfig4.value]
            return data.config4
        }
        return []
    })

    const artifactConfig2Configs = computed(() => {
        if (artifactNeedConfig2.value) {
            const data = artifactsData[artifactNeedConfig2.value]
            return data.config2
        }
        return []
    })

    const artifactWasmFormat = computed((): IArtifactWasm[] => {
        let temp: IArtifactWasm[] = []
        for (let id of artifactIds.value) {
            if (id >= 0) {
                const a = artifactStore.artifacts.value.get(id)
                if (a && !a.omit) {
                    const artifactWasm = convertArtifact(a)
                    temp.push(artifactWasm)
                }
            }
        }
        return temp
    })

    const artifactConfigForCalculator = computed(() => {
        let base = newDefaultArtifactConfigForWasm()

        for (const set of new Set([artifactNeedConfig2.value, artifactNeedConfig4.value])) {
            if (!set) continue
            const name = `config_${toSnakeCase(convertArtifactName(set))}`
            base[name] = { ...base[name], ...artifactSingleConfig.value?.[name] }
        }

        return base
    })

    const artifactCount = computed(() => {
        let count = 0
        for (const id of artifactIds.value) {
            if (id !== -1) {
                count += 1
            }
        }
        return count
    })

    function setArtifact(index: number, id: number) {
        artifactIds.value[index] = id
    }

    function removeArtifact(index: number) {
        artifactIds.value[index] = -1
    }

    function toggleArtifact(index: number) {
        const a = artifactItems.value[index]
        if (a) {
            const id = a.id
            artifactStore.toggleArtifact(id)
        }
    }

    return {
        artifactIds,
        artifactCount,
        artifactSingleConfig,
        artifactWasmFormat,

        artifactItems,
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
        toggleArtifact,
    }
}

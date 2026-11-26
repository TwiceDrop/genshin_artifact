import type {ArtifactSetName, ArtifactStatName} from "@/types/artifact"
import type {IConstraint, PanelBounds} from "@/types/preset"
import {convertArtifactName} from "@/utils/converter"
import {PANEL_STATS} from "../../beta-data/panel-search.mjs"

export function useComputeConstraint() {
    const algorithm = ref("AStar")
    const constraintArtifactSet = ref<ArtifactSetName[]>([])
    const constraintSandMainStats = ref<ArtifactStatName[]>([])
    const constraintGobletMainStats = ref<ArtifactStatName[]>([])
    const constraintHeadMainStats = ref<ArtifactStatName[]>([])
    const panelBounds = ref<PanelBounds>({recharge: {min: 1}})
    const panelMaximumConstraint = computed(() => {
        const maximums: Record<string, number> = {}
        for (const {key} of PANEL_STATS) {
            const max = panelBounds.value[key]?.max
            if (max != null) maximums[key] = max
        }
        return Object.keys(maximums).length ? maximums : undefined
    })

    const presetConstraint = computed(() => ({setNames: constraintArtifactSet.value,
        ...Object.fromEntries(PANEL_STATS.map(stat => [stat.presetMinimum, panelBounds.value[stat.key]?.min ?? 0])),
        panelMax: panelMaximumConstraint.value}))
    const presetFilter = computed(() => ({sandMainStats: constraintSandMainStats.value,
        gobletMainStats: constraintGobletMainStats.value, headMainStats: constraintHeadMainStats.value}))

    function restorePanelBounds(constraint?: IConstraint) {
        panelBounds.value = Object.fromEntries(PANEL_STATS.map(stat => {
            const min = constraint?.[stat.presetMinimum as keyof IConstraint] as number | undefined
            return [stat.key, {min: min === 0 ? undefined : min ?? (stat.key === 'recharge' ? 1 : undefined),
                max: constraint?.panelMax?.[stat.key]}]
        }))
    }

    const constraintSetMode = computed(() => {
        const convertedName = constraintArtifactSet.value.map(x => convertArtifactName(x))
        const len = convertedName.length
        if (len === 2) {
            return {
                "Set22": convertedName
            }
        } else if (len === 1) {
            return {
                "Set4": convertedName[0]
            }
        } else {
            return "Any"
        }
    })

    const constraintInterface = computed(() => ({set_mode: constraintSetMode.value,
        ...Object.fromEntries(PANEL_STATS.map(stat => [stat.minimum, panelBounds.value[stat.key]?.min ?? 0])),
        panel_max: panelMaximumConstraint.value}))

    return {
        presetConstraint,
        presetFilter,
        algorithm,
        constraintArtifactSet,
        constraintSandMainStats,
        constraintGobletMainStats,
        constraintHeadMainStats,
        panelBounds,
        restorePanelBounds,

        constraintSetMode,
        constraintInterface
    }
}

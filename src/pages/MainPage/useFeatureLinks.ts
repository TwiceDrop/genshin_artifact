/// <reference types="unplugin-icons/types/vue3" />
import {computed} from "vue"
import {useI18n} from "@/i18n/i18n"
import CalculateIcon from "~icons/ep/data-analysis"
import TeamIcon from "~icons/ep/connection"
import CharacterIcon from "~icons/ep/user-filled"
import ArtifactIcon from "~icons/ep/box"
import KumiIcon from "~icons/ep/collection"
import HistoryIcon from "~icons/ep/clock"

export function useFeatureLinks() {
    const { t } = useI18n()
    return computed(() => ({
        calculate: { path: "/calculate", label: t("nav.calculate"), icon: CalculateIcon },
        team: { path: "/team-optimization", label: t("nav.teamOptimize"), icon: TeamIcon },
        character: { path: "/uid-data", label: t("misc.character"), icon: CharacterIcon },
        artifacts: { path: "/artifacts", label: t("nav.artifact"), icon: ArtifactIcon },
        kumi: { path: "/artifacts-kumi", label: t("nav.kumi"), icon: KumiIcon },
        history: { path: "/calculation-history", label: "历史记录", icon: HistoryIcon },
    }))
}

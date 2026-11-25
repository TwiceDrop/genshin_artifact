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
        calculate: { path: "/calculate", label: t("nav.calculate"), icon: CalculateIcon, description: "单人圣遗物配装与伤害计算" },
        team: { path: "/team-optimization", label: t("nav.teamOptimize"), icon: TeamIcon, description: "队伍配装，圣遗物互不冲突" },
        character: { path: "/uid-data", label: t("misc.character"), icon: CharacterIcon, description: "管理角色面板、预设与 UID 数据" },
        artifacts: { path: "/artifacts", label: t("nav.artifact"), icon: ArtifactIcon, description: "浏览、筛选与导入圣遗物仓库" },
        kumi: { path: "/artifacts-kumi", label: t("nav.kumi"), icon: KumiIcon, description: "保存并快速套用常用配装组合" },
        history: { path: "/calculation-history", label: "历史记录", icon: HistoryIcon, description: "回看与对比以往计算结果" },
    }))
}

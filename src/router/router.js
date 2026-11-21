import NewArtifactPlanPage from "@page/NewArtifactPlanPage"
import TeamOptimizationPage from "@page/TeamOptimizationPage"
import MonaPlaygroundPage from "@page/MonaPlaygroundPage"
import ArtifactsPage from "@page/ArtifactsPage"
import AccountPage from "@page/AccountPage"
import SetupPage from "@page/SetupPage"

import { createRouter, createWebHashHistory, createWebHistory } from "vue-router"
import {getRepo} from "@/api/repo"
import {ElMessageBox} from "element-plus"
import "element-plus/es/components/message-box/style/css"
import {importMonaJson} from "@/utils/artifacts"
import {useArtifactStore} from "@/store/pinia/artifact"
import {followCloudSession, needsLogin} from "@/platform/login-gate.mjs"
import {profileSync} from "@/cloud/profile-sync"

const IntroPage = () => import(/* webpackChunkName: "intro-page" */ "@page/about/IntroPage")
const CharacterPresetsPage = () => import(/* webpackChunkName: "character-presets-page" */ "@page/CharacterPresetsPage")
const ExportToolPage = () => import(/* webpackChunkName: "help-page" */ "@page/helps/ExportToolPage")
const KumiPage = () => import (/* webpackChunkName: "kumi-page" */ "@page/KumiPage")


const webName = process.env.MONA_TITLE;

const routes = [
    {
        path: "/online-account",
        component: () => import(/* webpackChunkName: "online-account-page" */ "@page/OnlineAccountPage/OnlineAccountPage.vue"),
        name: "online-account",
        meta: {
            title: "账户管理与同步",
        }
    },
    { path: '/calculation-history', component: () => import('@page/CalculationHistoryPage.vue'), meta: { title: '历史记录' } },
    { path: '/uid-data', component: () => import('@page/UidDataPage.vue'), meta: { title: 'UID 数据' } },
    {
        path: "/setup",
        component: SetupPage,
        name: "setup",
        meta: {
            title: "设置"
        }
    },
    {
        path: "/playground",
        component: MonaPlaygroundPage,
        name: "playground",
        meta: {
            title: "Playground",
        }
    },
    {
        path: "/team-optimization",
        component: TeamOptimizationPage,
        meta: {
            title: "整队优化",
            keepAlive: true,
        }
    },
    {
        path: "/artifacts-kumi",
        component: KumiPage,
        meta: {
            title: "圣遗物套装",
            keepAlive: true,
        }
    },
    {
        path: "/help/export-tools",
        component: ExportToolPage,
        meta: {
            title: "导出工具汇总",
        }
    },
    {
        path: "/login",
        component: () => import(/* webpackChunkName: "login-page" */ "@page/LoginPage/LoginPage.vue"),
        name: "login",
        meta: {
            title: "登录",
            bare: true,
        }
    },
    {
        path: "/intro",
        component: IntroPage,
        alias: "/",
        name: "home",
        meta: {
            title: "首页",
        }
    },
    {
        path: "/account",
        component: AccountPage,
        name: "account",
        meta: {
            keepAlive: true,
            title: "账号",
        }
    },
    {
        path: "/artifacts",
        component: ArtifactsPage,
        name: "artifact",
        meta: {
            keepAlive: true,
            title: "圣遗物",
        }
    },
    {
        path: "/calculate",
        name: "calculate",
        component: NewArtifactPlanPage,
        meta: {
            keepAlive: true,
            title: "莫娜计算器",
        }
    },
    {
        path: "/tomodachi",
        redirect: { name: "home" },
    },
    {
        path: "/presets",
        component: CharacterPresetsPage,
        meta: {
            keepAlive: true,
            title: "计算预设",
        }
    },
]

const router = createRouter({
    routes,
    history: process.env.MONA_ROUTE_MODE === "hash" ? createWebHashHistory() : createWebHistory()
})

router.beforeEach((to, from, next) => {
    if (to.meta.title) {
        document.title = to.meta.title;
    }

    const title = to.meta.title
    document.title = `${title} | ${webName} ${process.env.MONA_VERSION}`

    next();
})

// 打开软件后的第一次跳转先过登录门：没登录、也没选过离线模式时先到登录页，之后回到原来要去的页面。
// 分享链接导入（/import）不拦。
let loginChecked = false
// 云档案同步跟随登录状态（已登录时启动、退出后停止），打开软件后开始跟随，不阻塞跳转
let syncFollowed = false
router.beforeEach(() => {
    if (!syncFollowed) { syncFollowed = true; followCloudSession(profileSync) }
    return true
})
router.beforeEach(async to => {
    if (loginChecked || to.name === "login" || to.path === "/import" || (to.name === 'setup' && to.hash === '#export-data')) return true
    loginChecked = true
    if (!(await needsLogin())) return true
    return { name: "login", query: to.fullPath === "/" ? {} : { redirect: to.fullPath } }
})

router.beforeEach(async (to, from, next) => {
    if (to.path === "/import") {
        const artifactStore = useArtifactStore()
        const type = to.query["type"]
        const code = to.query["code"]

        if (type === "artifact" && code) {
            try {
                const response = await getRepo(code)
                if (response.status === 200) {
                    const contentStr = response.data.content
                    const content = JSON.parse(contentStr)
                    console.log(content)

                    if (artifactStore.artifactsCount.value > 0) {
                        await ElMessageBox.confirm("检测到本地存在圣遗物，是否继续导入", "注意", {
                            confirmButtonText: "是",
                            cancelButtonText: "否",
                            type: "warning"
                        }).then(() => {
                            importMonaJson(content, true)
                        }).catch(() => {})
                    } else {
                        importMonaJson(content, true)
                    }
                }
            } catch (e) {
                console.log(e)
            }

            // console.log("123")
            // setImmediate(() => {
            // redirect("artifact")
            next({ name: "artifact" })
        } else {
            next({ name: "home" })
        }
    } else {
        next()
    }
})

export default router;

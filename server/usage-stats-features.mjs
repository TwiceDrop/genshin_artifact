// The one list of usage stats feature IDs. The client decides what it may report from it,
// online-service validates uploads against it, and the stats page shows its names.
// IDs are stored server side and kept across versions: rename a name freely, never an ID.
// A page feature is recorded by the global route hook; an action feature is recorded where the action succeeds.
// No Vue, browser or Node-only API here: the browser, the Node tests and online-service all import this file.

const PAGES = [
    ['page.calculate', '配装计算', '/calculate'],
    ['page.artifacts', '圣遗物仓库', '/artifacts'],
    ['page.artifacts-kumi', '圣遗物组', '/artifacts-kumi'],
    ['page.team-optimization', '四人轴', '/team-optimization'],
    ['page.presets', '角色预设', '/presets'],
    ['page.account', '账号', '/account'],
    ['page.uid-data', 'UID 数据', '/uid-data'],
    ['page.calculation-history', '历史记录', '/calculation-history'],
    ['page.playground', 'Playground', '/playground'],
    ['page.export-tools-help', '导出工具帮助', '/help/export-tools'],
    ['page.setup', '设置', '/setup'],
    ['page.intro', '介绍页', '/intro'],
]

const ACTIONS = [
    ['action.single-optimize', '单人配装'],
    ['action.dynamic-artifact-score', '动态圣遗物评分'],
    ['action.team-dps', '四人轴计算'],
    ['action.miyoushe-import', '米游社/HoYoLAB 导入'],
    ['action.artifact-file-import', '导入圣遗物文件'],
    ['action.data-export', '导出数据'],
    ['action.preset-save', '保存预设'],
    ['action.kumi-save', '保存圣遗物组'],
    ['action.clear-selected', '清空已选'],
    ['action.color-mode-change', '切换外观'],
    ['action.locale-change', '切换语言'],
    ['action.update-check', '检查更新'],
    ['action.update-install', '安装更新'],
    ['action.debug-export', 'Debug 导出'],
]

// The platforms an upload may name. The desktop build reports windows and the Android build android.
export const USAGE_PLATFORMS = Object.freeze(['windows', 'android'])

const FEATURES = Object.freeze([
    ...PAGES.map(([id, name, route]) => Object.freeze({id, category: 'page', name, route})),
    ...ACTIONS.map(([id, name]) => Object.freeze({id, category: 'action', name})),
])
const BY_ID = new Map(FEATURES.map(f => [f.id, f]))
const BY_ROUTE = new Map(FEATURES.filter(f => f.route).map(f => [f.route, f.id]))

export function listUsageFeatures() {
    return FEATURES
}

export function getUsageFeature(id) {
    return BY_ID.get(id)
}

// `route` is the path of the matched route record (for an alias, the path of the record it aliases).
export function usageFeatureIdForRoute(route) {
    return BY_ROUTE.get(route)
}

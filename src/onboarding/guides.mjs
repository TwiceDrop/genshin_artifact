export const ONBOARDING_GUIDES = [
    {
        id: 'quick-start',
        kind: 'quick',
        title: '快速了解',
        summary: '3 步认识导航与使用流程，各模块可按需单独查看详细引导。',
        pageRoutes: [],
        steps: [
            {
                id: 'nav.sidebar',
                route: null,
                anchor: 'nav.sidebar',
                mobileAnchor: 'nav.mobile-bottom',
                title: '认识主要功能区',
                body: '左侧栏（手机端为底部导航）汇总了角色（UID）、单次计算、多人优化和圣遗物仓库，常用功能都能在这里直达。'
            },
            {
                id: 'workflow',
                route: null,
                anchor: null,
                title: '常见使用流程',
                body: '一般先在「圣遗物」或「角色」页导入已有数据，再去「单次计算」自动配装；需要四人互不抢装备或算循环总伤时，再进「多人优化」。'
            },
            {
                id: 'nav.guide',
                route: null,
                anchor: 'nav.guide',
                mobileAnchor: 'nav.mobile-menu',
                title: '按模块查看详细引导',
                body: '每个核心页面顶栏都有「？」按钮，侧栏里也可以随时打开「使用引导」，需要哪一块再单独看哪一块的详细步骤。'
            }
        ]
    },
    {
        id: 'detail-import',
        kind: 'detail',
        title: '导入圣遗物与角色',
        summary: '理清 JSON 导入、米游社识图、UID 展柜与导出工具该怎么选。',
        pageRoutes: ['/artifacts', '/uid-data', '/help/export-tools'],
        steps: [
            {
                id: 'export-tools.list',
                route: '/help/export-tools',
                anchor: 'export-tools.list',
                title: '全仓库导入：先用导出工具',
                body: '想一次性导入全部圣遗物，先在这里选一款常用扫描器导出 JSON（支持莫娜格式与 GOOD v3）。'
            },
            {
                id: 'artifacts.import',
                route: '/artifacts',
                anchor: 'artifacts.import',
                mobileAnchor: 'artifacts.more',
                title: '导入圣遗物文件',
                body: '点「导入」上传 JSON。导入弹窗里，「删除未出现的圣遗物」适合全量同步，「备份现有套装」可保留旧套装组合。'
            },
            {
                id: 'artifacts.add',
                route: '/artifacts',
                anchor: 'artifacts.add',
                title: '单件补充：手动新增',
                body: '只想临时补几件新圣遗物，可以点「＋ 新增圣遗物」手动录入。'
            },
            {
                id: 'uid.import-entry',
                route: '/uid-data',
                anchor: 'uid.import-entry',
                title: '通过 UID 导入角色与预设',
                body: '在「角色」页输入 UID 或登录米游社，可导入角色等级、武器与当前穿戴圣遗物，并一键生成角色预设。'
            }
        ]
    },
    {
        id: 'detail-calculate',
        kind: 'detail',
        title: '单人配装与伤害计算',
        summary: '从载入预设、设置目标与过滤条件，到自动配装和对比结果。',
        pageRoutes: ['/calculate'],
        steps: [
            {
                id: 'calc.preset',
                route: '/calculate',
                anchor: 'calc.preset',
                title: '载入与保存预设',
                body: '在这里选择已导入的角色预设快速填好面板，调整完毕后也可以随时保存回预设。'
            },
            {
                id: 'calc.character-gear',
                route: '/calculate',
                anchor: 'calc.character-gear',
                title: '调整角色、武器与圣遗物',
                body: '可以手动更换武器、命座、天赋或单个部位的圣遗物，点击圣遗物还可查看单件评分与替换建议。'
            },
            {
                id: 'calc.conditions',
                route: '/calculate',
                anchor: 'calc.conditions',
                title: '配置队友 BUFF 与敌人',
                body: '在条件区域添加队友 BUFF、调整敌人等级与抗性，并可随时展开伤害构成查看各乘区明细。'
            },
            {
                id: 'calc.target',
                route: '/calculate',
                anchor: 'calc.target',
                title: '选择配装目标',
                body: '点「配装目标」决定优化方向：单技能最高伤害、指定面板阈值，或使用自定义 DSL 表达式。'
            },
            {
                id: 'calc.settings',
                route: '/calculate',
                anchor: 'calc.settings',
                title: '设置充能下限与圣遗物过滤',
                body: '「计算设置」可设充能/暴击等约束与搜索算法；「圣遗物设置」可限定套装或排除已被其他预设占用的圣遗物组。'
            },
            {
                id: 'calc.run',
                route: '/calculate',
                anchor: 'calc.run',
                title: '运行自动配装并对比提升',
                body: '点击「自动配装」开始搜索，完成后可在结果弹窗里与当前穿戴对比伤害变化，并一键应用或存为套装。'
            }
        ]
    },
    {
        id: 'detail-artifacts',
        kind: 'detail',
        title: '圣遗物仓库与套装组',
        summary: '高效筛选、锁定、评分圣遗物，并用套装组防止抢装备。',
        pageRoutes: ['/artifacts', '/artifacts-kumi'],
        steps: [
            {
                id: 'artifacts.slots',
                route: '/artifacts',
                anchor: 'artifacts.slots',
                title: '按部位与词条快速筛选',
                body: '用顶部的部位栏和筛选条件，快速找出指定套装、主词条或双暴副词条的圣遗物。'
            },
            {
                id: 'artifacts.grid',
                route: '/artifacts',
                anchor: 'artifacts.grid',
                title: '查看详情、锁定与评分',
                body: '点击任意圣遗物可查看角色适配评分、编辑词条或加锁；加锁后可在配装设置里按需排除或保留。'
            },
            {
                id: 'artifacts.more',
                route: '/artifacts',
                anchor: 'artifacts.more',
                title: '批量操作',
                body: '在「更多」菜单里可以一键全部解锁或清空当前仓库。'
            },
            {
                id: 'kumi.header',
                route: '/artifacts-kumi',
                anchor: 'kumi.header',
                title: '用圣遗物套装组固定搭配',
                body: '在「圣遗物套装」把常用的 5 件保存成组，既方便一键换装，也能在单人配装里勾选组过滤避免被其他角色抢走。'
            }
        ]
    },
    {
        id: 'detail-team-dps',
        kind: 'detail',
        title: '多人优化与四人轴 DPS',
        summary: '给四名角色同时分配不冲突的圣遗物，计算完整循环总伤。',
        pageRoutes: ['/team-optimization'],
        steps: [
            {
                id: 'team.toolbar',
                route: '/team-optimization',
                anchor: 'team.toolbar',
                title: '新建或导入四人动作轴',
                body: '多人优化以「动作轴」为单位：可以直接导入现成的动作轴 JSON，或新建一条动作轴并选定 4 名角色。'
            },
            {
                id: 'team.config-select',
                route: '/team-optimization',
                anchor: 'team.config-select',
                title: '切换计算配置',
                body: '已保存的动作轴都会列在这里，随时可以切换不同队伍循环，或点「管理计算配置」进入编辑。'
            },
            {
                id: 'team.manage-btn',
                route: '/team-optimization',
                anchor: 'team.manage-btn',
                title: '编辑时间轴与预览倍率',
                body: '在「管理计算配置」中可编辑角色出手顺序、初始前台、轴尾命中，并打开倍率预览核对循环。'
            },
            {
                id: 'team.workspace',
                route: '/team-optimization',
                anchor: 'team.workspace',
                title: '运行整队计算与查看明细',
                body: '选好动作轴后即可评估整队 DPS 或运行整队配装。当前四人轴按初始满能、无循环充能限制计算，可在事件明细中查看每一跳伤害。'
            }
        ]
    },
    {
        id: 'detail-history',
        kind: 'detail',
        title: '历史记录与方案对比',
        summary: '回看以往自动配装结果，对比不同方案的面板与伤害。',
        pageRoutes: ['/calculation-history'],
        steps: [
            {
                id: 'history.header',
                route: '/calculation-history',
                anchor: 'history.header',
                title: '自动留存配装记录',
                body: '每次完成自动配装后，结果会自动记录在这里，不用担心切角色后找不回之前的方案。'
            },
            {
                id: 'history.filters',
                route: '/calculation-history',
                anchor: 'history.filters',
                title: '筛选与定位历史方案',
                body: '可以按角色或记录类型快速筛选，找到想回看的那次配装。'
            },
            {
                id: 'history.list',
                route: '/calculation-history',
                anchor: 'history.list',
                title: '查看详情与再次载入',
                body: '点开记录可复盘当时的面板、词条收益与搭配，并重新载入计算器做进一步对比。'
            }
        ]
    },
    {
        id: 'detail-account-sync',
        kind: 'detail',
        title: '多账号、备份与跨设备迁移',
        summary: '管理本地多账号、整包备份还原以及手机电脑互传。',
        pageRoutes: ['/account', '/setup', '/online-account'],
        steps: [
            {
                id: 'account.header',
                route: '/account',
                anchor: 'account.header',
                title: '本地多账号隔离',
                body: '可以在「账号」页新建和切换多个本地账号，大小号或好友的圣遗物仓库与预设彼此独立。'
            },
            {
                id: 'setup.migration',
                route: '/setup',
                anchor: 'setup.migration',
                title: '整包导出与导入备份',
                body: '在设置页可一键将所有本地账号（含 UID、圣遗物、四人轴与历史记录）导出为备份文件，换设备时直接导入。'
            },
            {
                id: 'setup.phone-transfer',
                route: '/setup',
                anchor: 'setup.phone-transfer',
                title: '手机互传与云端同步',
                body: '同一局域网下可用「手机互传」快速迁移数据；若已登录在线账号，也可以在「账户管理与同步」开启云端同步。'
            }
        ]
    }
]

export function getGuideById(id) {
    return ONBOARDING_GUIDES.find(guide => guide.id === id)
}

export function getQuickGuide() {
    return getGuideById('quick-start')
}

export function getDetailGuides() {
    return ONBOARDING_GUIDES.filter(guide => guide.kind === 'detail')
}

export function getGuideForRoute(path) {
    // 圣遗物页也参与导入引导，页头的专属入口指向仓库与套装组。
    if (path === '/artifacts') return getGuideById('detail-artifacts')
    return getDetailGuides().find(guide => guide.pageRoutes.includes(path))
}

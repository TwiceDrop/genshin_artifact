# 05: 六套详细引导页面锚点与一致性测试

**What to build:** 为 6 套详细引导涉及的页面元素补齐 `data-tour` 锚点，并在 `tests/onboarding.test.mjs` 中新增静态锚点一致性测试，防止遗漏或拼写漂移。

**Blocked by:** 01, 04

**Status:** done

规格见 `docs/specs/onboarding/spec.md` 的「详细引导（6 套）」与「Verification Plan」。业务页面仅添加 `data-tour` 属性，不改动原有业务逻辑与计算。

## 任务清单

- [x] 导出工具页（`src/pages/helps/ExportToolPage/ExportToolPage.vue`）：
  - `data-tour="export-tools.list"`（工具列表区域）
- [x] 圣遗物仓库页（`src/pages/ArtifactsPage/ArtifactsPage.vue`）：
  - `data-tour="artifacts.import"`（导入按钮）
  - `data-tour="artifacts.more"`（更多下拉按钮）
  - `data-tour="artifacts.add"`（新增圣遗物按钮）
  - `data-tour="artifacts.slots"`（顶部部位栏）
  - `data-tour="artifacts.grid"`（圣遗物网格/列表主区）
- [x] 角色 / UID 页（`src/components/import/MiyousheImport.vue`）：
  - `data-tour="uid.import-entry"`（UID 输入 / 导入操作主区域）
- [x] 单人计算页（`src/pages/NewArtifactPlanPage/CalcTopBar.vue` 与 `src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue`）：
  - `data-tour="calc.top-actions"`（顶栏操作组，快速引导使用）
  - `data-tour="calc.preset"`（顶栏预设选择区）
  - `data-tour="calc.target"`（配装目标按钮）
  - `data-tour="calc.settings"`（计算设置与圣遗物设置按钮容器）
  - `data-tour="calc.run"`（自动配装按钮）
  - `data-tour="calc.character-gear"`（角色/武器/圣遗物配置区）
  - `data-tour="calc.conditions"`（队友 BUFF 与敌人条件区）
- [x] 圣遗物套装组页（`src/pages/KumiPage/KumiPage.vue`）：
  - `data-tour="kumi.header"`（套装组页顶栏/新建组操作区）
- [x] 多人优化 / 四人轴页（`src/pages/TeamOptimizationPage/TeamOptimizationWrapper.vue`）：
  - `data-tour="team.toolbar"`（顶部工具栏）
  - `data-tour="team.config-select"`（计算配置选择/导入区）
  - `data-tour="team.manage-btn"`（管理计算配置按钮）
  - `data-tour="team.workspace"`（四人轴主体计算区或空态新建区）
- [x] 历史记录页（`src/pages/CalculationHistoryPage.vue`）：
  - `data-tour="history.header"`（页面标题/顶栏区）
  - `data-tour="history.filters"`（筛选栏）
  - `data-tour="history.list"`（历史记录列表主区）
- [x] 账号与设置页（`src/pages/AccountPage/AccountPage.vue`、`src/pages/SetupPage/SetupPage.vue`）：
  - `data-tour="account.header"`（本地账号管理头部/新建账号区）
  - `data-tour="setup.migration"`（数据迁移导出/导入卡片）
  - `data-tour="setup.phone-transfer"`（手机互传卡片）
- [x] 在 `tests/onboarding.test.mjs` 新增静态扫描测试：
  - 扫描 `src/` 下全部 `.vue` 文件，提取所有 `data-tour="..."`
  - 断言 `ONBOARDING_GUIDES` 中每一步声明的 `anchor` 和 `mobileAnchor` 都在源码中存在
- [x] 验证：`node --test tests/onboarding.test.mjs` 与 `npm run build:local`

## Comments

已将详细步骤和快速步骤的锚点接到对应页面控件，分别标记仓库与四人轴的内容区和空态。新增静态扫描先检出缺失的导入锚点，补齐后指定 Node 测试 10 项全部通过，build:local 成功，有编译警告。高亮几何位置和真实交互交由 06 人工验收。

最终收口时指定两份 Node 测试 12 项全部通过，build:local 的 legacy 和 module 包均成功，每包 15 条警告，涉及 CSS 顺序与资源体积。桌面与手机浏览器的实际交互、布局和主题仍待 06 验收。

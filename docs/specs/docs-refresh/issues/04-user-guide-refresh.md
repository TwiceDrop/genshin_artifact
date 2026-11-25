# 重写常青版玩家使用手册

Status: done
Blocked by: 01

## 目标

新增不带版本号的常青玩家手册 `docs/user-guide.md`，取代停留在 7.1.11 的 `docs/user-guide-7.1.11.md`，按玩家实际使用流程组织，并与当前版本功能状态保持一致。

## 需对照核实的内容

- `docs/dev/current-state.md`（当前功能范围、已知限制、米游社扫码状态、Enka、GOOD v3、四人轴边界）
- `docs/user-guide-7.1.11.md`（可复用仍准确的概念说明，删除已过时的旧界面描述）
- `src/router/router.js`、`src/pages/MainPage/SideBar.vue`、`src/pages/about/IntroPage/QuickLaunchGrid.vue`（确认页面名称与入口）
- `docs/release-7.2.06-final.md`、`docs/release-7.2.06.04-final.md`（确认近期面向玩家的变化）

## 文档大纲

顶部写明一行「何时更新」（例如：发版新增玩家可见功能、调整导入方式或界面入口变化时更新）。

1. **简介与版本形态**
   - 莫娜占卜铺能做什么（单人伤害与配装、多人优化、四人固定轴 DPS、圣遗物管理）。
   - 桌面版（Windows 安装器/便携包/Tauri）与 Android 版的数据存储说明（各形态数据独立，换端/换端口需通过导出导入迁移）。
2. **第一步：导入角色与圣遗物**
   - 导出工具与 GOOD v3 / JSON 导入（`/artifacts`、`/help/export-tools`）。
   - Enka 公开展柜导入（`/uid-data`）。
   - 如实说明米游社扫码入口当前状态（以 `current-state.md` 为准）。
3. **单人伤害计算与配装（`/calculate`）**
   - 选择角色/武器/天赋/命座 → 配置队伍 BUFF 与敌人参数 → 选择目标函数并开始计算 → 查看面板、伤害拆分与词条收益。
4. **多人优化与四人轴（`/team-optimization`、计算器四人轴）**
   - 多角色圣遗物不冲突分配的用法；
   - 四人固定轴 DPS 的定位与已知前提（如初始满能、无循环充能、无敌人来伤，以 `current-state.md` 为准）。
5. **角色、圣遗物仓库、套装与历史记录**
   - `/uid-data`（角色与预设）、`/artifacts`（筛选/评分/去重）、`/artifacts-kumi`（圣遗物套装组合）、`/calculation-history`（历史记录回看）。
6. **账号管理、备份与同步**
   - 本地多账号切换（`/account`）、设置页全量备份导出/导入（`/setup`）、在线账号与云同步说明（按当前可用状态如实表述）。
7. **常见问题与问题反馈**
   - 升级/换端口后看不到原有数据怎么办；
   - 计算结果异常如何导出 Debug 包反馈（提醒不要公开分享含隐私凭据的文件）。

## 旧文档处理与收尾

- 检查全仓是否有对 `docs/user-guide-7.1.11.md` 的引用：
  - 若无外部强依赖，移入 `docs/history/user-guide-7.1.11.md` 并更新仓内引用；或保留原位并在顶部加一行「已由 `docs/user-guide.md` 取代」的归档提示（优先移入 `docs/history/`，除非发现外部脚本/README 强引用该路径）。
- 确认 `docs/README.md` 已正确链接 `docs/user-guide.md`。
- 不修改根目录 `README.md`。
- 完成后将本文件与 `docs/specs/docs-refresh/spec.md` 均改为 `Status: done`（前提是 `01`–`03` 均已 `done`）。

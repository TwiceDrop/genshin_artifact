# 10: 客户端首次使用弹窗

**What to build:** 第一次使用时弹窗，让用户选择导入数据的方式：用云端账号导入，或通过 UID / 圣遗物文件导入。选择后进入对应的现有导入流程。

**Blocked by:** 08, 09

**Status:** done

需要开发者先定：「第一次」怎么判断（本机没有任何数据，还是新登录的账号）；能否跳过、跳过后是否还会出现；弹窗文案。

- [x] 判断条件和文案确认
- [x] 各选项接入现有的导入入口，不复制导入逻辑
- [ ] 桌面和手机宽度各实测一次

## Comments

2026-11-18 开发者同意按推荐方案定稿。实现：`src/components/FirstUseDialog.vue`（挂在 `App.vue`），判断逻辑是纯函数 `src/platform/first-use.mjs`，测试 `tests/first-use.test.mjs`。

**何时弹出**：进入登录页以外的页面（欢迎页）后判断一次。本机所有本地账号的 `mona_account_artifacts_<id>`、`mona_account_presets_<id>` 都为空或不存在，且本机 `localStorage` 没有 `mona.firstUseDone`。登录和离线用户都适用。用量统计说明还没回答时先等它。选任何一项（含跳过）都写入 `mona.firstUseDone`，之后不再弹；读写出错时本次照常弹出，写入失败只记日志。

**文案**：
- 标题：先导入你的数据
- 说明：还没有圣遗物和预设。选一种方式导入，之后也可以在对应页面再导入。
- 按钮：从云端账号导入（仅登录时显示）／通过 UID 导入／导入圣遗物文件／跳过

**跳转**：云端账号 → `/account`（`OnlineAccountPage` 目前没有路由，账号页是现有入口）；UID → `/uid-data`（米游社/UID 导入页）；文件 → `/artifacts?import=1`，`ArtifactsPage` 读到后直接打开导入对话框并清掉参数。

**未实测**：桌面和手机宽度的外观、各跳转在浏览器里的实际行为（只构建和单元测试过）。

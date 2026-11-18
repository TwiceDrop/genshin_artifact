# 09: 客户端同步设置：按类别开关

**What to build:** 同步设置里，每类数据可以单独开关：Cookie、UID 数据、历史记录、圣遗物、角色设置（含 MONA-DSL 手改）、多人轴和文件。设置里显示上次同步时间、自动同步设置和「立即同步」按钮。

做法见 `spec.md` 已定结论 4。服务端不改：上传时，关闭的类别填入云端最新版本的原值；拉取时，关闭的类别不覆盖本机数据。Cookie 不在档案里，单独开关。

类别与档案字段的对应关系见 `docs/specs/online-sync/spec.md`。

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [x] 开关状态存在本机，默认全开
- [x] 上传和拉取按开关处理；把「关闭的类别保持云端原值、不覆盖本机」写成独立函数并测试
- [x] 上次同步时间、自动同步设置和立即同步按钮接入现有同步流程
- [x] 新增界面文案先交开发者确认

## Comments

### 实现说明（2026-11-18）

- 纯函数：`src/cloud/sync-categories.mjs`（`mergeForUpload`、`mergeForDownload`、`normalizeSyncSettings`）；测试 `tests/sync-categories.test.mjs`。
- 接入：`src/cloud/profile-sync-core.mjs`。开关存在本机同步元数据 `syncSettings`，默认全开。上传前若有关闭的档案类别，先 GET 云端最新版本取原值再提交；拉取时先读本机再合并后恢复。历史记录开关关闭时跳过历史同步。顺手补上了面板已在显示、但此前没人写入的 `binding.lastSyncedAt`。
- 类别与档案字段：UID 数据 = `miyoushe`；圣遗物 = `artifacts`；角色设置 = `presets`、`kumi`、`comparisonSettings`（`comparisonSettings` 在 online-sync 规格里没有归类，暂放这里，请确认）；多人轴和文件 = `teamDpsConfigurations`、`teamDpsTasks`；历史记录走独立的历史同步；`name` 始终同步。
- Cookie 开关只保存状态，位置已留，加解密由任务 04/08 接入。
- 注意：`CloudProfilesPanel.vue` 引用的 `@/cloud/profile-sync`（装配 `createProfileSync` 的文件）在当前代码里不存在，不是本次改动造成的，需要另行确认。

### 待开发者确认的界面文案（目前是占位实现）

「同步内容」区块标题；复选框标签：Cookie、UID 数据、历史记录、圣遗物、角色设置（含 MONA-DSL 手改）、多人轴和文件。上次同步时间、自动同步、立即同步沿用现有文案。

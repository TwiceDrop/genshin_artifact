# 莫娜占卜铺 开发约定

原神圣遗物配装与伤害计算工具。Vue 3 前端；计算由原始发布内核、效果桥接内核、扩展内核和 `beta-data/` 下的 JS 适配层组合完成，四人轴在 `beta-data/team-engine/`。术语以 `GLOSSARY.md` 为准，当前版本号与已实现范围见 `docs/dev/current-state.md`。

本文件是多人共用、Claude Code 与 Codex 共读的正本（`CLAUDE.md` 只引用它）。个人偏好写进 `CLAUDE.local.md` 或 `.claude/settings.local.json`，这两个文件不提交。需求与任务状态记在 `docs/specs/`，版本状态记在 `docs/dev/current-state.md`，本文件只放跨版本都成立的规则。

## 远端与发布

- 提交与合并只在本地。推送、建 PR、推标签、发 Release，以及其他改动 GitHub 上内容的操作，都只在当前对话的开发者明确要求时执行，一次要求只做那一次。原因：账号曾因一小时内连发多个版本被暂停。
- 正式发布需要开发者明确授权。未公开的游戏版本内容，要等官方授权创作体验服视频正式解禁并公开后才能发布，也不能夹带其他未解禁内容。发版步骤见 `docs/dev/release-checklist.md`。
- README 只在开发者明确要求时修改。

## 数据与隐私

- 测试用合成数据。真实数据（账号、UID、库存、预设、Debug 导出、浏览器存储、密钥、签名资料）不提交、不打包；开发者提供的调试包只用于当次排查。
- 已保存的数据保持原样：浏览器存储、用户原始导出、端口、主机名、应用 ID 和签名都不动，它们决定存储位置和覆盖升级。
- 临时测试产物放在 `.cache/test/<用途>/`（已被忽略），每类用固定子目录，用完删除。

## 计算内核

- 原始发布内核 `mona_wasm/pkg/mona_wasm_bg.wasm` 保留原样，以实际运行的 WASM 为准，Rust 源码只用于扩展内核（`docs/adr/0001-keep-original-release-kernel.md`）。
- 浏览器入口 `mona_wasm/pkg/index.js` 与 Node 入口 `beta-tools/runtime-7106.mjs`（名字含 7106，仍是当前入口）的包装顺序保持一致；改注册或包装顺序时两处同改，并核对 `src/workers/optimize_artifact.js`。
- 关键倍率和时序要有独立预期值，CPU／GPU 结果一致不能证明规则正确。
- 改公式、乘区、BUFF 作用域或反应系数前，先读 `docs/dev/formula-scope.md`。
- 接入新角色或新效果，按 `docs/dev/add-character.md` 走。

## 编码

- 只写解决当前问题的最小改动，信任内部代码。要新增校验、拦截、兜底、兼容回退或猜测的默认值时，先向开发者说明问题和拟改内容，同意后再写。
- 真实错误和 Debug 保留下来：异常带上阶段、原因和可定位信息，问题照实暴露，不靠取消检查、吞异常或清理存档来掩盖。
- 界面上新增说明、小字、提示或免责声明，先把具体文案交给开发者确认；适配限制和缺项在对话里说明。
- `src/assets/_gen_*.js` 与 `src/i18n/generated/` 之间用数字索引关联，保持原有顺序。它们由 `script/prepare-release.cjs` 和 `beta-tools/metadata-*.cjs` 生成，重新生成前先读生成脚本，确认不会覆盖本地补充的数据。

## 验证

- 每轮最多五项有明确目的的针对性验证，按实际改动选择；只改文档时不构建、不跑功能测试。汇报时说清实际核对了什么，只验证了源码就不说浏览器实测通过。
- 命令、环境要求和已知的测试问题见 `docs/dev/build-and-test.md`。

## 目录地图

| 位置 | 内容 |
| --- | --- |
| `src/` | Vue 前端，桌面（Element Plus）与新移动 UI 共用；`src/workers/` 是配装 Worker |
| `mona_wasm/pkg/` | 原始发布内核、效果桥接内核和浏览器 JS 入口 |
| `mona_wasm/extension/` | 扩展内核产物；源码在 `mona_core/`、`mona_wasm/src/`、`mona_dsl/` |
| `beta-data/` | JS 适配层：BUFF 规则、装备规则、单次伤害、配装接口 |
| `beta-data/team-engine/` | 四人轴引擎；角色包在 `characters/`，注册在 `character-packages.mjs` |
| `public/release-assets/` | 从原版发布包解出的图片，`_gen_character.js` 引用，已提交 |
| `server/` | 本机服务（`npm start`）：米游社导入、软件更新 |
| `online-service/` | 在线账号服务源码，尚未部署 |
| `android/`、`mobile/` | Android（Capacitor）与新移动 UI |
| `tauri-exe/`、`installer/` | Windows 的 Tauri 2 封装、Inno 安装器和托盘启动器 |
| `src-tauri/` | 旧 Tauri 1 封装，依赖的 `sub/yas` 不存在，无法构建 |
| `tests/` | `node --test` 测试；`tests/helpers/` 放合成夹具 |
| `beta-tools/` | 测试依赖的 Node 运行入口、冒烟脚本、证据生成脚本和数据提取脚本 |
| `docs/` | 发布说明与核对记录；`docs/dev/` 是开发文档，`docs/specs/` 是规格与任务，`docs/adr/` 是架构决策，`docs/agents/` 是 skill 配置 |

## 开发流程

项目内置 Matt Pocock 的 skills。Claude 用 `/名称` 调用，Codex 用 `$名称` 调用。

| 环节 | skill |
| --- | --- |
| 动手前对齐需求，沉淀术语和决策 | `grill-with-docs` |
| 把对齐结果写成规格 | `to-spec` |
| 把规格拆成任务文件 | `to-tickets` |
| 实现一个任务或规格 | `implement` |
| 测试先行 | `tdd` |
| 排查 bug | `diagnosing-bugs` |
| 代码审查 | Claude 用自带的 `/code-review`；Codex 用 `code-review` |
| 找架构改进点 | `improve-codebase-architecture` |

- `.claude/skills/`（Claude）和 `.agents/skills/`（Codex）是 `npx skills` 生成的同一批拷贝，来源与哈希记在 `skills-lock.json`。skill 文件保持上游原样，本项目的补充规则写在本文件或 `docs/agents/`。
- 更新 skill：`npx skills update`，两个目录一起更新，单独提交。

## Agent skills

### Issue tracker

仓库内的 markdown 文件：规格与任务放在 `docs/specs/<功能名>/`，不使用 GitHub Issues。见 `docs/agents/issue-tracker.md`。

### Triage labels

写成文件开头的 `Status:` 行（`ready-for-agent`、`ready-for-human`、`done` 等），不是 GitHub 标签。见 `docs/agents/triage-labels.md`。

### Domain docs

单一上下文：根目录 `GLOSSARY.md` 与 `docs/adr/`。见 `docs/agents/domain.md`。

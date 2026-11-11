# 莫娜占卜铺 开发约定

原神圣遗物配装与伤害计算工具。Vue 3 前端；计算由原始发布内核、效果桥接内核、扩展内核和 `beta-data/` 下的 JS 适配层组合完成，四人轴在 `beta-data/team-engine/`。术语以 `GLOSSARY.md` 为准，架构见 `docs/dev/architecture.md`，技术栈见 `docs/dev/tech-stack.md`，当前版本号与已实现范围见 `docs/dev/current-state.md`。

本文件是多人共用、Claude Code 与 Codex 共读的正本（`CLAUDE.md` 只引用它）。个人偏好写进 `CLAUDE.local.md` 或 `.claude/settings.local.json`，这两个文件不提交。需求与任务状态记在 `docs/specs/`，版本状态记在 `docs/dev/current-state.md`，本文件只放跨版本都成立的规则。

## 规则维护

- 每条规则后面写「目的」，新增规则时一起写。目的：以后能判断规则是否过时。
- 目的不再成立时，删掉整条规则。目的：本文件每轮对话都会加载，失效的规则只占上下文。
- skill 和 `docs/agents/` 下的配置同样写明目的，按同样的方式清理。

## 远端与发布

- 提交与合并只在本地。推送、建 PR、推标签、发 Release，以及其他改动 GitHub 上内容的操作，都只在当前对话的开发者明确要求时执行，一次要求只做那一次。目的：账号曾因一小时内连发多个版本被暂停。
- 正式发布需要开发者明确授权。未公开的游戏版本内容，要等官方授权创作体验服视频正式解禁并公开后才能发布，也不能夹带其他未解禁内容。发版步骤见 `docs/dev/release-checklist.md`。目的：遵守官方体验服的解禁约定。
- README 只在开发者明确要求时修改。目的：README 是面向玩家的下载页，版本号和下载链接要与已发布的成品一致。

## 数据与隐私

- 测试用合成数据。真实数据（账号、UID、库存、预设、Debug 导出、浏览器存储、密钥、签名资料）不提交、不打包；开发者提供的调试包只用于当次排查。目的：仓库和发布包是公开的，真实数据含登录凭据和个人库存。
- 已保存的数据保持原样：浏览器存储、用户原始导出、端口、主机名、应用 ID 和签名都不动。目的：它们决定存储位置和覆盖升级，改了之后玩家的存档就读不到。
- 临时测试产物放在 `.cache/test/<用途>/`（已被忽略），每类用固定子目录，用完删除。目的：不会被误提交，也不会越积越多。

## 计算内核

- 原始发布内核 `mona_wasm/pkg/mona_wasm_bg.wasm` 保留原样，以实际运行的 WASM 为准，Rust 源码只用于扩展内核。目的：仓库里的 Rust 源码比这个二进制少一部分角色和公式，重编译会把它们丢掉（`docs/adr/0001-keep-original-release-kernel.md`）。
- 浏览器入口 `mona_wasm/pkg/index.js` 与 Node 入口 `beta-tools/runtime-7106.mjs`（名字含 7106，仍是当前入口）的包装顺序保持一致；改注册或包装顺序时两处同改，并核对 `src/workers/optimize_artifact.js`。目的：测试走 Node 入口，页面走浏览器入口，两处不一致时测试通过而页面算错。
- 关键倍率和时序要有独立预期值。目的：CPU 与 GPU 共用同一套规则，规则错了两边结果仍然一致。
- 改公式、乘区、BUFF 作用域或反应系数前，先读 `docs/dev/formula-scope.md`。目的：乘区和作用域里有多处与直觉相反、已由开发者确认的语义。
- 接入新角色或新效果，按 `docs/dev/add-character.md` 走。目的：一个角色要同时接进注册表、五条公共入口和界面，漏一处就会出现某条路径算不出来。

## 编码

- 只写解决当前问题的最小改动，信任内部代码。要新增校验、拦截、兜底、兼容回退或猜测的默认值时，先向开发者说明问题和拟改内容，同意后再写。目的：兜底和默认值会让错误的伤害数值看起来正常。
- 真实错误和 Debug 保留下来：异常带上阶段、原因和可定位信息，问题照实暴露，不靠取消检查、吞异常或清理存档来掩盖。目的：玩家靠 Debug 导出包反馈计算问题，异常被吞掉就无从排查。
- 界面上新增说明、小字、提示或免责声明，先把具体文案交给开发者确认；适配限制和缺项在对话里说明。目的：界面文字直接面向玩家，措辞和取舍由开发者决定。
- 新文件的名字写它做什么，不带版本号或日期；按版本记录的发布说明除外。目的：带版本号的名字过了那个版本就看不出文件是否还在用，已有的 `runtime-7106.mjs` 就因此需要额外说明。
- `src/assets/_gen_*.js` 与 `src/i18n/generated/` 之间用数字索引关联，保持原有顺序。它们由 `script/prepare-release.cjs` 和 `beta-tools/metadata-*.cjs` 生成，重新生成前先读生成脚本，确认不会覆盖本地补充的数据。目的：顺序错位会让名称和翻译对不上。

## 验证

- 每轮最多五项有明确目的的针对性验证，按实际改动选择；只改文档时不构建、不跑功能测试。目的：全量测试有 200 多个文件，耗时很长，占用约 4 GB 内存。
- 汇报时说清实际核对了什么，只验证了源码就不说浏览器实测通过。目的：开发者据此决定还要不要自己实测。
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
| `tests/` | `node --test` 测试；`tests/helpers/` 放合成夹具 |
| `beta-tools/` | 测试依赖的 Node 运行入口、冒烟脚本、证据生成脚本和数据提取脚本 |
| `docs/` | 发布说明与核对记录；`docs/dev/` 是开发文档，`docs/specs/` 是规格与任务，`docs/adr/` 是架构决策，`docs/agents/` 是 skill 配置 |

## 开发流程

项目内置 Matt Pocock 的 skills。Claude 用 `/名称` 调用，Codex 用 `$名称` 调用。

| 环节 | skill | 目的 |
| --- | --- | --- |
| 动手前对齐需求，沉淀术语和决策 | `grill-with-docs` | 先把模糊的地方问清，避免做完才发现理解不一致 |
| 把对齐结果写成规格 | `to-spec` | 结论落成文件，换会话、换人、换 agent 都能接着做 |
| 把规格拆成任务文件 | `to-tickets` | 每个任务小到一次会话能做完并单独验证 |
| 实现一个任务或规格 | `implement` | 按任务文件实现，状态记在文件里 |
| 测试先行 | `tdd` | 关键倍率和时序先有独立预期值 |
| 排查 bug | `diagnosing-bugs` | 先能稳定复现再改，不凭猜测修 |
| 代码审查 | Claude 用自带的 `/code-review`；Codex 用 `code-review` | 提交前查出正确性问题 |
| 找架构改进点 | `improve-codebase-architecture` | 定期找出难测试、难定位的模块 |

`grilling`、`domain-modeling`、`codebase-design` 由上面的 skill 间接调用；`setup-matt-pocock-skills` 是一次性配置，结果已写在 `docs/agents/`。

- `.claude/skills/`（Claude）和 `.agents/skills/`（Codex）是 `npx skills` 生成的同一批拷贝，来源与哈希记在 `skills-lock.json`。skill 文件保持上游原样，本项目的补充规则写在本文件或 `docs/agents/`。目的：本地改过的 skill 在更新时会被覆盖或产生冲突。
- 更新 skill：`npx skills update`，两个目录一起更新，单独提交。目的：两个 agent 用的流程保持一致，更新内容能单独回看。

## Agent skills

### Issue tracker

仓库内的 markdown 文件：规格与任务放在 `docs/specs/<功能名>/`，不使用 GitHub Issues。见 `docs/agents/issue-tracker.md`。目的：任务随代码一起提交，协作者不需要 GitHub 权限，也不会改动远端。

### Triage labels

写成文件开头的 `Status:` 行（`ready-for-agent`、`ready-for-human`、`done` 等），不是 GitHub 标签。见 `docs/agents/triage-labels.md`。目的：agent 靠它判断一个任务能不能直接做。

### Domain docs

单一上下文：根目录 `GLOSSARY.md` 与 `docs/adr/`。见 `docs/agents/domain.md`。目的：代码、测试和对话用同一套术语。

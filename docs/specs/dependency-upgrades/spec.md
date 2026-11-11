# 升级老旧的前端依赖

Status: ready-for-human

2026-11-11 评估，开发者决定暂不升级，等需要时再做。启动时由开发者决定先做哪一步，再用 `/to-tickets` 拆成任务文件。下面的文件数、用法统计取自当天的 `cleanup-and-ai-rules` 分支，启动时重新搜索核对。

## 给执行者

- 开始前读根目录 `AGENTS.md`，它的规则优先于本规格。
- 一步一次本地提交，不推送、不建 PR。
- 升级不改变计算结果。任何一步引起伤害数值变化，都停下来问开发者。
- 每步验证不超过五项，按下表挑选。汇报时写清实际跑了什么；没在浏览器里点过的功能，就不说浏览器实测通过。

## 现状

| 依赖 | 当前版本 | 用在哪里 |
| --- | --- | --- |
| axios | 0.21 | 只有 `src/api/client.js`、`src/api/misc.js` 两个文件 |
| TypeScript | 4.5（`@vue/cli-plugin-typescript` 5） | 37 个 `.ts` 文件、39 个 `lang="ts"` 组件，主体是 JS |
| ESLint | 7（`eslint-plugin-vue` 8、`@typescript-eslint` 5） | `.eslintrc.js` 的 `ignorePatterns` 排除了 `src/`，`npm run lint` 实际不检查前端源码 |
| Vue CLI | 5（webpack 5） | `vue.config.js` 183 行，桌面、新移动 UI、Android、Tauri 的网页产物都由它构建 |

同批老旧但不在本规格内的：Vue 3.2、Element Plus 2.2、monaco-editor 0.33、unplugin 系列 0.x。换构建工具时，unplugin 系列和 Monaco 插件要一起换成 Vite 版本。

## 方案

按代价从小到大分四步。每一步都能单独做、单独回退，前两步不依赖后两步。

### 1. axios 0.21 → 1.x（代价很小）

- 0.21 有已公开的安全漏洞，是最值得先做的一步。
- 1.x 的变化主要在错误对象结构和默认请求头。`client.js` 只用了 `axios.create({baseURL, timeout})`；`misc.js` 判断 `response.status` 和 `response.data`，这两处用法在 1.x 下不变。
- 验证：`npm run build:local`；在页面上点一次用到 `src/api/` 的功能。三处上游在线接口（分享码导入、生成分享码、上传配装结果）开发者已决定先保留，验证时只确认它们的报错方式没变。

### 2. TypeScript 4.5 → 5.x（代价小）

- 需要同时确认 `@vue/cli-plugin-typescript` 和它带的 ts-loader / fork-ts-checker 支持 TS 5。不支持时，这一步推迟到第 4 步之后。
- `tsconfig.json` 的 `types: ["webpack-env"]` 和 `lib: ["scripthost"]` 是 webpack 时代的配置，留到第 4 步再处理。
- 验证：`npm run build:local`、`npm run build:mobile`，确认没有新增类型错误。

### 3. ESLint 7 → 9（升级本身小，后续量大）

先由开发者决定：**`npm run lint` 要不要真正检查 `src/`**。

- 不检查：升级到 ESLint 9 并改成 flat config（`eslint.config.js`），保持现在只检查脚本目录的范围。代价小。
- 检查：现有 `.eslintrc.js` 规定 4 空格缩进和双引号，`src/` 下很多文件不是这样写的，放开后会冒出大量报错。要先定规则（建议只开正确性规则，格式规则交给格式化工具或直接关掉），再分批修。格式修改单独提交，不和行为改动混在一起。
- 验证：`npm run lint` 退出码为 0；`npm run build:local`。

### 4. Vue CLI 5 → Vite（代价大，单独立规格）

Vue CLI 已停止功能开发，但目前还能正常构建，没有必须马上换的理由。需要换时，先针对这一步单独走 `/to-spec`，下面是已知要逐项迁移的内容：

| webpack 里的写法 | 位置 | Vite 下的处理 |
| --- | --- | --- |
| `NormalModuleReplacementPlugin` 在移动 UI 构建时把 `element-plus` 换成 `src/mobile/index.js`、把它的样式换成空文件 | `vue.config.js` | 用 `resolve.alias` 或自定义插件的 `resolveId` |
| `node:crypto` 换成 `src/platform/crypto-browser.mjs` | `vue.config.js` | `resolve.alias` |
| 移动 UI 把 `radix-vue` 等指向 `mobile/node_modules`、把 `vue` 指到根目录那一份 | `vue.config.js` | `resolve.alias`，迁移后重新确认 `mobile/` 的 `npm ci --legacy-peer-deps` 是否还需要 |
| 十多个路径别名（`@c`、`@worker`、`mona` 等） | `vue.config.js`、`jsconfig.json` | `resolve.alias`，两处保持一致 |
| `?raw-wasm` 查询让 WASM 按普通文件输出、由浏览器解析 | `mona_wasm/pkg/index.js`、`src/wasm/team-dps-native-api.mjs` | 改用 Vite 的 `?url`。这是内核入口，改完要跑 `tests/kernel-entry-composition.test.mjs` 和一份走公共入口的测试 |
| `experiments.asyncWebAssembly`、`topLevelAwait` | `vue.config.js` | Vite 原生支持顶层 await；WASM 用 `vite-plugin-wasm` 或上面的 `?url` 加载方式 |
| 9 处 `new Worker(new URL(..., import.meta.url))` | `src/wasm/`、`src/components/`、`src/pages/` 等 | Vite 支持同样的写法，但 Worker 里的 `import` 和 WASM 加载要逐个实测 |
| `.i18n` 文件的自定义 loader（2 个文件） | `loaders/i18n_loader.js` | 改写成 Vite 插件的 `transform` |
| `process.env.MONA_*` 由 `DefinePlugin` 注入（约 20 处引用） | `vue.config.js`、`.env.*.yaml` | 用 Vite 的 `define` 保持原名，不必改成 `import.meta.env` |
| `require.context` 读取装备图片 | `src/pages/NewArtifactPlanPage/SingleResultWorkbench.vue` | 改成 `import.meta.glob` |
| `require('../mobile/shadcn.css')` | `src/main.ts` | 改成动态 `import` |
| `monaco-editor-webpack-plugin` | `vue.config.js` | 换成 Vite 的 Worker 写法或 Vite 版 Monaco 插件；顺便只保留 DSL 编辑器用到的部分（见下） |
| unplugin 自动导入与组件解析（含移动 UI 的自定义 resolver） | `vue.config.js` | 换成同一批 unplugin 的 Vite 版本，resolver 逻辑不变 |

迁移要保持不变的：端口、主机名、产物目录结构（打包脚本、安装器、Android、Tauri 都按现有路径取文件），以及浏览器存储位置。

验证（分两轮做，每轮不超过五项）：

- 第一轮：桌面网页构建后用本机服务打开，计算页能出结果；DSL 编辑器能高亮；配装 Worker 能跑完一次；`tests/kernel-entry-composition.test.mjs`。
- 第二轮：新移动 UI 构建后能打开；Android 和 Windows 安装包各打一次，并实际启动。

## 可以随时顺手做的小优化

`vue.config.js` 里写的是 `new MonacoWebpackPlugin()`，没有传参数，会把 Monaco 支持的所有语言（TypeScript、CSS、HTML、JSON 等）和对应的 Worker 都打进包里。项目只在 DSL 编辑器里用了一门自己注册的语言，传 `languages: []` 应该能明显减小 DSL 页面的体积。改之前和改之后各构建一次，对比产物大小，并确认 DSL 编辑器的高亮仍然正常。

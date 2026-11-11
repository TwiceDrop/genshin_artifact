# 04: 删除上游线上站点配置和文档书

**What to build:** 构建配置里只剩本项目实际使用的开关，上游线上站点（`www.mona-uranai.com`）专用的配置和文档源码从仓库里消失，桌面网页和新移动 UI 照常构建。

**Blocked by:** 03

**Status:** done

开发者已决定：本项目只做本地发行，下面各项全部删除。前端调用上游在线接口的三处入口单列在最后，开发者已决定暂时不动。

- [x] 删除 `.env.production.yaml` 和 `package.json` 的 `build` 脚本（备案加 CDN 的线上构建）；先确认 `script/`、`installer/`、`docs/dev/` 里没有调用 `npm run build`
- [x] 三份环境文件里删掉 `MONA_NEED_BEIAN` 和 `TAURI`（没有代码读取）
- [x] 删掉 `MONA_NEED_MIGRATE`：环境文件里的设置，以及 `src/pages/about/IntroPage/IntroPage.vue` 里读取它的变量和只在它为真时显示的模板段
- [x] 删掉 `USE_CDN`：保留源码里 `/// #if !USE_CDN` 包住的那一支（去掉条件注释本身），删掉 `public/index.html` 的 CDN 模板段和 `vue.config.js` 里读取 `USE_CDN` 的配置（Monaco 插件改为始终启用）；`ifdef-loader` 只为这个开关服务，确认没有其他条件编译后连同依赖一起删
- [x] 删除 `mona_book/` 与 `mona_dsl_book/`；`docs/user-guide-7.1.11.md` 里提到它们的句子改成指向上游仓库
- [x] 验证：`npm run build:local` 与 `npm run build:mobile` 都成功；打开计算页，图表（ECharts）和 DSL 编辑器（Monaco）正常加载，这两处原先受 `USE_CDN` 分支控制

## 仍需开发者决定

**Status of this part:** wontfix（2026-11-11 开发者决定暂时不动，本规格的执行者跳过这一节）

前端有三处调用上游的在线接口，本机服务（`server/local.mjs`）没有实现这些接口，所以在本地发行里它们请求不到：

- `src/router/router.js` 的 `getRepo`：通过分享码导入圣遗物仓库（`/api/repo/<code>`）
- `src/pages/ArtifactsPage/ArtifactsPage.vue` 的 `createRepo`：生成分享码（`/api/repo/create`）
- `src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue` 的 `createComputeResult`：上传配装结果（`/api/compute_result/create`）

`vue.config.js` 的 `devServer.proxy` 只为这三处服务。删掉代理和这三处调用会去掉界面上的入口，属于界面改动，实施前把涉及的按钮和文案列给开发者确认。在开发者决定之前，代理和 `src/api/` 保持原样。

## Comments

- 2026-11-11：上面的删除项全部完成，`ifdef-loader` 只为 `USE_CDN` 服务，已一起卸载；DSL 编辑器的包装去掉了从 CDN 加载 Monaco 的分支。用户指南里的 DSL 语法链接改为指向上游仓库 `wormtql/genshin_artifact` 的同名文件（已确认两份文件在上游 main 分支存在）。
- 验证：桌面网页和新移动 UI 都构建成功（输出到 `.cache/test/`）；用本机服务托管桌面构建，词条收益曲线的折线图和饼图正常显示，Playground 的 Monaco 编辑器正常加载，控制台无报错。
- 新发现：`mobile/package-lock.json` 与 `mobile/package.json` 不同步（缺 radix-vue 需要的 vue），`npm ci` 在 `mobile/` 下会直接失败。本次用不写锁文件的 `npm install` 装依赖完成构建，没有改锁文件，需要单独处理。

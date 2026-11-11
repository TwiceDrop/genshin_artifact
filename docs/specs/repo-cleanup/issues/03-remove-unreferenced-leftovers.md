# 03: 删除零引用的上游残留

**What to build:** 没有任何代码引用的上游遗留文件和依赖从仓库和发布包里消失，桌面网页照常构建和运行。

**Blocked by:** None (can start immediately)

**Status:** done

每一项删除前再做一次全仓引用搜索；搜到引用的那一项停下来，在本文件末尾的 `## Comments` 里记下引用位置，其余照常进行。

- [x] `src/store/store.js` 与 `src/store/modules/`：Vue 2 时代的 Vuex 仓库，没有被导入，`vuex` 也不在依赖里；现行状态在 `src/store/pinia/`
- [x] `public/download.py`、`public/index2.html`：没有引用，却会被原样复制进 `dist/` 随发布包分发
- [x] `script/bot_skill_ratio.js`、`script/bot_skill_ratio2.js`、`script/bot_stats.js`、`script/download_artifact.js`：上游的网页抓取脚本；同时删掉 `package.json` 的 `download-artifact` 脚本和只被它们使用的 `node-html-parser`
- [x] 依赖 `is-electron`、`lodash`、`@fortawesome/*`（四个包）：`src/` 里没有引用
- [x] `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`：Capacitor 模板自带的示例
- [x] `rust-toolchain.toml` 里的 `x86_64-unknown-linux-gnu` 目标：Windows 构建用不到
- [x] `vue.config.js` 里被注释掉的 CDN 资源表
- [x] 删除后 `npm uninstall` 只删减了锁文件，`build:local` 同等配置构建成功（输出到 `.cache/test/`，没有覆盖正在被其他会话使用的 `dist/`），`dist/` 里不再有 `download.py` 和 `index2.html`
- [x] 用本机服务托管构建产物，打开计算页：内核加载、伤害计算、图标正常，控制台无报错

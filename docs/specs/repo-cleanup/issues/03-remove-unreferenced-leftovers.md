# 03: 删除零引用的上游残留

**What to build:** 没有任何代码引用的上游遗留文件和依赖从仓库和发布包里消失，桌面网页照常构建和运行。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

每一项删除前再做一次全仓引用搜索；搜到引用的那一项停下来，在本文件末尾的 `## Comments` 里记下引用位置，其余照常进行。

- [ ] `src/store/store.js` 与 `src/store/modules/`：Vue 2 时代的 Vuex 仓库，没有被导入，`vuex` 也不在依赖里；现行状态在 `src/store/pinia/`
- [ ] `public/download.py`、`public/index2.html`：没有引用，却会被原样复制进 `dist/` 随发布包分发
- [ ] `script/bot_skill_ratio.js`、`script/bot_skill_ratio2.js`、`script/bot_stats.js`、`script/download_artifact.js`：上游的网页抓取脚本；同时删掉 `package.json` 的 `download-artifact` 脚本和只被它们使用的 `node-html-parser`
- [ ] 依赖 `is-electron`、`lodash`、`@fortawesome/*`（四个包）：`src/` 里没有引用
- [ ] `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`：Capacitor 模板自带的示例
- [ ] `rust-toolchain.toml` 里的 `x86_64-unknown-linux-gnu` 目标：Windows 构建用不到
- [ ] `vue.config.js` 里被注释掉的 CDN 资源表
- [ ] 删除后 `npm ci --legacy-peer-deps` 与 `npm run build:local` 成功，`dist/` 里不再有 `download.py` 和 `index2.html`
- [ ] 打开 `http://127.0.0.1:4183/#/calculate`，页面图标和图表正常显示

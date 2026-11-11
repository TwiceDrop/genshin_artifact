# 01: 修正乱码报错和失效引用

**What to build:** 仓库里几处确定有错的引用和一条乱码报错改正后，顺着任何一处引用都能找到真实存在的文件，扩展内核加载失败时显示可读的中文。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

开发者已确认报错文案：`扩展内核加载失败`。

- [ ] `mona_wasm/pkg/index.js` 第 29 行的报错改成 `扩展内核加载失败`，文件按 UTF-8 保存；这一行之外的内容不动
- [ ] `src/algorithms/artifact-score/rules.mjs` 第 2 行引用的 `docs/dynamic-artifact-score-20261108.md` 不存在，git 历史里也没有：把注释改成指向现存的依据（`THIRD_PARTY_NOTICES.md` 的「喵喵评分」一节和 `tests/fixtures/dynamic-score-affix-source.json`），不新写文档
- [ ] `THIRD_PARTY_NOTICES.md` 末段引用的 `7.1.01 beta1使用说明.md` 不存在：删掉对这个文件的引用，保留对 `beta-data/weapons-beta3.json` 的引用
- [ ] `jsconfig.json` 里指向不存在目录的别名（`@enemy`、`mona`、`@character`、`@weapon`、`@targetFunction`、`@potentialFunction`、`@buff`）：与 `vue.config.js` 的 `alias` 对齐，`mona` 改成 `mona_wasm/pkg`，其余不存在的删掉
- [ ] `.eslintrc.js` 的 `ignorePatterns` 去掉已不存在的 `sub/**/*`
- [ ] 全仓搜索确认没有其他乱码字符串
- [ ] 只记录、不修改：`src/pages/about/IntroPage/IntroPage.vue` 读取的是 `process.env.MONA_BUILD_DATA`，而 `vue.config.js` 定义的是 `MONA_BUILD_DATE`，两边名字不一致。改正后介绍页会多显示一个构建日期，属于界面变化，把现状和改法列给开发者决定
- [ ] 验证：`node --test tests/interface-audit-7108.test.mjs` 通过（走 Node 入口，确认没有误伤）；浏览器入口的改动只有一行字符串，用 `git diff` 核对

# 01: 修正乱码报错和失效引用

**What to build:** 仓库里几处确定有错的引用和一条乱码报错改正后，顺着任何一处引用都能找到真实存在的文件，扩展内核加载失败时显示可读的中文。

**Blocked by:** None (can start immediately)

**Status:** done

开发者已确认报错文案：`扩展内核加载失败`。

- [x] `mona_wasm/pkg/index.js` 第 29 行的报错改成 `扩展内核加载失败`，文件按 UTF-8 保存；这一行之外的内容不动
- [x] `src/algorithms/artifact-score/rules.mjs` 第 2 行引用的 `docs/dynamic-artifact-score-20261108.md` 不存在，git 历史里也没有：把注释改成指向现存的依据（`THIRD_PARTY_NOTICES.md` 的「喵喵评分」一节和 `tests/fixtures/dynamic-score-affix-source.json`），不新写文档
- [x] `THIRD_PARTY_NOTICES.md` 末段引用的 `7.1.01 beta1使用说明.md` 不存在：删掉对这个文件的引用，保留对 `beta-data/weapons-beta3.json` 的引用
- [x] `jsconfig.json` 里指向不存在目录的别名（`@enemy`、`mona`、`@character`、`@weapon`、`@targetFunction`、`@potentialFunction`、`@buff`）：与 `vue.config.js` 的 `alias` 对齐，`mona` 改成 `mona_wasm/pkg`，其余不存在的删掉
- [x] `.eslintrc.js` 的 `ignorePatterns` 去掉已不存在的 `sub/**/*`
- [x] 全仓搜索确认没有其他乱码字符串
- [x] `src/pages/about/IntroPage/IntroPage.vue` 读取的变量名 `MONA_BUILD_DATA` 是笔误，已由开发者确认改成 `vue.config.js` 定义的 `MONA_BUILD_DATE`（2026-11-11 单独提交）。介绍页模板没有用到这个变量，页面显示不变
- [x] 验证：原定的 `tests/interface-audit-7108.test.mjs` 改动前就失败，改用 `tests/refactor-7108-pilot.test.mjs`（走 Node 入口），通过；浏览器入口的改动只有一行字符串，用 `git diff` 核对

## Comments

- 2026-11-11：`tests/interface-audit-7108.test.mjs` 在改动前就失败（`StellarDamageDetail is not defined`），改用 `tests/refactor-7108-pilot.test.mjs` 验证，通过。`release-7106`、`lunar-integration` 的失败改动前后完全一致，原因是缺少私有夹具，记在任务 07。
- `vue.config.js` 里也有同样指向不存在目录的别名（`@enemy`、`@character` 等 6 个，源码里没有任何引用），不在本任务范围，没有改。

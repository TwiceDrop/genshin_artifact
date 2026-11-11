# 02: 让已提交的内核入口和生成元数据不再被忽略

**What to build:** 在 `mona_wasm/pkg/`、`src/assets/`、`src/i18n/generated/` 新增或改名文件时，`git status` 能看见它们。

现状：这三处共 16 个文件已提交，却同时被各自目录下的 `.gitignore` 忽略（`mona_wasm/.gitignore` 的 `/pkg`，以及 `src/assets/.gitignore`、`src/i18n/generated/.gitignore`）。其中 `mona_wasm/pkg/index.js` 是手工维护的浏览器入口。新增文件会被静默跳过，和上一轮 `public/release-assets` 的问题同类。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] 调整三处 `.gitignore`，只忽略真正由本机生成且不该提交的文件
- [ ] `git ls-files -ci --exclude-standard` 输出为空
- [ ] 在三处各放一个临时文件，`git status` 能列出，核对后删除临时文件
- [ ] `docs/dev/build-and-test.md` 里 `npm run setup:release` 的说明与新的忽略规则一致

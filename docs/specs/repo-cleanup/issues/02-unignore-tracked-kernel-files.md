# 02: 让已提交的内核入口和生成元数据不再被忽略

**What to build:** 在 `mona_wasm/pkg/`、`src/assets/`、`src/i18n/generated/` 新增或改名文件时，`git status` 能看见它们。

现状：这三处共 16 个文件已提交，却同时被各自目录下的 `.gitignore` 忽略（`mona_wasm/.gitignore` 的 `/pkg`，以及 `src/assets/.gitignore`、`src/i18n/generated/.gitignore`）。其中 `mona_wasm/pkg/index.js` 是手工维护的浏览器入口。新增文件会被静默跳过，和上一轮 `public/release-assets` 的问题同类。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 调整三处 `.gitignore`，只忽略真正由本机生成且不该提交的文件
- [x] `git ls-files -ci --exclude-standard` 输出为空
- [x] 在三处各放一个临时文件，`git status` 能列出，核对后删除临时文件
- [x] `docs/dev/build-and-test.md` 里 `npm run setup:release` 的说明与新的忽略规则一致

## Comments

- 2026-11-11：三处忽略的恰好都是已提交的文件，没有本机生成的私有产物，所以删掉了 `src/assets/.gitignore`、`src/i18n/generated/.gitignore`，`mona_wasm/.gitignore` 只保留 `/target`。
- 核对时发现 `npm run setup:release` 会把 `mona_wasm/pkg/index.js` 覆盖成上游的简化入口，而构建文档原先把它列为首次准备的必做步骤。这些文件都已提交，新克隆不需要它；文档已改为「只在恢复原始文件时运行，运行后必须还原 `index.js`」。

# 06: 把历史文档归档到 docs/history

**What to build:** `docs/` 顶层只剩现行文档；按版本号或日期命名的交接、核对、调研记录集中在 `docs/history/`，原有的引用仍然有效。

现状：`docs/` 顶层约 70 个文件里有 53 个带版本号或日期。

**Blocked by:** None (can start immediately)

**Status:** done

只移动文件和改引用，不改文档内容。「逐份判断」的那一项拿不准时留在原位，在本文件末尾的 `## Comments` 里列出来。

- [x] 留在原位：`docs/release-*-final.md`（打包脚本按 `docs/release-<版本>-final.md` 取文件，README 也链接到它）
- [x] 留在原位，或在同一次提交里改引用：被测试和源码引用的文档（`direct-reactions-only-7108.md`、`character-score-20261002.md`、`shared-buff-rules.md`、`lunar-damage-model.md`、`local-features.md`、`hoyolab-login-7202-20261031.md`、`character-buff-migration-7108.md` 与同名 `.json`）
- [x] 其余带版本号或日期的文档（`handoff-*`、`release-validation-*`、`investigation-*`、`pending-*`、`*-fix-*`、`*-research-*` 等）移到 `docs/history/`
- [x] 不带版本号、描述现行规则的文档（`independent-damage-scope.md`、`lunar-*-adapters.md`、`reaction-parameters-implementation.md`、`unified-buff-coverage.md`、`recovered-*.md`）：逐份判断是并入 `docs/dev/formula-scope.md`，还是移到 `docs/dev/`
- [x] `docs/已知公式未实现角色BUFF交接.md` 与 `docs/history/7.1.06-角色BUFF交接.md` 是否重复，重复则只留一份
- [x] 移动后全仓搜索 `docs/` 路径，没有指向旧位置的引用
- [x] `AGENTS.md` 目录地图里 `docs/` 一行按新结构更新

## Comments

- 2026-11-11：移到 `docs/history/` 的有 40 个文件（含截图），其中包括 `已知公式未实现角色BUFF交接.md`：它记录的是 7.1.07 时的状态，和 `7.1.06-角色BUFF交接.md` 内容不同，不算重复，两份都保留在 history。
- 不带版本号的规则说明（`independent-damage-scope.md`、`lunar-*-adapters.md`、`reaction-parameters-implementation.md`、`unified-buff-coverage.md`、`recovered-*.md`、`release-privacy.md`）没有把握判断是否仍是现行规则，按任务要求留在原位。`user-guide-7.1.11.md` 被已发布的 7.1.11 发布说明用 GitHub 链接引用，移动会让外部链接失效，也留在原位。
- 全仓的 `docs/<文件>` 路径和 Markdown 相对链接已按新位置改写；任务 05 移出 `beta-data/` 的三份笔记里断掉的链接一并修正。链接检查后仍无法解析的只有两类：交接文档里指向仓库外目录或本机 `.build-target/` 的路径，以及 `README_en.md` 里指向不存在的 `README_jp.md`（README 按规则不改，需要开发者决定）。

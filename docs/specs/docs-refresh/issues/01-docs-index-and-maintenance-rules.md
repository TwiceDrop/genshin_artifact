# 建立文档总索引与维护规则

Status: done

## 目标

为 `docs/` 建立统一导航入口，把「常青文档 vs 冻结记录」的维护规则落到具体文件，并清理 `docs/` 顶层混放的过时专题文档。

## 具体工作

1. **新建 `docs/README.md`**
   - 按四个板块组织链接：
     - **玩家使用**：`docs/user-guide.md`（待 `04` 补齐，先标明或待 `04` 接入）、`docs/local-features.md`（如实注明当前米游社扫码关闭状态见 `current-state.md`）、最新 `docs/release-7.2.06.04-final.md`。
     - **开发者文档**：`AGENTS.md`、`GLOSSARY.md`、`docs/dev/` 下全部文档（含即将新增的 `frontend-ui.md`、`services-and-platforms.md`）。
     - **架构决策与规格**：`docs/adr/`、`docs/specs/README.md`。
     - **发布记录与历史归档**：`docs/release-*.md`、`docs/history/`。
   - 在顶部用简短表格说明「常青文档（原地更新，不带版本号）vs 冻结记录（完成后封存）」的维护规则。

2. **为 `docs/dev/` 现有常青文档补齐顶部「何时更新」提示**
   - 检查 `docs/dev/` 下的现有文件（`architecture.md`、`tech-stack.md`、`build-and-test.md`、`formula-scope.md`、`add-character.md`、`usage-stats-rollout.md`），若开头缺少维护触发说明，补上一句简短的「何时更新本文件」。

3. **更新 `docs/dev/release-checklist.md`**
   - 在「2. 更新文档」中新增检查项：
     - 若本版有面向玩家的新功能或入口变化，同步更新 `docs/user-guide.md`。
     - 若本版新增或归档了文档，同步更新 `docs/README.md`。
   - 保持原有检查项不变，不动根目录 `README.md`。

4. **梳理 `docs/` 顶层带日期/版本号的非发布文档**
   - 逐个检查 `docs/character-buff-migration-7108.md`、`docs/character-score-20261002.md`、`docs/hoyolab-login-7202-20261031.md`、`docs/lunar-damage-model.md`：
     - 先全仓搜索引用（`git grep` / 搜索文件名）。
     - 若属于历史迁移/单次调研且已不再作为现行入口，移入 `docs/history/` 并同步修复仓内引用；若仍为现行参考，保留原位并在 `docs/README.md` 标明用途。
   - `docs/release-*.md` 暂保留在 `docs/` 顶层（避免破坏外部或发版说明里的链接）。

## 验收

- `docs/README.md` 中所有相对链接指向真实存在的文件（`02`/`03`/`04` 尚未创建前可先不放死链，或在对应任务完成后补链）。
- 仓内不存在因移动文件导致的断链。
- 完成后将本文件改为 `Status: done`。

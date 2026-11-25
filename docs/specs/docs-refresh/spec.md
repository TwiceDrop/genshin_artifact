# 项目文档补全与维护体系

Status: done

## 背景与目标

仓库目前已有 `AGENTS.md`、`GLOSSARY.md`、`docs/dev/`、`docs/adr/` 和 `docs/specs/`，但存在四个实际痛点：
1. 缺少文档总导航（`docs/README.md`），`docs/` 顶层混放了大量 `release-*.md` 和带日期/版本号的旧文档，难以快速定位现行文档。
2. 面向玩家的 `docs/user-guide-7.1.11.md` 落后于当前版本（7.2.06.04），未反映新 UI、四人轴、GOOD v3、Enka 展柜与多端备份方式。
3. 前端双端自适应与深浅色主题体系（`--wl-*` / `--sh-*` / `--cx-*`、`postcss-mona-colors.cjs` 避坑、`<keep-alive>` 与 `meta.bare`）缺少集中开发文档。
4. `server/`、`online-service/`、`android/`、`tauri-exe/` 的联调与打包说明分散在各处，缺少统一索引与边界说明。

本次目标：在不推倒重写已有好文档的前提下，建立清晰的文档地图、补齐 3 份高价值常青文档，并把低成本维护规则接进现有流程。

## 文档分层与维护约定

- **常青文档（Living Docs）**：`docs/README.md`、`docs/user-guide.md`、`docs/dev/*.md`、`GLOSSARY.md`。
  - 文件名**不带版本号或日期**；始终描述当前代码状态，变动时原地更新。
  - 文档顶部写明一行「何时更新」的触发条件（参考 `docs/dev/current-state.md`）。
  - 单一正本：同一事实只在一处写全，其他地方用相对链接引用，不复制粘贴。
- **冻结记录（Immutable）**：`docs/specs/*`、`docs/adr/*`、`docs/release-*.md`、`docs/history/*`。
  - 完成后封存，不回头维护；ADR 被推翻时只标记 `Superseded` 并链接新 ADR。
  - Spec 收尾标 `done` 时，若有跨版本适用的约定，提炼回对应常青文档。

## 硬性约束

- **不修改根目录 `README.md`**（遵循 `AGENTS.md`：README 只在开发者明确要求时修改）。
- 所有文档内容必须对照当前代码核实（路径、路由、命令、开关状态、功能限制如实说明，不编造不存在的功能或已关闭入口）。
- 归档或移动 `docs/` 顶层旧文档前，先全仓搜索引用，确保不留断链。
- 本次纯文档改动，不跑前端构建和功能测试（遵循 `AGENTS.md` 验证约定）。

## 任务拆分

按顺序或分批完成 `issues/` 下的 4 个任务：

1. [01-docs-index-and-maintenance-rules.md](./issues/01-docs-index-and-maintenance-rules.md) — 建立 `docs/README.md` 总索引、补全常青文档更新触发头、更新发版核对清单、梳理顶层旧文档归档。
2. [02-frontend-ui-guide.md](./issues/02-frontend-ui-guide.md) — 编写 `docs/dev/frontend-ui.md`（前端布局、路由、配色变量与 PostCSS 插件避坑）。
3. [03-services-and-platforms-guide.md](./issues/03-services-and-platforms-guide.md) — 编写 `docs/dev/services-and-platforms.md`（本机服务、在线服务与多端构建调试）。
4. [04-user-guide-refresh.md](./issues/04-user-guide-refresh.md) — 编写常青版 `docs/user-guide.md` 取代旧版 7.1.11 指南，并在 `docs/README.md` 中挂接。

## 整体验收

- `docs/README.md` 能从顶层清晰导航到所有现行玩家文档、开发文档、ADR、Spec 与发布记录，无死链。
- 3 份新增常青文档（`frontend-ui.md`、`services-and-platforms.md`、`user-guide.md`）中的所有文件路径、命令、路由、端口与功能状态均与当前仓库代码一致。
- 根目录 `README.md` 未被改动。
- 4 个子任务全部完成并标记 `Status: done` 后，将本文件改为 `Status: done`。

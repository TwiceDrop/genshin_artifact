# 规格与任务

每个功能一个目录：`<功能名>/spec.md` 是规格，`<功能名>/issues/01-xxx.md` 起是拆分出的任务。文件开头的 `Status:` 行记录状态（`ready-for-agent`、`ready-for-human`、`done` 等），完整约定见 `docs/agents/issue-tracker.md`。

通常由 `/to-spec` 和 `/to-tickets` 生成，`/implement` 按路径读取。手写也可以，保持同样的结构即可。

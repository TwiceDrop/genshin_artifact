# 10: 清理与整页验收

**What to build:** 删掉不再使用的旧模板和样式，整页验收。

**Blocked by:** 01, 08, 09

**Status:** ready-for-agent

- [ ] 删除 `calculation-workbench.css` 中不再使用的规则（或整个文件）、页面里旧区块的样式和 `jumpToSection` 等跳转逻辑
- [ ] 确认读页面源码的测试全部通过：`buff-dialog-7110`、`filter-kumi-7110`、`filter-kumi-source-7204`、`direct-reactions-only-7108`、`reaction-labels`
- [ ] 桌面 1440 与手机 375、浅色与深色各走一遍主要流程，截图给开发者
- [ ] 更新 `docs/dev/current-state.md` 里关于计算器界面的描述（如有）

## Comments

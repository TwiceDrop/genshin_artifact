# 01: 计算预设页视觉

**What to build:** 按 `../spec.md` 重做页面、列表组件、预设卡片和编辑弹窗配色。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 页面外框和顶部操作
- [x] `PresetBrowser` 分段按钮和筛选行
- [x] `PresetItem` 新卡片，「…」菜单导出 / 删除
- [x] `PresetEditor` 配色
- [x] 手机布局
- [x] 验证：桌面和手机、浅色和深色；计算器导入角色预设弹窗；删除测试浏览器里的合成预设

## Comments

- 2026-11-15：`PresetBrowser` 根元素带 `cx-scope`，放在计算器的导入 / 应用弹窗里也有配色；预设选择弹窗和编辑弹窗用 `custom-class="cx-scope"` 套新配色，`content-theme.css` 给 `.el-dialog.cx-scope` 设了卡片底色。页面标题用已有的 `nav.preset`（计算预设），没有新增文字。开发服务器的文件监听漏掉了 `PresetBrowser.vue` 的修改，重启后生效。
- 验证：内置浏览器桌面 1440 深色、手机 375 浅色。切换游戏内 / 自定义；搜索「重击」剩 1 条；「…」菜单只弹导出 / 删除、不误开编辑；点卡片打开编辑弹窗（新配色）；计算器导入角色预设弹窗显示新样式。`character-preset-workflow` 测试通过。测试浏览器里的 5 条合成预设已删除。

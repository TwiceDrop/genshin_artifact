# 10: 清理与整页验收

**What to build:** 删掉不再使用的旧模板和样式，整页验收。

**Blocked by:** 01, 08, 09

**Status:** done

- [x] 删除 `calculation-workbench.css` 中不再使用的规则（或整个文件）、页面里旧区块的样式和 `jumpToSection` 等跳转逻辑
- [x] 确认读页面源码的测试全部通过：`buff-dialog-7110`、`filter-kumi-7110`、`filter-kumi-source-7204`、`direct-reactions-only-7108`、`reaction-labels`
- [x] 桌面 1440 与手机 375、浅色与深色各走一遍主要流程，截图给开发者
- [x] 更新 `docs/dev/current-state.md` 里关于计算器界面的描述（如有）

## Comments

- 2026-11-15：`calculation-workbench.css` 用 postcss 按选择器删掉 66 条只作用于已删元素的规则，另有 4 组选择器去掉了失效的部分；页面样式块（SCSS，postcss 默认解析器读不了）逐条删改。全部属性抽屉的属性列表样式从 `.panel-card` 改挂到新包的 `.attributes-body`；目标函数描述图片的尺寸规则改挂到抽屉内容区。内容区底色和文字色改用 `--cx-*`。旧的「雾蓝」`[data-theme="mist"]` 变量还被抽屉里沿用的旧控件样式引用，保留。
- `docs/dev/current-state.md` 里没有计算器界面的描述，未改。
- 验证：内置浏览器桌面（1706 宽）深色、浅色，手机 375 宽浅色整页截图，显示正常；手机深色在 09 里看过。`direct-reactions-only-7108`、`filter-kumi-7110`、`filter-kumi-source-7204` 通过；`buff-dialog-7110`、`reaction-labels` 的 2 项、`buff-groups` 仍是合并前就有的失败。测试浏览器里加的 15 件合成圣遗物已删；配装时写入的计算历史和对比历史留在测试浏览器里，没有删。

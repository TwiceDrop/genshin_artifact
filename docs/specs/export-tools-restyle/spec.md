# 导出工具页换样式

Status: done

2026-11-15 开发者要求按页重做时做到这一页。页面内容少，不改结构，只换成夜空风格，没有另做布局方案。颜色读 `src/styles/content-theme.css` 的 `--cx-*`。

## Solution

1. 页面做成圆角内容块，标题用路由已有的「导出工具汇总」。
2. 在维护的工具做成两列卡片（窄屏单列）：名称、说明（有才显示）、链接胶囊按钮（主链接金色）。
3. 「其他工具」用原生 `<details>` 折叠：胶囊样式的展开按钮，展开后先显示原有提醒「这些工具已经停更，请勿使用」（金色小字），停更的工具卡片调暗。

## Implementation Decisions

- 工具列表数据、链接、打开方式（`window.open`）不变；`tests/good-import.test.mjs` 会检查 GOODScanner 链接仍在页面源码里。
- `el-card`、`el-button-group`、`el-collapse`、`el-alert` 换成普通元素，文字不变。

## Testing Decisions

- 用 `@vue/compiler-sfc` 编译两个组件，确认没有模板错误、GOODScanner 链接仍在。
- 浏览器实测：桌面深色（展开「其他工具」）、浅色手机宽度。

## 记下未处理

- 椰羊的「下载地址」不是 GitHub 链接，却用了 GitHub 图标（原数据就是这样，本次没改）。

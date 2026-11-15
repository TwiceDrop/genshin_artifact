# 01: 抽屉外壳和配色改成共用

**What to build:** 把计算器的抽屉外壳和配色移到共用位置，圣遗物页也能用。

**Blocked by:** None (can start immediately)

**Status:** done

规格见 `../spec.md` 实现决定 1。

- [x] `CalcDrawer.vue` 移到 `src/components/misc/SideDrawer.vue`，计算器改用新路径，样式 class 同步改名
- [x] `calculator-theme.css` 移到 `src/styles/content-theme.css`，在 `main.ts` 全局引入；选择器改成 `.cx-scope`（以及抽屉）
- [x] 计算器内容区加 `cx-scope`；计算器外观不变
- [x] 验证：计算器页深色、浅色各看一次，打开一个抽屉

## Comments

- 2026-11-15：EP 主色映射原来靠 `.calc-content[data-theme]` 压过计算器旧「雾蓝」主题的 scoped 规则，改成 `.cx-scope` 后优先级不够，加了 `html[data-color-mode]` 前缀。验证：计算器页深色打开配装设置抽屉，抽屉 class 为 `side-drawer`，选中的单选按钮是金色，内容区底色是 `--cx-ground`。

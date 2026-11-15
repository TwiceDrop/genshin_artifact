# 01: 抽屉外壳和配色改成共用

**What to build:** 把计算器的抽屉外壳和配色移到共用位置，圣遗物页也能用。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

规格见 `../spec.md` 实现决定 1。

- [ ] `CalcDrawer.vue` 移到 `src/components/misc/SideDrawer.vue`，计算器改用新路径，样式 class 同步改名
- [ ] `calculator-theme.css` 移到 `src/styles/content-theme.css`，在 `main.ts` 全局引入；选择器改成 `.cx-scope`（以及抽屉）
- [ ] 计算器内容区加 `cx-scope`；计算器外观不变
- [ ] 验证：计算器页深色、浅色各看一次，打开一个抽屉

## Comments

# 01: 默认深色模式

**What to build:** 没在设置里选过外观的玩家，打开就是深色界面。

**Blocked by:** None (can start immediately)

**Status:** done

规格见 `../spec.md` 实现决定 5。

- [x] `src/styles/color-mode.mjs` 在没有 `?theme=` 参数、也没有存过 `mona_color_mode` 时，默认值由 `auto` 改为 `dark`
- [x] 已存的 `mona_color_mode`（light / dark / auto）读出后照原样生效，不迁移、不改写
- [x] 设置页的外观选项和文字不变；确认设置页在未存值时显示为「深色」而不是「跟随系统」
- [x] 新移动 UI 共用这份默认值，确认它也默认深色
- [x] 验证：清空存储后打开首页是深色；存过 light 的浏览器打开仍是浅色

## Comments

- 2026-11-15：`color-mode.mjs` 未存值时默认 `dark`。新移动 UI 走同一个 `main.ts` 入口，共用这份默认值。验证：内置浏览器里 `mona_color_mode` 为空时首页和设置页是深色，设置页选中「深色」。「存过 light 仍是浅色」走原有读取逻辑未改，只核对了源码，没在浏览器实测。

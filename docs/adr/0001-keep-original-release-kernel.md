# 保留原始发布内核，不用 Rust 源码重编译覆盖

`mona_wasm/pkg/mona_wasm_bg.wasm` 来自上游 v5.33.58 发布物，仓库里的 Rust 源码与这个二进制的角色覆盖并不相同，重编译会丢掉只存在于二进制里的角色与公式。因此原始发布内核保留原样，新角色和新效果走扩展内核、效果桥接内核和 JS 适配层；以实际运行的 WASM 为准，文档或来源数据更新也不重编译覆盖它。

## Consequences

- 改 `mona_core` 等 Rust 源码只影响扩展内核（`npm run build:beta-kernel`），不影响原始发布内核。
- 原始内核里的部分反应系数仍被桑多涅／瑞希的技能直伤借用，删除公开入口时不能顺手删同名私有字段。
- `npm run setup:release` 是恢复原始发布内核的唯一途径，来源与校验值记录在 `THIRD_PARTY_NOTICES.md`。

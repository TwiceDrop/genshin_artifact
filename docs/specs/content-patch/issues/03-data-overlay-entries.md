# 03: 数据覆盖层与三个入口

**What to build:** 在加载数据的地方加一个统一的覆盖步骤：先读覆盖层里被补丁替换的数据，没有就用安装包里的原数据。浏览器入口、四人轴 Worker 和 Node 测试入口共用这一份实现。

**Blocked by:** 01

**Status:** ready-for-agent

规格见 `docs/specs/content-patch/spec.md` 的「能热更的范围」。本任务不涉及下载和存储，覆盖数据先由调用方传入。

现状：三处各自加载同一批数据文件，再交给 `composeKernelApi({data})`：

- `mona_wasm/pkg/index.js`（页面）
- `src/wasm/team-dps-native-api.mjs`（四人轴 Worker，自己组装包装链）
- `beta-tools/runtime.mjs`（Node 测试和冒烟）

- [ ] 新增一个覆盖函数：输入「安装包原数据」和「覆盖层数据」，输出合并后的数据对象；只允许替换登记表内的项，其他项原样保留
- [ ] 登记表第一版只含走 `composeKernelApi({data})` 的几项：武器 JSON、签名武器 JSON、`vodyanitsa`、`extension-support`、角色数据。`weapons-expanded-runtime.mjs` 等静态导入的模块数据不进第一版（见规格「待开发者决定」第 6 条）
- [ ] 三个入口都在调用 `composeKernelApi` 之前调用这个覆盖函数。覆盖数据为空时输出和现在完全一致
- [ ] 包装链顺序只写在 `compose-kernel-api.mjs`，不要为了补丁在三个入口各加一段逻辑；覆盖函数放在 `beta-data/` 下，三处只调用
- [ ] 覆盖数据来自入口之外传入的参数。页面和 Worker 如何拿到覆盖层由任务 04 处理，本任务用测试夹具传入
- [ ] 扩展 `tests/kernel-entry-composition.test.mjs`：确认三个入口都经过覆盖函数
- [ ] 测试：用一份把某把武器数值改掉的覆盖，确认伤害计算结果变化，且没有被覆盖的武器结果不变；覆盖为空时与不调用覆盖函数的结果逐项一致
- [ ] 验证：跑 `kernel-entry-composition` 测试、新增的覆盖测试，以及一个现有的武器计算测试

## Comments

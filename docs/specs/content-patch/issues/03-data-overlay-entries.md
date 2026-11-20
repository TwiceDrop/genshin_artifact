# 03: 数据覆盖层与三个入口

**What to build:** 在加载数据的地方加一个统一的覆盖步骤：先读覆盖层里被补丁替换的数据，没有就用安装包里的原数据。浏览器入口、四人轴 Worker 和 Node 测试入口共用这一份实现。

**Blocked by:** 01

**Status:** done

规格见 `docs/specs/content-patch/spec.md` 的「能热更的范围」。本任务不涉及下载和存储，覆盖数据先由调用方传入。

现状：三处各自加载同一批数据文件，再交给 `composeKernelApi({data})`：

- `mona_wasm/pkg/index.js`（页面）
- `src/wasm/team-dps-native-api.mjs`（四人轴 Worker，自己组装包装链）
- `beta-tools/runtime.mjs`（Node 测试和冒烟）

- [x] 新增一个覆盖函数：输入「安装包原数据」和「覆盖层数据」，输出合并后的数据对象；只允许替换登记表内的项，其他项原样保留
- [x] 登记表第一版只含走 `composeKernelApi({data})` 的几项：武器 JSON、签名武器 JSON、`vodyanitsa`、`extension-support`、角色数据。`weapons-expanded-runtime.mjs` 等静态导入的模块数据不进第一版（见规格「待开发者决定」第 6 条）
- [x] 覆盖函数由 `composeKernelApi` 统一调用（新增可选参数 `overlay`），三个入口都经过它。覆盖数据为空时输出和现在完全一致
- [x] 包装链顺序只写在 `compose-kernel-api.mjs`，不要为了补丁在三个入口各加一段逻辑；覆盖函数放在 `beta-data/` 下，三处只调用
- [x] 覆盖数据来自入口之外传入的参数。页面和 Worker 如何拿到覆盖层由任务 04 处理，本任务用测试夹具传入
- [x] 扩展 `tests/kernel-entry-composition.test.mjs`：确认三个入口都经过覆盖函数
- [x] 测试：用一份把某把武器数值改掉的覆盖，确认伤害计算结果变化，且没有被覆盖的武器结果不变；覆盖为空时与不调用覆盖函数的结果逐项一致
- [x] 验证：跑 `kernel-entry-composition` 测试、新增的覆盖测试，以及一个现有的武器计算测试

## Comments

- 2026-11-20：已实现。和任务文件原文的出入：
  - 覆盖函数 `applyDataOverlay` 和登记表 `PATCHABLE_DATA` 在 `beta-data/data-overlay.mjs`，由 `composeKernelApi` 内部调用，入口只需传 `overlay` 参数，不在三个入口各调一次。这样包装顺序和覆盖都只写在 `compose-kernel-api.mjs` 一处。
  - 四人轴 Worker 的 `src/wasm/team-dps-native-api.mjs` 之前自己抄了一份包装链，没经过 `composeKernelApi`（现有的一致性测试只查了另两个入口）。为了让补丁也覆盖它，改成调用 `composeKernelApi`，包装顺序与原来逐项一致；数据和内核加载方式没动。`tests/kernel-entry-composition.test.mjs` 把它也加进检查。
  - 目前三个入口都没有传 `overlay`，页面和 Worker 怎么拿到覆盖层由任务 04 处理，所以行为和之前完全相同。
  - 覆盖函数对覆盖数据只做两项检查：键必须在登记表内，值必须是对象或数组，不通过抛 `DATA_OVERLAY_INVALID`（带 `stage: 'overlay'`），不跳过。登记表键与 `composeKernelApi` 的 `data` 参数一致，测试核对两者同步。
  - 测试里的覆盖用 `BeyondTheChrysalis` 90 级的 `subStat` 加 0.1，核对暴击伤害恰好多 0.1，另一把专武（`HymnOfTheMaelstrom`）的全部属性逐项不变。必须用凯亚这类非内核自带实现的角色：薇斯娜、沃迪尼察走内核自带的专武实现，不读这份行数据。专武行里的 `attack` 在这条路径上没有被使用。
  - `beta-tools/runtime.mjs` 额外导出了 `core`、`extension`、`data`，测试用它再组一份带覆盖的接口。
- 验证：`kernel-entry-composition`、新增的 `data-overlay`、`team-execution-scope` 共 12 项通过。`team-execution-scope` 的 Worker 测试会把 `team-dps-native-api.mjs` 换成 Node 入口的 `api`，没有真正加载改过的这个文件，所以另用 `vue-cli-service build --target lib` 单独打包了它，打包通过。没有在浏览器里实际跑四人轴，没有核对改前改后四人轴的计算结果。
- 任务文件里写的「Blocked by: 01」：本任务没有用到 01 的校验模块，登记表也由本任务定义，所以先做了。任务 01 会用这份登记表判断补丁路径。

# 接入新角色或新效果

分两条路径：四人固定轴（TeamDPS）里的角色包，以及单次伤害／配装用的 BUFF 规则。一个新角色通常两条都要走。动手前先读 `GLOSSARY.md` 和 `docs/adr/`。

## 原则

- 内部调用角色规则，外部只导入技能顺序。角色状态、天赋、命座与技能事件放在该角色自己的模块；附着、反应和装备走公共规则。
- 先复用原生能力和现有公共原语，只在缺少公共原语时扩展引擎。机制不在页面或 Worker 里复制。
- 概率状态保持相关性，按当前候选求值；技能快照、有限次数、治疗与资源遵守事件顺序。
- 普通命中、附着、反应伤害与额外攻击分开处理，触发资格按事件判断，与伤害数值是否为零无关。

## 四人固定轴：角色包

1. 在 `beta-data/team-engine/characters/` 新建 `<角色>.mjs`，导出角色包：身份（`id`、元素、武器类型）、`actions` 动作列表、默认武器、`nativeParameters`、`create()` 中的增益。可以参照 `vesna.mjs`、`faruzan.mjs`。
2. 资源、层数、持续时间等复杂状态写在 `<角色>-runtime.mjs`，由角色包的 `createTimeline`／`createCombat` 引用。
3. 在 `beta-data/team-engine/character-packages.mjs` 注册。目录和界面都由这份注册表投影出来，不另外维护角色列表。
4. 以下模块都在 `beta-data/team-engine/` 下：普通动作用 `action-recipes.mjs`；增益用 `effect-plan.mjs`、`effect-state.mjs`、`effect-resolver.mjs`；附着与反应用 `elemental-runtime.mjs` 和反应模块；装备用 `equipment-effects.mjs`，以及 `beta-data/equipment-axis-rules.mjs`。
5. 补一份 `tests/team-<角色>-*.test.mjs`。关键倍率和时序写独立预期值，CPU／GPU 结果一致不能代替规则正确性证明。数据用 `tests/helpers/` 里的合成夹具。
6. 动作轴样例放到 `examples/team-dps/`，只放合成配置。

## 单次伤害与配装：BUFF 规则

1. **确定范围。** 读实际入口和 `docs/dev/formula-scope.md`，确认目标角色、技能、状态、BUFF、敌人和目标函数。优先查公共参数转换和共享逻辑，再查角色特例。
2. **最小合成复现。** 用户仓库不做固定测试。纯单次对比不能意外带入会改写伤害目标的配装参数。
3. **写清数据合同。** 来源、受益者、伤害类型、触发／退出条件、参数单位／默认值／边界、是否叠加、各乘区位置。
4. **改共享规则。** 在现有 rule book 中表达新效果，让公共引擎编译到实际消费的属性；必要时扩展属性或桥接。用真实实现代替名称白名单。
5. **接完整调用链。** 核对 `CalculatorInterface.get_damage_analysis`、`CommonInterface.get_attribute`、`OptimizeSingleWasm.optimize`、`BonusPerStat.bonus_per_stat`；支持 DSL 的路径再核对 `DSLInterface.run`。套装参数别名、敌人、停用 BUFF、默认参数在共用入口处理。
6. **同步两个入口。** `mona_wasm/pkg/index.js`（浏览器）和 `beta-tools/runtime-7106.mjs`（Node）的包装顺序保持一致，再核对 `src/workers/optimize_artifact.js`。
7. **同步界面。** 更新目录、参数、翻译和可见伤害分支，只显示与当前技能相关的结果。新增界面文案先给开发者确认。

## 完成标准

- 新角色在注册表、目录、界面三处一致，单次、面板、DSL、配装和词条收益五个公共入口都能算出有限数值。
- 新增测试覆盖本次改动的关键倍率或时序，并按 `AGENTS.md` 的验证上限选择。
- 需要的话更新 `docs/dev/current-state.md` 里的动作轴人数。

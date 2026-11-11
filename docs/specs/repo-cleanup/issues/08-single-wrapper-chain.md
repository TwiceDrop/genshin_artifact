# 08: 把两份包装链收拢成一份

**What to build:** 浏览器入口和 Node 入口调用同一个组合模块得到九个接口对象，改注册或包装顺序只需要改一处。`AGENTS.md` 里「两处同改」那条规则可以随之删除。

现状：`mona_wasm/pkg/index.js` 和 `beta-tools/runtime-7106.mjs` 各手写了一遍十几层的包装调用。测试走 Node 入口，页面走浏览器入口，两处不一致时测试发现不了。

**Blocked by:** None (can start immediately)

**Status:** done

这是本规格里唯一改动计算入口的任务。动手前先读 `docs/dev/formula-scope.md` 和 `docs/adr/0001-keep-original-release-kernel.md`；包装的先后顺序、传入每一层的参数一个都不能变，只改变「写在哪里」。两个入口现在的包装链如有差异，先停下来把差异列给开发者，不自行选择以哪边为准。

- [x] 在适配层新增一个组合模块：输入是已经加载好的原始接口、扩展内核和各份数据，输出是九个接口对象；包装顺序只写在这里
- [x] 浏览器入口只负责用 fetch 加载内核和静态导入数据，然后调用组合模块
- [x] Node 入口只负责读文件加载内核和数据，然后调用同一个组合模块
- [x] 新增一条测试，证明两个入口的包装链来自同一个模块
- [x] 走 Node 入口的现有测试：`refactor-7108-pilot`（单次伤害）、`illuga-index-7201`（含配装和词条收益）、`dsl-generator-7201`（DSL）、`panel-search-7203`（面板配装）全部通过
- [x] 同等配置构建成功；页面上默认角色的伤害为 341／429／286，与改动前一致，控制台无报错。页面上的配装没有跑：这个浏览器配置里没有圣遗物仓库，配装路径由 Node 入口的 `illuga-index-7201` 覆盖
- [x] 更新 `AGENTS.md`、`docs/dev/add-character.md`、`docs/dev/architecture.md` 里关于两处同步的描述

## Comments

- 2026-11-11：两个入口的包装链逐层比对完全一致，没有差异需要开发者裁决。新模块是 `beta-data/compose-kernel-api.mjs`。Node 入口原先读了 `_gen_buff.js` 又没用到，也引入了没用到的 `deriveTeamBuffs`，收拢时一并去掉。
- `tests/all-character-entry-7108.test.mjs` 有 3 个用例失败，改动前后失败内容逐行相同，属于测试本身的问题，没有处理。

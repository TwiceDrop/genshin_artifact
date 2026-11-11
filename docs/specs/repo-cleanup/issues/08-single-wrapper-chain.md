# 08: 把两份包装链收拢成一份

**What to build:** 浏览器入口和 Node 入口调用同一个组合模块得到九个接口对象，改注册或包装顺序只需要改一处。`AGENTS.md` 里「两处同改」那条规则可以随之删除。

现状：`mona_wasm/pkg/index.js` 和 `beta-tools/runtime-7106.mjs` 各手写了一遍十几层的包装调用。测试走 Node 入口，页面走浏览器入口，两处不一致时测试发现不了。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

这是本规格里唯一改动计算入口的任务。动手前先读 `docs/dev/formula-scope.md` 和 `docs/adr/0001-keep-original-release-kernel.md`；包装的先后顺序、传入每一层的参数一个都不能变，只改变「写在哪里」。两个入口现在的包装链如有差异，先停下来把差异列给开发者，不自行选择以哪边为准。

- [ ] 在适配层新增一个组合模块：输入是已经加载好的原始接口、扩展内核和各份数据，输出是九个接口对象；包装顺序只写在这里
- [ ] 浏览器入口只负责用 fetch 加载内核和静态导入数据，然后调用组合模块
- [ ] Node 入口只负责读文件加载内核和数据，然后调用同一个组合模块
- [ ] 新增一条测试，证明两个入口的包装链来自同一个模块
- [ ] 走公共入口的现有测试挑四份跑通（单次伤害、配装、词条收益、DSL 各一）
- [ ] `npm run build:local` 成功，页面上跑一次配装得到结果
- [ ] 更新 `AGENTS.md`、`docs/dev/add-character.md`、`docs/dev/architecture.md` 里关于两处同步的描述

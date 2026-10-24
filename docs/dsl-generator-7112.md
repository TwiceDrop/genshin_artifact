# 7.1.12 DSL生成器同步（2026-10-23）

## 范围与实现

按用户要求从7.2.01EA同步DSL生成器到7.1.12。以本版src/assets/_gen_character.js为角色范围，技能名称映射只保留141个角色、2178个索引映射；米提亚、瓦列里未加入，未复制EA角色、武器、版本或内核文件。

新增src/pages/NewArtifactPlanPage/DslGenerator.vue、src/algorithms/dsl-generator.mjs及beta-data/dsl-skill-names.json。计算器新增第三个「DSL生成器」页签，按当前角色列出技能，默认依据当前版本实际内核结果筛选伤害类型；支持期望/暴击/非暴击、附魔、技能参数快照、次数/权重、移除和重置。生成结果复用已有DSL与单人优化接口。

已有普通和MONA-DSL页签保留。预设新增可选targetMode、dslGenerator字段，仅在用户保存时写入当前预设；未改变预设存储版本、迁移逻辑或用户存档。缺少新字段的旧预设继续按原useDSL与dslSource恢复，普通目标也按原保存名称恢复；不把旧终奏预设改为生命值目标。

## 三个定向验证目的

1. 角色映射和真实计算：141角色所有界面技能索引均有合法映射，米提亚/瓦列里明确不存在。安柏技能参数、凯亚附魔、沃雅妮莎扩展角色、桑多涅星伤、荧冰五类样本的生成DSL执行及单人Naive优化均与对应单次结果一致；空组合生成result = 0。命令：node --test tests/dsl-generator-7112.test.mjs。
2. 构建与本地交付：build:local通过，保留已有资源体积警告。dist已同步至../launcher/dist，原启动EXE、版本7.1.12、4184端口及存档位置不变；构建生成的components.d.ts已恢复构建前内容。
3. 实际生产页面：隔离Chrome从本版launcher/dist加载，添加安柏两项技能、保存生成器预设、重置、重新加载均通过。旧普通预设保留VodyanitsaDefault，旧MONA-DSL预设保留result = 17；保存新预设和多次刷新/恢复前后，两个旧合成预设的持久化记录完全相同。430px窄屏弹窗可横向滚动，未捕获页面异常为0。生产构建不暴露页面setupState，验证改用实际UI及隔离IndexedDB合成存档后通过，未读取用户浏览器数据。

证据目录：.build-target/dsl-generator-7112，包含core.log、build.log、browser.log/json、generator.png、mobile.png及browser.mjs。浏览器使用临时测试端口，不改变实际应用端口。

未改7.2.01EA或历史项目，未改README，未生成安装包/ZIP/APK、未发布。本轮只同步生成器；其余已记录的待修复问题维持原状态。

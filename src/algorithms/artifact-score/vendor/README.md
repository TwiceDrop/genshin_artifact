# 喵喵评分来源

角色规则直接取自 yoimiya-kokomi/miao-plugin，MIT，固定提交 4b6cf4c2845a143ef6d99d3fcafe4033b814f55c。版权声明见 LICENSE.miao。rules/ 中的文件仅调整导入路径；weights.mjs 为上游 artis-mark.js。character-facts.mjs 为游戏基础数值，不含账号数据。

miao.mjs 是本项目的独立接口，按上游 ArtisMark.js、ArtisMarkCfg.js、extra.js 的归一化方式计算。保留本项目的默认玛薇卡精通流、具名流派权重优先约定。默认评分使用基础攻击加武器攻击 520 的固定归一化；它是装备评分，不是伤害或培养完成度。

单件角色排名默认使用对应角色的默认流派，旅行者取最优元素；普通分是角色排名前半数平均分。齐五件总评分按平均分划分 D/C/B/A/S/SS/SSS/ACE/MAX，缺件不显示毕业档位。未配置角色显示待适配。规则不会联网自动更新。

本发行版没有再分发 BetterGI 的独立评分适配脚本。

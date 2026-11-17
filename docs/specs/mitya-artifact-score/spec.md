Status: done

# 喵喵评分适配米提亚

来源：[Notion「喵喵面板适配米提亚」](https://app.notion.com/p/4149fe6be6ef802e92f6f3c9588dc05f)。任务正文为空，本次范围为已有喵喵圣遗物评分接入米提亚。

## 问题与实现

默认权重表已有米提亚，但 `vendor/character-facts.mjs` 缺少其基础属性和元素。评分器会过滤没有基础属性的角色，导致面板显示「待适配」、没有词条详情，并且角色排序列表不包含米提亚。

补齐米提亚的 `baseAttr`（生命 12460.48、攻击 322.29、防御 847.87）和雷元素映射。数据与项目固定喵喵提交 [fbabcc0c0952c01212c8491b0af9ec3b252a4ba2 的角色资料](https://raw.githubusercontent.com/yoimiya-kokomi/miao-plugin/fbabcc0c0952c01212c8491b0af9ec3b252a4ba2/resources/meta-gs/character/%E7%B1%B3%E6%8F%90%E4%BA%9A/data.json) 一致。

沿用已有默认权重：暴击率、暴击伤害、元素精通各 100，充能效率 40，其余为 0。无需更改评分算法、伤害内核或界面文案。

## 验收

- 米提亚出现在角色评分选择列表与单件角色排名中，元素为雷，排名没有重复项。
- 单件得分、五件总分、词条详情一致；缺件显示「未齐装」，不再显示「待适配」。
- 双暴和精通词条有效，攻击与普通雷伤杯主词条按现有权重不计分；一个合成花部位样例具有独立公式预期值。
- `node --test tests/artifact-score.test.mjs`：11 项通过，包含原有角色评分回归与新增 3 项米提亚检查。
- 尚未浏览器实测或客户端打包，Notion 任务保持「待验证」。

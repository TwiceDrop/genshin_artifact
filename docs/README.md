# 莫娜占卜铺文档导航

新增、归档或移动文档，以及发布新版说明时更新本页。

| 文档类型 | 何时维护 |
| --- | --- |
| 常青文档 | 玩家手册、开发文档、术语表与本索引使用无版本号的文件名。行为变化时按文首提示原地更新，其他文档链接到同一份说明。 |
| 冻结记录 | 规格、架构决策、发布说明和历史记录完成后封存。规格标为 done 前把跨版本约定提炼到常青文档。旧决策被替代时标记 Superseded 并链接新决策。 |

## 玩家使用

- [玩家使用手册](user-guide.md)按导入、单人配装、四人轴和换机备份讲解当前入口。
- [本地功能详解](local-features.md)收录了词条收益曲线、评分和穿戴保护的操作示例。7.2.06.04 发布版的米游社扫码入口暂时关闭，开放状态见[当前版本状态](dev/current-state.md)。
- [7.2.06.04 更新说明](release-7.2.06.04-final.md)列出了本版的导入变化。

## 开发者文档

| 要做的事 | 从这里开始 |
| --- | --- |
| 了解项目约定、术语和当前支持范围 | [开发约定](../AGENTS.md) · [术语表](../GLOSSARY.md) · [当前版本状态](dev/current-state.md) |
| 查模块边界、依赖和本地验证命令 | [架构](dev/architecture.md) · [技术栈](dev/tech-stack.md) · [构建与测试](dev/build-and-test.md) |
| 接角色或核对伤害计算 | [接入新角色或新效果](dev/add-character.md) · [公式与属性作用域](dev/formula-scope.md) · [月曜技能直伤](lunar-damage-model.md) |
| 核对评分来源、迁移结果或登录协议 | [角色评分适配记录](character-score-20261002.md)供评分实现追溯来源；[角色 BUFF 迁移清单](character-buff-migration-7108.md)由报告脚本生成；[HoYoLAB 登录记录](hoyolab-login-7202-20261031.md)供服务端查协议依据。 |
| 修改界面或首页入口 | [前端布局、路由与配色](dev/frontend-ui.md) |
| 联调本机 API、排查存储或打包客户端 | [服务与多端打包](dev/services-and-platforms.md) |
| 准备发布或启用统计 | [发版核对](dev/release-checklist.md) · [使用统计部署步骤](dev/usage-stats-rollout.md) |

## 架构决策与规格

- [架构决策目录](adr/)记录长期取舍，包括[保留原始发布内核](adr/0001-keep-original-release-kernel.md)和 [Tauri 封装定位](adr/0002-tauri-shell-stays-experimental.md)。
- [规格与任务约定](specs/README.md)说明状态字段和文件结构。按功能查找请进[规格目录](specs/)。

## 发布记录与历史归档

- 7.2 系列：[7.2.06.04](release-7.2.06.04-final.md) · [7.2.06.03](release-7.2.06.03-final.md) · [7.2.06.02](release-7.2.06.02-final.md) · [7.2.06-hotfix1](release-7.2.06-hotfix1-final.md) · [7.2.06](release-7.2.06-final.md) · [7.2.05EA](release-7.2.05EA.md) · [7.2.05](release-7.2.05-final.md) · [7.2.04](release-7.2.04-final.md) · [7.2.03](release-7.2.03-final.md) · [7.2.02](release-7.2.02-final.md) · [7.2.01](release-7.2.01-final.md)
- 7.1 系列：[7.1.12](release-7.1.12-final.md) · [7.1.11](release-7.1.11-final.md) · [7.1.10](release-7.1.10-final.md) · [7.1.09](release-7.1.09-final.md) · [7.1.08](release-7.1.08-final.md) · [7.1.07](release-7.1.07-final.md)

[历史归档](history/)保留各版本的交接、核对和单次调研。

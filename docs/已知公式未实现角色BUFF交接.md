当前发布：7.1.07 正式版已发布，提供网页、Android 和 Windows 安装包，保留 Debug。当前发布说明见 release-7.1.07-final.md；下文保留公式与实现过程记录。

# 角色BUFF交接：v7.1.07当前状态

2026-09-27：此前剩余12项已接入，目录257项的命名缺口为0；当前适配器125条。详细公式、范围、来源与后续限制见 [v7.1.07实现说明](release-7.1.07.md)，覆盖统计见 [覆盖表](unified-buff-coverage.md)。不要继续按旧12项表重复实现。

当前公开源码以 GitHub 主分支及 v7.1.07 标签为准。正式版已发布；后续开发应使用清理后的源码历史，避免旧本地副本重新引入私人样本。

本轮完成名称：CynoC2StellarConduct、KleeC1、TravelerElements、TravelerEnhancedAttribute、AetherCryoTalent1、AetherCryoC6、YaeMikoC1、NahidaC2、DurinTalent2、DurinC2、IfaTalent2、AlyoshaHunterPrecision。

已构建扩展WASM，原发布WASM不变。继续保留两内核；新增手动单次面板不依赖旧角色技能实现。命名BUFF接入不表示所有角色技能、自动联动、武器状态及联合优化已完成。没有手动配方的旧复合BUFF明确报错；用户可先计入普通面板。固定面板禁止进入优化。

下一阶段若扩大范围，应先明确要补的角色技能或计算入口；不要删除原拦截。星扩散3～4人近似继续标注；无需重复向用户索要已确认的月曜、独立倍率公式。测试继续最多5项。

旧公式与调研记录存档：[7.1.06交接快照](history/7.1.06-角色BUFF交接.md)。其中“待实现”“不构建”及阿罗夏缺资料均为历史状态。阿罗夏六命星超导两层40%，旧快照的20%描述已纠正。

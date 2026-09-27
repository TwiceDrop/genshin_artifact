当前发布：用户已实测 alpha2 正常，转为 7.1.07 正式版；保留 Debug，仅更新版本标识并构建网页及 Android。此次不运行额外测试，说明见 release-7.1.07-final.md。

当前更新：7.1.07alpha2 修复 alpha1 Debug 日志确认的 Worker 启动语法错误；恢复 Webpack 可识别的内联 URL 写法。只构建，不测试，不能据此宣称旧版全部报错已修复。详见 release-7.1.07alpha2.md。

> 最新调试交付：已构建7.1.07alpha1；按用户要求不测试，实际报错尚未完整定位。见 [alpha1说明](release-7.1.07alpha1.md)。

# 角色BUFF交接：v7.1.07当前状态

2026-09-27：此前剩余12项已接入，目录257项的命名缺口为0；当前适配器125条。详细公式、范围、来源与后续限制见 [v7.1.07实现说明](release-7.1.07.md)，覆盖统计见 [覆盖表](unified-buff-coverage.md)。不要继续按旧12项表重复实现。

工作区为 D:/Documents/ChatGPT/unified-kernel-work，分支codex/unified-kernel。含尚未提交的前批与本批修改，HEAD ce2fda9不代表当前成果。最新用户已授权构建v7.1.07，输出 D:/Documents/ChatGPT/v7.1.07；此前“不构建”要求已被覆盖。本轮没有GitHub发布操作。

本轮完成名称：CynoC2StellarConduct、KleeC1、TravelerElements、TravelerEnhancedAttribute、AetherCryoTalent1、AetherCryoC6、YaeMikoC1、NahidaC2、DurinTalent2、DurinC2、IfaTalent2、AlyoshaHunterPrecision。

已构建扩展WASM，原发布WASM不变。继续保留两内核；新增手动单次面板不依赖旧角色技能实现。命名BUFF接入不表示所有角色技能、自动联动、武器状态及联合优化已完成。没有手动配方的旧复合BUFF明确报错；用户可先计入普通面板。固定面板禁止进入优化。

下一阶段若扩大范围，应先明确要补的角色技能或计算入口；不要删除原拦截。星扩散3～4人近似继续标注；无需重复向用户索要已确认的月曜、独立倍率公式。测试继续最多5项。

旧公式与调研记录存档：[7.1.06交接快照](history/7.1.06-角色BUFF交接.md)。其中“待实现”“不构建”及阿罗夏缺资料均为历史状态。阿罗夏六命星超导两层40%，旧快照的20%描述已纠正。

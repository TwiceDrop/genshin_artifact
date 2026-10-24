# 莫娜占卜铺

原神圣遗物配装与伤害计算工具。当前正式版 **7.1.12**，提供 Windows 安装包、ZIP 便携包和两种 Android APK。

## 项目特色

在莫娜原有配装与伤害计算功能的基础上，本项目重点补充：

- **米游社角色导入**：扫码导入角色养成、武器及已装备圣遗物，支持多账号、UID 数据管理、荧的七元素身份及重复导入去重。未装备的背包圣遗物可使用 GOODScanner 等工具扫描后通过文件导入，支持 GOODScanner GOOD v3、YAS GOOD v1 和原 Mona 格式。
- **更直观的配装对比**：查看更换圣遗物前后的面板与伤害，结合角色喵喵评分、词条得分明细和 0～20 条最优词条收益曲线，判断提升方向。配装结果支持查看全部保留搭配、按期望／暴击／非暴击排序及点击换装。
- **组合目标与计算控制**：DSL 生成器可按技能、附魔、参数及次数／权重构建单人配装目标，并保存为预设；配装显示实时进度和阶段耗时，支持主动取消，不再设置 600 秒自动终止。沃雅妮莎新增最大生命值目标，直伤星扩散／星超导支持可编辑伤害明细。
- **7.1 角色与直伤适配**：接入沃雅妮莎、薇斯纳、银釭及相关队友 BUFF，保留角色技能、天赋和命座自身造成的星／月直伤，支持单次伤害和单人配装优化；旅行者按男女实际重击倍率计算。
- **软件内更新与筛选**：优先通过 CNB 检查和下载更新，CNB 无更新或查询失败后检查 GitHub；绿色推荐按钮直接下载，点击灰色其他源按钮后才展开并测速。预设支持元素筛选、最近更新／元素排序，圣遗物组支持名称搜索、中文拼音排序与完整配装角色头像。五类 BUFF 可连续添加。
- **多端本地使用**：Windows 与 Android 均可使用，支持文件导出与互传；保留 Debug 开关和本地调试包导出，方便排查计算问题。

## 安装说明

在 [CNB 7.1.12 下载页（推荐）](https://cnb.cool/twicedrop/genshin_artifact/-/releases/tag/v7.1.12) 或 [GitHub 7.1.12 下载页](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.12) 选择对应版本：

| 平台 | 下载与使用 |
| --- | --- |
| Windows 10/11（64 位） | 下载 [CNB EXE 安装包](https://cnb.cool/twicedrop/genshin_artifact/-/releases/download/v7.1.12/genshin_artifact_V7.1.12_windows_x64_setup.exe)（[GitHub](https://github.com/TwiceDrop/genshin_artifact/releases/download/v7.1.12/genshin_artifact_V7.1.12_windows_x64_setup.exe)），退出旧版后安装，从开始菜单打开。安装包自带 Node.js，无需另装。 |
| Android · Element Plus | 下载 [CNB APK 安装包](https://cnb.cool/twicedrop/genshin_artifact/-/releases/download/v7.1.12/genshin_artifact_V7.1.12_android.apk)（[GitHub](https://github.com/TwiceDrop/genshin_artifact/releases/download/v7.1.12/genshin_artifact_V7.1.12_android.apk)），在系统提示时允许安装。沿用本项目旧版包名和签名，可覆盖安装。 |
| Android · 新 UI 测试版 | 下载 [CNB 新 UI 测试 APK](https://cnb.cool/twicedrop/genshin_artifact/-/releases/download/v7.1.12/genshin_artifact_V7.1.12_mobiletest_android.apk)（[GitHub](https://github.com/TwiceDrop/genshin_artifact/releases/download/v7.1.12/genshin_artifact_V7.1.12_mobiletest_android.apk)）。使用独立包名 `com.mona.artifact.local.mobiletest`，可与旧 UI 版并存；两版数据各自保存，可通过文件导入互传。 |
| Windows ZIP 便携版 | 下载 [CNB ZIP 便携包](https://cnb.cool/twicedrop/genshin_artifact/-/releases/download/v7.1.12/genshin_artifact_V7.1.12_web.zip)（[GitHub](https://github.com/TwiceDrop/genshin_artifact/releases/download/v7.1.12/genshin_artifact_V7.1.12_web.zip)），解压后运行 `启动7.1.12.exe`。ZIP 已附带 Node.js；关闭日志窗口后软件驻留托盘，退出时使用托盘菜单。 |

## 其他

- **问题反馈**：请在 [Issues](https://github.com/TwiceDrop/genshin_artifact/issues) 提交，附上软件版本、操作步骤和错误截图。
- **BUG 反馈QQ群**：1087955401。
- **Debug 使用**：遇到计算报错时，开启“开始计算”下方的 Debug，复现后导出调试包。调试包包含当前角色、装备和计算配置，按需提供；刷新前先导出。
- **数据保存**：仓库和配装数据保存在本地，可通过「UID 数据」导出备份或互传。浏览器数据按访问地址分别保存，切换端口或浏览器不会自动共享。
- **更新说明**：完整改动见 [7.1.12 更新日志](docs/release-7.1.12-final.md)。
- **开源许可**：许可证见 [LICENSE](LICENSE)，第三方模块说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

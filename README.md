# 莫娜占卜铺

原神圣遗物配装与伤害计算工具。当前正式版 **7.1.07**，提供 Windows 安装包、Android APK 和网页版。

## 项目特色

在莫娜原有配装与伤害计算功能的基础上，本项目重点补充：

- **米游社角色导入**：扫码导入角色养成、武器及已装备圣遗物，支持多账号、UID 数据管理和重复导入去重。未装备的背包圣遗物仍需扫描或文件导入。
- **更直观的配装对比**：查看更换圣遗物前后的面板与伤害，结合圣遗物评分和 0～20 条最优词条收益曲线，判断提升方向。
- **7.1 角色与反应适配**：接入沃雅妮莎、薇斯纳及相关武器、队友 BUFF，补充已确认的星／月反应公式；未确认效果保留提示。
- **单次伤害手填计算**：可以自己提供主 C 面板，再添加队友 BUFF，计算指定的一击。
- **多端本地使用**：Windows 与 Android 均可使用，支持文件导出与互传；保留 Debug 开关和本地调试包导出，方便排查计算问题。

## 安装说明

在 [7.1.07 下载页](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.07) 选择对应版本：

| 平台 | 下载与使用 |
| --- | --- |
| Windows 10/11（64 位） | 下载 [EXE 安装包](https://github.com/TwiceDrop/genshin_artifact/releases/download/v7.1.07/genshin_artifact_V7.1.07_windows_x64_setup.exe)，退出旧版后安装，从开始菜单打开。安装包自带 Node.js，无需另装。 |
| Android | 下载 [APK 安装包](https://github.com/TwiceDrop/genshin_artifact/releases/download/v7.1.07/genshin_artifact_V7.1.07_android.apk)，在系统提示时允许安装。沿用本项目旧版包名和签名，可覆盖安装。 |
| 网页版 | 下载 [网页 ZIP](https://github.com/TwiceDrop/genshin_artifact/releases/download/v7.1.07/genshin_artifact_V7.1.07_web.zip)，安装 Node.js 20 或更新版本，解压后运行 `启动7.1.07.bat`，访问 http://127.0.0.1:4183/#/calculate 。使用时保留服务窗口。 |

## 其他

- **问题反馈**：请在 [Issues](https://github.com/TwiceDrop/genshin_artifact/issues) 提交，附上软件版本、操作步骤和错误截图。
- **Debug 使用**：遇到计算报错时，开启“开始计算”下方的 Debug，复现后导出调试包。调试包包含当前角色、装备和计算配置，按需提供；刷新前先导出。
- **数据保存**：仓库和配装数据保存在本地，可通过「UID 数据」导出备份或互传。浏览器数据按访问地址分别保存，切换端口或浏览器不会自动共享。
- **开源许可**：许可证见 [LICENSE](LICENSE)，第三方模块说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

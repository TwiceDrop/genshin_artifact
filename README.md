# 莫娜占卜铺 · 7.1.05

原神 7.1 桌面与安卓计算器。沃雅妮莎、薇斯纳及专武，以及「新枝」「凝雪沉心」「柔风游弦」和至冬纪行、锻造武器均已接入。详细配置见[使用说明](7.1.05使用说明.md)。

- 两把专武支持精炼 1～5、等级 1～90 与突破前后属性。漩流颂歌可自定义最终生命值；蝶变的三种效果可分别设置覆盖率。
- 修复专武错误的角色限制：同类型角色均可装备漩流颂歌或蝶变，基础攻击与副词条正常进入面板，满足条件时计算武器特效。漩流颂歌产生的队友加攻在「武器」BUFF 中配置。
- 新增薇斯纳的队友增益：按来源最终攻击力和覆盖率提高星扩散基础伤害。
- 13 把四星武器支持精炼、等级、特效和覆盖率；直接回能另显示触发机会利用率。
- 梦见月瑞希、七七、桑多涅等角色的星扩散加强已接入配装、伤害及收益曲线；计算范围见[角色加强说明](beta-data/strengthened-notes.md)。
- 启动时可检查 GitHub Release 更新并查看更新日志；「关于」页可手动检查。主页的 YAS 入口已更新到维护中的项目。
- 本版是部分修复：新增套装、星/月反应、理论排行及旧角色使用新武器的部分路径仍受限制，详见[更新说明](7.1.05更新说明.md)。
- 保留米游社导入、UID 数据管理、伤害对比与词条收益等功能。

[下载 7.1.05 电脑版、安卓版](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.05) · [更新说明](7.1.05更新说明.md) · [武器数据与范围](beta-data/limited-71-notes.md) · [原项目](https://github.com/wormtql/genshin_artifact)

安卓版沿用原版包名与签名，可覆盖安装并保留本机数据；安装与互传说明见[安卓使用说明](docs/android-offline.md)。

## 启动

Windows 安装包自带 Node.js，无需另装；也可下载网页压缩包，安装 Node.js 22 LTS 或更新版本后解压双击 `启动7.1.05.bat`，打开 http://127.0.0.1:4183/#/calculate 。从源码启动：

```powershell
npm ci
npm run build:local
node script/start-local.mjs
```

WASM、生成元数据和图片资源已随源码提供。不要运行旧版 `setup:release`、`build:wasm` 或 `gen_meta` 覆盖当前扩展。账号凭据保存在本地 `.local-data`，可用 `MONA_DATA_DIR` 指定目录；发布包不含账号数据。升级或换端口前可通过「UID 数据」导出浏览器中的仓库数据。

## 正式版核对

对照[原神 7.1 更新公告](https://ys.mihoyo.com/main/news/detail/166392)与 Gachabase `release` 版本 `7.1.0 D48145775 / R48145775`：两名新角色的技能倍率、被动与命座参数，两把专武的全部精炼和等级数据，以及 13 把相关四星武器的全部精炼和等级数据，与项目已有数值一致。运行时武器表已切换到[正式版提取数据](beta-data/weapons-release-71.json)。角色完整时间轴、部分乘区、旧角色武器等级插值与多人联合配装仍有限制，详见使用说明。

本次提供源码、Windows 安装包、桌面网页包与 Android APK。保留原项目 LICENSE，第三方模块说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

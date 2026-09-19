# 莫娜占卜铺 · 7.1.01 beta1

基于本地 beta3 的桌面网页预发布版。新增沃雅妮莎、薇斯纳及专武配置，修复沃雅妮莎占位背景遮挡页面的问题。

- 两把专武支持精炼1～5、1～90级及突破前后属性。
- 漩流颂歌可自定义用于生命转攻击的最终生命值；填0跟随装备者面板。
- 蝶变可分别设置暴伤、星扩散增伤、回能三项覆盖率。
- 保留米游社导入、UID 数据管理、伤害对比与词条收益等功能。

[版本详情与计算限制](<7.1.01 beta1使用说明.md>) · [预发布下载](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.01-beta1) · [已有 V7.0.11 正式版](https://github.com/TwiceDrop/genshin_artifact/releases/tag/V7.0.11)

## 启动

需要 Node.js 22 LTS 或更新版本。下载源码后运行：

```powershell
npm ci
npm run build:local
node script/start-local.mjs
```

以后可双击 `启动7.1.01 beta1.bat`，访问 http://127.0.0.1:4183/#/calculate 。若下载的是发布页的 `genshin_artifact_7.1.01-beta1_web.zip`，网页已经构建，可直接双击启动（仍需 Node.js）。

WASM、生成元数据和图片资源已经随源码提供。不要运行旧版 `setup:release`、`build:wasm` 或 `gen_meta` 覆盖当前扩展。

账号凭据默认保存在本地 `.local-data`，可用 `MONA_DATA_DIR` 指定目录；发布包不含账号数据。网页仓库数据仍随浏览器站点保存，升级和换端口前可通过「UID 数据」导出备份。

## 数据范围

`7.1.01 beta1` 是本项目发布名称。角色与武器数据目前基于测试服 `7.0.54 / D48100502`，不代表正式服全部机制已确认。两把新专武的直接装备计算目前对应各自角色；漩流颂歌队友加攻支持已有角色。星扩散完整时间轴、部分乘区及多人联合配装仍有限制，详见版本说明。

本次只发布源码与桌面网页包，不提供新版安卓 APK 或 Windows 安装程序；仓库保留的原打包脚本属于旧版发布流程。

## 校验

```powershell
npm run test:local
npm run test:beta
npm run test:beta2
npm run test:beta3
```

重编扩展需 Rust `nightly-2024-10-10-x86_64-pc-windows-gnu`、`wasm32-unknown-unknown` 目标、MinGW，以及 `wasm-bindgen-cli 0.2.92`。工具加入 PATH 后执行 `npm run build:beta-kernel`，再执行 `npm run build:local`。

## 来源

基于 [wormtql/genshin_artifact](https://github.com/wormtql/genshin_artifact) 及 [1803233552/genshin_artifact](https://github.com/1803233552/genshin_artifact)。保留原项目 LICENSE，第三方模块说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 及各模块目录。

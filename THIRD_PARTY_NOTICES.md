# 第三方来源与许可证

## 莫娜占卜铺

上游公开源码来源为 `1803233552/genshin_artifact`，提交 `beaced4d82619aa86920d0054ab6114b5fc5608f`；源自 wormtql 的莫娜占卜铺。MIT，版权声明见根目录 LICENSE，原作者署名保留。

当前运行用的 WASM、生成元数据与图片来自该上游的 v5.33.58 Windows 发布物：

https://github.com/1803233552/genshin_artifact/releases/tag/v5.33.58

原始安装包 SHA-256：`dc56d714ec0413ce4afff7e09dca3b2b6edcad237753e4dca9fb8b7bdf264034`。

WASM SHA-256：`fa42077784f9556dd312743bc1327bd475970c53146e4867191f3cad63005b90`。

`script/prepare-release.cjs` 提供校验与提取过程，只恢复发布物，不声称恢复未公开 Rust 源码。

## 喵喵评分

https://github.com/yoimiya-kokomi/miao-plugin

固定提交 `4b6cf4c2845a143ef6d99d3fcafe4033b814f55c`，MIT。许可证保存在 `src/algorithms/artifact-score/vendor/LICENSE.miao`，安装包内另存 `LICENSE.miao`。角色规则直接来源于该版本的 `resources/meta-gs/character/*/artis.js`，默认权重来自 `resources/meta-gs/artifact/artis-mark.js`。接口中的数学评分方式参考同版本 `ArtisMark.js`、`ArtisMarkCfg.js`、`extra.js`。

本发行版的评分接口为本项目实现，不包含 BetterGI 的独立评分脚本。算法功能曾参考其交互设计，感谢相关贡献者。

## 扫码登录

https://github.com/TwiceDrop/mhy-qdcode-to-cookie

来源提交 `1813583f97548fb7b9afddead548b13f92d4106a`。TwiceDrop 确認拥有本项目所用模块的全部版权，并于 2026-09-12 授权该模块以 MIT 许可随本项目发布。许可见 `server/vendor/twicedrop/LICENSE`。该项授权不改变上游仓库其余版本的许可标识。

## 运行库与游戏资源

V7.0.11 的 Windows 安装包包含 Node.js 22.23.2，来自 Node.js 官方 Windows x64 发行包；其许可证位于安装目录 `runtime/LICENSE`。本次 7.1.01 beta1 网页压缩包不捆绑 Node.js，使用用户自行安装的运行环境。

前端依赖及版本在 `package-lock.json` 中记录，包含 Vue、Element Plus、ECharts、Monaco Editor 等。各依赖按其自身许可证提供；构建时生成的许可证文件随对应资源一同分发。图标、字体及其他第三方素材按各自许可证提供。

游戏图片、角色/武器/圣遗物名称及资料属于相应权利人，本项目 MIT 许可不覆盖这些权利。

## 本次测试服扩展

`mona_wasm/extension/` 为本项目新增 Rust 源码编译出的扩展内核。角色、武器数据来源及核对版本见 `7.1.01 beta1使用说明.md` 与 `beta-data/weapons-beta3.json`；发布名称不改变数据来源的测试服版本标记。

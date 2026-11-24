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

## Agent skills

https://github.com/mattpocock/skills

`.claude/skills/` 与 `.agents/skills/` 下的开发流程 skill 来自该仓库，安装时的上游提交为 `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`，各 skill 的来源路径记录在 `skills-lock.json`。MIT，Copyright (c) 2026 Matt Pocock，许可全文见 `docs/agents/LICENSE.mattpocock-skills`。

## 运行库与游戏资源

V7.2.02 Windows 包的 HoYoLAB 登录窗口使用 Microsoft Edge WebView2。随包分发的 WebView2 SDK 组件版本为 1.0.4129.50，许可证及声明位于 `runtime/hoyolab-login/LICENSE.txt`、`NOTICE.txt`；系统需要安装 Microsoft Edge WebView2 Runtime。

V7.0.11 的 Windows 安装包包含 Node.js 22.23.2，来自 Node.js 官方 Windows x64 发行包；其许可证位于安装目录 `runtime/LICENSE`。本次 7.1.01 beta1 网页压缩包不捆绑 Node.js，使用用户自行安装的运行环境。

Windows 安装器的简体中文界面使用 Inno Setup 社区翻译 `installer/ChineseSimplified.isl`，原样取自 https://github.com/jrsoftware/issrc 标签 `is-6_7_4`（提交 `c2913c993858a781fcb455bac8b8949c1c366cb8`）的 `Files/Languages/Unofficial/ChineseSimplified.isl`，维护者 Zhenghan Yang，按 Inno Setup 许可随安装器分发。

前端依赖及版本在 `package-lock.json` 中记录，包含 Vue、Element Plus、ECharts、Monaco Editor 等。各依赖按其自身许可证提供；构建时生成的许可证文件随对应资源一同分发。图标、字体及其他第三方素材按各自许可证提供。

欢迎页标题使用龙藏体（Long Cang），Copyright 2018 The Long Cang Project Authors，SIL Open Font License 1.1。`src/assets/fonts/long-cang-title.woff2` 是 Google Fonts 生成的子集，只含「莫娜占卜铺」五个字，许可全文见 `src/assets/fonts/OFL.long-cang.txt`。

游戏图片、角色/武器/圣遗物名称及资料属于相应权利人，本项目 MIT 许可不覆盖这些权利。

计算器角色卡和角色选择列表共用 `src/images/character-portraits/` 中的竖版立绘。素材来自米游社战绩角色立绘与[《原神》官网角色展示页](https://ys.mihoyo.com/main/character/natlan)的移动端透明立绘。

## 本次测试服扩展

`mona_wasm/extension/` 为本项目新增 Rust 源码编译出的扩展内核。角色、武器数据来源及核对版本见 `beta-data/weapons-beta3.json`；发布名称不改变数据来源的测试服版本标记。

## 圣遗物截图识别

开发页对单件截图进行备用识别时使用本地 [PP-OCRv6_tiny_det ONNX](https://huggingface.co/PaddlePaddle/PP-OCRv6_tiny_det_onnx/tree/2ba1506c0380b8f0b03dd142459aac66d4421f6c)（Apache-2.0）定位文字行。

开发页的米游社原神战绩分享图使用 [PP-OCRv6_tiny_rec ONNX](https://huggingface.co/PaddlePaddle/PP-OCRv6_tiny_rec_onnx/tree/2612ab37152ae0a677521bae4e1e3d4fb4cf7c30)（Apache-2.0）。`characters.json` 按模型 `inference.yml` 中的 CTC 字典顺序导出。模型、[ONNX Runtime Web 1.22.0](https://www.npmjs.com/package/onnxruntime-web/v/1.22.0) 的 WASM 运行时（MIT）及许可声明均保存在 `public/artifact-ocr/paddle-tiny/`。

仓库在本机使用 [Tesseract.js 6.0.1](https://github.com/naptha/tesseract.js)、[tesseract.js-core 6.0.0](https://github.com/naptha/tesseract.js-core) 和 4.0.0_best_int 的 [chi_sim](https://www.npmjs.com/package/@tesseract.js-data/chi_sim) 与 [eng](https://www.npmjs.com/package/@tesseract.js-data/eng) 模型。浏览器脚本、LSTM 内核、语言模型、Apache-2.0 许可证及随包声明保存在 `public/artifact-ocr/`。

## shadcn-vue Sidebar

侧栏组件取自 [shadcn-vue](https://github.com/unovue/shadcn-vue/tree/d1bf1b3a2d1a824b19f32d7253a28a43797b8253/apps/v4/registry/new-york-v4/ui/sidebar)，在本地适配 Vue 3.2 和项目主题。MIT 许可证及版权声明见 [src/components/ui/sidebar/LICENSE](src/components/ui/sidebar/LICENSE)。

## 角色天赋与命之座

普通攻击、元素战技、元素爆发及六阶命之座的名称、效果与图标标识来自 [genshin-db](https://github.com/theBowja/genshin-db/tree/8e5badd60b5d894284ccc927a56c9683529d2592/src/data)。图标属于 HoYoverse，取自 [Enka Network](https://enka.network/) 与 [Yatta](https://gi.yatta.moe/)，保存在本地供离线显示。

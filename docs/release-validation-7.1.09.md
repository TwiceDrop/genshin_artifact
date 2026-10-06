# 7.1.09 构建与发布核对

日期：2026-10-06。用户明确要求构建 7.1.09 并发布 GitHub，随后指定先修评分；评分修复完成后恢复该发布任务。开发源码为 D:/Documents/ChatGPT/v7.1.09/source，独立 Git 发布目录为 D:/Documents/ChatGPT/v7.1.09/source-publish，没有操作旧 Git 工作区或旧版成品。

## 本轮针对性验证

评分修复共五项有明确目的的验证，没有重新跑 Astra 已完成的 44 项清单：

| 项目 | 结果 |
| --- | --- |
| 1. 具名流派全局修正 | 实际 scoreBuild／scoreDetails 与固定喵喵原始函数的分数、明细、标题及权重一致。心海西风秘典 24.4、琴绿剑 41.9、绫华精通绝缘 53.5；心海无西风对照保持 10.0 |
| 2. 玛薇卡分支 | 精通 0／39／40／49 使用已有纯火／超载规则，50 保留精通权重 85，与上游一致 |
| 3. 绝缘权重 | 纳西妲充能 55→100、绫华 55→85、玛薇卡 0→75；无绝缘对照正确 |
| 4. 固定模板及默认排名 | 薇斯纳普通／直接星扩散两种固定评分模板保留；玛薇卡默认排名与上游一致 |
| 5. 实际编译评分入口 | 运行桌面 dist 和 Android dist-mobile 的现代／兼容 chunk 中实际公共 scoreBuild。心海西风 24.4、玛薇卡精通 0／50 分支 29.2／34.1、纳西妲绝缘 46.9，四套产物均一致 |

前四项详见 [评分修复记录](artifact-score-fix-7109.md)。第五项使用固定四个合成样例，未扫描全部角色或游戏组合；私有脚本及结果位于 .build-target/release-7109/compiled-score.mjs、compiled-score-results.json。初次验证器误加载 Worker 入口和误查被合并的内部导出，已修正为收集正常 chunk 并调用实际公共 scoreBuild；没有为此改动业务代码。

## 构建与包内容

Windows 前端和手机前端分别从当前源码构建，Windows ZIP、Inno Setup EXE 和签名 Android APK 构建成功。构建发现 GOOD 角色目录索引的 TypeScript 类型错误，已以 keyof typeof characterData 正确标注索引；没有改变位置名称转换语义。既有工具链的 CSS 顺序、包体大小和弃用警告仍保留，没有升级依赖。

- ZIP：genshin_artifact_V7.1.09_web.zip，59886575 字节，425 个网页文件逐文件回读与 dist 一致；附带原 Node 22.23.2 运行时、启动器及更新脚本。
- EXE：genshin_artifact_V7.1.09_windows_x64_setup.exe，44382518 字节，与 ZIP 使用同一 staging 目录；启动器与安装器数字版本为 7.1.9.0，启动器显示版本为 7.1.09。
- APK：genshin_artifact_V7.1.09_android.apk，28591672 字节，429 个网页文件逐文件回读与 dist-mobile 一致；签名验证通过。沿用已有升级签名，应用 ID com.mona.artifact.local、versionCode 70109、versionName 7.1.09，来源保持 https://localhost。
- ZIP／APK 未发现账号目录、Debug 导出、签名资料、依赖目录或私有构建证据。公开源码采用既有目录／文件允许清单，排除存档、导出、签名和缓存。没有新增哈希／SHA256 或摘要文件。

当前产物位于 D:/Documents/ChatGPT/v7.1.09。公开日志列出本版 15 条功能、修复与语义，README 按四部分更新下载、特色和安装说明；7.1.08 完整 44 条历史保留链接。

## 验证边界与发布状态

自动更新的合成下载／完整回读、取消、Windows 临时目录 ZIP 覆盖及 Astra 后续路径修复沿用既有证据；Android APK 大小读取为实际依赖和 API 合同核对。本轮没有执行真实 Windows 覆盖安装或 Android 后台下载、授权及覆盖安装。包体版本和签名通过不代表这些系统流程已实机重测。Android 系统导出／回读及 7.1.07 导出兼容沿用 7.1.08 已完成的证据，没有重新运行，也没有据此声称本轮重新验证。

当前完成构建与上传前核对，GitHub 正式发布结果将在发布后补记。发布目标为 TwiceDrop/genshin_artifact、标签 v7.1.09；库存原生静态推荐权重继续按用户要求暂缓。

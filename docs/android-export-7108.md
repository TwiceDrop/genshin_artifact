# 7.1.08beta Android 数据导出修复

2026-09-30，按用户明确要求修复 Android 导出崩溃并在本地构建 APK。保留当前单次伤害、单人配装和角色技能星／月直伤范围，不恢复已经删除的独立反应及多人贡献功能。

## 原因与修复

旧代码把 UID、圣遗物、预设、Debug JSON 或图片 Base64 的完整内容保存在启动文件选择器的 PluginCall 中。安装的 Capacitor 8.5.1 会把同一 options 分别写入桥接状态和插件状态。Android 停止后台 Activity 时，两份大字符串超过 Binder 状态传输限制，使应用退出，保存回调无法完成，文件可能不存在或为空。

同一真实保存场景的旧代码对照已复现进程崩溃：

- TransactionTooLargeException，data parcel size 为 4,245,816 字节。
- capacitorLastPluginCallOptions 为 2,121,400 字节。
- capacitorLastPluginCallBundle 为 2,121,432 字节，其中 _json 又保存完整载荷。
- 证据：.build-target/android-export-repair1/baseline-real-save-test.log 和 baseline-real-save-device.log。

MonaLocalPlugin.saveFile 现在先将文本以 UTF-8 或图片以 Base64 解码写入本应用私有临时文件，再从 PluginCall 中移除载荷，仅保存受约束的文件 token、文件名和 MIME 类型。系统保存页面在主线程启动；恢复回调仍可通过 token 找到原文件。并发导出会明确提示先完成当前操作。

fileSelected 在后台读取临时文件，使用 ContentResolver 打开系统返回的目标 URI，以 8 KiB 缓冲流式写入。目标流关闭后才返回 saved: true。取消、保存页面打开失败、准备失败和目标写入失败均结束本次操作并清理本次临时文件；失败提供阶段代码和具体原因。仓库、单个预设、全部预设的前端补上异步错误提示。原账号、仓库、预设和 Debug 数据不做清空或迁移。

Android 的说明见 [状态传输](https://developer.android.com/guide/components/activities/parcelables-and-bundles) 和 [Storage Access Framework](https://developer.android.com/training/data-storage/shared/documents-files)。实际根因以本次旧代码对照日志及安装的框架源码为证据。

## 本次验证

只选择五项针对性验证，没有运行计算内核、角色或其他无关全量测试。回归使用 Android 15 模拟器和独立 .debug 包；正式包名对应的已有数据不变。

1. 大型中文/Emoji 文本：约 4.18 MB 的合成文本，载荷从 options 移除，双份序列化状态小于 4 KiB；重建插件和 options 后保存的 UTF-8 字节完全一致。
2. Base64 二进制：65,537 字节逐字节一致，临时文件清理完成。
3. 保存异常：模拟系统保存页面缺失及目标目录不可写，分别返回 EXPORT_PICKER、EXPORT_WRITE；随后可重新发起导出。
4. **真实系统保存及重新导入**：在 App 导入合成 UID（4 名角色、2500 件圣遗物），点击实际 UID 导出按钮及手机版仓库导出菜单；在 Android DocumentsUI 选择 Downloads 并点击“保存”。真实落盘文件读取后与导出 UTF-8 字节完全一致。UID 文件为 923,717 字节，仓库文件为 907,285 字节，均能解析为完整 JSON；两者均通过 App 实际导入入口重新导入。UID 导入新增 0 件；仓库导入为 skip2500、upgrade0、new0、remove0。应用未崩溃。新增低等级合成装备由默认过滤器隐藏，避免把文件验证变成几千张卡片的渲染压力测试。
5. APK 检查：签名有效，与 7.1.07 APK 证书一致；包名、来源、版本正确；SHA-256 与校验文件一致；未发现签名、私有目录、调试导出或 androidTest 合成样本进入 APK。

第 4 项明确验证了保存回调、真实系统目标 URI 和文件写入结果，不只验证选择器打开或编译成功。相同真实场景在旧代码上因状态包超限崩溃，在修复代码上完整保存并重新导入成功。

证据位于 .build-target/android-export-repair1/：

- fixed-native-test.log：前三项通过记录。
- real-save-test.log、real-save-results.xml、real-save-device.log：实际保存、读取与重新导入成功记录。
- baseline-real-save-test.log、baseline-real-save-device.log：旧代码对照崩溃。
- apk-verification.txt：签名、版本、来源、资源及校验记录。

以上是模拟器与合成数据验证，尚未在用户实体手机及该品牌文件提供者上验证。手机上升级请直接覆盖安装，避免卸载或清除数据。

## 构建与产物

版本为 versionCode 70108 / versionName 7.1.08beta。包名仍为 com.mona.artifact.local，来源仍为 https://localhost。Android 7.0 及以上。

本次完整执行移动前端构建、Capacitor 同步和 Gradle release 构建，复用原签名：

~~~powershell
$env:NODE_OPTIONS = '--max-old-space-size=6144'
$env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr'
$env:ANDROID_HOME = 'C:/Users/Admin/AppData/Local/Android/Sdk'
& ./script/build-android.ps1 -SigningDirectory 'D:/Documents/ChatGPT/genshin-artifact/.local-data' -OutputSuffix 'android-export-repair1' -OutputDirectory 'D:/Documents/ChatGPT/v7.1.08beta/source/release'
~~~

签名只读取原有文件，不生成新证书。上述产物已存在，后续使用新的后缀；脚本会拒绝覆盖成品及校验文件。构建有既有 CSS 顺序、Browserslist 和 Gradle 弃用警告，未升级依赖。

- APK：release/genshin_artifact_V7.1.08beta-android-export-repair1_android.apk
- 校验：同名 .apk.sha256
- 大小：26,767,773 字节，约 25.53 MiB
- SHA-256：767b955506fb03807702acc902319c68ce4218e1662abeb6f866d962bb2b3f8d

仅本地交付，没有上传 GitHub；原网页 repair5 包保持原状。

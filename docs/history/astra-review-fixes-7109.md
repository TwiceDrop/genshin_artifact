# Astra 审查问题修复 — 7.1.09

状态：2026-10-06。按 Astra 本轮结论修复两项新引入 P1 和一项既有共享入库 P2。只修改源码、验证脚本和记录；未构建、发布或操作用户存档。未重新执行 7.1.08 的 01–44 清单。

## 1. P1：Android 更新 APK 大小读成 0

位置：android/app/src/main/java/com/mona/artifact/local/MonaLocalPlugin.java 的 downloadUpdate。

原有 PluginCall.getLong("size", 0L) 只接受 Java Long，Android JSON 解析出的普通整数是 Integer，因此正常 size=65536 被读成 0；即使下载完整，也会在 downloadStatus 的 bytes != expected 判断中失败。

改为 call.getData().getLong("size")，在启动下载前只读取一次，把同一个 long 用于 mona-updates 的 size 和下载开始回复的 total。保留现有下载完成后的字节数比较、错误和系统安装确认，没有添加兜底值或新的校验。

验证为 API 合同及实际消费者核对：当前 node_modules 中的 PluginCall.getData() 返回 JSObject，JSObject 继承 JSONObject 且未覆盖 getLong；Android JSONObject.getLong 调用 JSON.toLong，Number 使用 longValue()，能够读取 Integer。前端仍直接传入发布资产 asset.size，原生持久化和状态读取均使用 long。未执行设备后台下载、安装授权或覆盖安装，不能将本项记为实机通过。

来源：[Android JSONObject.getLong](https://android.googlesource.com/platform/libcore/+/refs/tags/android-14.0.0_r1/json/src/main/java/org/json/JSONObject.java)、[JSON.toLong](https://android.googlesource.com/platform/libcore/+/refs/tags/android-14.0.0_r1/json/src/main/java/org/json/JSON.java)、[JSONTokener 整数解析](https://android.googlesource.com/platform/libcore/+/refs/tags/android-14.0.0_r1/json/src/main/java/org/json/JSONTokener.java)。Capacitor 合同以本地实际依赖源码为准。

## 2. P1：Windows 便携更新拒绝默认安装目录

位置：script/install-update.ps1 的 Install-PortablePackage；默认目录由 server/updates.mjs 的 LocalUpdater 提供。

根目录尾部已经带反斜杠时，原比较再次追加反斜杠，正常 dist 等目录被误判为越界。现在只将边界比较前缀的末尾规范为一个分隔符；目标目录仍由 GetFullPath 解析，保留原越界检查及 UTF-8 BOM 编码。

tests/auto-update-7109.test.mjs 的第 3 项已修正为覆盖真实入口：使用 new LocalUpdater().root 和安装函数中真实的前缀赋值检查四个程序子目录；相似名称的兄弟目录仍不能通过。随后以带末尾分隔符的合成安装目录，实际压缩／解压 ZIP 并调用源码安装函数。四个程序目录更新成功，新启动器文件存在；合成 .local-data、用户文件和旧启动器内容不变。全部操作位于专用临时目录，没有停止真实服务或启动合成 EXE。

执行：node --test --test-name-pattern '^3\.' tests/auto-update-7109.test.mjs。1 项通过。

## 3. P2：新增第四副词条导致原 ID 和锁定丢失

位置：src/utils/artifacts.ts 的共享 importMonaJson。这是 7.1.08 已存在、GOOD 接入后仍可触发的问题，不计为 7.1.09 新引入回归。

在现有升级匹配中补入可唯一识别的三→四副词条升级：旧件等级低于 4 且有三条副词条，新件等级至少为 4 且有四条；套装、部位、星级及主词条类型相同；旧三条副词条的名称与数值保持一致，数值沿用现有去重的五位小数精度。库存与本次输入必须双向唯一，匹配表在入库修改之前计算，不按输入顺序猜配对。

确认升级后复用原 ID，并显式保留原 omit，包括 Mona 输入带 omit=false 的情况。没有修改 artifactHash.ts，没有新增哈希或摘要。原有四副词条升级、重复导入和删除不存在装备流程继续沿用。

tests/good-import.test.mjs 新增两项定向验证，使用真实 GOOD 转换、共享导入、artifact／kumi store 和合成数据：

- 五星角斗士花 +0：暴击率 3.9%、暴伤 7.8%、攻击力 5.8%；+4 新增充能 6.5%。GOOD 和 Mona 两种输入，分别开启／关闭删除选项，均得到 skip=0、upgrade=1、add=0、remove=0。库存仍为一件，原 ID、omit=true 和自建配装引用不变，主词条生命为 1530。重复导入 skip=1，后续四词条 +8 升级仍复用原 ID 和锁定。
- 两个旧件对应一个新件、一个旧件对应两个不同新件、同次输入同时出现旧件和新件（两种顺序）均不把新增第四词条强行合并，旧 ID 和锁定保留。此验证关闭删除选项；有歧义时仍按既有新增／删除规则处理，不承诺猜出实际装备身份。

执行：node --test --test-name-pattern '^review:' tests/good-import.test.mjs。2 项通过。

## 本轮验证范围

共四项针对性核对：一项 Android API 合同核对、三项实际回归验证。没有 Android 实机下载／安装、真实 Windows 安装 EXE 覆盖或完整平台成品测试。这些是验证边界，不另列为已证实的 bug。原库存静态推荐权重继续按用户要求暂缓；其余已通过的审查项沿用既有证据。

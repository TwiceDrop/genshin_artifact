# 7.1.12 正式发布核对

日期：2026-10-24。用户明确授权重新构建Windows安装器／ZIP与双UI APK、更新README及Release，并确认GitHub和CNB同步对应源码。该指令取代此前“只改源码、不构建”和“只上传成品”限制。

## 当前状态

本地四包及公开源码已准备，正在发布到两端；最终发布结果随后补充，不能把本节当成已经完成远程发布。

## 正式成品

目录：D:/Documents/ChatGPT/v7.1.12/release-20261024。原R2、7.1.11及历史成品保留。

| 文件 | 字节数 |
| --- | ---: |
| genshin_artifact_V7.1.12_windows_x64_setup.exe | 45115653 |
| genshin_artifact_V7.1.12_web.zip | 61386392 |
| genshin_artifact_V7.1.12_android.apk | 30087651 |
| genshin_artifact_V7.1.12_mobiletest_android.apk | 29884501 |

Windows启动器“启动7.1.12.exe”产品版本7.1.12、文件／程序集7.1.12.0，安装器文件版本7.1.12.0。旧UI包名com.mona.artifact.local，新UI测试包名com.mona.artifact.local.mobiletest，versionCode=70112、versionName=7.1.12；两APK签名验证通过，证书DER字节与原7.1.10正式包完全一致。

## 本轮五个核对目的

1. Windows构建与版本：重新构建当前桌面网页，使用正式打包脚本生成完整web、对应版本启动器、ZIP及Inno安装器；版本核对通过。
2. Android构建与身份：当前新旧两UI网页分别同步Capacitor、沿用原签名生成release APK；包名、版本与签名核对通过。
3. 公开范围及包内容：ZIP内416个桌面网页文件、旧UI APK内416个网页文件、新UI APK内410个网页文件逐文件字节一致；许可、Node运行时、更新脚本齐全，归档未包含账号目录／Debug／签名资料／依赖缓存／本地证据。源码从独立source-publish准备，原旧Git工作区未提交或推送，git diff --check和新增文本敏感内容检查通过。
4. 实际编译更新界面：本地隔离端口加载两种生产构建，合成v99.0.0元数据。初始仅查询CNB、没有测速；绿色按钮rgb(22,163,74)，灰色按钮rgb(229,231,235)。点击其他源后才产生四条非CNB Range探测；旧UI默认CNB下载和新UI备用源下载都收到完整合成包并到达安装接管夹具（不执行系统安装器）。新UI 412px宽度下两按钮宽380px、左右16px，未溢出。两页控制台错误0。此前18项更新器定向测试保留，不重复历史全量功能测试。
5. 双平台最终发布回读：待完成。需核对源码提交／版本标签、README、Release正文、四项附件和实际下载内容。

实际R2远程下载、Windows隔离覆盖、Android合成存档保留及用户APK／EXE实机安装成功的证据见[CNB续记](cnb-default-20261024-r4.md)。本轮未重复操作用户手机或真实存档，也不把合成安装接管夹具写成新正式包系统安装交互实测。

完整18项更新见[发布说明](release-7.1.12-final.md)。已知未修问题保持原状态；未加入EA角色或Beta多人优化功能。

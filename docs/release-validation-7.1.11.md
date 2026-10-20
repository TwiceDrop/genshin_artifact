# 7.1.11 发布核对

日期：2026-10-20。用户明确要求构建并上传GitHub，随后授权README同步，追加旧Element Plus与新UI测试两种APK、不同包名，以及新UI BUFF分类拖动修复。

当前状态：四项成品已于2026-10-20正式发布，五项目的核对完成；非草稿、非预发布，已设为latest。旧版源码、成品和本轮被替代候选保留。

## 成品

| 文件 | 字节 | 身份 |
| --- | ---: | --- |
| genshin_artifact_V7.1.11_windows_x64_setup.exe | 45055217 | Windows x64安装器，文件版本7.1.11.0 |
| genshin_artifact_V7.1.11_web.zip | 60522876 | 含Node、启动7.1.11.exe和当前桌面网页 |
| genshin_artifact_V7.1.11_android.apk | 29233852 | Element Plus，com.mona.artifact.local，70111／7.1.11 |
| genshin_artifact_V7.1.11_mobiletest_android.apk | 29011576 | 新UI测试，com.mona.artifact.local.mobiletest，70111／7.1.11 |

两个APK使用原升级签名。新测试包使用独立应用名和包名，两者数据独立，可通过现有文件导入互传；正式旧包身份与https://localhost保持。未安装到用户手机、未改真实存档。

## 本轮五项目的定向核对

1. Windows构建与版本：从当前源码执行build:local、build-web-package.ps1和build-windows.ps1；启动器产品版本7.1.11，文件／程序集7.1.11.0，标题及文件名同步；安装器文件版本7.1.11.0。
2. Android构建与身份：build-android.ps1 -Ui elementplus使用dist，-Ui mobiletest使用dist-mobile。两者原生release构建成功，apksigner verify通过；与7.1.10的签名证书DER字节直接比较相同，不生成摘要。aapt读取两个独立包名和相同版本。软件更新选择对两种附件排列顺序均通过；最终编译bundle分别保留android和android-test通道。
3. 公开源码与成品：接续已清理main，在独立source-publish准备；公开目录允许清单、暂存文本敏感内容和git diff --check核对。ZIP的416个网页文件、旧UI APK的416个网页文件、新UI APK的413个网页文件逐文件直接字节比较一致。ZIP具备Node许可、安装更新脚本和独立Node安装承载。归档未发现账号目录、Debug、密钥、依赖或本地构建证据。Windows安装器从同一web staging生成。复制阶段遗漏的129个原有静态图片已从保留7.1.10源码补齐，最终两套编译目录和各包均包含；此前候选保留在本地.build-target/release-7111下，不发布。
4. 实际编译UI：仅用两件合成花。桌面迪卢克评分53.3／14.0、芭芭拉54.2／5.0，排序随角色改变；详情默认跟随角色且肖像实际加载。手机迪卢克53.3／14.0一致，清空恢复原库存顺序且分数撤去；375px内容区无横向溢出。新UI BUFF分类鼠标拖动scrollLeft从0到218再回0，拖动保持原选项，点击元素共鸣正确显示实际列表。保留原生触屏滚动，未将浏览器鼠标验证写成真实手机手指验证。
5. GitHub最终回读通过：[正式Release](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.11)，标签v7.1.11指向源码提交264029a2603f55f946e0cadfbecbace46d075229；draft=false、prerelease=false。四项资产名称／字节数／uploaded状态与本地一致，README及七项更新说明与已准备文本一致。读取7.1.10正式APK实际编译选择器，在发布前后分别消费真实GitHub附件列表，均选择genshin_artifact_V7.1.11_android.apk，即旧Element Plus包；测试包未被旧版默认选中。公开main随后追加本核对及AGENTS的发布完成记录，正式标签不移动。

本轮不默认运行历史44项或全量角色回归。自动更新修复此前的五项目的验证及Android系统安装未验证边界见[专项记录](auto-update-fix-7111.md)。

## 发布范围与保留边界

完整七项更新见[更新说明](release-7.1.11-final.md)，README保持原有四部分结构并同步版本与四项下载链接。哥伦比娅超时继续按用户要求搁置，薇斯纳快捷目标限制等仍按AGENTS实际状态保留，未改计算内核。

Windows旧客户端首次取得更新器修复需要手动覆盖升级一次；用户原手机0%的系统根因仍未确认。本轮未执行真实Windows安装覆盖或Android系统APK授权／覆盖安装，不声称正式系统升级链已全覆盖。

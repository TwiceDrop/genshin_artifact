# 7.1.12 更新说明弹窗溢出修复

2026-10-24，按用户要求同时修复7.1.12与7.2.01EA，仅涉及src/App.vue的样式及样式入口。

原因：本项目Element Plus版本未将el-dialog上的class传至实际弹窗元素，已有.release-update-dialog .release-notes规则没有生效，pre保持white-space:pre。旧生产页合成复现中，560px日志容器的横向内容宽3923px。

修复：使用组件实际支持的custom-class。长段落/长链接按pre-wrap及overflow-wrap:anywhere换行；日志限高并可滚动；弹窗限制视口高度，正文可滚动，页头和底部按钮保留。窄屏下载线路及更新偏好标签允许换行。完整日志原文不变，不改更新检查/下载/安装的JavaScript逻辑。

验证范围：两个版本修改后的App.vue字节一致，脚本部分与各自修改前一致。7.1.12实际生产网页通过1280×800、412×915、320×600三个布局检查：日志scrollWidth分别等于clientWidth（560/364/272），长日志可滚动，全文保持，弹窗与底部按钮在视口内，正文无横向溢出；下次再说可关闭，页面错误0。使用隔离浏览器和合成Release/下载线路响应，没有真实下载或安装，没有访问用户浏览器存储。两版build:local均成功，编译JS中的custom-class绑定与CSS规则均已核对；未声称实际更新下载/安装验证通过。

本版416个dist文件已同步原launcher/dist，逐字节一致、首页最后复制；版本、启动器、端口、角色/计算功能和已有预设保持。未改README，未打安装包/ZIP/APK或发布。

共享网页验证：D:/Documents/ChatGPT/v7.1.12/source/beta-tools/update-dialog-css-check.mjs。前后尺寸数据/截图在同源.build-target/update-dialog-css/before.json、after.json、before-*.png、after-*.png；各版本自身构建/同步证据为.build-target/update-dialog-css/build.log和sync.json。

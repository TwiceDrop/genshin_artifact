@echo off
chcp 65001 >nul
setlocal
set MONA_PORT=4183
title 莫娜占卜铺 7.1.06
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo 未找到 Node.js，请安装 Node.js 后重新启动。
    pause
    exit /b 1
)
node "script\start-local.mjs" %*
if errorlevel 1 (
    echo.
    echo 启动失败，请查看上方提示。
    pause
    exit /b 1
)

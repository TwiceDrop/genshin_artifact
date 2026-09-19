$ErrorActionPreference = 'Stop'
$betaRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $betaRoot
$toolBin = Join-Path $PSScriptRoot 'mingw64/bin'
if (Test-Path -LiteralPath $toolBin) { $env:PATH = $toolBin + ';' + $env:PATH }
$bindgenPath = Join-Path $PSScriptRoot 'wasm-bindgen-0.2.92-x86_64-pc-windows-msvc/wasm-bindgen.exe'
if (-not (Test-Path -LiteralPath $bindgenPath)) { $bindgenPath = (Get-Command wasm-bindgen -ErrorAction Stop).Source }
& cargo +nightly-2024-10-10-x86_64-pc-windows-gnu build --lib --release --target wasm32-unknown-unknown --manifest-path mona_wasm/Cargo.toml --locked
if ($LASTEXITCODE -ne 0) { throw '扩展内核编译失败' }
$targetRoot = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $betaRoot 'mona_wasm/target' }
& $bindgenPath (Join-Path $targetRoot 'wasm32-unknown-unknown/release/mona_wasm.wasm') --target web --out-dir mona_wasm/extension --out-name mona_extension
if ($LASTEXITCODE -ne 0) { throw '扩展内核绑定生成失败' }
& node beta-tools/smoke.mjs
if ($LASTEXITCODE -ne 0) { throw '扩展内核验证失败' }
& node beta-tools/smoke-beta2.mjs
if ($LASTEXITCODE -ne 0) { throw 'beta2 验证失败' }
& node beta-tools/smoke-beta3.mjs
if ($LASTEXITCODE -ne 0) { throw 'beta3 专武验证失败' }
Write-Host '扩展构建完成。执行 npm run build:local 更新桌面页面。'

$ErrorActionPreference = 'Stop'
$betaRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $betaRoot
$toolBin = Join-Path $PSScriptRoot 'mingw64/bin'
if (Test-Path -LiteralPath $toolBin) { $env:PATH = $toolBin + ';' + $env:PATH }
$bindgenPath = Join-Path $PSScriptRoot 'wasm-bindgen-0.2.92-x86_64-pc-windows-msvc/wasm-bindgen.exe'
if (-not (Test-Path -LiteralPath $bindgenPath)) { $bindgenPath = (Get-Command wasm-bindgen -ErrorAction Stop).Source }
& cargo +nightly-2024-10-10-x86_64-pc-windows-gnu build --lib --release --target wasm32-unknown-unknown --manifest-path mona_wasm/Cargo.toml --locked
if ($LASTEXITCODE -ne 0) { throw 'Extension compilation failed' }
$targetRoot = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $betaRoot 'mona_wasm/target' }
& $bindgenPath (Join-Path $targetRoot 'wasm32-unknown-unknown/release/mona_wasm.wasm') --target web --out-dir mona_wasm/extension --out-name mona_extension
if ($LASTEXITCODE -ne 0) { throw 'Extension bindings generation failed' }
& node beta-tools/smoke.mjs
if ($LASTEXITCODE -ne 0) { throw 'Extension smoke checks failed' }
& node beta-tools/smoke-beta2.mjs
if ($LASTEXITCODE -ne 0) { throw 'Vesna smoke checks failed' }
& node beta-tools/smoke-beta3.mjs
if ($LASTEXITCODE -ne 0) { throw 'Signature weapon checks failed' }
& node beta-tools/smoke-limited-71.mjs
if ($LASTEXITCODE -ne 0) { throw 'Limited, battle-pass and forged weapon checks failed' }
& node beta-tools/smoke-strengthened.mjs
if ($LASTEXITCODE -ne 0) { throw 'Strengthened character checks failed' }
& node beta-tools/smoke-stellar-support.mjs
if ($LASTEXITCODE -ne 0) { throw 'Stellar support checks failed' }
Write-Host 'Extension build complete. Run npm run build:local to update the web app.'

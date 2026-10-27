param(
    [Parameter(Mandatory=$true)][string]$NodeRuntime,
    [string]$OutputDirectory,
    [switch]$SkipWebBuild
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$output = if ($OutputDirectory) { [IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $projectRoot 'release-output' }
$stage = Join-Path $output 'web'
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).displayVersion
$archive = Join-Path $output "genshin_artifact_V${version}_web.zip"
if (Test-Path -LiteralPath $stage) { throw "Output already exists: $stage" }
if (Test-Path -LiteralPath $archive) { throw "Output already exists: $archive" }
Push-Location $projectRoot
try {
    if (-not $SkipWebBuild) {
        & npm.cmd run build:local
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    }
    New-Item -ItemType Directory -Path $stage,(Join-Path $stage 'script'),(Join-Path $stage 'docs') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'dist'),(Join-Path $projectRoot 'server') -Destination $stage -Recurse
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'start-local.mjs') -Destination (Join-Path $stage 'script')
    & (Join-Path $PSScriptRoot 'build-tray-launcher.ps1') -NodeRuntime $NodeRuntime -OutputDirectory $stage
    foreach ($name in @('LICENSE','THIRD_PARTY_NOTICES.md','README.md')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $stage
    }
    Copy-Item -LiteralPath (Join-Path $projectRoot "docs/release-${version}-final.md") -Destination (Join-Path $stage 'docs')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'src/algorithms/artifact-score/vendor/LICENSE.miao') -Destination (Join-Path $stage 'LICENSE.miao')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'server/vendor/twicedrop/LICENSE') -Destination (Join-Path $stage 'LICENSE.qrcode')
    [IO.File]::WriteAllText((Join-Path $stage "启动${version}.bat"), "@echo off`r`nstart `"`" `"%~dp0启动${version}.exe`"`r`n", [Text.Encoding]::GetEncoding(936))
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -CompressionLevel Optimal
    Write-Output $archive
} finally { Pop-Location }

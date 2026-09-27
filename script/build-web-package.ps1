param([switch]$SkipWebBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$output = Join-Path $projectRoot 'release-output'
$stage = Join-Path $output 'web-stage'
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).displayVersion
$archive = Join-Path $output "genshin_artifact_V${version}_web.zip"

if (Test-Path -LiteralPath $stage) { throw 'release-output/web-stage already exists. Move it before packaging again.' }
if (Test-Path -LiteralPath $archive) { throw "The web archive already exists: $archive" }

Push-Location $projectRoot
try {
    if (-not $SkipWebBuild) {
        & npm.cmd run build:local
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/index.html'))) { throw 'Built web files are missing.' }
    New-Item -ItemType Directory -Path $stage,(Join-Path $stage 'script'),(Join-Path $stage 'docs'),(Join-Path $stage 'beta-data') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'dist'),(Join-Path $projectRoot 'server') -Destination $stage -Recurse
    Copy-Item -LiteralPath (Join-Path $projectRoot 'script/start-local.mjs') -Destination (Join-Path $stage 'script')
    Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/android-offline.md') -Destination (Join-Path $stage 'docs')
    foreach ($name in @('limited-71-notes.md','strengthened-notes.md')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot "beta-data/$name") -Destination (Join-Path $stage 'beta-data')
    }
    foreach ($name in @('LICENSE','THIRD_PARTY_NOTICES.md','README.md','7.1.04使用说明.md','7.1.06使用说明.md','7.1.06更新说明.md','启动7.1.06.bat','启动莫娜.bat')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $stage
    }
    Copy-Item -LiteralPath (Join-Path $projectRoot 'src/algorithms/artifact-score/vendor/LICENSE.miao') -Destination (Join-Path $stage 'LICENSE.miao')
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -CompressionLevel Optimal
    $digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$archive.sha256", "$digest  $([IO.Path]::GetFileName($archive))`n", [Text.UTF8Encoding]::new($false))
    Write-Output $archive
} finally { Pop-Location }

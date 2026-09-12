param(
    [Parameter(Mandatory=$true)][string]$NodeRuntime,
    [string]$Iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    [switch]$SkipWebBuild
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$stage = Join-Path $projectRoot 'release-stage'
$output = Join-Path $projectRoot 'release-output'
if (Test-Path -LiteralPath $stage) { throw 'release-stage already exists. Rename it before creating a new installer.' }
if (-not (Test-Path -LiteralPath $Iscc)) { throw 'Inno Setup compiler not found; supply -Iscc.' }
foreach ($name in @('node.exe','LICENSE')) {
    if (-not (Test-Path -LiteralPath (Join-Path $NodeRuntime $name))) { throw "Node runtime missing $name" }
}
Push-Location $projectRoot
try {
    if (-not $SkipWebBuild) {
        & npm.cmd run build:local
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    }
    New-Item -ItemType Directory -Path $stage,$output,(Join-Path $stage 'runtime'),(Join-Path $stage 'script') -Force | Out-Null
    # Explicit runtime allowlist: never package the project root or user data.
    Copy-Item -LiteralPath (Join-Path $projectRoot 'dist'),(Join-Path $projectRoot 'server') -Destination $stage -Recurse
    foreach ($name in @('LICENSE','THIRD_PARTY_NOTICES.md','README.md')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $stage }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'start-local.mjs') -Destination (Join-Path $stage 'script')
    foreach ($name in @('node.exe','LICENSE')) { Copy-Item -LiteralPath (Join-Path $NodeRuntime $name) -Destination (Join-Path $stage 'runtime') }
    Copy-Item -LiteralPath (Join-Path $projectRoot 'src/algorithms/artifact-score/vendor/LICENSE.miao') -Destination (Join-Path $stage 'LICENSE.miao')
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    & $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ("/win32icon:" + (Join-Path $projectRoot 'public/favicon.ico')) ("/out:" + (Join-Path $stage 'MonaArtifact.exe')) (Join-Path $projectRoot 'installer/Launcher.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
    & $Iscc ("/DStageDir=" + $stage) ("/DOutputPath=" + $output) (Join-Path $projectRoot 'installer/mona.iss')
    if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
    $installer = Join-Path $output 'genshin_artifact_V7.0.11_windows_x64_setup.exe'
    $digest = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText((Join-Path $output 'SHA256SUMS.txt'), "$digest  $([IO.Path]::GetFileName($installer))`n", [Text.UTF8Encoding]::new($false))
    Write-Output $installer
} finally { Pop-Location }

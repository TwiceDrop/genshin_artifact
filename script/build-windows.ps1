param(
    [Parameter(Mandatory=$true)][string]$StageDirectory,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [string]$Iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$version = $package.displayVersion
$numericVersion = ([version]$package.version).ToString(3) + '.0'
& $Iscc ("/DStageDir=" + [IO.Path]::GetFullPath($StageDirectory)) ("/DOutputPath=" + [IO.Path]::GetFullPath($OutputDirectory)) ("/DDisplayVersion=" + $version) ("/DNumericVersion=" + $numericVersion) (Join-Path $projectRoot 'installer/mona.iss')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
Write-Output (Join-Path $OutputDirectory "genshin_artifact_V${version}_windows_x64_setup.exe")

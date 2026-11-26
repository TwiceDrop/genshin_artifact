param(
    [Parameter(Mandatory=$true)][string]$BuildDirectory,
    [Parameter(Mandatory=$true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$source = (Resolve-Path -LiteralPath (Join-Path $BuildDirectory 'mona-tauri.exe')).ProviderPath
$output = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
[IO.Directory]::CreateDirectory($output) | Out-Null
$destination = Join-Path $output "genshin_artifact_V$($package.displayVersion)_windows_desktop_tauri_x64.exe"
[IO.File]::Copy($source, $destination)
Write-Output $destination

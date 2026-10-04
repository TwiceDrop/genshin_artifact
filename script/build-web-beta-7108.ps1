param([switch]$SkipWebBuild,[ValidatePattern('^[a-z0-9-]*$')][string]$OutputSuffix='',[string]$OutputDirectory='',[Parameter(Mandatory=$true)][string]$NodeRuntime)
$ErrorActionPreference='Stop'
$sourceRoot=Split-Path $PSScriptRoot -Parent
$betaRoot=if($OutputDirectory){[IO.Path]::GetFullPath($OutputDirectory)}else{Split-Path $sourceRoot -Parent}
$suffix=if($OutputSuffix){'-'+$OutputSuffix}else{''}
$stage=Join-Path $betaRoot ('web'+$suffix)
$archive=Join-Path $betaRoot ('genshin_artifact_V7.1.08beta'+$suffix+'_web.zip')
if((Test-Path -LiteralPath $stage) -or (Test-Path -LiteralPath $archive)){throw 'Beta web output already exists; choose a new destination before packaging again.'}
Push-Location $sourceRoot
try {
 if(-not $SkipWebBuild){ & npm.cmd run build:local; if($LASTEXITCODE -ne 0){throw 'Web build failed'} }
 if(-not (Test-Path -LiteralPath 'dist/index.html')){throw 'Missing built web entry'}
 New-Item -ItemType Directory -Path $stage,(Join-Path $stage 'script'),(Join-Path $stage 'docs') | Out-Null
 Copy-Item -LiteralPath 'dist','server' -Destination $stage -Recurse
 Copy-Item -LiteralPath 'script/start-local.mjs' -Destination (Join-Path $stage 'script')
 & ./script/build-tray-launcher.ps1 -NodeRuntime $NodeRuntime -OutputDirectory $stage
 foreach($file in @('LICENSE','THIRD_PARTY_NOTICES.md')){Copy-Item -LiteralPath $file -Destination $stage}
 foreach($file in @('refactor-7.1.08beta.md','character-buff-migration-7108.md','character-buff-migration-7108.json','research-repairs-7108.md','entry-repair-7108.md','interface-audit-7108.md','interface-parameters-7108.md','direct-reactions-only-7108.md','tray-launcher-20261002.md','interface-audit-screenshot.jpg')){Copy-Item -LiteralPath (Join-Path 'docs' $file) -Destination (Join-Path $stage 'docs')}
 Copy-Item -LiteralPath 'docs/direct-reactions-only-7108.md' -Destination (Join-Path $stage '使用说明.md')
 Copy-Item -LiteralPath 'src/algorithms/artifact-score/vendor/LICENSE.miao' -Destination (Join-Path $stage 'LICENSE.miao')
 Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -CompressionLevel Optimal
 $digest=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
 [IO.File]::WriteAllText("$archive.sha256", "$digest  $([IO.Path]::GetFileName($archive))`n",[Text.UTF8Encoding]::new($false))
 Write-Output $archive
} finally {Pop-Location}

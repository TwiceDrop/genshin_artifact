param([string]$PackageDirectory='')
$ErrorActionPreference='Stop'
$sourceRoot=Split-Path $PSScriptRoot -Parent
$root=if($PackageDirectory){[IO.Path]::GetFullPath($PackageDirectory)}else{$sourceRoot}
$work=Join-Path $sourceRoot '.build-target/tray-launcher'
$library=Join-Path $work 'TrayLauncherProbe.dll'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:library /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Core.dll ("/out:"+$library) (Join-Path $PSScriptRoot 'tray-launcher-7108.cs')
if($LASTEXITCODE -ne 0){throw 'Launcher verification compilation failed'}
[void][Reflection.Assembly]::LoadFrom($library)
$env:MONA_DATA_DIR=Join-Path $work 'synthetic-data'
$result=[TrayLauncherProbe]::Run(@($root,$work))
exit $result

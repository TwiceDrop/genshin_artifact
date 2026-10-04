param(
    [Parameter(Mandatory=$true)][string]$NodeRuntime,
    [string]$OutputDirectory=''
)
$ErrorActionPreference='Stop'
$sourceRoot=Split-Path $PSScriptRoot -Parent
$output=if($OutputDirectory){[IO.Path]::GetFullPath($OutputDirectory)}else{$sourceRoot}
$package=Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json
$displayVersion=$package.displayVersion
$version=([version]($package.version -split '-')[0]).ToString(3)+'.0'
$exe=Join-Path $output ('启动'+$displayVersion+'.exe')
if(Test-Path -LiteralPath $exe){throw "Launcher output already exists: $exe"}
foreach($name in @('node.exe','LICENSE')){
    if(-not (Test-Path -LiteralPath (Join-Path $NodeRuntime $name))){throw "Node runtime missing $name"}
}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$work=Join-Path $sourceRoot '.build-target/tray-launcher'
New-Item -ItemType Directory -Path $output,$work,(Join-Path $output 'runtime') -Force | Out-Null
$info=Join-Path $work 'LauncherVersion.cs'
$source=@"
[assembly: System.Reflection.AssemblyTitle("莫娜占卜铺 $displayVersion")]
[assembly: System.Reflection.AssemblyProduct("莫娜占卜铺")]
[assembly: System.Reflection.AssemblyVersion("$version")]
[assembly: System.Reflection.AssemblyFileVersion("$version")]
[assembly: System.Reflection.AssemblyInformationalVersion("$displayVersion")]
internal static class LauncherBuild { internal const string DisplayVersion = "$displayVersion"; }
"@
[IO.File]::WriteAllText($info,$source,[Text.UTF8Encoding]::new($false))
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Core.dll ("/win32icon:"+(Join-Path $sourceRoot 'public/favicon.ico')) ("/out:"+$exe) (Join-Path $sourceRoot 'installer/TrayLauncher.cs') $info
if($LASTEXITCODE -ne 0){throw 'Tray launcher compilation failed'}
foreach($name in @('node.exe','LICENSE')){
    Copy-Item -LiteralPath (Join-Path $NodeRuntime $name) -Destination (Join-Path $output 'runtime')
}
Write-Output $exe

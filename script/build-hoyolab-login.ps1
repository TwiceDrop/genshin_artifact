param([string]$SdkDirectory = (Join-Path $env:USERPROFILE '.nuget/packages/microsoft.web.webview2/1.0.4129.50'))
$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path $PSScriptRoot -Parent
$output = Join-Path $sourceRoot 'runtime/hoyolab-login'
$lib = Join-Path $SdkDirectory 'lib/net462'
New-Item -ItemType Directory -Force $output | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Core.dll /reference:System.Web.Extensions.dll ("/reference:"+(Join-Path $lib 'Microsoft.Web.WebView2.Core.dll')) ("/reference:"+(Join-Path $lib 'Microsoft.Web.WebView2.WinForms.dll')) ("/out:"+(Join-Path $output 'HoyolabLogin.exe')) (Join-Path $sourceRoot 'installer/HoyolabLogin.cs')
if ($LASTEXITCODE -ne 0) { throw 'HoYoLAB login helper compilation failed' }
foreach ($name in @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll')) { Copy-Item -LiteralPath (Join-Path $lib $name) -Destination $output }
Copy-Item -LiteralPath (Join-Path $SdkDirectory 'runtimes/win-x64/native/WebView2Loader.dll') -Destination $output
foreach ($name in @('LICENSE.txt','NOTICE.txt')) { Copy-Item -LiteralPath (Join-Path $SdkDirectory $name) -Destination $output }

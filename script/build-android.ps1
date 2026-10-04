param([switch]$SkipWebBuild, [string]$SigningDirectory, [string]$OutputSuffix, [string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
if ($OutputSuffix -and $OutputSuffix -notmatch '^[a-z0-9][a-z0-9-]*$') { throw '输出后缀只能包含小写字母、数字和连字符' }
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$version = if ($package.displayVersion) { $package.displayVersion } else { $package.version }
$suffix = if ($OutputSuffix) { "-$OutputSuffix" } else { '' }
$filename = "genshin_artifact_V${version}${suffix}_android.apk"
$outputRoot = if ($OutputDirectory) { [IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $projectRoot 'releases' }
$apk = Join-Path $outputRoot $filename
if ((Test-Path -LiteralPath $apk) -or (Test-Path -LiteralPath "$apk.sha256")) { throw "输出已经存在，已保留旧包：$apk" }
if ($SigningDirectory) {
    $signingRoot = (Resolve-Path -LiteralPath $SigningDirectory).Path
    if (-not (Test-Path -LiteralPath (Join-Path $signingRoot 'android-signing.jks')) -or
        -not (Test-Path -LiteralPath (Join-Path $signingRoot 'android-signing.json'))) {
        throw '指定的升级签名不完整，停止构建以免生成不同签名'
    }
}
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not (Test-Path -LiteralPath "$env:JAVA_HOME\bin\java.exe")) { throw '需要 Java 21，请设置 JAVA_HOME。' }
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path -LiteralPath $sdkRoot)) { throw '未找到 Android SDK，请设置 ANDROID_HOME。' }
[IO.File]::WriteAllText((Join-Path $projectRoot 'android/local.properties'), "sdk.dir=$($sdkRoot.Replace('\','/'))`n")
if (-not $SkipWebBuild) { & npm.cmd run build:mobile; if ($LASTEXITCODE -ne 0) { throw '手机前端构建失败' } }
$licenseDir = Join-Path $projectRoot 'dist-mobile/licenses'
New-Item -ItemType Directory -Path $licenseDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'LICENSE'),(Join-Path $projectRoot 'THIRD_PARTY_NOTICES.md') -Destination $licenseDir
Copy-Item -LiteralPath (Join-Path $projectRoot 'src/algorithms/artifact-score/vendor/LICENSE.miao') -Destination $licenseDir
Copy-Item -LiteralPath (Join-Path $projectRoot 'server/vendor/twicedrop/LICENSE') -Destination (Join-Path $licenseDir 'LICENSE.qrcode')
& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { throw '安卓资源同步失败' }
$privateDir = if ($SigningDirectory) { (Resolve-Path -LiteralPath $SigningDirectory).Path } else { Join-Path $projectRoot '.local-data' }
New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
$keyFile = Join-Path $privateDir 'android-signing.jks'
$passwordFile = Join-Path $privateDir 'android-signing.json'
if ((Test-Path -LiteralPath $keyFile) -and -not (Test-Path -LiteralPath $passwordFile)) { throw '签名密码文件缺失，已保留现有签名文件' }
if (-not (Test-Path -LiteralPath $passwordFile)) {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes); $rng.Dispose()
    @{ password = [Convert]::ToBase64String($bytes) } | ConvertTo-Json | Set-Content -LiteralPath $passwordFile -Encoding UTF8
}
$env:MONA_SIGN_STORE = $keyFile
$env:MONA_SIGN_PASSWORD = (Get-Content -LiteralPath $passwordFile -Raw | ConvertFrom-Json).password
try {
    if (-not (Test-Path -LiteralPath $keyFile)) {
        & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -keystore $keyFile -storepass:env MONA_SIGN_PASSWORD -keypass:env MONA_SIGN_PASSWORD -alias mona-local -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Mona Offline, OU=Local App, O=Mona, C=CN' -noprompt
        if ($LASTEXITCODE -ne 0) { throw '生成本地签名失败' }
    }
    & .\android\gradlew.bat -p android assembleRelease --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'APK 构建失败' }
    New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination $apk
    Write-Output "APK 已生成：$apk"
} finally {
    Remove-Item Env:MONA_SIGN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MONA_SIGN_STORE -ErrorAction SilentlyContinue
}

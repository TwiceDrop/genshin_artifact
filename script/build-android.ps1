param([switch]$SkipWebBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not (Test-Path -LiteralPath "$env:JAVA_HOME\bin\java.exe")) { throw '需要 Java 21，请设置 JAVA_HOME。' }
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path -LiteralPath $sdkRoot)) { throw '未找到 Android SDK，请设置 ANDROID_HOME。' }
[IO.File]::WriteAllText((Join-Path $projectRoot 'android/local.properties'), "sdk.dir=$($sdkRoot.Replace('\','/'))`n")
if (-not $SkipWebBuild) { & npm.cmd run build:mobile; if ($LASTEXITCODE -ne 0) { throw '手机前端构建失败' } }
& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { throw '安卓资源同步失败' }
$privateDir = Join-Path $projectRoot '.local-data'
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
    New-Item -ItemType Directory -Path releases -Force | Out-Null
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination 'releases/mona-offline-android.apk'
    $hash = (Get-FileHash -LiteralPath 'releases/mona-offline-android.apk' -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText((Join-Path $projectRoot 'releases/mona-offline-android.apk.sha256'), "$hash  mona-offline-android.apk`n")
    Write-Output 'APK 已生成：releases/mona-offline-android.apk'
} finally {
    Remove-Item Env:MONA_SIGN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MONA_SIGN_STORE -ErrorAction SilentlyContinue
}

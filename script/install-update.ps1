param(
    [Parameter(Mandatory=$true)][string]$Package,
    [Parameter(Mandatory=$true)][string]$TargetRoot,
    [Parameter(Mandatory=$true)][ValidateSet('installer','portable')][string]$Mode,
    [Parameter(Mandatory=$true)][string]$Version,
    [int]$LauncherPid,
    [int]$ServerPid,
    [int]$Port=4184
)
$ErrorActionPreference='Stop'

function Install-PortablePackage([string]$Archive, [string]$Destination, [string]$DisplayVersion) {
    $destinationPath=[IO.Path]::GetFullPath($Destination)
    $destinationPrefix=$destinationPath.TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
    $work=Join-Path ([IO.Path]::GetDirectoryName($Archive)) 'expanded'
    Expand-Archive -LiteralPath $Archive -DestinationPath $work
    $launcherName='启动'+$DisplayVersion+'.exe'
    $packageRoot=[IO.Path]::GetDirectoryName((Get-ChildItem -LiteralPath $work -Filter $launcherName -File -Recurse | Select-Object -First 1).FullName)
    if(-not (Test-Path -LiteralPath (Join-Path $packageRoot 'dist/index.html'))){throw '更新包缺少网页入口'}
    foreach($name in @('dist','server','script','runtime')){
        $source=Join-Path $packageRoot $name
        $target=[IO.Path]::GetFullPath((Join-Path $destinationPath $name))
        if(-not $target.StartsWith($destinationPrefix,[StringComparison]::OrdinalIgnoreCase)){throw '更新目标超出程序目录'}
        Copy-Item -LiteralPath $source -Destination $destinationPath -Recurse -Force
    }
    foreach($name in @($launcherName,'LICENSE','THIRD_PARTY_NOTICES.md','LICENSE.miao')){
        Copy-Item -LiteralPath (Join-Path $packageRoot $name) -Destination (Join-Path $destinationPath $name) -Force
    }
}

try {
    foreach($processId in @($LauncherPid,$ServerPid)){
        $running=Get-Process -Id $processId -ErrorAction SilentlyContinue
        if($running){Wait-Process -InputObject $running -Timeout 30}
    }
    $root=[IO.Path]::GetFullPath($TargetRoot)
    if($Mode -eq 'installer'){
        $setup=Start-Process -FilePath $Package -ArgumentList @('/SILENT','/SUPPRESSMSGBOXES','/NORESTART',('/DIR="'+$root+'"'),('/LOG="'+$Package+'.log"')) -PassThru -Wait -WindowStyle Hidden
        if($setup.ExitCode -notin @(0,3010)){throw ('安装程序退出码 '+$setup.ExitCode)}
    }else{
        Install-PortablePackage $Package $root $Version
    }
    $env:MONA_PORT=[string]$Port
    Start-Process -FilePath (Join-Path $root ('启动'+$Version+'.exe')) -WorkingDirectory $root -WindowStyle Hidden
}catch{
    $_ | Out-String | Set-Content -LiteralPath ($Package+'.error.log') -Encoding UTF8
    Add-Type -AssemblyName System.Windows.Forms
    [Windows.Forms.MessageBox]::Show($_.Exception.Message,'莫娜更新失败') | Out-Null
    exit 1
}

#ifndef StageDir
  #error StageDir is required
#endif
#ifndef OutputPath
  #define OutputPath "..\release-output"
#endif
#ifndef DisplayVersion
  #error DisplayVersion is required
#endif
#ifndef NumericVersion
  #error NumericVersion is required
#endif
#define LauncherName "启动" + DisplayVersion + ".exe"
[Setup]
AppId={{B9F05725-3D59-446B-B772-6AAC68F9E611}
AppName=莫娜占卜铺
AppVersion={#DisplayVersion}
AppVerName=莫娜占卜铺 V{#DisplayVersion}
VersionInfoVersion={#NumericVersion}
AppPublisher=TwiceDrop
AppPublisherURL=https://github.com/TwiceDrop/genshin_artifact
AppSupportURL=https://github.com/TwiceDrop/genshin_artifact/issues
DefaultDirName={localappdata}\Programs\MonaArtifact
DefaultGroupName=莫娜占卜铺
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputPath}
OutputBaseFilename=genshin_artifact_V{#DisplayVersion}_windows_x64_setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
LicenseFile={#StageDir}\LICENSE
UninstallDisplayIcon={app}\{#LauncherName}
AppMutex=Local\MonaArtifactLauncher
CloseApplications=no
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked
[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\莫娜占卜铺"; Filename: "{app}\{#LauncherName}"
Name: "{autodesktop}\莫娜占卜铺"; Filename: "{app}\{#LauncherName}"; Tasks: desktopicon
[Run]
Filename: "{app}\{#LauncherName}"; Description: "Launch Mona"; Flags: nowait postinstall skipifsilent

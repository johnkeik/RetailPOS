#define MyAppName "MiniPOS"
#define MyAppVersion "1.0.0"
#define MyAppExeName "pos_client.exe"

[Setup]
AppId={{7E54D382-6D2A-4F31-8B29-C31AEB9C5AB4}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\MiniPOS
DefaultGroupName={#MyAppName}
OutputDir=Output
OutputBaseFilename=MiniPOS-Setup
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
Uninstallable=yes

[Files]
Source: "..\apps\pos_client\build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\MiniPOS"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\MiniPOS"; Filename: "{app}\{#MyAppExeName}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch MiniPOS"; Flags: nowait postinstall skipifsilent
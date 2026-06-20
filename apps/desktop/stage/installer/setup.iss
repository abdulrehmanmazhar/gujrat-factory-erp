[Setup]
AppName=GUJRAT_FACTORY_ERP
AppVersion=1.0.0
AppId={{D23B7E91-GUJRATFACTORYERP-PORTABLE}}
DefaultDirName={localappdata}\GUJRAT_FACTORY_ERP
DefaultGroupName=GUJRAT_FACTORY_ERP
OutputBaseFilename=GUJRAT_FACTORY_ERP
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
; --- Custom Icon for the Installer/Uninstaller ---
SetupIconFile=..\app\icons\icon.ico

[Files]
; Copy the entire app folder content
Source: "..\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs createallsubdirs
; Copy the batch file
Source: "run.bat"; DestDir: "{app}\installer"

[Icons]
; Create desktop shortcut pointing to the batch file, but using the app's icon
Name: "{userdesktop}\GUJRAT_FACTORY_ERP"; Filename: "{app}\installer\run.bat"; IconFilename: "{app}\app\icons\icon.ico"
Name: "{group}\GUJRAT_FACTORY_ERP"; Filename: "{app}\installer\run.bat"; IconFilename: "{app}\app\icons\icon.ico"

[Run]
; Optional: Launch the app immediately after installation
Filename: "{app}\installer\run.bat"; Description: "{cm:LaunchProgram,GUJRAT_FACTORY_ERP}"; Flags: nowait postinstall skipifsilent

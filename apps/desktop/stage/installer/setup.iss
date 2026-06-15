[Setup]
AppName=Trip-2-Go Recorder
AppVersion=1.0.0
AppId={{D23B7E91-TRIP2GOREC-PORTABLE}}
DefaultDirName={localappdata}\Trip2GoRecorder
DefaultGroupName=Trip-2-Go Recorder
OutputBaseFilename=Trip2GoRecorder
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
Name: "{userdesktop}\Trip-2-Go Recorder"; Filename: "{app}\installer\run.bat"; IconFilename: "{app}\app\icons\icon.ico"
Name: "{group}\Trip-2-Go Recorder"; Filename: "{app}\installer\run.bat"; IconFilename: "{app}\app\icons\icon.ico"

[Run]
; Optional: Launch the app immediately after installation
Filename: "{app}\installer\run.bat"; Description: "{cm:LaunchProgram,Trip-2-Go Recorder}"; Flags: nowait postinstall skipifsilent

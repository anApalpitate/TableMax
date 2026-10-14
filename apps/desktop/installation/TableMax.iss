#include "build-config.iss"

[Setup]
AppId={#InnoAppId}
AppName={#ProductName}
AppVersion={#BuildVersion}
VersionInfoVersion={#BuildVersion}
AppPublisher=TableMax
DefaultDirName={src}
DisableDirPage=no
AppendDefaultDirName=no
UsePreviousAppDir=yes
UsePreviousTasks=yes
DefaultGroupName={#ProductName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
UninstallDisplayIcon={app}\TableMax.exe
UninstallDisplayName={#ProductName}
OutputDir={#OutputDirectory}
OutputBaseFilename={#OutputName}
SetupIconFile={#IconPath}
Compression=lzma2/normal
SolidCompression=yes
CloseApplications=no
RestartApplications=no
AllowRootDirectory=no
UninstallFilesDir={app}
UninstallLogMode=overwrite
SetupLogging=yes
WizardStyle=modern
WizardSizePercent=120

[Languages]
Name: "chinese"; MessagesFile: "compiler:Default.isl"

[LangOptions]
chinese.LanguageName=简体中文
chinese.LanguageID=$0804
chinese.DialogFontName=Microsoft YaHei UI
chinese.DialogFontSize=12
chinese.TitleFontName=Microsoft YaHei UI
chinese.TitleFontSize=16
chinese.WelcomeFontName=Microsoft YaHei UI
chinese.WelcomeFontSize=16

[Messages]
chinese.WelcomeLabel1=欢迎使用 [name] 安装向导
chinese.WelcomeLabel2=安装完整的 TableMax，包括全部正式游戏和玩法。%n%n请确认要安装的位置；更新会保留存档、设置和原局模块。
chinese.WizardSelectDir=选择安装位置
chinese.SelectDirDesc=TableMax 应安装在哪里？
chinese.SelectDirLabel3=选择安装位置，然后点击下一步。安装目录中的其他资料会保留。
chinese.WizardSelectTasks=选择快捷方式
chinese.SelectTasksDesc=选择需要创建的快捷方式。
chinese.SelectTasksLabel2=请选择是否创建桌面快捷方式。
chinese.WizardReady=准备安装
chinese.ReadyLabel1=已准备在所选位置安装完整 TableMax。
chinese.ButtonNext=下一步(&N) >
chinese.ButtonBack=< 上一步(&B)
chinese.ButtonInstall=安装(&I)
chinese.ButtonCancel=取消
chinese.ButtonFinish=完成(&F)
chinese.FinishedHeadingLabel=TableMax 安装完成
chinese.FinishedLabelNoIcons=已安装完整 TableMax。存档、设置和历史游戏模块将在以后升级或默认卸载时保留。
chinese.ConfirmUninstall=确定卸载 TableMax 程序？存档、设置、历史模块和其他资料将保留。
chinese.UninstalledAll=TableMax 程序已卸载。数据与历史模块保留在原 TableMax 目录。

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："; Flags: {#DesktopTaskFlags}

[Files]
Source: "{#CandidateDirectory}\*"; DestDir: "{tmp}\candidate"; Excludes: "installation-manifest.json,*.AssemblyInfo.cs"; Flags: ignoreversion recursesubdirs createallsubdirs deleteafterinstall notimestamp
Source: "{#CandidateDirectory}\installation-manifest.json"; DestDir: "{tmp}\candidate"; Flags: ignoreversion deleteafterinstall notimestamp; AfterInstall: CommitCandidate

[Icons]
Name: "{code:ProgramShortcutRoot}\{#ProductName}"; Filename: "{app}\TableMax.exe"; WorkingDir: "{app}"; Check: InstallConfirmed
Name: "{code:ProgramShortcutRoot}\卸载 {#ProductName}"; Filename: "{uninstallexe}"; WorkingDir: "{app}"; Check: InstallConfirmed
Name: "{code:DesktopShortcutRoot}\{#ProductName}"; Filename: "{app}\TableMax.exe"; WorkingDir: "{app}"; Tasks: desktopicon; Check: InstallConfirmed

[Code]
var
  Confirmed: Boolean;
  ResultCode: Integer;
  MigrationPage: TWizardPage;
  MigrationEdit: TNewEdit;
  MigrationBrowse: TNewButton;

function InstallConfirmed: Boolean;
begin
  Result := Confirmed;
end;

function ProgramShortcutRoot(Param: String): String;
begin
  if {#FixtureBuild} = 1 then Result := ExpandConstant('{app}\fixture-shortcuts\Start')
  else Result := ExpandConstant('{userprograms}\{#ProductName}');
end;

function DesktopShortcutRoot(Param: String): String;
begin
  if {#FixtureBuild} = 1 then Result := ExpandConstant('{app}\fixture-shortcuts\Desktop')
  else Result := ExpandConstant('{userdesktop}');
end;

function Quoted(const Value: String): String;
begin
  if Pos('"', Value) > 0 then RaiseException('路径包含无效字符。');
  Result := '"' + Value + '"';
end;

procedure BrowseMigration(Sender: TObject);
var
  Directory: String;
begin
  Directory := MigrationEdit.Text;
  if BrowseForFolder('选择原 TableMax 配置目录', Directory, False) then
    MigrationEdit.Text := Directory;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = MigrationPage.ID) and (MigrationEdit.Text <> '') then begin
    Result := FileExists(AddBackslash(MigrationEdit.Text) + 'TableMax.config.json');
    if not Result then MsgBox('所选原配置目录应包含 TableMax.config.json；不迁移时请保持空白。', mbError, MB_OK);
  end;
end;

procedure InitializeWizard;
var
  Notice: TNewStaticText;
begin
  WizardForm.NextButton.Font.Size := 14;
  WizardForm.BackButton.Font.Size := 14;
  WizardForm.CancelButton.Font.Size := 14;
  Notice := TNewStaticText.Create(WizardForm);
  Notice.Parent := WizardForm.SelectDirPage;
  Notice.Left := ScaleX(0);
  Notice.Top := WizardForm.DirEdit.Top + WizardForm.DirEdit.Height + ScaleY(14);
  Notice.Width := WizardForm.SelectDirPage.ClientWidth;
  Notice.Height := ScaleY(42);
  Notice.AutoSize := False;
  Notice.WordWrap := True;
  Notice.Caption := '不推荐安装在C盘，因为这是一个有良心的安装包';
  MigrationPage := CreateCustomPage(wpSelectTasks, '继续使用旧便携数据', '可选：选择原 TableMax 配置目录；不迁移时保持空白。');
  MigrationEdit := TNewEdit.Create(WizardForm);
  MigrationEdit.Parent := MigrationPage.Surface;
  MigrationEdit.Top := ScaleY(32);
  MigrationEdit.Width := MigrationPage.SurfaceWidth - ScaleX(100);
  MigrationBrowse := TNewButton.Create(WizardForm);
  MigrationBrowse.Parent := MigrationPage.Surface;
  MigrationBrowse.Left := MigrationEdit.Width + ScaleX(8);
  MigrationBrowse.Top := MigrationEdit.Top;
  MigrationBrowse.Width := ScaleX(90);
  MigrationBrowse.Caption := '浏览…';
  MigrationBrowse.OnClick := @BrowseMigration;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  RegisteredRoot: String;
begin
  Result := '';
  if IsAdminInstallMode or IsAdminLoggedOn then begin
    Result := '请以当前普通用户运行安装包，不使用管理员身份。';
    Exit;
  end;
  if Length(ExpandConstant('{app}')) <= 3 then Result := '请选择有效的可写目录，不能安装到磁盘根。';
  if RegKeyExists(HKCU64, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#ProductId}_is1') then begin
    if not RegQueryStringValue(HKCU64, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#ProductId}_is1', 'InstallLocation', RegisteredRoot) then
      Result := '已有安装登记缺少原位置，请先修复或卸载原安装，不创建第二份安装。'
    else if CompareText(RemoveBackslashUnlessRoot(ExpandFileName(RegisteredRoot)), RemoveBackslashUnlessRoot(ExpandFileName(ExpandConstant('{app}')))) <> 0 then
      Result := '当前用户已有 TableMax 安装。升级和修复请使用原安装位置；本版本不提供安装目录搬迁。';
  end;
end;

procedure CommitCandidate;
var
  Arguments, Target, Migration: String;
begin
  begin
    Arguments := '--commit --root=' + Quoted(ExpandConstant('{app}')) + ' --candidate=' + Quoted(ExpandConstant('{tmp}\candidate')) + ' --manifest=' + Quoted(ExpandConstant('{tmp}\candidate\installation-manifest.json')) + ' --installer-source=' + Quoted(ExpandConstant('{srcexe}'));
    Target := ExpandConstant('{param:TABLEMAXTARGET|}');
    if Target <> '' then Arguments := Arguments + ' --target=' + Quoted(Target);
    Migration := ExpandConstant('{param:TABLEMAXMIGRATION|}');
    if Migration = '' then Migration := MigrationEdit.Text;
    if Migration <> '' then Arguments := Arguments + ' --migration-root=' + Quoted(Migration);
    if not Exec(ExpandConstant('{tmp}\candidate\UpdateHelper.exe'), Arguments, ExpandConstant('{tmp}'), SW_HIDE, ewWaitUntilTerminated, ResultCode) then RaiseException('无法启动安装协调程序，原数据已保留。');
    if ResultCode <> 0 then RaiseException('安装未确认完成（' + IntToStr(ResultCode) + '）。原数据与恢复记录已保留，请检查 TableMax 目录。');
    Confirmed := True;
  end;
end;

function GetCustomSetupExitCode: Integer;
begin
  if Confirmed then Result := 0 else Result := 40;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Helper, Temporary, Arguments: String;
begin
  if CurUninstallStep <> usUninstall then Exit;
  Helper := ExpandConstant('{app}\UpdateHelper.exe');
  Temporary := ExpandConstant('{tmp}\TableMax-uninstall-helper.exe');
  if not FileExists(Helper) or (GetSHA256OfFile(Helper) <> '{#HelperSHA256}') then
    RaiseException('卸载协调程序校验失败，已保留程序和数据。请先运行完整安装包修复。');
  if not FileExists(Helper) or not FileCopy(Helper, Temporary, False) then begin
    RaiseException('卸载协调程序缺失，已保留程序和数据。请先运行完整安装包修复。');
  end;
  if GetSHA256OfFile(Temporary) <> '{#HelperSHA256}' then
    RaiseException('临时卸载协调程序校验失败，已保留程序和数据。');
  Arguments := '--uninstall --root=' + Quoted(ExpandConstant('{app}'));
  if not Exec(Temporary, Arguments, ExpandConstant('{tmp}'), SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then begin
    RaiseException('卸载未完成，程序登记与数据已保留。请关闭 TableMax 并检查恢复记录。');
  end;
end;

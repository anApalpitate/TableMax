#include "build-config.iss"

[Setup]
AppId={#InnoAppId}
AppName={#ProductName}
AppVersion={#BuildVersion}
VersionInfoVersion={#BuildVersion}
AppPublisher=TableMax
DefaultDirName={src}\TableMax
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
UninstallLogMode=append
SetupLogging=yes
WizardStyle=modern
WizardSizePercent=120

[Languages]
Name: "chinese"; MessagesFile: "languages\ChineseSimplified.isl"

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
chinese.WizardSelectTasks=选择安装选项
chinese.SelectTasksDesc=选择快捷方式及版本迁移选项。
chinese.SelectTasksLabel2=请选择是否创建桌面快捷方式，以及是否迁移旧版本数据。
chinese.WizardReady=准备安装
chinese.ReadyLabel1=已准备在所选位置安装完整 TableMax。
chinese.ButtonNext=下一步(&N) >
chinese.ButtonBack=< 上一步(&B)
chinese.ButtonInstall=安装(&I)
chinese.ButtonCancel=取消
chinese.ButtonFinish=完成(&F)
chinese.FinishedHeadingLabel=TableMax 安装完成
chinese.FinishedLabelNoIcons=已安装完整 TableMax。默认卸载会移除程序和已确认可重建的当前游戏资源，保留存档、设置、旧局依赖及其他资料。
chinese.FinishedLabel=已安装完整 TableMax，可通过快捷方式启动。默认卸载会移除程序和已确认可重建的当前游戏资源，保留存档、设置、旧局依赖及其他资料。
chinese.ConfirmUninstall=确定卸载 TableMax 程序和已确认可重建的当前游戏资源？%n%n存档、设置、旧局依赖及其他资料将保留。
chinese.UninstalledAll=TableMax 程序及已确认可重建的当前游戏资源已卸载。存档、设置、旧局依赖及其他资料保留在原位置。
chinese.UninstalledMost=部分程序文件未能删除。存档、设置、旧局依赖及其他资料按约定保留，请勿将这些保留资料当作卸载残留删除。

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："; Flags: {#DesktopTaskFlags}

[Files]
Source: "{#CandidateDirectory}\*"; DestDir: "{tmp}\candidate"; Excludes: "installation-manifest.json,*.AssemblyInfo.cs"; Flags: dontcopy ignoreversion recursesubdirs createallsubdirs noencryption notimestamp
Source: "{#CandidateDirectory}\installation-manifest.json"; DestDir: "{tmp}\candidate"; Flags: dontcopy ignoreversion noencryption notimestamp

[Icons]
Name: "{code:ProgramShortcutRoot}\{#ProductName}"; Filename: "{app}\TableMax.exe"; WorkingDir: "{app}"; Check: InstallConfirmed
Name: "{code:ProgramShortcutRoot}\卸载 {#ProductName}"; Filename: "{uninstallexe}"; WorkingDir: "{app}"; Check: InstallConfirmed
Name: "{code:DesktopShortcutRoot}\{#ProductName}"; Filename: "{app}\TableMax.exe"; WorkingDir: "{app}"; Tasks: desktopicon; Check: InstallConfirmed

[Code]
var
  Confirmed: Boolean;
  ResultCode: Integer;
  MigrationPage: TWizardPage;
  MigrationCheck: TNewCheckBox;
  MigrationEdit: TNewEdit;
  MigrationBrowse: TNewButton;

#include "uninstall-helper.iss"

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

function MigrationRequested: Boolean;
begin
  { An explicit path is an opt-in only for silent automation. Interactive
    installation always requires the visible, initially unchecked control. }
  if WizardSilent then
    Result := Trim(ExpandConstant('{param:TABLEMAXMIGRATION|}')) <> ''
  else Result := MigrationCheck.Checked;
end;

function SelectedMigrationRoot: String;
begin
  Result := '';
  if WizardSilent then
    Result := Trim(ExpandConstant('{param:TABLEMAXMIGRATION|}'))
  else if MigrationCheck.Checked then
    Result := Trim(MigrationEdit.Text);
end;

function MigrationSelectionError: String;
var
  Migration: String;
begin
  Result := '';
  if not MigrationRequested then begin
    if (not WizardSilent) and (Trim(ExpandConstant('{param:TABLEMAXMIGRATION|}')) <> '') then
      Result := '命令行指定了迁移目录。请先勾选“是否进行版本迁移”，并在迁移页确认目录；不迁移时请移除该参数。';
    Exit;
  end;
  Migration := SelectedMigrationRoot;
  if Migration = '' then
    Result := '请选择原 TableMax 配置目录；不迁移时请返回上一页取消勾选“是否进行版本迁移”。'
  else if not FileExists(AddBackslash(Migration) + 'TableMax.config.json') then
    Result := '所选原配置目录必须包含有效的 TableMax.config.json。请选择原目录，或返回上一页取消版本迁移。';
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := (PageID = MigrationPage.ID) and (not MigrationRequested);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Error: String;
begin
  Result := True;
  Error := '';
  if CurPageID = MigrationPage.ID then Error := MigrationSelectionError
  else if (CurPageID = wpSelectTasks) and (not MigrationRequested) then
    Error := MigrationSelectionError;
  if Error <> '' then begin
    Result := False;
    Log('版本迁移选择未通过：' + Error);
    if not WizardSilent then MsgBox(Error, mbError, MB_OK);
  end;
end;

procedure InitializeWizard;
var
  Notice: TNewStaticText;
  DefaultMigration: String;
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
  MigrationCheck := TNewCheckBox.Create(WizardForm);
  MigrationCheck.Parent := WizardForm.SelectTasksPage;
  MigrationCheck.Left := WizardForm.TasksList.Left;
  MigrationCheck.Top := WizardForm.TasksList.Top + WizardForm.TasksList.Height - ScaleY(40);
  MigrationCheck.Width := WizardForm.TasksList.Width;
  MigrationCheck.Height := ScaleY(30);
  MigrationCheck.Caption := '是否进行版本迁移';
  MigrationCheck.Checked := False;
  WizardForm.TasksList.Height := MigrationCheck.Top - WizardForm.TasksList.Top - ScaleY(10);
  MigrationPage := CreateCustomPage(wpSelectTasks, '继续使用旧版本数据', '选择原 TableMax 配置目录。原目录保留；取消迁移请返回上一页取消勾选。');
  MigrationEdit := TNewEdit.Create(WizardForm);
  MigrationEdit.Parent := MigrationPage.Surface;
  MigrationEdit.Top := ScaleY(32);
  MigrationEdit.Width := MigrationPage.SurfaceWidth - ScaleX(100);
  DefaultMigration := ExpandConstant('{src}\TableMax');
  if DirExists(DefaultMigration) then MigrationEdit.Text := DefaultMigration;
  MigrationBrowse := TNewButton.Create(WizardForm);
  MigrationBrowse.Parent := MigrationPage.Surface;
  MigrationBrowse.Left := MigrationEdit.Width + ScaleX(8);
  MigrationBrowse.Top := MigrationEdit.Top;
  MigrationBrowse.Width := ScaleX(90);
  MigrationBrowse.Caption := '浏览…';
  MigrationBrowse.OnClick := @BrowseMigration;
end;

procedure CommitCandidate;
var
  Arguments, Target, Migration: String;
begin
  begin
    Arguments := '--commit --root=' + Quoted(ExpandConstant('{app}')) + ' --candidate=' + Quoted(ExpandConstant('{tmp}\candidate')) + ' --manifest=' + Quoted(ExpandConstant('{tmp}\candidate\installation-manifest.json')) + ' --installer-source=' + Quoted(ExpandConstant('{srcexe}'));
    Target := ExpandConstant('{param:TABLEMAXTARGET|}');
    if Target <> '' then Arguments := Arguments + ' --target=' + Quoted(Target);
    Migration := SelectedMigrationRoot;
    if Migration <> '' then Arguments := Arguments + ' --migration-root=' + Quoted(Migration);
    if not ExecAndLogOutput(ExpandConstant('{tmp}\candidate\UpdateHelper.exe'), Arguments, ExpandConstant('{tmp}'), SW_HIDE, ewWaitUntilTerminated, ResultCode, nil) then RaiseException('无法启动安装协调程序，原数据已保留。');
    Log('TableMax coordinator finished with exit code: ' + IntToStr(ResultCode));
    if ResultCode <> 0 then RaiseException('安装未确认完成（' + IntToStr(ResultCode) + '）。原数据与恢复记录已保留，请检查 TableMax 目录。');
    Confirmed := True;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  RegisteredRoot: String;
begin
  Result := '';
  Confirmed := False;
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
  if Result <> '' then Exit;
  Result := MigrationSelectionError;
  if Result <> '' then Exit;
  try
    { Before/AfterInstall exceptions do not abort Inno. Confirm the managed
      transaction before Inno can replace the previous uninstall framework. }
    if ExtractTemporaryFiles('{tmp}\candidate\*') <= 0 then
      RaiseException('安装载荷未能提取，原程序与数据已保留。');
    CommitCandidate;
  except
    Confirmed := False;
    Result := GetExceptionMessage;
  end;
end;

function GetCustomSetupExitCode: Integer;
begin
  if Confirmed then Result := 0 else Result := 40;
end;

{ In locked Inno 6.7.3, Chr is the compiler's raw btChar intrinsic.
  Keep its output in AnsiString; never pass binary through Unicode String. }
function UninstallBase64Value(Value: AnsiChar): Integer;
begin
  if (Value >= 'A') and (Value <= 'Z') then Result := Ord(Value) - Ord('A')
  else if (Value >= 'a') and (Value <= 'z') then Result := Ord(Value) - Ord('a') + 26
  else if (Value >= '0') and (Value <= '9') then Result := Ord(Value) - Ord('0') + 52
  else if Value = '+' then Result := 62
  else if Value = '/' then Result := 63
  else Result := -1;
end;

function DecodeUninstallHelper(const Encoded: AnsiString; ExpectedBytes: Integer): AnsiString;
var
  InputIndex, OutputIndex, Count, A, B, C, D: Integer;
begin
  if (ExpectedBytes <= 0) or (ExpectedBytes >= 120000000) then
    RaiseException('卸载协调程序内嵌长度无效，已保留程序和数据。');
  if Length(Encoded) <> ((ExpectedBytes + 2) div 3) * 4 then
    RaiseException('卸载协调程序内嵌编码长度无效，已保留程序和数据。');
  SetLength(Result, ExpectedBytes);
  InputIndex := 1;
  OutputIndex := 1;
  while InputIndex <= Length(Encoded) do begin
    A := UninstallBase64Value(Encoded[InputIndex]);
    B := UninstallBase64Value(Encoded[InputIndex + 1]);
    C := 0;
    D := 0;
    Count := 3;
    if (A < 0) or (B < 0) then
      RaiseException('卸载协调程序内嵌编码无效，已保留程序和数据。');
    if Encoded[InputIndex + 2] = '=' then begin
      if (InputIndex + 3 <> Length(Encoded)) or (Encoded[InputIndex + 3] <> '=') or ((B and 15) <> 0) then
        RaiseException('卸载协调程序内嵌填充无效，已保留程序和数据。');
      Count := 1;
    end else begin
      C := UninstallBase64Value(Encoded[InputIndex + 2]);
      if C < 0 then RaiseException('卸载协调程序内嵌编码无效，已保留程序和数据。');
      if Encoded[InputIndex + 3] = '=' then begin
        if (InputIndex + 3 <> Length(Encoded)) or ((C and 3) <> 0) then
          RaiseException('卸载协调程序内嵌填充无效，已保留程序和数据。');
        Count := 2;
      end else begin
        D := UninstallBase64Value(Encoded[InputIndex + 3]);
        if D < 0 then RaiseException('卸载协调程序内嵌编码无效，已保留程序和数据。');
      end;
    end;
    if OutputIndex + Count - 1 > ExpectedBytes then
      RaiseException('卸载协调程序解码长度超出范围，已保留程序和数据。');
    Result[OutputIndex] := Chr((A shl 2) or (B shr 4));
    if Count >= 2 then Result[OutputIndex + 1] := Chr(((B and 15) shl 4) or (C shr 2));
    if Count = 3 then Result[OutputIndex + 2] := Chr(((C and 3) shl 6) or D);
    OutputIndex := OutputIndex + Count;
    InputIndex := InputIndex + 4;
  end;
  if OutputIndex <> ExpectedBytes + 1 then
    RaiseException('卸载协调程序解码长度不符，已保留程序和数据。');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Directory, Temporary, Arguments: String;
  Data: AnsiString;
  OwnDirectory, OwnFile: Boolean;
begin
  if CurUninstallStep <> usUninstall then Exit;
  Data := DecodeUninstallHelper(EmbeddedUninstallHelperBase64, EmbeddedUninstallHelperBytes);
  if GetSHA256OfString(Data) <> EmbeddedUninstallHelperSHA256 then
    RaiseException('内嵌卸载协调程序校验失败，已保留程序和数据。');
  Directory := GenerateUniqueName(ExpandConstant('{tmp}'), '');
  OwnDirectory := False;
  OwnFile := False;
  try
    if FileOrDirExists(Directory) or not CreateDir(Directory) then
      RaiseException('无法创建私有卸载临时目录，已保留程序和数据。');
    OwnDirectory := True;
    Temporary := AddBackslash(Directory) + 'UpdateHelper.exe';
    if FileOrDirExists(Temporary) then
      RaiseException('卸载临时路径已存在，已保留程序和数据。');
    OwnFile := True;
    if not SaveStringToFile(Temporary, Data, False) then
      RaiseException('无法写入卸载协调程序，已保留程序和数据。');
    if GetSHA256OfFile(Temporary) <> EmbeddedUninstallHelperSHA256 then
      RaiseException('临时卸载协调程序校验失败，已保留程序和数据。');
    Arguments := '--uninstall --root=' + Quoted(ExpandConstant('{app}'));
    if not ExecAndLogOutput(Temporary, Arguments, Directory, SW_HIDE, ewWaitUntilTerminated, ResultCode, nil) then begin
      Log('卸载协调程序启动失败，系统代码：' + IntToStr(ResultCode));
      RaiseException('卸载未完成，程序登记与数据已保留。请关闭 TableMax 并检查恢复记录。');
    end;
    Log('卸载协调程序退出代码：' + IntToStr(ResultCode));
    if ResultCode <> 0 then
      RaiseException('卸载未完成，程序登记与数据已保留。请关闭 TableMax 并检查恢复记录。');
  finally
    { Only these paths inside the new private directory are cleanup candidates. }
    if OwnFile then if not DeleteFile(Temporary) then Log('无法移除本次卸载临时程序：' + Temporary);
    if OwnDirectory then if not RemoveDir(Directory) then Log('无法移除本次卸载临时目录：' + Directory);
  end;
end;

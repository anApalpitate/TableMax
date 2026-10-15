# 当前交付与验收

本页仅保留当前完整EXE、仍有效的证据和待验边界。下方旧标题为导航，不能把原版本通过升级为当前包通过。

2026-10-15安装／卸载／盒子更新继续验收，current仍为已验证便携1.0.6.10；候选15已封包、闭包及实际生产根验签通过，未推广或发布，候选14原SHA保留。续行03／04／05／06各累计3失败，原run均已停止；续行07保留2项包装器预检失败，修正后标准账户验收进行中。普通I／默认D的fixture实际7步及后续启动清理新增5项组件分别保留证明，完整三链、真实下一启动、正式GUID与完整容量仍待验，接续见[安装任务](../tasks/windows-installation-update.md)。

## 1.0.6.15：候选冻结与续行07（2026-10-15）

[候选15冻结交付](../../artifacts/package-payloads/v1.0.6/29c81e29c4a3-1H6Xye/full/installer-delivery.json)对应[完整EXE](../../artifacts/releases/TableMax-1.0.6.15-win-x64.exe)，35,713,286字节、SHA `fcf3627c873558d8e551bdf5b73019a83b156d41bfebd08a4a8a66375f872df2`；candidate SHA `5a767509273ed1ee392cc3df24c00100b8be38fe38b17c5696d1cfcda7cdb23e`，snapshot `29c81e29c4a385e747133a116f5ea154aa6b53f00540e8064395a25fca6cc829`。原31游戏单元未重建，current原SHA仍保留便携10；程序暂存97,491,605字节尚不含实际框架和首次启动G，完整容量仍须系统测量。

[封包闭包9项](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/production-seal-15-repair-01/results.json)实际通过，包含逐文件／ZIP／三PE、配方、生产签名、原游戏单元及current保全。[实际程序集生产根验签](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/production-signature-15/report.json)Native／helper各22项通过，launcher12项只核原字节、GUID和版本；反射核验不运行产品Main。[本地交付上下文](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/production15/local-delivery-context.json)记录NotSigned、无ZoneIdentifier、未观察浏览器下载，不证明SmartScreen体验或发布。

[续行06账本](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/round.json)最终3失败保留：prototype比较、临时seal工具参数正则错误、PS7父进程误用Desktop模块路径后的只读元数据autoload失败。工具正则修正未改变候选字节；环境修复使Desktop路径仅用于PS5子进程并在finally恢复，PS7父进程使用自身模块。[续行07](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-07/round.json)开始后又记录2项包装器预检失败：Inno版本字符串尾部空白、fixture Native四位ProductVersion被误按生产版三位比较；两处已修正，候选及夹具字节不变，复用已过组件／闭包／验签与[准备13](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/handoff-prepare-13/report.json)原报告，不重复执行或计数。准备13保留原prepared-not-executed状态；正式driver已启动，真实旧首装与宿主就绪已通过，整套结果尚未形成，不把准备或局部通过认定为完整系统证明。

## 续行06：数据路径分类与共用门禁（2026-10-15）

[续行05账本](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/round.json)保留两次I198默认D的首次启动失败和1项工具ESLint错误，累计3后停止。第二次日志已证实service与WebView2 environment ready，控制器创建抛COM `0x800705B4`；不能再称Node未启动。工具显式cause遗漏修复后的静态检查通过。

[短外D独立诊断](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/startup-external-account-01/application-startup-external-data/report.json)在同I198／同PE下通过4步、0失败；G仍B、固定私有work/D、配置原字节不变，真实日志从D归档。[隔离收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/startup-external-account-01/isolated-account.json)确认新账户和profile删除，driver退出0。该对照仅把问题收敛到数据目录相关因素；不证明UDF长度是唯一根因，不冒称默认D或实际Apply通过。

后续完整链分别使用普通I／默认D，以及I198／显式短外D；长链仍要求原helper273／下载317与实际短副本身份。任意深度I／D不在冻结承诺内，原默认深D失败作为限制保留，不移动缓存或改系统保护。

[普通I／默认D首轮](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/three-chains-account-01/application-handoff/report.json)实际通过7步：准备材料、旧Inno首装、旧主机、检查下载、Apply父交接、新持续主机健康及精确默认卸载。交接审计`handoff-helper-and-data`因相同元组的普通对象与null-prototype对象比较失败，报告仍failed、1失败，SHA `94db1b804fb9d37d691dbffe21fca560b1005b81615d85aff4cb9c4552e9852e`；表示差异修复不放宽字段或原字节摘要。[收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/three-chains-account-01/isolated-account.json)SHA `b785e5d2da64260df5eca317d4645b6b43eaa629f46736304a1975c4a6b893ac`确认账户／profile删除。该失败计入续行06最终3失败；长I与旧框架恢复当轮未执行，不能认定三链通过。

后续启动清理生产实现为`ApplicationUpdate`读取信任根／receipt后同步调用`InstallationLaunch.CleanupFinished`，仅本地按本安装B审计索引TEMP，无联网或等待helper。它以同实例／SID／根、所有安装事务终态、历史或当前成功目标的RSA／清单／receipt及原helper／审计SHA授权；运行中、pending、未知和篡改均保留。只按原文件句柄删除TEMP的h／存在的i／元数据和B旧helper，再删除已空私有目录；B公共审计／签名描述／handoff保留，canonical大下载真实保留，其元组写入`cleanup.json`并另计缓存。

[新增清理组件5项](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/completed-cleanup-component/report.json)通过、0新增失败，原报告SHA `1137be8d24e3163df7b5197ae10df605e6e85f8ecb1171ccb326e96a318a1403`，历史run为`ff26634b-c069-428a-a944-cca98c4bebad`。实际net48 Core与RSA覆盖同版／历史成功目标、幂等及pending／未知／篡改／占用保全；成员是合成不可执行字节，进程观察是合成记录，未运行Native、helper或installer，不代替真实新版正常退出后的独立下一启动清理。原短目录8项和共用门禁10项继续按各自证据复用，不重复增加统计。

[共用门禁10项纯测试](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/publication-gates/results.json)通过，Node原TAP为两文件各5／5，历史库仍按各文件原验证身份统计。推广及未来发布复用唯一生命周期／容量校验；新系统工具要求真实卸载后重装读回玩家、两次默认卸载，以及安装文件和当前G的同次实测分项。占用观察只报maxObserved下界，不声称绝对峰值或未执行的prestart采样。正式GUID卸载后重装与容量系统链尚未运行，不能用上述纯测试替代。

## 续行05：活跃卸载通过与长路径启动诊断（2026-10-15）

续行04达到3失败后停止并转入实质修复。Framework通过`GetProcessById`取得的对象未持久保留进程句柄，`WaitForExit`后读取`ExitCode`可能因`NoProcessHandle`抛出异常；源码已在Stop和Apply两处于请求／握手前保留`.Handle`，helper源SHA `f11562011e2b6b848f55ab49182b3c7e4a77205e04880f64a2f9b60a0ce7891b`，未放宽保存确认、精确PID／路径或退出0门槛。

[新准备09](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/handoff-prepare-09/report.json)已按新源重新编译双PE。随后[真实活跃卸载](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/active-uninstall-account-03/application-active-uninstall/report.json)4步通过、0失败，原报告SHA `d270a8786476320d8a8674bc59a6f06a09e0461afe44c82ea31502518e7d054c`；[隔离收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/active-uninstall-account-03/isolated-account.json)SHA `4c94a4d35c6a3da6f0db27711464ca5c2a88b9fcf575db84acb4820d24d6498a`确认账户／profile已删除，driver退出0。只证明该fixture活跃卸载，不是正式GUID或更新通过。

[短目录组件](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/native-launch-component/report.json)8项通过、0失败，原报告SHA `f4294957004c65a825cb305ca8583435e5dc22a1d9a65537287412af71bdd6e9`。实际net48调用创建时私有ACL、严格绑定／篡改拒绝及同SHA清理；合成字节不可执行，无Native／helper／installer或系统登记。

[完整链01](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/chains-account-01/application-handoff/report.json)原报告SHA `1b6253d2f730d03daccd624d979a858e782b58d188d06ba871a863ef2575df98`，初次旧Inno返回40、1失败，未到Apply。I198、最长重定向快捷方式259，原helper273／下载317仍超260；Native记录COM `0x800705B4`，目前没有具体await阶段／堆栈，通用错误文案不证明Node未ready。[该轮清理](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/chains-account-01/isolated-account.json)SHA `49214ce05e208afb3383eacba133221511887b74ed04771a4e3ee8b0a0519891`确认新账户／profile删除。补诊断后定向定位，不把该失败或组件通过升级为实际短副本启动。正式GUID、迁移、卸载后重装、完整首次启动容量及推广继续待验。

## 续行04：组件复验与活动卸载失败（2026-10-15）

[修复轮记录](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/round.json)绑定当时修复源码和工具SHA，完整保留续行03的3项失败。[原规则](validation.md#历史通过率与失败阈值)允许实质修复后仅重跑受影响项；此前额外询问另开轮许可的问题已撤回，不把未答复当作新同意。原03范围静态审计仍含该错误等待假定，原字节保留为历史快照，不作为当前授权规则。已有账户／UAC／profile授权仍有效，不能仅换轮次名重试未修复输入。

[长路径控制器](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/controller-long-path/report.json)1项、0失败，1851ms，报告SHA `ea68faaa044faf34b98b20ac7a665ae37dee4bf08e0850340045e911a7c135a9`；[partial清理控制器](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/controller-partial-cleanup/report.json)的cancel／broken-stream／wrong-sha共3项、0失败，报告SHA `195e0cad47f22b5fdd24312550fae09b2483cca4559711ddecc5de4025b9d740`。范围为实际net48 ApplicationUpdate控制器与文件系统、合成安装成员及管理HTTP传输；没有启动Native／Node、真实GitHub下载、installer或登记，不证明短TEMP的ACL、实际helper／installer启动、Apply或正式GUID安装。

另有[新harness格式调用误入Corepack](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/launch-harness-tooling-failure-01.json)、exit1，报告SHA `fc5de46cda6c6f2a4c80162be610522a9f855014d783f68c5cf8aea5b94f8f16`。该环境失败1项，加下述实际卸载失败2项，续行04累计3后停止；与上述4项组件0失败分开记录。

[准备07](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/handoff-prepare-07/report.json)已真实编译封包两版fixture，结果为`prepared-not-executed`、0失败，原报告SHA `c9df3591ac44cc223ef7cce0c97e3685d70af0431bb9afece406c26a0606da12`。[材料复核](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/handoff-prepare-07/static-review.json)绑定18源及两份recipe：60000 EXE35,695,808字节，SHA `2ed61d7423d19739b344a58822652d020c469abe94c68ccf4f44b086a85ea317`；60001 EXE35,690,891字节，SHA `10e676d1d1548a6a1b6fe0c16ecde1c22b859c59d2a2af7c0e29622b6c3e098b`。编译准备不算Apply或卸载通过。

[活动卸载07](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/active-uninstall-account-01/application-active-uninstall/report.json)为`failed`、1失败，原报告SHA `85f270daf17779b59029ca7cc48c2fe77b8b72af5a528a6b0695892caacf814b`。前三步材料核验、真实首装和旧主机通过；Native PID24340退出0、两流完整EOF、诊断errors为空，desktop.log有`Service shutdown: drained`，但helper10／Inno1，原日志不能唯一归因。[收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/active-uninstall-account-01/isolated-account.json)SHA `b6184218af5578a9b2747e105008ebf7e1b3f25af5ba33c49263dbd3fd17dad3`确认TMVerify_d871439f、SID尾1016及profile均清理。

[活动卸载08](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/active-uninstall-account-02/application-active-uninstall/report.json)同为`failed`、1失败，原报告SHA `816f4d4ad64a355d2d9f6ea93941c7190c6e7cac6786a58651c4c0cdd90f8323`；前三步通过，Native PID22716退出0，helper10／Inno1。[实际Inno日志](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/active-uninstall-account-02/application-active-uninstall/uninstall-inno.log)明确`stage=stop.native-exit exceptionType=System.InvalidOperationException HResult=0x80131509`，由此定位上述句柄生命周期缺陷。[收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/active-uninstall-account-02/isolated-account.json)SHA `e9f9b19c336ec961b3740f913b6061d64fa1cd4def51d5df4f59ab255a08f2b2`确认TMVerify_06c7268a、SID尾1017及profile均清理，driver于07:20:10Z完成、exit1。

Native退出0和服务drained不证明Stop已成功返回，也不能记为卸载通过。两次均为fixture-only，未执行正式候选；新稳定入口／helper／installer实际执行和完整系统链仍待证明。I／B／D／G、保存／exit0契约及原current10／候选14字节保留，修复源码须新的精确候选证明。准备07／08只按各自原来源复用，不能代替后续句柄修复后的新准备材料。

## 续行03：真实首装与剩余故障（2026-10-15）

[轮次记录](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/round.json)保留本轮3项失败及前轮记录。[编码专项](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/encoding-probe/report.json)7项、[fixture签名及范围检查](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/fixture-tooling/report.json)13项通过；后者原始输出仅终端，报告明确没有另存原始日志。测试产品GUID签原始ABF描述，生产协议未改。[UTF8静态复用审查](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/fixture-tooling/utf8-reuse-06.json)只证明方法未变，不增加产品通过数。

[第一次系统链](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-01/application-handoff/report.json)通过fixture真实首装、中文登记及默认卸载，旧主机被夹具在生产WinForms初始化前启动Timer阻断，记1失败。[收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-01/isolated-account.json)确认SID1014及profile删除。Timer已改首次Application.Idle后启动，[准备06](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/handoff-prepare-06/report.json)重新封包两版60000／60001，0失败；准备材料不是Apply成功证明。

[第二次系统链](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-02/application-handoff/report.json)通过真实首装、精确中文登记、旧Native／Node主机及可信检查。下载阶段在获授权正常profile内的长路径partial失败，随后finally执行的真实Inno默认卸载返回1，两项均计失败；没有执行Apply、失败升级框架专项或正式GUID。原[卸载日志](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-02/application-handoff/uninstall-inno.log)缺helper返回码及Native关闭日志，无法判定是服务保存还是浏览器退出异常，不按耗时推断。SID1015及profile已[清理](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-02/isolated-account.json)，删除profile不替代产品卸载。

生产ApplicationUpdate已接入既有扩展路径IO封装，覆盖下载、partial清理、候选长度、helper复制及信任水位读取。[静态集成审查](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/static-io-integration-audit.json)另发现合法深度安装根的helper／安装器模块路径仍可能超过.NET Framework启动限制；该轮实际I长129，只观察到partial失败，没有实际执行Apply，不能将静态风险改写为已发生的进程启动失败。当前补充当前用户私有短路径字节副本及交接绑定，I／B／D／G和保存／退出门槛不变。

Inno增加实际helper退出码日志，验证工具补关闭诊断保全。[诊断静态审查](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/diagnostic-static-integration-audit.json)发现双流在readline关闭后可能暂停，工具已修复EOF归档边界；活动卸载专用模式及桌面快捷方式取消选择的升级保留检查随后进入定向验证。当时要求新候选与新准备材料，现已由候选15及准备13承接，不能套用14原字节证明。真实便携默认／外置迁移工具和独立账户模式已按便携10／候选15精确SHA绑定，尚未执行；完整首次启动容量、正式GUID、完整三链、迁移与推广仍待验。

## 1.0.6.14：安装候选与标准账户诊断（2026-10-15）

[冻结交付](../../artifacts/package-payloads/v1.0.6/ff8eb35cb3f0-9mGOFX/full/installer-delivery.json)对应[完整EXE](../../artifacts/releases/TableMax-1.0.6.14-win-x64.exe)，35,663,121字节，SHA `48cb4a6e2bc80ee409e41afd68356b684e0a949e17735b0d05c4f4be27bf4396`；payload43,995,554字节，程序暂存97,360,020字节。暂存不含实际框架与首次启动G，完整安装容量仍待测。源码保留候选13的31个游戏单元，显式复用原签名模块源，公开版本不变；[封包日志](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-candidate-build.log)与[本地已签正文](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/candidate14-body.md)均不表示发布。

内嵌卸载helper采用锁定Pascal Script原始八位Chr，严格Base64和长度／内存SHA／落盘SHA核验后只执行自身固定身份。[探针02](../../artifacts/maintenance/v1.0.6/installation-remaining/embedded-uninstaller-probe-02/results.json)通过全部0–255字节、填充、真实helper及10个拒绝向量；[新双PE准备03](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/handoff-prepare-profile-03/report.json)60000／60001实际编译封包通过，含严格profile范围校核，仍不是实际Apply或框架卸载证明。旧框架A在B失败后自行解码A helper的七步系统专项仍待执行。

真实临时标准账户已运行首个fixture Inno：文件、helper健康与快捷方式步骤后，在HKCU卸载登记RegCreateKeyEx code5失败并回滚；[原报告](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account/application-handoff/report.json)不改写为安装通过。[账户清理](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account/isolated-account.json)已确认账户及profile删除成功；[独立身份](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account/user-identity.json)包含真实SID／profile／AppData。正式GUID、Apply、失败升级恢复及完整首次启动容量尚未执行。

[候选14闭包首轮](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-seal-14/results.json)的安全上下文读取因WindowsPowerShell5.1加载Core7模块失败；仅隔离子进程Desktop模块路径／UTF8后，[新闭包9项](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-seal-14-repair-01/results.json)及[实际程序集验签](../../artifacts/maintenance/v1.0.6/installation-remaining/production-signature-dotnet-14/report.json)通过：Native22、helper22、稳定入口12项，源码／EXE字节未变。候选本地Authenticode为NotSigned、无MOTW，不能当作浏览器下载SmartScreen证明。此前resume-02累计4个失败条目，达到阈值停止新增动态验证，原失败仍保留，current原SHA及候选13原字节继续保护。

[两版只读账户诊断](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/registry-diagnostic/account-read-01/registry-account.json)确认真实新SID／profile和HKCU映射正确，DACL允许该用户FullControl，但probe为Low完整性、现存CurrentVersion写权限打开code5。工程根、Node和EXE继承Low mandatory label，根因及原字节见[只读证据](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/registry-diagnostic/mic-root-cause.json)；[Microsoft规则](https://learn.microsoft.com/en-us/windows/win32/secauthz/mandatory-integrity-control)说明Low进程即使DACL允许也不能写Medium对象。诊断不改注册表、标签或token，第二个临时账户及profile同样删除成功。用户已明确允许扩展此前工程tmp限制，在新标准用户正常profile验收；真实Medium token已核验，但随后中文登记校核失败，完整系统链仍未完成；不能把诊断完成当作安装／升级／卸载通过。

[Medium实际轮](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account-profile-02/application-handoff/report.json)保留Inno退出0及写登记成功日志；其后WindowsPS5.1默认码页的中文InstallLocation被Node按UTF8解码，两个失败步骤分别为首装目录断言及同因保护性卸载拒绝。原profile内fixture未走完默认卸载；[外层账户收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account-profile-02/isolated-account.json)通过删除本次账户及profile完成授权清理，不作为产品卸载通过。正式GUID、实际Apply、失败升级框架链、完整容量及推广仍未完成。

resume-02停止时，UTF8输出和逐流解码修复只完成静态审阅／格式化；其准备03保留旧工具SHA及原编译范围。随后续行03已完成编码专项、新准备与真实首装，最新失败及未验范围见本页上节，原失败不覆盖。已有账户／UAC／profile授权持续有效，源候选14及current原字节保留。

## 协调器修复与三失败停止（2026-10-15）

[底层恢复专项](../../artifacts/maintenance/v1.0.6/installation-remaining/recovery-coordinator-fixed-03/report.json)3/3通过，新增失败0、源码输入未变、收尾无错误且遗留进程0。完整候选精确匹配pending目标后只恢复协调器，保全原坏字节、配置、D／G及既有事务记录；同版本其他载荷不符、源安装器不符或无效签名目标均拒绝。新增修复子日志单独记录，不宣称pending整树零变化；数据库不回退。源码与完整输入SHA归[交接](../../artifacts/maintenance/v1.0.6/installation-remaining/recovery-coordinator-fixed-03/handoff.json)，测试是1.0.6.10独立产品GUID的组合fixture及直接helper卸载重装，不是候选13或实际Inno证明；已封候选13未包含此补丁。

[上轮记录](../../artifacts/maintenance/v1.0.6/installation-remaining/account-round-20261015.json)累计3失败后停止：账户描述超过48字符、fixture封包覆盖旧tmp sidecar、内嵌卸载探针编译类型不匹配。描述已修正，旧sidecar已精确恢复；当轮未创建账户或生成第三项setup。用户随后明确继续，解码修复和新候选状态见上节，不清零旧失败。

不同PE失败升级后，旧卸载框架固定SHA与新版live helper可能不一致；精确恢复新版helper不能替代旧框架实际卸载证明。[上轮草稿保全](../../artifacts/maintenance/v1.0.6/installation-remaining/unverified-bootstrap-drafts-01/drafts.json)及撤回按当时源码认定；本轮已恢复、修正并封入候选14，真实跨PE框架链仍待完成。原双PE材料仅历史证据，当前准备材料见上节。

## 1.0.6.13：安装候选与专项证据（2026-10-15）

候选13仍存在协调器复合恢复边界；后续源码的底层补丁只按上节组件证据认定，不反写进旧候选。框架bootstrap及真实不同PE失败恢复尚未闭合，接续见[任务缺口](../tasks/windows-installation-update.md#剩余验收与授权边界)，不将组件通过写成完整默认卸载重装保证。

待验安装候选为 [TableMax-1.0.6.13-win-x64.exe](../../artifacts/releases/TableMax-1.0.6.13-win-x64.exe)，对应[冻结交付](../../artifacts/package-payloads/v1.0.6/4e4f4f05f0a9-GUFTiZ/full/installer-delivery.json)与[成功封包日志](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-build-03/build.log)。EXE35,521,681字节，SHA `c45d0055d2f68e469dd432a56ec44cc373cdd7e48ff04c525bfce85c7a42b6df`；payload43,995,554字节、程序暂存97,354,419字节。后者尚未加入实际框架文件与首次启动模块物化计量，不能宣称完整首次启动门禁已通过。正式密钥的本地更新描述已签署并自验；尚待干净标准Windows用户的实际安装、升级、快捷方式及默认卸载证明，不推广current或发布。

[封包闭包9项](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-seal-13-repair-03/results.json)通过全部成员、实际PE文件版本、配方输入、6款正式游戏／7个玩法的当前映射和13个完整依赖blob、生产RSA签名及原交付保全。程序保留已签历史目录元数据，[映射说明](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-seal-13-repair-03/current-game-mapping.json)区分25条历史目录与7条实际预装发行；静态闭包不替代实际安装后物化、系统登记或默认卸载验收。

[实际内置生产根.NET验签](../../artifacts/maintenance/v1.0.6/installation-remaining/production-signature-dotnet-13/report.json)以候选原生壳／helper各22项通过正式envelope及正文机器块，绑定相同EXE／manifest／bootstrap；入口12项只核字节与身份，不宣称入口包含验签模块。探针不运行产品Main，不能抵扣真实安装启动与Apply链。

[实际向导最终轮](../../artifacts/maintenance/v1.0.6/installation-remaining/wizard-production13-r3-03-final/report.json)通过同SHA候选副本的默认src、精确提示「不推荐安装在C盘，因为这是一个有良心的安装包」、中文空格目标、桌面任务关／开／关、准备页、返回保留设置及正常取消。自有Job和未切换私有桌面限制操作范围，同普通SID的四登记视图前后为空，目标／受管文件未生成，未知资料及原EXE SHA保全，所有自有进程自然退出。7张PrintWindow图记录实际DPI144和物理窗口尺寸；初始选中文本未被绘出，默认目录由原生控件值证明。前两轮API、权限、线程、空窗口、后台UIA输入、取消等待及裁切捕获缺陷保留，不把失败清零；该证明未点击Install，也未验收UAC或Windows安全提示。

以下证据继续按各自源码、fixture、组合输入及原SHA认定，不能因候选13静态闭包通过而改写为正式系统安装通过。

| 专项与证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 已证明范围与限制                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [阶段1房间／服务保存关闭](../../artifacts/maintenance/test-history/runs/f3d34d35-5084-40e2-b1be-9f14e907e3cf/results.json)、[私有入口及隔离](../../artifacts/maintenance/test-history/runs/f8e8bf49-1562-4c23-ad61-4e15dfba3aec/results.json)、[原生停止8场景](../../artifacts/maintenance/test-history/runs/ba303024-d2de-4816-9a8a-6c453849c6cd/results.json)、[窗口退出](../../artifacts/maintenance/test-history/runs/97c31b1d-8117-40d8-be55-20223d589e55/results.json) | 队列排空、真实SQLite、保存失败／drained确认、私有协议与Native／Node／WebView2退出；阶段1隔离候选，不包含installer。原[异步关闭失败](../../artifacts/maintenance/test-history/runs/fed592ce-cca5-48d6-96a6-274133f9b7ed/results.json)保留 |
| [JS数值与签名](../../artifacts/maintenance/v1.0.6/application-update-signature/20261015-js-numeric-01/results.json)、[实际.NET更新管理19项](../../artifacts/maintenance/v1.0.6/installation-remaining/native-update-controller-19-longpaths/report.json)                                                                                                                                                                                                                     | 严格原字节签名、规范整数、版本／摘要绑定及真实检查／下载／取消逻辑；网络由管理HTTP夹具输送，不表示GitHub新附件已发布或实际Apply通过                                                                                                      |
| [实际长路径7项](../../artifacts/maintenance/v1.0.6/installation-remaining/native-long-path-20261015-032822/report.json)                                                                                                                                                                                                                                                                                                                                                      | 420字符受管成员及361字符事务日志真实IO；未修改系统长路径策略，不承诺任意深度Native／浏览器启动路径                                                                                                                                       |
| [事务受影响7项](../../artifacts/maintenance/v1.0.6/installation-remaining/transaction-affected-05/report.json)                                                                                                                                                                                                                                                                                                                                                               | 同构建实际helper、完整10成员数据库指纹、默认／外置D保全、默认卸载与同包重装健康。迁移输入为合法保全-only形状，不冒称历史版本兼容                                                                                                         |
| [pending受管损坏2项](../../artifacts/maintenance/v1.0.6/installation-remaining/transaction-pending-damage-06/report.json)                                                                                                                                                                                                                                                                                                                                                    | DB已变化时commit/recover明确40且保全；默认卸载精确隔离坏字节、缺失不伪造、拒绝未知／超预算受管内容，同完整包重装真实健康；构造日志不代表断电实测                                                                                         |
| [恢复指纹／持续租约交接](../../artifacts/maintenance/v1.0.6/installation-remaining/recovery-fingerprint-20261014-203339/handoff.json)、[跨进程数据独占](../../artifacts/maintenance/test-history/runs/828787df-12cd-4f5a-adf1-eba29d1c8634/results.json)、[服务回归](../../artifacts/maintenance/test-history/runs/91f4022b-6ddd-4e5f-a9b2-4d6c647a0c5d/results.json)                                                                                                        | 6项租约、foundation／journal指纹分支、commit/recover的playing拒绝及foundation库全生命周期独占；不以探测后关闭的句柄代表持续复制保护                                                                                                      |
| [helper启动模式4项](../../artifacts/maintenance/v1.0.6/installation-remaining/native-confirm-final-20261014-211319/handoff.json)                                                                                                                                                                                                                                                                                                                                             | 默认生产路径持续新主机；显式工程flag才用静音后台健康检查，双PEfixture持续分支独立；不抵扣真正Apply后的新主机健康                                                                                                                         |
| [真实旧1.0.6.3档4项](../../artifacts/maintenance/v1.0.6/installation-remaining/real-old-1063-03-clean-env/results.json)                                                                                                                                                                                                                                                                                                                                                      | 原资料SHA、玩家／座位／checkpoint、旧发行恢复及新局映射，真实playing Native拒绝pending恢复20；fixture／新helper组合输入，不包含真实Inno                                                                                                  |
| [更新界面与权限6项](../../artifacts/maintenance/v1.0.6/installation-remaining/helper-host-ui-06-clean-env/results.json)、[实际截图2项](../../artifacts/maintenance/v1.0.6/installation-remaining/helper-host-ui-07-capture/results.json)                                                                                                                                                                                                                                     | 实际主机／公共屏／浏览器／同源child权限和短屏更新面板，清继承注入环境。历史截图套件另有3失败，不称全套通过                                                                                                                               |
| [实际保存失败屏障2项](../../artifacts/maintenance/v1.0.6/installation-remaining/helper-save-barrier-04-clean-env/results.json)                                                                                                                                                                                                                                                                                                                                               | 隔离SQLite专属trigger触发真实保存失败后，Native拒绝更新、失败退出并保全最后成功状态、身份及原档；trigger只回收本轮创建项                                                                                                                 |
| [双PE准备](../../artifacts/maintenance/v1.0.6/installation-remaining/handoff-prepare-final-07/report.json)、[准备素材复验](../../artifacts/maintenance/v1.0.6/installation-remaining/handoff-reverify-final-08/report.json)                                                                                                                                                                                                                                                  | 60000／60001及进程内RSA的双fixture已准备／签名／逐字节复验，尚未执行实际检查下载Apply→父进程退出→Inno→新helper／持续主机                                                                                                                 |

[旧事务报告](../../artifacts/maintenance/v1.0.6/installation-remaining/transaction-positive-04/report.json)保持21通过与无效迁移夹具失败；[旧Inno失败诊断](../../artifacts/maintenance/v1.0.6/installation-remaining/delivery/fixture-qwPCp2-failed/report.json)和[helper-only健康](../../artifacts/maintenance/v1.0.6/installation-remaining/delivery/fixture-EovwuK-helper-health/report.json)均不升级为系统安装证明。失败修订11／12保留，修订13不复用其编号或结果。

仍未执行：真实干净标准用户的正式GUID首装、同根重装、实际快捷方式／卸载登记、默认卸载、完整首次启动容量，以及不同PE实际Apply／helper自身升级。临时账户及所需UAC已获用户授权，本轮因三失败停止；current推广另待精确完整证明，发布仍须明确授权。临时RSA、测试GUID、隔离环境变量、静态提取或向导取消均不能替代系统门禁。运行与发布契约分别归[构建与运行](build-and-run.md#windows-安装与整个程序更新)、[Release流程](release.md#完整安装器与免费应用签名2026-10-15)，实际入口见[验证工具](../../tools/test/README.md#完整安装与程序更新验证)。

工程进程退出后已完成[一次安全维护](../../artifacts/maintenance/v1.0.6/installation-remaining/maintenance-once/result.json)，回收7项缓存4,185,200字节及67项白名单副本86,289,239字节，安全候选耗尽后停止；[全量逻辑体积](../../artifacts/maintenance/v1.0.6/installation-remaining/workspace-capacity-after.json)12,596,402,720字节，未达8GiB。原current、候选13、双PE素材／准备报告SHA仍匹配；维护前后测量时点不同，不按差值推算回收量。只读文档收尾不追加cleanup。

退役成员及原SHA见[维护清单](../../artifacts/maintenance/local-cleanup-20261014-221625-488-maintenance/cleanup.json)。封包闭包9项在维护前完成；维护后关键SHA仅由本轮终端补核，未另写独立保护报告，不把维护前结果充作维护后证明。

## 1.0.6.10：宝可梦新设计应用（2026-10-12）

当前本地完整程序为 [TableMax-1.0.6.10-win-x64.exe](../../artifacts/releases/TableMax-1.0.6.10-win-x64.exe)，公开版本仍为1.0.6。新局使用 `events-research-v3`，统一144张、17项研究、单格超梦及六类随机事件；旧存档、checkpoint及原局下一小局固定原发行。Mega与羁绊仅展示主题占位，7项缺失研究插图采用符合新条件的代码场景。主机／公共隐藏玩家缓冲，本人端保留操作；天气角标、环境层、全屏能力与路卡利欧画像波导已接入。

[实际完整EXE证明](../../artifacts/maintenance/v1.0.6/windows-editions/63b12c9af279f4a374a51d80dfa4e9251ac1f9f1c54b6b467c3cd62d1336c41a/shipping-executable-checks-full.json)通过载荷全部哈希、96成员集合、重复提取及隐藏原生WebView2／包内Node安全。EXE **44,096,512字节**，内部ZIP **43,964,478字节**，实际提取 **97,009,047字节**，均严格小于120,000,000字节。宝可梦扩展模块 **3,717,195字节**（[同包严格预算证明](../../artifacts/maintenance/v1.0.6/pokemon-events-v3-verification/module-budget-10610.json)），本轮仍按4,194,304字节门禁，新增4份运行图片共167,594字节。EXE SHA-256为 `93207df18d568e808ea903ce5d538fe1835323f80a523af95a09241eeb6364bc`，冻结快照与内部载荷由[当前指针](../../artifacts/package-payloads/v1.0.6/current.json)绑定。

源码适用检查已通过：新配置、半分／负分及多暗行计分、144张守恒、单格秘密权限、事件原子保存与恢复、三档2–6人完整三胜矩阵、6席32MiB真实Worker混合大局、原版差分与旧profile回归。人机矩阵及138,392ms混合Worker结果见[人机验证边界](../games/pokemon-encounters/bot.md#当前验证边界)。默认浮钮已修正横竖切换的右缘位置及滚动避让，5项模型检查和类型检查通过。

同一个EXE的适用专项已全部通过：[真实服务与旧发行恢复](../../artifacts/maintenance/v1.0.6/pokemon-expansion-runtime/events-v3-10610-d/results.json)、[显示矩阵](../../artifacts/maintenance/v1.0.6/network-adaptation/game-audit/events-v3-10610-a/results.json)、[演出](../../artifacts/maintenance/v1.0.6/pokemon-expansion-effects/events-v3-10610-b/results.json)、[结算与授胜](../../artifacts/maintenance/v1.0.6/pokemon-expansion-awards/events-v3-10610-a/results.json)和[自然游玩](../../artifacts/maintenance/v1.0.6/pokemon-expansion-normal-play/events-v3-10610-b/results.json)。服务专项6个受控合法事件场景经真实Socket与SQLite保存，对照实际包内规则、单张私看、随机状态及暗牌投影；真实1.0.6.3旧局的恢复、回退、重启和下一小局仍保持原发行。18张肖像、16张无损卡面、8个主题音频、27个叫声及4张新增运行图的离线哈希／解码通过。

显示矩阵含2／4／6人、手机320–430px竖屏及568–932px横屏、电脑720p至4K横竖与短屏／长昵称／浮窗／100／125／150%模拟缩放；1,674次布局审计、422次真实点击、37次草稿保留、425组天气角标几何记录及54格结算通过。记录自然按钮高度、18px主要动作、44px触区及多点点击命中。自然随机对局没有遇到所有能力和事件，未遇阶段单列，固定合法场景补验独立记录；不以随机游玩代替全覆盖。

演出专项106,490ms通过59帧既有姿态、13条序列、路卡利欧画像波导、六类事件三身份、减少动态／取消／恢复不重播，以及原版喷火龙／卡比兽真实规则触发。自然游玩使用实际服务和本人UI，记录15次叫声成功播放；技术播放不表示真人听感已认可。独立查看六人结算、手机雨天角标和能力入场，布局与角色辨识清晰；简化演出仍需真人美术认可。失败达到3项停止后定向复验，原失败与修复过程见[归档](../archive/completed-tasks-2026-10-10.md#宝可梦新设计应用2026-10-12)。实体手机、现场LAN、物理DPI、真人听感、美术认可、7项插图、Mega／羁绊独立效果与时长平衡继续[待验收](../tasks/pokemon-encounters-expansion.md)。本轮仅本地交付，不发布Release／Pages或源码ZIP。

## 当前源码与本地交付

当前本地交付为本页[宝可梦新设计应用](#10610宝可梦新设计应用2026-10-12)的 `TableMax-1.0.6.10-win-x64.exe`与本地清单；内部payload、manifest及 `current.json`位于 `artifacts/package-payloads/v1.0.6/`。预装6款正式游戏／7个玩法，新局固定本EXE的验证映射；旧局按原精确发行继续。当前交付与实际证明保留，同包专项状态以上节为准，历史构建只按各自哈希和原结果认定。

EXE、内部载荷、原图、签名仓库和本地验收不随源码push上传。公开版本仍为1.0.6，线上已发布附件保持2026-10-11的原字节，本地1.0.6.10尚未发布。提交／推送不授权Release或Pages部署，不生成源码ZIP。

此前深度瘦身实测 **5,896,919,854逻辑字节**（含受保护嵌套仓库），达到当次6GB目标；1.0.6.10交付收尾实际退役6,526,191,088字节，维护实测10,340,767,910逻辑字节（9.631GiB，排除链接与嵌套仓库），低于默认10GiB阈值，追加删除0，见[本轮瘦身记录](project-slimming.md#宝可梦新版交付收尾2026-10-12)。历次“原包保留”和容量数字仅表示当时状态；已按审计退役的历史包／截图由当前精确清单说明，不修改原失败、文字结论或逐文件哈希。

本页[手写改动单第1项](#106手写改动单第1项2026-10-11)曾交付运行ZIP，SHA `0048f55745f66c289eed918b78efccb058afbd4e2014bbc67655d36cc3be52c5`；该真实旧包作为明确迁移／验证输入保留在独立历史目录。下方更早的电力公司及宝可梦整合结论仍限定原版本，不表示当前需下载ZIP或重复其完整整局检查。

## 1.0.6.3：关闭与WebView2资源释放（2026-10-12）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#1063关闭与webview2资源释放2026-10-12)。

## 1.0.6：唯一完整 EXE（2026-10-12）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106唯一完整-exe2026-10-12)。

## 1.0.6：版本适应性与本地四位版本（2026-10-12）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106版本适应性与本地四位版本2026-10-12)。

## 1.0.6：游戏包失败原因细化（2026-10-12，源码）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106游戏包失败原因细化2026-10-12源码)。

## 1.0.6：下载文字与EXE命名微调（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106下载文字与exe命名微调2026-10-11)。

## 1.0.6：阿瓦隆唯一配置与并发密投（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106阿瓦隆唯一配置与并发密投2026-10-11)。

## 1.0.6：安装索引并发与临时journal恢复修复（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106安装索引并发与临时journal恢复修复2026-10-11)。

## 1.0.6：测试选择与证据复用（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106测试选择与证据复用2026-10-11)。

## 1.0.6：安装故障矩阵与验收范围调整（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106安装故障矩阵与验收范围调整2026-10-11)。

## 1.0.6：轻量目录与统一玩法控件（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106轻量目录与统一玩法控件2026-10-11)。

## 1.0.6：空盒子大厅与两种Windows EXE（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106空盒子大厅与两种windows-exe2026-10-11)。

## 1.0.6：Pages部署与同版本重新发布（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106pages部署与同版本重新发布2026-10-11)。

## 1.0.6：Pages准备、盒子界面与人机发言（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106pages准备盒子界面与人机发言2026-10-11)。

## 1.0.6：独立游戏包与公共作者契约（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106独立游戏包与公共作者契约2026-10-11)。

## 1.0.6：手写改动单第1项（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106手写改动单第1项2026-10-11)。

## 1.0.6：UNO右侧白边与手牌宽度（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106uno右侧白边与手牌宽度2026-10-11)。

## 1.0.6：拉密交互完善与恢复开放（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106拉密交互完善与恢复开放2026-10-11)。

## 1.0.6：手写bug第5–7条修复（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106手写bug第57条修复2026-10-11)。

## 1.0.6：手写bug前四条修复（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106手写bug前四条修复2026-10-11)。

## 1.0.6：盒子12席显示兼容（2026-10-10，源码专项）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106盒子12席显示兼容2026-10-10源码专项)。

## 1.0.6：经典阿瓦隆（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106经典阿瓦隆2026-10-10)。

## 1.0.6：更新构建（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106更新构建2026-10-10)。

## 1.0.6：UNO 交互优化（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106uno-交互优化2026-10-10)。

## 1.0.5：经典 UNO 完整本地交付（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105经典-uno-完整本地交付2026-10-10)。

## 1.0.5：发言面板优化（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105发言面板优化2026-10-09)。

## 1.0.5：盒子初始选择与网址入口（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105盒子初始选择与网址入口2026-10-09)。

## 1.0.5：玩家互动音效触摸解锁（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105玩家互动音效触摸解锁2026-10-09)。

## 1.0.5：拉密经典版本地完整交付（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105拉密经典版本地完整交付2026-10-09)。

## 1.0.5：GitHub发布核验（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105github发布核验2026-10-09)。

## 1.0.5：菜单、互动并发与手机同步（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105菜单互动并发与手机同步2026-10-09)。

## 1.0.5：互动精修与即时覆盖（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105互动精修与即时覆盖2026-10-09)。

## 1.0.5：盒子调整与跨游戏互动（2026-10-08）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105盒子调整与跨游戏互动2026-10-08)。

## 1.0.4：网络连接与多设备页面适配（2026-10-08）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#104网络连接与多设备页面适配2026-10-08)。

## 1.0.4：玩家比例与游戏工作区修订（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104玩家比例与游戏工作区修订2026-10-08)。

## 1.0.4：滚动条与电脑玩家横屏（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104滚动条与电脑玩家横屏2026-10-08)。

## 1.0.4：根入口、研究风险与公开缓冲重设计（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104根入口研究风险与公开缓冲重设计2026-10-08)。

## 1.0.4：电脑玩家手机视窗、盒子排版与远程续验（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104电脑玩家手机视窗盒子排版与远程续验2026-10-08)。

## 1.0.3：10.7 浏览器玩家、实时恢复与换机（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103107-浏览器玩家实时恢复与换机2026-10-08)。

## 1.0.3：全量构建与GitHub发布交付（2026-10-07）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103全量构建与github发布交付2026-10-07)。

## 1.0.3：扩展需求复查与演出时序（2026-10-07）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103扩展需求复查与演出时序2026-10-07)。

## 1.0.3：扩展版能力消耗、原版演出与全量构建（2026-10-07）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103扩展版能力消耗原版演出与全量构建2026-10-07)。

## 1.0.3：电力公司数量采购、进度与稳定反馈（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司数量采购进度与稳定反馈2026-10-06)。

## 1.0.3：宝可梦扩展深度界面与整合交付（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦扩展深度界面与整合交付2026-10-06)。

## 1.0.3：电力公司地图材质、动画与综合资料细化（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司地图材质动画与综合资料细化2026-10-06)。

## 1.0.3：电力公司地图与带图公司卡优化（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司地图与带图公司卡优化2026-10-06)。

## 1.0.3：宝可梦扩展版UI重设计（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦扩展版ui重设计2026-10-06)。

## 1.0.3：游戏介绍弹窗布局修复（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103游戏介绍弹窗布局修复2026-10-06)。

## 1.0.3：单EXE专属目录初始化微调（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103单exe专属目录初始化微调2026-10-06)。

## 1.0.3：便携存储配置与大存档启动修复（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103便携存储配置与大存档启动修复2026-10-06)。

## 1.0.2：测试静音与资源瘦身（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102测试静音与资源瘦身2026-10-06)。

## 1.0.2：扩展版一次性技术收尾（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102扩展版一次性技术收尾2026-10-06)。

## 1.0.2：普通前瞻三胜目标同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102普通前瞻三胜目标同包续验2026-10-06)。

## 1.0.2：三胜目标修复同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102三胜目标修复同包续验2026-10-06)。

## 1.0.2：累积能力模型同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102累积能力模型同包续验2026-10-06)。

## 1.0.2：火箭队能力估值与角色无损格式续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102火箭队能力估值与角色无损格式续验2026-10-06)。

## 1.0.2：普通收局前瞻与无损卡面续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102普通收局前瞻与无损卡面续验2026-10-06)。

## 1.0.2：扩展版三胜策略与叫声同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102扩展版三胜策略与叫声同包续验2026-10-06)。

## 1.0.2：电力公司地图背景与阶段抽屉（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102电力公司地图背景与阶段抽屉2026-10-06)。

## 1.0.2：前瞻均值修复与普通模式同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102前瞻均值修复与普通模式同包续验2026-10-06)。

## 1.0.2：扩展版续建、预算与同包复核（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102扩展版续建预算与同包复核2026-10-06)。

## 1.0.2：本地宝可梦扩展版技术可玩包（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102本地宝可梦扩展版技术可玩包2026-10-05)。

## 1.0.2：完整EXE发布与维护规则更新（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102完整exe发布与维护规则更新2026-10-05)。

## 1.0.4：独立增量构建与分块组装（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104独立增量构建与分块组装2026-10-05)。

## 1.0.4：新手引导开关与同版本更新（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104新手引导开关与同版本更新2026-10-05)。

## 1.0.4：合并打包与实际便携检查（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104合并打包与实际便携检查2026-10-05)。

## 1.0.3：任务完成后合并重打包与复核（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103任务完成后合并重打包与复核2026-10-05)。

## 1.0.3：电力公司人机、分页与声画 debug（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司人机分页与声画-debug2026-10-05)。

## 1.0.3：宝可梦操作引导、同值归零与动漫切入（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦操作引导同值归零与动漫切入2026-10-05)。

## 1.0.3：宝可梦原创图文规则页（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦原创图文规则页2026-10-05)。

## 1.0.3：宝可梦人机、能力演出与版本复用（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦人机能力演出与版本复用2026-10-05)。

## 1.0.3：电力公司真实 UI 试玩与第二轮优化（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司真实-ui-试玩与第二轮优化2026-10-05)。

## 1.0.2：合并深度检查与项目瘦身（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102合并深度检查与项目瘦身2026-10-05)。

## 1.0.2：电力公司界面与原创规则图解（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102电力公司界面与原创规则图解2026-10-05)。

## 1.0.2：宝可梦声画与手机优化（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102宝可梦声画与手机优化2026-10-05)。

## 1.0.2：现代艺术优化（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102现代艺术优化2026-10-05)。

## 1.0.2：盒子 debug（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102盒子-debug2026-10-04)。

## 1.0.2：本地重新导出与 releases 清理（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102本地重新导出与-releases-清理2026-10-04)。

## 历史截图去重（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#历史截图去重2026-10-04)。

## 本地项目整理与瘦身（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#本地项目整理与瘦身2026-10-04)。

## 历史验收导航

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#历史验收导航)。

## 1.0.2：电力公司 debug，横向地图、价区与声画（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#102电力公司-debug横向地图价区与声画2026-10-04)。

## 1.0.2：通用视觉、规则说明与项目瘦身（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102通用视觉规则说明与项目瘦身2026-10-04)。

## 1.0.2：现代艺术 debug 修复（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#102现代艺术-debug-修复2026-10-04)。

## 1.0.2：版本导出与历史清理（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#102版本导出与历史清理2026-10-04)。

## 1.0.1：电力公司经典德国版（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101电力公司经典德国版2026-10-04)。

## 1.0.1：现代艺术真实对局排查（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101现代艺术真实对局排查2026-10-04)。

## 1.0.1：现代艺术视听与共用倒计时（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101现代艺术视听与共用倒计时2026-10-04)。

## 1.0.1：盒子头像与游戏介绍（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101盒子头像与游戏介绍2026-10-04)。

## 1.0.1：宝可梦画面与动效返修（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101宝可梦画面与动效返修2026-10-04)。

## 1.0.1：应用图标更新（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101应用图标更新2026-10-03)。

## 1.0.1：GitHub Release（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101github-release2026-10-03)。

## 执行与证据

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#执行与证据)。

## AC 对照

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#ac-对照)。

## 首版维护：独立牌桌与操作简化

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护独立牌桌与操作简化)。

## 使用与维护

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#使用与维护)。

## 首版维护：视觉纠错与场景打磨

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护视觉纠错与场景打磨)。

## 首版维护：角色卡面与管理员体验

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护角色卡面与管理员体验)。

## 首版维护：聚会可靠性与连续游玩

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护聚会可靠性与连续游玩)。

## 首版维护：手机围桌与三档人机

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护手机围桌与三档人机)。

## 首版维护：游玩节奏与六人提示

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护游玩节奏与六人提示)。

## 首版维护：电脑多分辨率显示

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护电脑多分辨率显示)。

## 1.6.0：盒子、对局体验与可靠性

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#160盒子对局体验与可靠性)。

## v1.0.0：版本归一与开发效率优化

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#v100版本归一与开发效率优化)。

## 1.0.0：同版本视觉优化（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100同版本视觉优化2026-10-03)。

## 1.0.0：独立视觉审查与返修（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100独立视觉审查与返修2026-10-03)。

## 1.0.0：便携包语言精简（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100便携包语言精简2026-10-03)。

## 1.0.0：原生桌面与小体积交付（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100原生桌面与小体积交付2026-10-03)。

## 1.0.0：现代艺术独立接入（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100现代艺术独立接入2026-10-03)。

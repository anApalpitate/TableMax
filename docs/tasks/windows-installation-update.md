# Windows 安装、卸载与盒子内更新

## 任务接续速查

- 创建日期：2026-10-14（Asia/Shanghai）；最新接续：2026-10-15。阶段0／1完成，其余阶段已有基础实现与专项；真实系统链和最终容量尚未闭合，本任务继续开放。
- 用户已授权完整离线安装器、默认保留数据卸载、盒子内可信检查／下载及明确重启更新。公开版本仍为1.0.6；current仍为已验证便携1.0.6.10。候选16已封包，三条fixture系统链各8步通过；随后正式GUID首装受验证器临时路径布局阻断，新增1失败，全部待验完成前不推广或发布。候选15及原失败独立保留。
- 候选16为[冻结交付](../../artifacts/package-payloads/v1.0.6/b97714007d0e-KYZUyd/full/installer-delivery.json)，EXE35,708,409字节，SHA `34abe1e75925630da7c8c4905671c44b3c5562833c37b2168a0abf98c017714f`。保留原31游戏单元而未重建游戏；原候选15的[冻结交付](../../artifacts/package-payloads/v1.0.6/29c81e29c4a3-1H6Xye/full/installer-delivery.json)、EXE35,713,286字节及SHA `fcf3627c873558d8e551bdf5b73019a83b156d41bfebd08a4a8a66375f872df2`，原候选14的[冻结交付](../../artifacts/package-payloads/v1.0.6/ff8eb35cb3f0-9mGOFX/full/installer-delivery.json)、EXE35,663,121字节及SHA `48cb4a6e2bc80ee409e41afd68356b684e0a949e17735b0d05c4f4be27bf4396`作为历史保留。不发布GitHub／Pages或生成发布source ZIP。
- 精确证据及历史范围统一进入[当前候选16与续行08](../reference/acceptance.md#续行08旧框架保全时序修复2026-10-15)；本页保留剩余安排，完整系统链通过前不归档全任务。

- [x] 阶段0／1：安装契约冻结、保存关闭与隔离底座；[准备归档](../archive/windows-installation-preparation-2026-10-15.md)保留原决策。
- [x] 原候选前置：可信协议与控制器组件专项、候选13原SHA的生产根验签、真实向导取消和适用专项；不抵扣续行03发现的下载长路径故障。
- [x] 底层协调器精确恢复与拒绝专项；源码已进入新候选14。
- [x] Inno内嵌解码类型修复：全部0–255字节、1／2／3字节填充、真实helper内存／落盘SHA和10项非法编码拒绝通过；新旧不同PE安装副本已重新编译封包。
- [x] 候选14完整静态闭包9项、实际Native／helper各22项验签及稳定入口12项身份检查；原SHA和失败保留。
- [x] UTF8修复专项：实际WindowsPS5.1五出口中文／空格／emoji JSON及真实逐字节双流解码，共7项通过；不代替安装业务验收。
- [x] 修复后控制器定向复验：长路径下载1项及partial取消／流中断／错误SHA清理3项通过，均为组件证据，不抵扣短副本启动或系统安装链。
- [x] 句柄修复后实际活跃卸载4步通过；临时标准账户／profile已清理。私有短目录安全与精确清理组件8项通过，仍不抵扣Apply。
- [x] 同I198／同PE的短外D诊断4步通过且账户清理成功；统一生命周期／容量门禁10项纯测试通过，不抵扣实际重装恢复或容量测量。
- [x] 普通I／默认D的fixture真实首装、检查下载、不同PE Apply、父退出、新持续主机健康及默认卸载等7步通过；交接审计因对象prototype比较失败1项，不能认定完整链通过。
- [x] 后续启动精确清理组件新增5项通过，包含历史成功目标；使用合成不可执行成员，不抵扣实际Native下一启动清理。
- [x] 候选15真实封包、静态闭包9项及实际Native／helper各22项生产根验签、launcher12项身份检查通过；准备13原报告独立保存，不抵扣系统链。
- [x] 续行07双fixture普通I／默认D和长I／短外D各完整8步通过，含真实Apply、新持续主机、独立下一启动清理及默认卸载；不抵扣正式GUID或修复后新包。
- [x] 候选16封包、闭包9项及实际Native／helper各22项验签、launcher12项身份检查通过；Prepare提交时序修复后的普通I／默认D、长I／短外D、旧框架失败恢复各完整8步通过，含旧框架／登记／快捷方式原字节保全。
- [ ] 阶段2–6剩余：修正正式验证器TEMP布局后继续正式GUID系统链、旧便携默认／外置数据迁移、卸载后重装恢复、完整首次启动容量与验后推广。

## 剩余验收与授权边界

临时标准账户、Windows UAC及新标准用户profile普通目录均已于2026-10-15明确授权。测试只使用本项目同SHA临时副本，验后删除账户及新建profile，凭据仅内存；不修改原工程Low标记、token、DACL、系统保护、防火墙或发布。授权继续有效，无需重复询问。

原规则要求达到三失败后停止原run、依据证据修复，并仅复验受影响项；[验证规则](../reference/validation.md#历史通过率与失败阈值)没有要求实质修复后另获用户许可。此前“是否另开一轮”的额外审批问题已撤回，不把未答复视为新同意。原续行03累计3失败和全部证据保留，既有账户／UAC／profile授权继续适用；不会只因换goal、turn或目录而清零或重试未修复输入。

### 历史候选15与续行07

候选15的candidate SHA为`5a767509273ed1ee392cc3df24c00100b8be38fe38b17c5696d1cfcda7cdb23e`，snapshot为`29c81e29c4a385e747133a116f5ea154aa6b53f00540e8064395a25fca6cc829`。[闭包9项](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/production-seal-15-repair-01/results.json)及[实际程序集验签](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/production-signature-15/report.json)通过，后者Native／helper各22项，launcher12项只核身份和字节，不执行产品Main。原31游戏单元及current原SHA保留；97,491,605字节程序暂存尚不含真实框架／首次启动G，不能替代完整容量。[本地交付上下文](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/production15/local-delivery-context.json)为NotSigned、无ZoneIdentifier，未观察浏览器下载，不证明SmartScreen体验。

[续行06账本](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/round.json)最终3失败保留：prototype比较、seal参数正则、PS7父进程误用Desktop模块路径的autoload失败。[续行07](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-07/round.json)先有Inno版本字符串空白及fixture四位ProductVersion比较两项包装器预检失败，修正后实际框架保全又失败，累计3后停止；不改候选15或原[准备13](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/handoff-prepare-13/report.json)字节。组件／闭包／验签继续按原输入复用，两条正向通过和框架失败分别记录如下，不能认定正式GUID或三链通过。

### 续行08：框架保全时序修复

续行07的[普通I／默认D](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-07/production-account-15-03/application-handoff/report.json)与[长I／短外D](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-07/production-account-15-03/application-handoff-long-root-external-data/report.json)各8步实际通过、0失败，含父退出0、新持续主机、独立下一启动清理及精确默认卸载。原报告SHA分别为`28bf9b4122513894936a76013a7abfa25106579a92da5b0bab7ea76e770d8482`、`2d6d83a3b7acec0221424e7aa5b35b5f75b0a18868f919ee0970be6e47b375ac`，只证明对应双fixture输入。

[框架链](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-07/production-account-15-03/application-framework-recovery/report.json)前4步通过，B已按预期健康失败并改变数据库；随后`framework-old-uninstaller-retained`发现A的unins EXE／dat被改写，报告failed、1失败，SHA `dd52524222afbac9f74d058ace5a2aa38a248268b3caf5326c28d9940d858645`。Inno捕获AfterInstall异常后继续写框架及登记，最后才自定义返回40；该40不证明安装已在健康失败处中止。finally实际默认卸载通过，只证明收尾，不补证原A框架保全或缺live helper恢复。[隔离收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-07/production-account-15-03/isolated-account.json)SHA `59a566823493d04b611be16da19788844f50eab9979f12eaab6f0ce692b85ad7`确认账户／profile均已删除，driver退出1；正式GUID、重装容量与迁移未执行。

[续行08](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-08/round.json)按实质时序修复从0失败开始：唯一生产变更ISS，以dontcopy内嵌candidate，在PrepareToInstall原权限／root检查后显式提取，同步完成helper提交／健康确认；错误返回非空，成功后才允许Inno写框架／登记。ISS源码SHA `a2383deefb359cc27e92ba61d20d3df8ddf5f5b4ca01ea682e88cbf276254813`，其余生产源与15相同。候选16已封包，[闭包9项](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-08/production-seal-16/results.json)及[实际程序集验签](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-08/production-signature-16/report.json)通过；原15和全部失败保留。

本轮[普通I／默认D](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-08/production-account-16-01/application-handoff/report.json)、[长I／短外D](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-08/production-account-16-01/application-handoff-long-root-external-data/report.json)及[旧框架恢复](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-08/production-account-16-01/application-framework-recovery/report.json)各8步实际通过、0失败。框架链实际证明B健康40／外层准备拒绝7、A框架EXE／dat／登记／快捷方式原字节保全，且live helper缺失后由A内嵌协调器实际默认卸载，D/G/config保全；对应fixture的检查下载、不同PE Apply、父退出0、新持续主机、真实下一启动清理亦通过，不扩为正式GUID证明。

随后正式GUID首装outer7，新增1失败。[保全的install.log](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-08/production-account-16-01/installer-logs/install.log)SHA `6e8394373c711301cbce08e67df7c62170f165273833190c5c46046ab5511091`显示首个64hex blob提取路径279字符即失败，尚未启动helper或写安装框架；属于验证器将TEMP嵌在本次work／验证子目录下的布局问题。下一步只缩短同一已授权profile/work内的验证器TEMP，不改候选16／ISS或游戏载荷，不分配17。[隔离收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-08/production-account-16-01/isolated-account.json)SHA `b9333d82bd550121b86e39b4dc2e5289ad7d69a80211e32e2f3fd46e936b3aa0`确认SID1024账户及profile均已删除，driver退出1；正式保存／卸载重装、完整容量及两项旧便携迁移尚待。

### 续行06：短外D分类与最终验收门禁

[续行05](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/round.json)最终累计3失败：两次I198默认D首次健康确认失败，以及新增验收工具的1项ESLint错误。第二次启动诊断证实Node与WebView2环境均ready，COM `0x800705B4`发生于`CreateCoreWebView2ControllerAsync`；未到Apply。两次临时账户／profile均已清理。工具遗漏的显式异常cause已修复并定向复验，不清除原失败。

[续行06](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/round.json)的[短外D独立诊断](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/startup-external-account-01/application-startup-external-data/report.json)在同I198及同PE下通过实际首装、宿主就绪和活跃卸载，共4步、0失败；新账户／profile清理成功。D固定为本次私有work/D，G仍在B，配置rawSHA未变，日志取自实际D。该对照说明问题与数据目录有关，不能单独断言UDF长度是唯一原因，也不能代替默认D或Apply证明。

完整正向验证据此拆为普通I／默认D和I198／显式短外D两条；后者保留长helper273／下载317与实际短副本模块观察。冻结契约不承诺任意深度I／D；原I198默认D失败保留为已测限制，不通过搬缓存、目录别名或系统策略绕过。旧框架恢复仍用原短I／默认D。

[普通I／默认D首轮](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/three-chains-account-01/application-handoff/report.json)中7步实际通过：材料核验、旧Inno首装、旧主机、检查下载、真实Apply父交接、新持续主机健康及精确默认卸载；`handoff-helper-and-data`在原值相同的普通对象与null-prototype对象比较处失败，原报告仍为failed、1失败，SHA `94db1b804fb9d37d691dbffe21fca560b1005b81615d85aff4cb9c4552e9852e`。仅修复验证工具的表示差异，字节摘要和字段门槛不放宽。[隔离收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/three-chains-account-01/isolated-account.json)SHA `b785e5d2da64260df5eca317d4645b6b43eaa629f46736304a1975c4a6b893ac`确认账户及profile均删除；该报告失败计入续行06最终3失败。长I完整链和旧框架恢复当轮未执行，不把七步通过写成三链通过。

`ApplicationUpdate`构造读取实际信任根和安装receipt后，仅本地同步调用`InstallationLaunch.CleanupFinished`。只从本安装B的`handoff-UUID`审计索引私有TEMP，要求同实例／SID／根、全部安装事务终态、已完成目标不高于当前版本，且原RSA描述、目标清单／receipt、旧helper和原始审计摘要精确匹配；运行中或未知、篡改、pending均保留。成功时按已核验的原句柄删除TEMP的h／存在的i／元数据及B旧helper，再删除已空私有目录；B公共审计／envelope／handoff和canonical大下载保留，后者原字节元组写入`cleanup.json`并另计缓存。[新增5项组件](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/completed-cleanup-component/report.json)通过、0新增失败，原报告SHA `1137be8d24e3163df7b5197ae10df605e6e85f8ecb1171ccb326e96a318a1403`，覆盖成功／历史目标及幂等、pending、未知成员、篡改和占用保全。它们实际编译调用Core和RSA校验，但成员不可执行、进程观察为合成记录；真实下一启动现由续行07两条正向链分别证明，组件原报告范围不变。

正式验收工具已补实际保存玩家→默认卸载→同根重装读回→再次默认卸载，以及同一真实采样的安装文件／当前G分项和其他数据占用观察，尚待系统运行。推广与未来发布共用唯一严格验收门禁；[10项纯测试](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-06/publication-gates/results.json)全部通过，只证明缺失恢复证据、容量口径篡改及既有身份／签名门槛的拒绝逻辑。

### 当前修复：进程句柄保全与续行05

续行04已累计3失败并停止原run。实际日志定位到helper的`stop.native-exit`阶段抛出`System.InvalidOperationException`、`HResult=0x80131509`：Framework通过`GetProcessById`取得的对象未持久保留句柄，`WaitForExit`释放临时句柄后读取`ExitCode`可能因`NoProcessHandle`失败。源码已在Stop及Apply两处于请求／握手前持有`.Handle`；保存确认、精确PID／路径及退出0门槛保持。

[续行05](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/round.json)保留前轮失败，按新来源复验。[活跃卸载03](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/active-uninstall-account-03/application-active-uninstall/report.json)四步实际通过、0失败，报告SHA `d270a8786476320d8a8674bc59a6f06a09e0461afe44c82ea31502518e7d054c`；driver退出0且新账户／profile清理成功。[短目录组件](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/native-launch-component/report.json)8项通过，覆盖创建时ACL、原字节绑定、篡改／未知成员拒绝和仅清理自建同SHA文件，不运行任何安装器或helper。

该轮完整fixture的I改为198，使最长重定向快捷方式259，helper原路径273、下载原路径317仍超过260。[完整链01](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-05/chains-account-01/application-handoff/report.json)初次旧Inno健康确认失败、返回40，计1项失败；当时仅记录COM `0x800705B4`超时，未取得具体await阶段／堆栈。随后诊断、最终三失败及续行06的独立分类见上节，不把该首次失败改写为Node启动故障或Apply结果。

### 续行04：组件通过与活动卸载失败

[修复轮记录](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/round.json)绑定实质修复后的生产源码和工具SHA。已通过[长路径控制器](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/controller-long-path/report.json)1项、0失败，1851ms；[partial清理控制器](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/controller-partial-cleanup/report.json)的cancel／broken-stream／wrong-sha共3项、0失败。它们使用实际net48控制器与文件系统、合成安装成员及管理HTTP传输，不启动Native／Node，不证明真实GitHub下载、私有短TEMP的ACL／进程启动、Apply或正式安装。

另有[新harness格式调用误入Corepack](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/launch-harness-tooling-failure-01.json)、exit1，计1项环境失败；不改变上述4项组件各自0失败。其后两次实际活动卸载各失败1项，续行04累计3后停止。

[准备07](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/handoff-prepare-07/report.json)按当时源码真实编译封包60000／60001，结果为`prepared-not-executed`、0失败；[只读材料复核](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/handoff-prepare-07/static-review.json)绑定18源、原MJS及两份recipe／实际EXE字节。后续句柄修复和I198改变后必须重新准备，不能直接复用原材料。

[活动卸载07](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/active-uninstall-account-01/application-active-uninstall/report.json)通过材料、真实首装与旧主机三步，默认卸载失败；Native退出0、双流完整到EOF、desktop.log记录`Service shutdown: drained`，但helper10／Inno1，原证据不足以唯一归因。[收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/active-uninstall-account-01/isolated-account.json)确认SID1016账户及profile已删除。

[活动卸载08](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/active-uninstall-account-02/application-active-uninstall/report.json)同样前三步通过、卸载失败；[实际Inno日志](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/active-uninstall-account-02/application-active-uninstall/uninstall-inno.log)记录`stage=stop.native-exit`、上述异常类型及HResult，Native正常退出0，helper10／Inno1。[收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-04/active-uninstall-account-02/isolated-account.json)确认SID1017账户及profile已删除。Native退出0和服务drained不证明Stop已成功返回，更不证明产品卸载；两次均未执行正式候选，current10及候选14保留。

### 原续行03失败与修复边界

用户明确持续完成全任务后，建立[续行03](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/round.json)，保留前轮全部失败。[UTF8专项](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/encoding-probe/report.json)7项实际通过，范围仅为编码、分流和字节计数。静态审查另发现fixture签名产品ID与TEST程序集不一致、public Quit误用私有反射，以及新版ready早于Inno登记完成的时序风险；先修正验证底座再重新准备双PE，不放宽生产签名协议。阶段0的真实旧便携默认／外置数据迁移仍须验收，不能因旧表遗漏而视为完成。

续行03的首个[系统链](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-01/application-handoff/report.json)通过真实fixture首装、中文精确登记及默认卸载；旧主机启动被fixture提前启动WinForms Timer的初始化时序阻断，本轮记1失败。新SID1014及profile已[清理](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-01/isolated-account.json)，卸载通过与账户删除分别保留。计时器改为生产消息循环首次Idle后启动；修复后须重新封包双PE，正式GUID、Apply和框架专项尚未执行。

[准备06](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/handoff-prepare-06/report.json)编译封包通过后，[第二次系统链](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-02/application-handoff/report.json)通过真实首装、精确登记、旧Native／Node主机及签名检查；下载partial长路径失败，随后真实默认卸载返回1，共新增2失败。本轮累计3后停止新增动态，不自动重试。SID1015及profile已[清理](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-02/isolated-account.json)，不把删除profile写成产品卸载通过。

下载控制器已补既有扩展路径IO。[静态集成审查](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/static-io-integration-audit.json)另确认：合法安装根深度仍可能令交接helper及下载EXE的模块路径超过.NET Framework进程启动限制；这与该轮实际发生的partial写入失败分别记录，不能把尚未执行的Apply写成已观察失败。当前补充当前用户私有短路径启动副本、严格元数据绑定与原始字节核验；组件IO已进入上节定向复验，短副本启动及完整系统链仍待验。I／B／D／G及保存关闭契约不变。

卸载缺少helper返回码与Native日志，根因尚未分类，已补诊断供定向复验定位，不放宽exit0或保存确认。[诊断静态审查](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/diagnostic-static-integration-audit.json)发现readline关闭可能暂停原双流并漏掉尾部字节；工具已补EOF及提前脱离锁存，晚到EOF不能覆盖归档不完整。另增加活动卸载专用入口与升级保留“取消桌面快捷方式”选择的断言；均为源码准备，不能替代真实系统证明。

上述修复现已封入候选15并完成准备13，候选14不能推广。续行04原run已停止，既有证据继续按原来源认定。真实便携迁移底座已按候选15精确SHA更新，尚未执行。[完整范围静态审计](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/completion-scope-audit.md)逐项列出阶段2–6的43项要求及当时证据缺口，不作为新增通过数；其中“待另开轮用户批准”是后来已撤回的人为门槛，原字节作为历史快照保留，不用于当前授权判断。

本次接续另完成[生产修复静态交接](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/short-launch-static-01.json)、[handoff工具静态检查](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/handoff-static-followup-01.json)和[账户驱动PS5.1解析](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/fixture-driver-static-01/windows-powershell-ast.json)。独立审查发现的TEMP盘根会被裁成盘符相对路径，已在归一化及关闭前明确拒绝；没有改全局路径规则。当时完整链计划I长200及实际模块路径／元数据绑定断言按原源码认定，后续I198夹具仍待重新准备及实际验证。

已推送阶段提交 `babc3d3` 保存当时的验证底座及文档，`2515729` 保存后续静态检查通过的诊断工具准备和文档。生产长路径修复、私有启动副本和Inno helper退出码日志保留在工作区，待受影响编译及适用验证后提交。controller已按续行04范围取得组件证据；退出诊断、活动卸载及迁移模式仍按“源码准备／静态检查”认定，不作为动态通过。公开版本、current及候选14原字节不改。

此前resume-02累计4项失败及Low标签、profile物化、UTF8修复的完整边界保留于[候选14诊断](../reference/acceptance.md#10614安装候选与标准账户诊断2026-10-15)。续行03的准备04／05／06各按原sourceSHA认定；最新生产IO及日志改动后均不能直接作为下轮新工具准备材料。旧证据不覆盖，不把局部通过升级为正式系统链。

| 剩余事项                 | 完成条件                                                                            | 当前接续                                                        |
| ------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 下载IO与卸载失败闭合     | 长路径真实下载／Apply可达；取得真实卸载helper及Native退出原因并保持保存、exit0门槛  | 16对应双fixture正向各8步通过；不扩为正式GUID证明                |
| 候选16证明绑定           | 精确三PE／全部成员／配方及原31游戏单元保全，实际程序集验签后绑定后续系统验收        | 16封包、闭包9项与Native／helper各22及launcher12项通过，正式待验 |
| 注册表环境与真实首装     | 正常Medium标准用户首装及精确中文登记；正式GUID另验                                  | fixture已通过；正式首装TEMP布局失败1项，helper前拒绝            |
| 不同PE Apply及helper升级 | 旧Native检查／下载／Apply、保存关闭与父退出、同Inno升级及新持续主机健康             | 08两条正向各8步通过，含真实下一启动清理                         |
| 框架bootstrap失败恢复    | A实际安装、B健康失败且DB变化、A框架保全、live helper缺失后实际A卸载，D/G/config保全 | 08实际8步通过，原A框架／登记／快捷方式保全及7／40分别确认       |
| 正式GUID安装／重装／卸载 | 精确最终候选登记、快捷方式、identity／receipt及默认卸载，保全数据并清理账户/profile | 修正验证器TEMP布局后继续；SID1024账户／profile已清理            |
| 旧便携默认／外置数据迁移 | 真实便携生成合法保存与G；实际Inno迁移，默认D复制／外置D保指针，旧根与默认卸载保全   | 源码及独立driver模式已按16精确SHA更新，实际迁移尚未执行         |
| 完整首次启动容量         | app、稳定入口、helper、框架卸载文件、归属清单和当前G严格小于120,000,000字节         | 尚待正式首装完成后测量；静态程序暂存不替代完整门禁              |
| current推广与安全体验    | 最终系统证明绑定精确候选与账户清理rawSHA，核原current后原子切换并诚实记录安全上下文 | current仍10，16尚待正式证明；NotSigned／无Zone不证明SmartScreen |

候选13的恢复缺口和三失败历史保留于[历史小节](../reference/acceptance.md#协调器修复与三失败停止2026-10-15)。新源码、输入或候选字节改变后只复验受影响范围；管理HTTP传输夹具不等于真实线上附件发布。

## 已有证据入口与复用限制

| 证据                                                                                                                                                                                                                                                                                                                                                                      | 可复用范围                                                                                                                                    | 不能替代                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [候选13封包闭包9项](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-seal-13-repair-03/results.json)与[当前映射说明](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-seal-13-repair-03/current-game-mapping.json)                                                                                            | 实际三PE、暂存／ZIP全部成员、配方、保留31原游戏单元、6正式游戏／7玩法与13依赖blob、原current保全                                              | 实际框架安装、首启动物化、快捷方式、默认卸载                                                                                     |
| [实际内置生产根.NET互操作](../../artifacts/maintenance/v1.0.6/installation-remaining/production-signature-dotnet-13/report.json)                                                                                                                                                                                                                                          | Native／helper各22项真实程序集验签；launcher12项仅字节、GUID及版本                                                                            | 产品Main启动、真实Apply及helper升级                                                                                              |
| [候选13向导最终轮](../../artifacts/maintenance/v1.0.6/installation-remaining/wizard-production13-r3-03-final/report.json)                                                                                                                                                                                                                                                 | 同SHA副本默认src、精确中文提示、中文空格目标、桌面任务关／开／关、准备页／返回／正常取消；登记前后为空、无新受管文件、未知资料与原EXE SHA保全 | 点击Install、系统安装／卸载、UAC／SmartScreen。DPI144完整截图来自实际窗口；初始选中文本未被PrintWindow绘出，目录值由原生控件证明 |
| [真实1.0.6.3旧档4项](../../artifacts/maintenance/v1.0.6/installation-remaining/real-old-1063-03-clean-env/results.json)、[保存失败屏障2项](../../artifacts/maintenance/v1.0.6/installation-remaining/helper-save-barrier-04-clean-env/results.json)、[实际界面与权限](../../artifacts/maintenance/v1.0.6/installation-remaining/helper-host-ui-06-clean-env/results.json) | 旧局身份／checkpoint／原发行、新局映射、playing恢复拒绝、SQLite失败保全及角色／frame权限                                                      | 候选13正式Inno系统链；fixture／组合输入保持各自来源和SHA                                                                         |
| [helper受影响7项](../../artifacts/maintenance/v1.0.6/installation-remaining/transaction-affected-05/report.json)、[pending损坏2项](../../artifacts/maintenance/v1.0.6/installation-remaining/transaction-pending-damage-06/report.json)、[指纹与租约交接](../../artifacts/maintenance/v1.0.6/installation-remaining/recovery-fingerprint-20261014-203339/handoff.json)    | 同构建事务、10数据库成员指纹、默认／外置D保全、卸载重装、持续租约、数据库变化后同目标确认／保留数据卸载                                       | 真实断电、不同PE完整更新、外层框架卸载器及系统登记                                                                               |

原失败不改写：[旧事务轮](../../artifacts/maintenance/v1.0.6/installation-remaining/transaction-positive-04/report.json)只有21项通过，另有无效迁移夹具失败；[旧Inno诊断](../../artifacts/maintenance/v1.0.6/installation-remaining/delivery/fixture-qwPCp2-failed/report.json)包含health和HKCU拒绝；[早期helper健康](../../artifacts/maintenance/v1.0.6/installation-remaining/delivery/fixture-EovwuK-helper-health/report.json)只是helper链。向导早期API／权限／线程／取消等待失败及裁切捕获缺陷保留，最终轮不清零历史统计。失败修订11／12不复用。

## 阶段 1 完成记录（2026-10-15）

此标题保留原入链。保存关闭长期行为见[平台规格](../reference/phase-02-platform-spec.md)及[保存关闭与安装隔离底座](../reference/validation.md#保存关闭与安装隔离底座2026-10-15)，操作入口见[保存关闭屏障与隔离底座](../../tools/test/README.md#保存关闭屏障与隔离底座)。

[原始异步关闭失败](../../artifacts/maintenance/test-history/runs/fed592ce-cca5-48d6-96a6-274133f9b7ed/results.json)、[房间／服务专项](../../artifacts/maintenance/test-history/runs/f3d34d35-5084-40e2-b1be-9f14e907e3cf/results.json)、[私有入口与隔离](../../artifacts/maintenance/test-history/runs/f8e8bf49-1562-4c23-ad61-4e15dfba3aec/results.json)、[原生停止8场景](../../artifacts/maintenance/test-history/runs/ba303024-d2de-4816-9a8a-6c453849c6cd/results.json)和[隐藏窗口退出](../../artifacts/maintenance/test-history/runs/97c31b1d-8117-40d8-be55-20223d589e55/results.json)继续限定阶段1源码／合成数据／隔离候选，不抵扣后来installer系统验收。

## 接续维护

安装范围、I／B／D／G、默认卸载及旧便携迁移契约归[构建与运行](../reference/build-and-run.md#windows-安装与整个程序更新)；RSA、密钥、版本及发布门禁归[Release流程](../reference/release.md#完整安装器与免费应用签名2026-10-15)。入口见[测试工具](../../tools/test/README.md#完整安装与程序更新验证)和[交付工具](../../tools/release/README.md)。实施前建议不再作为当前事实保留于任务页。

工程进程退出后已完成[一次现有安全维护](../../artifacts/maintenance/v1.0.6/installation-remaining/maintenance-once/result.json)：退役7项缓存4,185,200字节、67项白名单副本86,289,239字节。安全候选耗尽，不追加第二轮；[全量逻辑体积](../../artifacts/maintenance/v1.0.6/installation-remaining/workspace-capacity-after.json)为12,596,402,720字节，未达到8GiB目标。候选13、原current、双PE素材及准备报告SHA保留；维护前后时点不同，不能直接相减作为回收量。当前只读文档维护不再执行cleanup。

退役逐项记录见[维护清单](../../artifacts/maintenance/local-cleanup-20261014-221625-488-maintenance/cleanup.json)。封包闭包9项发生在维护前；维护后关键SHA由本轮终端补核，未另建独立保护报告，不能把维护前的封包记录标成维护后证明。

全部剩余验收完成后，由主agent汇总精确证明、按已授权完整交付范围更新current并归档本任务。账户／UAC／profile范围授权持续有效，实质修复后仅定向复验受影响项并保留原失败；推广仍须完整证明，发布须另行明确授权。

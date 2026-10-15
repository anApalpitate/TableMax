# Windows 安装、卸载与盒子内更新

## 任务接续速查

- 创建日期：2026-10-14（Asia/Shanghai）；最新接续：2026-10-15。阶段0／1完成，其余阶段已有基础实现与专项；真实系统链和最终容量尚未闭合，本任务继续开放。
- 用户已授权完整离线安装器、默认保留数据卸载、盒子内可信检查／下载及明确重启更新。公开版本仍为1.0.6；current仍为已验证便携1.0.6.10；新安装候选1.0.6.14已封包，尚未推广或发布。
- 候选14为[冻结交付](../../artifacts/package-payloads/v1.0.6/ff8eb35cb3f0-9mGOFX/full/installer-delivery.json)，EXE35,663,121字节，SHA `48cb4a6e2bc80ee409e41afd68356b684e0a949e17735b0d05c4f4be27bf4396`。已包含精确协调器恢复与框架内嵌helper；原候选13及current原字节保留。不发布GitHub／Pages或生成发布source ZIP。
- 精确证据及历史范围统一进入[当前安装候选](../reference/acceptance.md#10614安装候选与标准账户诊断2026-10-15)；本页保留剩余安排，完整系统链通过前不归档全任务。

- [x] 阶段0／1：安装契约冻结、保存关闭与隔离底座；[准备归档](../archive/windows-installation-preparation-2026-10-15.md)保留原决策。
- [x] 阶段4及原候选前置：可信检查下载、候选13原SHA的生产根验签、真实向导取消和适用专项。
- [x] 底层协调器精确恢复与拒绝专项；源码已进入新候选14。
- [x] Inno内嵌解码类型修复：全部0–255字节、1／2／3字节填充、真实helper内存／落盘SHA和10项非法编码拒绝通过；新旧不同PE安装副本已重新编译封包。
- [ ] 候选14完整静态闭包及实际内置生产根.NET验签。
- [ ] 阶段2／3／5／6剩余：真实不同PE Apply、失败升级旧框架卸载、正式GUID系统链、完整首次启动容量与验后推广。

## 剩余验收与授权边界

临时标准账户及所需Windows UAC已于2026-10-15多次明确授权，并在本次继续指示中重申；验后删除该账户及新建profile，凭据仅内存，测试限工程临时副本，不改防火墙或发布。无需重复询问相同授权。

用户明确继续后建立[新轮记录](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/round.json)，保留[上轮3失败](../../artifacts/maintenance/v1.0.6/installation-remaining/account-round-20261015.json)，不覆盖或清零历史。新轮当前2／3：真实标准账户首个fixture Inno在HKCU卸载登记RegCreateKeyEx code5拒绝；候选闭包附加的Windows签名上下文读取遇到PowerShell5.1安全模块加载错误。后者是工具环境问题，不是RSA或EXE字节不符。先只读诊断原因，不盲目重跑。

[实际账户报告](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account/isolated-account.json)确认新账户及profile均已删除；[真实身份](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account/user-identity.json)证明独立标准SID、profile及AppData归一。首个Inno已执行文件、helper健康和快捷方式步骤，但在保存登记时失败并回滚框架；不把它写成首装通过。Apply、失败升级专项和正式GUID链尚未执行。

当前只读诊断核对HKCU实际native对象、显式新SID hive、逐层ACL和restricted token；不开新注册表键、不修改DACL、不关闭保护。只有原因明确并修复相应工具／环境后，才使用原授权继续受影响测试；累计3失败即停止本轮产品验证。

| 剩余事项                   | 完成条件                                                                                                | 当前接续                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 新候选完整闭包与生产根验签 | 精确三PE、完整成员、配方／内嵌helper、原31游戏单元及current保全，实际程序集验签                         | [首轮闭包](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-seal-14/results.json)前4项通过，工具环境错误后停止，未自动重试     |
| 注册表环境与真实首装       | 真实新标准用户可创建自己的卸载登记；不能更改保护或跳过登记                                              | [首次真实链](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account/application-handoff/report.json)因HKCU code5失败，先诊断 |
| 不同PE Apply及helper升级   | 旧Native真实检查／下载／Apply、保存关闭与父退出、同Inno升级及新持续主机健康                             | [新双PE准备](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/handoff-prepare/report.json)通过，仅准备不等于执行                          |
| 框架bootstrap失败恢复      | 实际A安装、B健康失败且DB变化，A框架原字节保留、live helper缺失后实际A卸载成功，D／G／配置／未知资料保全 | [解码探针](../../artifacts/maintenance/v1.0.6/installation-remaining/embedded-uninstaller-probe-02/results.json)通过；真实七步专项待执行                     |
| 正式GUID安装／重装／卸载   | 精确最终候选的当前用户登记、快捷方式、身份、receipt及默认卸载，保全数据，账户／profile成功清理          | fixture首装登记未通，正式GUID尚未运行                                                                                                                        |
| 完整首次启动容量           | app、稳定入口、helper、框架卸载文件、归属清单和当前必需G物化严格小于120,000,000字节                     | 候选14暂存97,360,020字节不含实际框架及首次G，不能替代门禁                                                                                                    |
| current推广与安全体验      | 最终系统证明绑定精确字节与清理报告，核对原current SHA后授权入口原子切换；诚实记录安全上下文             | current仍10；本地无MOTW／静默运行不能冒称浏览器下载SmartScreen通过。发布另须明确授权                                                                         |

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

全部剩余验收完成后，由主agent汇总精确证明、按已授权完整交付范围更新current并归档本任务。本次按新增明确授权继续账户系统验收；推广仍须完整证明，发布须另行明确授权。

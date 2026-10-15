# Windows 安装、卸载与盒子内更新

## 任务接续速查

- 创建日期：2026-10-14（Asia/Shanghai）；最新接续：2026-10-15。阶段0／1完成，其余阶段已有基础实现与专项；真实系统链和最终容量尚未闭合，本任务继续开放。
- 用户已授权完整离线安装器、默认保留数据卸载、盒子内可信检查／下载及明确重启更新。公开版本仍为1.0.6；current仍为已验证便携1.0.6.10；安装候选1.0.6.14原字节保留；后续IO与诊断修复尚未封包，全部待验完成前不推广或发布。
- 候选14为[冻结交付](../../artifacts/package-payloads/v1.0.6/ff8eb35cb3f0-9mGOFX/full/installer-delivery.json)，EXE35,663,121字节，SHA `48cb4a6e2bc80ee409e41afd68356b684e0a949e17735b0d05c4f4be27bf4396`。已包含精确协调器恢复与框架内嵌helper；原候选13及current原字节保留。不发布GitHub／Pages或生成发布source ZIP。
- 精确证据及历史范围统一进入[当前安装候选](../reference/acceptance.md#10614安装候选与标准账户诊断2026-10-15)；本页保留剩余安排，完整系统链通过前不归档全任务。

- [x] 阶段0／1：安装契约冻结、保存关闭与隔离底座；[准备归档](../archive/windows-installation-preparation-2026-10-15.md)保留原决策。
- [x] 原候选前置：可信协议与控制器组件专项、候选13原SHA的生产根验签、真实向导取消和适用专项；不抵扣本轮发现的下载长路径故障。
- [x] 底层协调器精确恢复与拒绝专项；源码已进入新候选14。
- [x] Inno内嵌解码类型修复：全部0–255字节、1／2／3字节填充、真实helper内存／落盘SHA和10项非法编码拒绝通过；新旧不同PE安装副本已重新编译封包。
- [x] 候选14完整静态闭包9项、实际Native／helper各22项验签及稳定入口12项身份检查；原SHA和失败保留。
- [x] UTF8修复专项：实际WindowsPS5.1五出口中文／空格／emoji JSON及真实逐字节双流解码，共7项通过；不代替安装业务验收。
- [ ] 阶段2–6剩余：下载长路径与实际卸载失败闭合、新候选封包／验签、真实不同PE Apply、失败升级旧框架卸载、正式GUID系统链、旧便携默认／外置数据迁移、完整首次启动容量与验后推广。

## 剩余验收与授权边界

临时标准账户、Windows UAC及新标准用户profile普通目录均已于2026-10-15明确授权。测试只使用本项目同SHA临时副本，验后删除账户及新建profile，凭据仅内存；不修改原工程Low标记、token、DACL、系统保护、防火墙或发布。授权继续有效，无需重复询问。

用户明确持续完成全任务后，建立[续行03](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/round.json)，保留前轮全部失败。[UTF8专项](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/encoding-probe/report.json)7项实际通过，范围仅为编码、分流和字节计数。静态审查另发现fixture签名产品ID与TEST程序集不一致、public Quit误用私有反射，以及新版ready早于Inno登记完成的时序风险；先修正验证底座再重新准备双PE，不放宽生产签名协议。阶段0的真实旧便携默认／外置数据迁移仍须验收，不能因旧表遗漏而视为完成。

续行03的首个[系统链](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-01/application-handoff/report.json)通过真实fixture首装、中文精确登记及默认卸载；旧主机启动被fixture提前启动WinForms Timer的初始化时序阻断，本轮记1失败。新SID1014及profile已[清理](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-01/isolated-account.json)，卸载通过与账户删除分别保留。计时器改为生产消息循环首次Idle后启动；修复后须重新封包双PE，正式GUID、Apply和框架专项尚未执行。

[准备06](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/handoff-prepare-06/report.json)编译封包通过后，[第二次系统链](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-02/application-handoff/report.json)通过真实首装、精确登记、旧Native／Node主机及签名检查；下载partial长路径失败，随后真实默认卸载返回1，共新增2失败。本轮累计3后停止新增动态，不自动重试。SID1015及profile已[清理](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-03/production-account-02/isolated-account.json)，不把删除profile写成产品卸载通过。

下载控制器已补既有扩展路径IO，保持身份／URL／进程路径及关闭门槛。卸载缺少helper返回码与Native日志，根因尚未分类，已补诊断以便下一获准轮定位，不放宽exit0或保存确认。新源码尚未编译／动态验证，须新候选及重新prepare；候选14不能推广。已询问用户是否在保留原3失败后另开验收轮，账户／UAC／profile原授权不变。真实便携迁移底座已完成源码和静态检查，尚未执行，须按下一精确候选更新当前14白名单。

本次阶段提交仅保存验证底座及文档；生产ApplicationUpdate长路径修复和Inno helper退出码日志保留在工作区，待下一获准轮编译及适用验证后提交。新增长路径controller场景、退出诊断和迁移模式均按“源码准备／静态检查”认定，不作为动态通过；公开版本、current及候选14原字节不改。

此前resume-02累计4项失败及Low标签、profile物化、UTF8修复的完整边界保留于[候选14诊断](../reference/acceptance.md#10614安装候选与标准账户诊断2026-10-15)。续行03的准备04／05／06各按原sourceSHA认定；最新生产IO及日志改动后均不能直接作为下轮新工具准备材料。旧证据不覆盖，不把局部通过升级为正式系统链。

| 剩余事项                 | 完成条件                                                                            | 当前接续                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 下载IO与卸载失败闭合     | 长路径真实下载／Apply可达；取得真实卸载helper及Native退出原因并保持保存、exit0门槛  | IO源码已修，诊断补齐中；3失败后停止新增动态，待获准新轮                      |
| 新候选闭包与生产根验签   | 按新源码封包，精确三PE／全部成员／配方及原31游戏单元保全，实际程序集验签            | 14原闭包9项与验签按原字节保留；新源码须新候选，尚未封包                      |
| 注册表环境与真实首装     | 正常Medium标准用户首装及精确中文登记；正式GUID另验                                  | 两次fixture首装与精确中文登记已通过；不能代替正式GUID                        |
| 不同PE Apply及helper升级 | 旧Native检查／下载／Apply、保存关闭与父退出、同Inno升级及新持续主机健康             | 真实旧主机与检查已过，下载长路径失败；Apply尚未执行                          |
| 框架bootstrap失败恢复    | A实际安装、B健康失败且DB变化、A框架保全、live helper缺失后实际A卸载，D/G/config保全 | 尚未执行，解码与组件恢复证据不代替七步系统专项                               |
| 正式GUID安装／重装／卸载 | 精确最终候选登记、快捷方式、identity／receipt及默认卸载，保全数据并清理账户/profile | 尚未执行；本轮第二次fixture卸载失败未闭合                                    |
| 旧便携默认／外置数据迁移 | 真实便携生成合法保存与G；实际Inno迁移，默认D复制／外置D保指针，旧根与默认卸载保全   | 源码、独立driver模式及静态检查完成；当前14白名单须按下一精确候选更新，未执行 |
| 完整首次启动容量         | app、稳定入口、helper、框架卸载文件、归属清单和当前G严格小于120,000,000字节         | 未测；候选14暂存97,360,020字节不能替代完整门禁                               |
| current推广与安全体验    | 最终系统证明绑定精确候选与账户清理rawSHA，核原current后原子切换并诚实记录安全上下文 | current仍10，候选14不推广；浏览器下载SmartScreen与发布另有明确门禁           |

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

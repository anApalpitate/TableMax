# Windows 安装、卸载与盒子内更新

## 任务接续速查

- 创建日期：2026-10-14（Asia/Shanghai）；最新接续：2026-10-15。阶段0／1已完成，阶段2–6已有基础实现和专项，恢复边界与实际系统安装／升级全链仍未闭合，本任务继续开放。
- 用户已授权实现完整离线安装器、整个程序默认保留数据卸载、盒子内可信检查／下载及明确重启更新。公开版本仍为1.0.6，候选13源码检查点为 `3c01d0b`；后续组件修复另按源码SHA与专项报告绑定。
- `current.json` 仍绑定原便携完整 **1.0.6.10**；[原包与证明](../reference/acceptance.md#当前源码与本地交付)继续按原字节认定。
- 已冻结安装候选为 **1.0.6.13**：[冻结交付](../../artifacts/package-payloads/v1.0.6/4e4f4f05f0a9-GUFTiZ/full/installer-delivery.json)，EXE SHA `c45d0055d2f68e469dd432a56ec44cc373cdd7e48ff04c525bfce85c7a42b6df`。协调器复合恢复缺口确认后暂缓推广；原字节保留，修复后另分配新候选。不发布GitHub／Pages或生成发布source ZIP。
- 已完成事项及历史范围统一见[安装候选与专项证据](../reference/acceptance.md#10613安装候选与专项证据2026-10-15)。本页只保留剩余接续和必要证据入口，完整系统验收通过前不归档全任务。

- [x] 阶段0／1：安装契约冻结、保存关闭与隔离底座；[详细准备记录](../archive/windows-installation-preparation-2026-10-15.md)保留原结论和证据边界。
- [x] 阶段4及候选前置：可信检查下载、候选13封包、生产根验签、真实向导取消与适用隔离专项。
- [x] 底层协调器精确恢复：完整候选／目标／receipt／源安装器／运行helper核验、坏字节保全和拒绝专项；只通过组件验证，尚未进入正式候选。
- [ ] 阶段2／3／5／6剩余：框架协调器bootstrap、真实系统链、完整首次启动容量及验收后推广。

## 剩余验收与授权边界

用户已于2026-10-15明确授权一次性标准测试账户及Windows UAC，验后删除该账户与新建profile；凭据仅内存，测试限工程临时副本，不修改防火墙或发布。该授权继续有效，后续接续不重新询问同一授权。本轮实际创建账户0、正式Inno安装0；未推广current、未分配候选14或发布。

本轮累计3失败后已按AGENTS第11条停止，不自动重试：[轮次记录](../../artifacts/maintenance/v1.0.6/installation-remaining/account-round-20261015.json)分别保留账户Description过长（创建前拒绝，已修正并提交 `fc81049`）、fixture输出覆盖旧tmp清单（按原SHA恢复，旧EXE／ZIP／release manifest未变），以及内嵌卸载探针的 `AnsiChar(Integer)` 编译类型不匹配（未生成或运行setup）。不清零历史结果，不为文档收尾继续产品验证或追加安全维护。

数据库已变的pending事务同时丢失／损坏协调器时，候选13存在恢复循环；[底层修复3项](../../artifacts/maintenance/v1.0.6/installation-remaining/recovery-coordinator-fixed-03/report.json)已通过baseline、既有pending载荷损坏和新协调器复合场景，涵盖两种故障、同版本其他载荷不符／源安装器不符／无效签名目标拒绝、坏字节保全及恢复后helper直接卸载重装。仅可恢复与pending目标完全一致的可信完整包内协调器，不回退数据库；新增修复日志与坏字节副本不被误写为pending整树不变。输入与边界见[交接](../../artifacts/maintenance/v1.0.6/installation-remaining/recovery-coordinator-fixed-03/handoff.json)，不抵扣实际Inno证明。

尚未闭合的是框架bootstrap：不同PE升级失败时，旧框架仍可能固定A版helper SHA，而live／pending已是B版；补回B不能证明旧框架可卸载。内嵌固定SHA协调器及真实跨PE失败专项目前只是[未验证草稿](../../artifacts/maintenance/v1.0.6/installation-remaining/unverified-bootstrap-drafts-01/drafts.json)，已逐文件保全10份源／探针输入并[撤出当前构建路径](../../artifacts/maintenance/v1.0.6/installation-remaining/unverified-bootstrap-drafts-01/restoration.json)，不纳入已验证提交。下一步先修正二进制写出方式并完成全字节／真实helper无登记探针，再冻结两版新素材；实际B健康失败且DB变化、A框架原字节保留、live helper缺失后A框架默认卸载与数据保全均须真实验证。

| 剩余事项                                     | 完成条件                                                                                                                                                                    | 当前状态／前置材料                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 框架bootstrap与跨PE失败恢复                  | 框架自带协调器严格解码／SHA通过，实际A安装、B健康失败且数据库变化后，A框架默认卸载可达；D／G／配置／未知资料保全                                                            | 当前探针编译失败，源码草稿已隔离保全；禁止仅凭底层helper专项冻结或放行                                                                                                                                                                                                              |
| 正式产品ID首装、同根重装、快捷方式和默认卸载 | 在真实干净标准Windows用户中执行修复后最终候选的同一完整Inno；核对当前用户登记、启动／卸载快捷方式、身份、receipt、未知资料及配置／D／G保全，最终卸载和账户／profile清理成功 | 已获临时账户及UAC授权；首轮驱动在创建账户前失败，描述长度已修正。恢复修复与新候选冻结后继续，不能靠隔离环境变量绕过登记                                                                                                                                                             |
| 完整首次启动容量                             | 实际安装后计入app、稳定入口、helper、框架卸载文件、归属清单及当前必需G物化，逻辑字节严格小于120,000,000；历史模块、存档、缓存及暂存峰值另列                                 | 暂存97,354,419字节不含实际框架文件与首次启动G，不能替代最终门禁                                                                                                                                                                                                                     |
| 更高不同PE构建原目录升级及helper自身升级     | 实际旧Native检查／下载／Apply，经保存关闭及父进程正常退出握手，调用真实Inno，由新helper确认新持续Native／Node身份和健康，保全设置、D／G和原资料                             | 原[双PE准备](../../artifacts/maintenance/v1.0.6/installation-remaining/handoff-prepare-final-07/report.json)及[复验](../../artifacts/maintenance/v1.0.6/installation-remaining/handoff-reverify-final-08/report.json)仍仅历史材料；helper源码已变，须重新prepare，未执行Apply／Inno |
| 推广唯一安装交付                             | 系统证明精确绑定最终候选的EXE／payload／manifest／映射、真实隔离账户及成功清理；复验原current SHA后，由授权推广入口原子切换                                                 | 等待完整系统证明，推广沿已授权完整交付范围，推广不另分配已验候选修订，不以helper或向导取消证明放行                                                                                                                                                                                  |
| 系统安全提示与发布                           | 真实记录Windows安全提示／SmartScreen；后续获发布授权后只上传完整installer EXE与发布提交source ZIP，正文含唯一可信机器块                                                     | 尚未验收／发布；免费项目RSA不等同Authenticode，不关闭系统保护                                                                                                                                                                                                                       |

后续接续先闭合框架bootstrap，再以新候选／新prepared材料闭合实际不同PE Apply与正式Inno系统链，复核完整首次启动容量和保全后按既有授权及推广门禁切换current。入口见[完整安装与程序更新验证](../../tools/test/README.md#完整安装与程序更新验证)；临时账户与所需UAC已明确授权。向导浏览／取消按原SHA复用，不扩大游戏整局矩阵；本轮三失败后不继续上述验证。

候选、helper、源码或输入发生字节变化时，记录新身份和失败原因，只重跑实际受影响项；已有专项保持原SHA及范围。未执行的双PE素材须全部哈希／签名复验后使用，不把管理HTTP夹具写成真实线上附件下载。

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

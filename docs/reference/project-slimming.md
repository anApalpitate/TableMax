# 项目瘦身方案与执行记录

## 构建与验证自动维护落地（2026-10-10）

已接入专属 Node 运行时指纹、精选截图／精确复用、成功验证产物登记及空闲收尾。真实收尾按当前 ZIP 便携证明、引用／最近两份缓存、30分钟、成员哈希、进程及互斥保护核验255个过期模块缓存；第一次处理204项后因另一工程检查运行而停止，剩余51项随后完成，原目标合计1,052,690,943逻辑字节。中断范围由[原预览与恢复审计](../../artifacts/maintenance/v1.0.6/automatic-maintenance/1791638391423-bff77553-2a7f-4619-a000-76a43546cf98/cache-recovery-audit.json)绑定，后续943,762,189字节及逐文件哈希／逐项操作见[实际缓存清单](../../artifacts/maintenance/v1.0.6/build-cache-cleanup/1791638424885-apply.json)和相邻jsonl；两者有包含关系，不重复相加。

[完整维护结果](../../artifacts/maintenance/v1.0.6/automatic-maintenance/1791638391423-bff77553-2a7f-4619-a000-76a43546cf98/result.json)实测9,629,649,087逻辑字节（8.968GiB），低于10GiB，广域Maintain追加删除0。新登记验证目录与额外截图仍受近期保护，旧未知／未登记产物保留。当前运行ZIP哈希48d71a06…与原证明一致；没有重新打包或增加版本号。首次大量缓存审计／中断约5分45秒，恢复剩余约1分39秒，属于本次存量处理耗时。适用回归及真实盒子、UNO、阿瓦隆样本通过；长期命令与边界归[自动维护](../../tools/maintenance/README.md)。

## 盒子12席显示兼容收尾（2026-10-10）

本轮93组源码布局检查、结束操作与人数筛选通过，全部构建／浏览器进程已退出。[维护实测](../../artifacts/maintenance/v1.0.6/box-seats/maintenance-final.log)为 **10,331,898,891逻辑字节（9.622GiB）**，低于10GiB，`Maintain-Project.ps1 -Apply`追加删除0，不扩大清理。三份已结束源码夹具约6MB经精确预览核对，仍保留默认30分钟近期保护；首次手动清理因沙箱CIM进程查询限制未执行删除，之后按默认维护入口收尾。当前ZIP／清单、素材、规则资料、存档、失败报告和8张当前源码截图保留，未重新打包。

## 阿瓦隆制作收尾（2026-10-10）

最终阿瓦隆ZIP的五人／六人原生验证、单图审查、冻结源码与实际包审计通过，全部本轮构建／验证／审计进程退出后，先沿既有入口预览，再精确退役4个本次打包目录 **953,328,584字节** 和17个已结束浏览器／实际解压副本 **858,501,525字节**，合计 **1,811,830,109字节**。手动精确范围采用已确认结束候选的MinimumAgeMinutes=0，路径、活动进程、链接、目录指纹与当前ZIP保护均保留；自动维护仍采用30分钟保护。实际范围、逐项结果与原清单见 [本轮收尾](../../artifacts/maintenance/v1.0.6/avalon/cleanup-result.json)，[预览记录](../../artifacts/maintenance/v1.0.6/avalon/cleanup-preview-summary.json)、[release清单](../../artifacts/maintenance/local-cleanup-20261010-063202-412-releases/cleanup.json)和 [临时副本清单](../../artifacts/maintenance/local-cleanup-20261010-063231-796-intermediates/cleanup.json)。

随后执行Maintain-Project.ps1 -Apply，实际 **10,322,446,955逻辑字节（9.614GiB）**，结果below-threshold，低于10GiB触发门槛，零追加删除；不为追求8GiB扩大清理。见 [维护实测](../../artifacts/maintenance/v1.0.6/avalon/maintenance-result.json)和 [日志](../../artifacts/maintenance/v1.0.6/avalon/maintenance-final.log)。当前43,563,681字节运行ZIP与清单、完整与定向验收图、13轮原生结果及SQLite证据、原素材／PCM、2012规则资料、源码冻结与24份原日志均保留；release仅当前ZIP／清单。最终ZIP哈希48d71a06…在清理后再次一致，NTFS物理节省不计入逻辑容量或包门禁。

## UNO v1.0.6 交互优化收尾（2026-10-10）

最终ZIP的2／3／4／6人、手机／桌面、实际触控、特殊动作与旧版恢复通过后，工程进程退出，预览并清理release旧版副本 **41,686,696字节**，见[清单](../../artifacts/maintenance/local-cleanup-20261010-045052-195-releases/cleanup.json)。旧版已按原SHA保存到`artifacts/maintenance/v1.0.6/uno-ui/delivery-v1.0.5/`，原验收与原素材继续保留；本地release目录仅当前ZIP及清单。两份本轮近期生成阶段目录原样移入tmp，零删除／零容量节省，不作长期历史归档，见[移动记录](../../artifacts/maintenance/v1.0.6/uno-ui/stage-relocation.json)。

普通中间物预览没有到龄候选；随后`Maintain-Project.ps1 -Apply`按10GiB→8GiB默认门槛执行，退役1份到龄验证副本 **31,150,337字节**。最终实际 **14,237,283,404逻辑字节（13.260GiB）**，结果`candidates-exhausted`，见[维护清单](../../artifacts/maintenance/local-cleanup-20261010-045424-322-maintenance/cleanup.json)与[日志](../../artifacts/maintenance/v1.0.6/uno-ui/maintenance-final.log)。18个近期候选、310个用途未纳入标准清理的临时项、依赖／构建缓存及其他任务内容继续保护；1,760链接跳过，无嵌套仓库，不扩大删除或以NTFS物理节省代替逻辑容量。

## 盒子游戏库与仓库入口收尾（2026-10-10）

源码游戏库／通知、精确单测和独立原生链接验证已完成；证据在 `artifacts/maintenance/v1.0.6/game-library/`、`box-notifications/` 与 `box-repository/`。本轮生成的 `tmp/box-layout-*` 与 `tmp/box-repository-fbed1f` 已识别用途，后者的编译、最终和失败报告及实际截图均已转存上述证据；原素材、规则资料、正式存档和当前交付保留。

[维护预览](../../artifacts/maintenance/v1.0.6/game-library/maintenance-preview.json)实测14,278,077,343逻辑字节（约13.297GiB），超过10GiB；当时当前ZIP正在另一任务验证，预览因没有匹配的便携通过证明而停止。随后自动审批因UNO实际验证仍运行而拒绝清理，所有文件保留，没有结束其他任务进程或绕过保护。

工程进程退出并取得当前ZIP匹配证明后，先按四个精确目录预览，再由 `Clean-Intermediates.ps1` 退役本轮已结束源码验证副本 **6,004,170字节**，见[清理记录](../../artifacts/maintenance/local-cleanup-20261010-045053-580-intermediates/cleanup.json)。随后 `Maintain-Project.ps1 -Apply` [实测](../../artifacts/maintenance/v1.0.6/game-library/maintenance-result.json) **14,231,275,318逻辑字节（约13.254GiB）**，零可用安全候选、328项保护跳过、1,764链接跳过；仍超过10GiB，不扩大删除范围。新的 `tmp/box-repository-fbed1f` 独立原生程序尚未登记进清理白名单，继续保留；当前交付、验收及全部原始内容受保护。容量分别对应当时实测，不把并行任务清理或NTFS物理节省计成本轮退役量。

## 盒子通知优化收尾（2026-10-10）

源码通知单测与盒子渲染验证完成、工程进程退出后，精确预览并退役本轮6个 `tmp/box-layout-*` 隔离副本，共11,566,799字节，见[清理清单](../../artifacts/maintenance/local-cleanup-20261010-040729-375-intermediates/cleanup.json)。当前ZIP、原素材、存档、通知截图／报告和逐项测试历史继续保留。

随后执行 `Maintain-Project.ps1 -Apply`，初始11,065,835,202逻辑字节；16个已识别旧验证副本退役1,201,835,930字节，最终实际 **9,864,057,781字节（约9.19GiB）**，结果 `candidates-exhausted`，见[维护清单](../../artifacts/maintenance/local-cleanup-20261010-040825-815-maintenance/cleanup.json)与[日志](../../artifacts/maintenance/v1.0.5/box-notifications/maintenance-final.log)。986链接跳过、零嵌套仓库；安全候选耗尽后停止，不扩大至依赖缓存、素材或用途未知内容。

## UNO 完整制作收尾（2026-10-10）

当前 UNO ZIP 已实际核验，全部本轮 Native／Node／验证进程退出后，按默认30分钟保护先预览再执行：六个隔离验证副本退役216,905,989字节，见 [精确临时清理](../../artifacts/maintenance/local-cleanup-20261009-185638-006-intermediates/cleanup.json)；三个打包目录退役464,484,686字节，见 [release清理](../../artifacts/maintenance/local-cleanup-20261009-185833-744-releases/cleanup.json)。当前ZIP／清单、原素材／WAV、Mattel规则资料、正式存档及全部当前验收图／失败结论保留。

两个近期打包目录原样移至 `tmp/delivery-stage-package-1.0.5-MIhcZZ` 与 `tmp/delivery-stage-package-1.0.5-Ap6hfK`，继续保留内容，不计删除或容量节省，不建立清理历史归档。旧发布EXE与source ZIP收回已核验同SHA备份，冗余副本59,727,661字节另计；releases仅展示当前本地运行ZIP及清单。移动前核验绝对路径、链接／嵌套仓库及空闲，移动后核验文件数／字节，附件逐文件SHA一致，见 [精简移动记录](../../artifacts/maintenance/v1.0.5/uno-20261010/release-relocation.json)。

[空闲维护](../../artifacts/maintenance/v1.0.5/uno-20261010/maintenance-final.log)初始11,944,020,974逻辑字节（11.124GiB），11个安全候选退役878,945,438字节；最终实际 **11,065,160,003字节（约10.305GiB）**，结果 `candidates-exhausted`，见 [维护清单](../../artifacts/maintenance/local-cleanup-20261009-190041-309-maintenance/cleanup.json)。986链接跳过、零嵌套仓库；近期、用途未知、依赖／工具缓存及原始内容继续保护。仍超过10GiB且安全候选耗尽，只报告，不扩大删除、不常驻轮询、不采用NTFS节省抵扣逻辑水位。手动与自动候选合计退役1,560,336,113字节，容量数字只对应本次实测时点。

此前2026-10-10同版本附件替换收尾：已结束本轮工程进程，按精确清单预览后删除5个验证临时目录（362729549字节）和1个打包目录（230264211字节），合计592993760字节；当时EXE、运行ZIP、source ZIP、逐文件清单及历史验收证据保留。清理明细见[临时目录](../../artifacts/maintenance/local-cleanup-20261009-162153-832-intermediates/cleanup.json)、[打包目录](../../artifacts/maintenance/local-cleanup-20261009-162222-507-releases/cleanup.json)。当时 `Maintain-Project.ps1 -Apply` 实测逻辑空间8857752882字节（8.249GiB），低于10GiB阈值，见[维护记录](../../artifacts/maintenance/v1.0.5/release-replace-20261010/maintenance-final.log)。

## 玩家互动音效验证收尾（2026-10-09）

同包声音核验通过、本工程进程退出后，按精确预览退役本轮实际ZIP解压副本与浏览器临时数据，共112,251,506字节，见[中间物清理](../../artifacts/maintenance/local-cleanup-20261009-132524-021-intermediates/cleanup.json)；再退役一个release打包过程目录230,262,543字节，见[release清理](../../artifacts/maintenance/local-cleanup-20261009-132650-195-releases/cleanup.json)，合计342,514,049字节。当前ZIP／清单、旧包备份、原资料及声音红例／最终验收保留；未识别的早期探针目录继续按工具保护保留，没有转存清理归档。

`Maintain-Project.ps1 -Apply`实测8,479,114,943逻辑字节（约7.897GiB），低于10GiB，自动删除0、跳过983链接，见[最终维护日志](../../artifacts/maintenance/v1.0.5/player-interaction-audio/maintenance-final.log)。外部下载目录的独立TableMax继续运行；它与本工作区的路径／参数均无关，没有结束用户程序。该水位对应维护时点，后续文档和Git写入另增。

2026-10-09，拉密完整交付收尾按精确预览退役两个release打包过程目录，删除460,520,308字节；当前ZIP／清单、原已发布附件与验收证据保护，见[清理记录](../../artifacts/maintenance/local-cleanup-20261009-043721-393-releases/cleanup.json)。空闲安全维护实测8,347,570,674逻辑字节（7.774GiB），低于10GiB，自动删除0、跳过983链接，[实际日志](../../artifacts/maintenance/v1.0.5/rummikub-20261009/maintain-authoritative-final.log)。新拉密临时范围未擅自扩入旧工具白名单，保留存档及来源资料。

## v1.0.5 同步优化收尾（2026-10-09）

全部本轮服务与验收进程退出后执行`Maintain-Project.ps1 -Apply`，实际逻辑字节6,622,672,315（约6.17GiB），低于10GiB阈值，未删除或采用NTFS压缩抵扣。结果见[维护记录](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/checks/maintenance.json)。`Clean-Releases.ps1 -KeepLatestOnly`预览及Apply均无到龄候选，两个本轮打包过程目录仍受30分钟保护；原样放入`tmp/delivery-stage-package-1.0.5-ShkA7e`及`tmp/delivery-stage-package-1.0.5-28dfGH`，不计为删除或容量节省，不建立历史归档副本。releases仅保留当前运行ZIP及清单；素材、存档和本轮截图／失败证据保持原位。容量对应维护测量时点，后续少量文档／提交记录字节另增。

## 历史归档与旧版本退役（2026-10-09）

按用户最新要求取消清理历史归档保留，并退役无需复用的旧版本内容。本轮按[明确清单](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/plan.json)删除20,709个文件、9,286,082,480逻辑字节（约8.65GiB）：清理历史副本2,198,473,522字节、旧版运行PNG截图6,272,339,209字节、旧交付815,269,749字节。5个最近修改的归档记录继续遵守30分钟保护，未因新授权绕过近期保护；原素材、规则资料、存档、当前v1.0.5交付与验收保留。

复用共享工程进程保护及清理互斥，删除前核验路径、链接、嵌套仓库、近期修改及逐文件哈希；当前ZIP、清单及交付证明在清理前后哈希一致。已失效文档链接改指[本轮退役结果](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)，项目逻辑体积以[清理后统计](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/capacity.json)为准。本轮只清理本地资料并更新要求，未构建或发布程序。

## v1.0.5 互动精修收尾（2026-10-09）

本轮运行ZIP40,851,905字节、实际解压94,333,009字节，同包原生／浏览器互动检查及精准补拍通过；旧同版ZIP和清单保留在`artifacts/maintenance/v1.0.5/interaction-refinement/delivery-before-refinement/`，原素材、来源、失败及当前验收截图保留。互动媒体195,117字节；没有推送或GitHub Release。

全部工程应用退出后，`Clean-Releases.ps1 -KeepLatestOnly -MinimumAgeMinutes 0`先预览再Apply，退役已完成打包副本229,573,074字节，releases只留当前运行ZIP和清单。随后按默认30分钟保护执行`Maintain-Project.ps1 -Apply`，两项已知隔离验证副本退役227,957,462字节；两者是审计退役量，不冒充工作区净降幅。所有清理记录[原样集中归档](../../artifacts/maintenance/cleanup-history/operations/interaction-refinement-20261009-directory-move.json)，逐文件字节／SHA核验并更新索引，目录移动不计空间节省。

[维护最终实测](../../artifacts/maintenance/v1.0.5/interaction-refinement/checks/maintenance-apply.log)为15,146,704,131逻辑字节（约14.106GiB），219项保护／用途待确认内容跳过、1,370链接跳过，零嵌套仓库，结果candidates-exhausted。仍超过10GiB，已耗尽安全候选，未扩大清理范围或以NTFS物理节省替代逻辑门槛；原资料、正式存档、依赖／工具缓存、当前包及审计原件继续保留。后续文字与Git写入会略增，此值仅对应实测时点。

## v1.0.5 本地交付与安全维护（2026-10-08）

v1.0.5实际ZIP40,857,197字节／解压94,363,202字节，120MB硬上限与114MB预算通过。头像轻度派生节省151,238字节，40无损FLAC节省711,478字节，互动媒体232,441字节；原素材、原WAV、来源及失败证据保留。[历史v1.0.4四文件](../../artifacts/maintenance/v1.0.5/previous-delivery/preserved.json)逐文件大小／SHA核验后另存，再按Clean-Releases预览／Apply退役releases副本，共100,647,197字节，当前目录只留v1.0.5运行ZIP和清单。新打包暂存尚受近期保护，原样迁入维护证据目录并逐文件复核，不作为删除或空间节省。

全部工程进程退出后执行Maintain-Project预览／Apply，[实际结果](../../artifacts/maintenance/v1.0.5/implementation/maintenance-apply.log)为14,961,838,773逻辑字节（约13.934GiB），安全候选为零，199项保护／用途待确认内容跳过，1,370链接跳过，零嵌套仓库。仍高于10GiB；没有扩大范围、降低近期保护或以NTFS压缩替代逻辑容量。保留当前交付、原件、验收和失败记录，清理记录集中归档，后续Git及文字写入会略增；此值记录在该次实测时点。

## v1.0.4 网络连接与多设备页面适配收尾（2026-10-08）

最终运行ZIP `d08c299b…` 的完整显示、盒子、新连接入口、HTTP／HTTPS等价故障与完整EXE核验通过，全部工程进程退出后才执行安全清理，保留默认30分钟近期保护。先预览再Apply：[7份过期打包暂存（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役 **1,619,378,488字节**，[16份明确隔离测试副本（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役 **1,592,680,400字节**；另按逐文件审计[退役两个旧测试浏览器配置目录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json) **100,581,893字节**，原同级SQLite、设置、报告及库存证明哈希不变。两份用途不能确定的旧浏览器状态继续保留。

[构建缓存清理](../../artifacts/maintenance/v1.0.4/build-cache-cleanup/1791445362710-apply.json)退役49份过期生成产物，清单输出合计 **88,005,562字节**；当前开发与交付快照、每单元最近两份成功产物、依赖和工具缓存保留。随后 `Maintain-Project.ps1 -Apply` [退役57项已过保护期的生成副本（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json) **6,186,650,654字节**。本轮[审计退役量](../../artifacts/maintenance/v1.0.4/network-adaptation/cleanup-summary.json)合计 **9,587,296,997字节（约8.929GiB）**，其中缓存只统计输出清单，不能把这个量冒充工程净下降或NTFS物理释放。

[自动维护最终实测](../../artifacts/maintenance/v1.0.4/network-adaptation/checks/maintenance-final.log)从20,307,216,695降至 **14,120,624,037逻辑字节（约13.151GiB）**；起点在手动退役和缓存清理之后。10GiB／8GiB规则下结果candidates-exhausted，192项保护／用途待确认内容跳过，1,370链接跳过、零嵌套仓库；仍超门限，不扩大删除范围。与本轮开始前只读水位13,974,399,310字节相比净增146,224,727字节，期间新增并保留实际验收、失败画面和候选原包；退役量与新增证据、实际容量分别记录。后续source ZIP、审计及Git写入会继续略增。

四份结束记录[逐文件大小及SHA不变地集中归档](../../artifacts/maintenance/v1.0.4/network-adaptation/cleanup-record-archive.json)，原文件不改写、索引追加现路径，maintenance直属local-cleanup目录剩余零。原素材、规则资料、正式存档、当前和失败验收证据继续保护。releases仅留当前运行ZIP、清单及完整EXE；本轮用户明确授权GitHub发布，最终提交另导出source ZIP，线上附件仅完整EXE与source ZIP，详见[验收](acceptance.md#104网络连接与多设备页面适配2026-10-08)。

## v1.0.4 玩家比例与工作区修订收尾（2026-10-08）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v104-玩家比例与工作区修订收尾2026-10-08)。

## v1.0.4 玩家横屏与滚动条收尾（2026-10-08）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v104-玩家横屏与滚动条收尾2026-10-08)。

## 用户指定旧版本资料清理（2026-10-08）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#用户指定旧版本资料清理2026-10-08)。

## v1.0.4 研究重设计与根入口收尾（2026-10-08）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v104-研究重设计与根入口收尾2026-10-08)。

## v1.0.4 手机玩家视窗与远程续验收尾（2026-10-08）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v104-手机玩家视窗与远程续验收尾2026-10-08)。

## 10.7 浏览器恢复与换机验证的前轮清理（2026-10-08）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#107-浏览器恢复与换机验证的前轮清理2026-10-08)。

## v1.0.3全量构建发布后的维护（2026-10-07）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103全量构建发布后的维护2026-10-07)。

## 扩展需求复查后的维护（2026-10-07）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#扩展需求复查后的维护2026-10-07)。

## v1.0.3 扩展修订后的深度瘦身（2026-10-07）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-扩展修订后的深度瘦身2026-10-07)。

## 清理记录目录原样集中归档（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#清理记录目录原样集中归档2026-10-06)。

## v1.0.3 电力公司数量采购与进度收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-电力公司数量采购与进度收尾2026-10-06)。

## v1.0.3 宝可梦深度界面与整合交付收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-宝可梦深度界面与整合交付收尾2026-10-06)。

## v1.0.3 电力公司材质与综合资料收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-电力公司材质与综合资料收尾2026-10-06)。

## v1.0.3 文档整理与推送前维护（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-文档整理与推送前维护2026-10-06)。

## v1.0.3 宝可梦UI重设计收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-宝可梦ui重设计收尾2026-10-06)。

## v1.0.3 电力公司地图优化收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-电力公司地图优化收尾2026-10-06)。

## v1.0.3 游戏介绍修复收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-游戏介绍修复收尾2026-10-06)。

## v1.0.3 初始化微调收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-初始化微调收尾2026-10-06)。

## v1.0.3 导出与旧资源退役（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-导出与旧资源退役2026-10-06)。

## 测试静音与低于10GiB收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#测试静音与低于10gib收尾2026-10-06)。

## 电力公司布局交付收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#电力公司布局交付收尾2026-10-06)。

## v1.0.2发布收尾（2026-10-05）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v102发布收尾2026-10-05)。

## v1.0.4 交付与空闲维护（2026-10-05）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v104-交付与空闲维护2026-10-05)。

## 电力公司 debug 收尾（2026-10-05）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#电力公司-debug-收尾2026-10-05)。

## 宝可梦引导与动漫切入收尾（2026-10-05）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#宝可梦引导与动漫切入收尾2026-10-05)。

## 判断标准

按实际用途与证据决定保留，不能把 Git 忽略、文件年纪或临时目录名称等同于可删除。

| 内容                                                     | 处理方案与依据                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 当前运行 ZIP 与逐文件清单                                | 保留唯一当前交付；先实际解压、核对全部文件并完成同哈希便携回归，再退役旧包。                                      |
| 历史运行／源码 ZIP                                       | 本次明确授权退役；保留当时清单、包哈希、结果、日志和逐包退役说明，链接改指退役记录，不把旧通过结论转移到新包。    |
| 隔离测试数据库、浏览器 profile、重复解压及打包目录       | 按已核验脚本用途清理；混入证据的副本只能通过精确路径和逐文件哈希清单手动退役，保留父级结果与源码。                |
| 当前验收截图、失败文字记录、当次源码、规则研究与素材原图 | 保留。用户授权清理历史内容后，旧版本运行截图可全部退役，包括独有画面；保留哈希和删除记录，同步修正正文引用。      |
| 正式玩家存档与历史迁移样本                               | 保留；不接触默认 LOCALAPPDATA/TableMax。测试隔离数据不作为正式存档。                                              |
| 活动依赖、Node／NuGet 等工具缓存                         | 保留，避免下一次开发重下。Electron／electron-builder 已退出活动工程，其已确认无引用的旧下载缓存可按显式清单退役。 |
| 正式美术、声音、原型、模板与历史规范                     | 保留仍有引用或追溯用途的内容，不为减少文件数删去唯一资料。火箭队 BGM 与喵喵 WAV 保持用户原字节。                  |

## 运行包瘦身

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#运行包瘦身)。

## 工作区清理路径

先完成全部应用／构建／验证并确认退出，再预览清理，核对后 Apply。按顺序处理当前 releases 的打包残留、已知验证临时目录、显式历史包／可再生副本及重复截图；最后执行自动维护和无损透明压缩。

手动历史退役使用 `Clean-Intermediates.ps1 -RetiredGeneratedManifest <清单>`。清单必须绑定当前通过便携检查的 ZIP 哈希，逐项注明精确路径、类别、理由、完整文件大小／SHA-256 和保留证据路径／SHA-256。工具复核目录边界、链接、嵌套 Git、近期修改、进程、互斥及删除前内容；拒绝整个证据目录、平台存档、源码或不认识的类别。默认预览不写日志、不删除；自动维护不采用这一扩展范围。旧缓存限于无活动依赖的两个 Electron 缓存，不能推广为清空 .cache。

不通过手写递归删除绕过保护。存在链接、未知临时内容或唯一资料时，保留并记录原因；空间目标不能优先于资料完整性。剩余资料可用 NTFS 逐文件透明压缩，保持语义字节与 SHA-256，跳过范围外硬链接、链接目录、只读或无收益文件。

## 历史包退役

旧验收继续保留原哈希、大小、通过／失败、当时边界与清单。历史包链接转到同位置的 `.zip.retired.json`，说明旧包字节已按本次授权删除，并指向当前交付及完整退役清单。历史过程不得宣称旧包仍可下载，也不得把原通过结果升级为新包通过。

本次原始盘点、清理清单、工具检查与最终容量报告保存在 [专项证据目录](../../artifacts/maintenance/v1.0.2/full-audit-20261005/)。逻辑删除字节、按路径统计的工作区字节和按文件身份去重的 NTFS 物理节省分别计量；并行验证耗时不相加冒充总耗时。

## 执行结果

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#执行结果)。

## v1.0.3 再导出与增量清理

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#v103-再导出与增量清理)。

## maintenance 历史残量专项（2026-10-05）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#maintenance-历史残量专项2026-10-05)。

## 历史运行截图全量退役（2026-10-05）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#历史运行截图全量退役2026-10-05)。

## 清理记录集中归档（2026-10-05）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#清理记录集中归档2026-10-05)。

## 宝可梦人机与复用优化收尾（2026-10-05）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#宝可梦人机与复用优化收尾2026-10-05)。

## 宝可梦原创规则图解收尾（2026-10-05）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#宝可梦原创规则图解收尾2026-10-05)。

## 宝可梦扩展版续建收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#宝可梦扩展版续建收尾2026-10-06)。

## 宝可梦前瞻修复与隔离交付收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#宝可梦前瞻修复与隔离交付收尾2026-10-06)。

## 宝可梦三胜与叫声续验收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#宝可梦三胜与叫声续验收尾2026-10-06)。

## 普通收局与无损卡面续验收尾（2026-10-06）

见[历史记录](../archive/project-slimming-2026-10-05-to-08.md#普通收局与无损卡面续验收尾2026-10-06)。

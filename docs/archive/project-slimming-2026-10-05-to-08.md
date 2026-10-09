# 项目瘦身执行历史：2026-10-05 至 2026-10-08

2026-10-08 从当前主题页归档已完成的过程，保留当时范围、结论、失败、哈希与证据。当前状态及操作见[原主题页](../reference/project-slimming.md)；本文中的旧版本、旧命令及“当前”仅描述记录形成时的状态。

## v1.0.4 玩家比例与工作区修订收尾（2026-10-08）

最终ZIP `bdb08d10…` 的完整显示、草稿、盒子、根入口、混合Worker及远程恢复通过，全部工程进程结束后才预览并执行既有脚本。保留默认30分钟近期保护：三份过期打包暂存退役 **693,965,613字节**，六份明确隔离验证副本退役 **570,855,046字节**；自动维护再退役一份已过保护期的盒子验证副本 **136,394,922字节**，合计 **1,401,215,581逻辑字节（约1.305GiB）**。原素材、规则资料、正式存档、依赖／工具缓存、候选原包、当前及失败验收截图继续保留。

[自动维护实测](../../artifacts/maintenance/v1.0.4/layout-revision-delivery/maintenance-final.json)从14,108,948,456降至 **13,972,589,009逻辑字节（约13.013GiB）**；这次起点在两轮手动清理之后，不冒充整个任务的初始容量。超过10GiB，目标8GiB未达，结果candidates-exhausted，204项保护／未知用途跳过；不放宽近期门限或扩大删除范围。releases根目录只有当前运行ZIP与清单，另有两份未过30分钟保护期的打包暂存目录原样保留。数字为脚本统计时点，后续文档与Git写入会略增；不以NTFS物理节省折抵包预算。

三份结束记录[原样集中归档](../../artifacts/maintenance/v1.0.4/layout-revision-delivery/cleanup-record-archive.json)，移动前后逐文件大小及SHA不变，索引保留原／现路径。当前包双100MB与95MB工程预算另见[验收](acceptance-2026-10-05-to-08.md#104玩家比例与游戏工作区修订2026-10-08)。本轮按用户授权提交并push源码，不创建标签或GitHub Release。

## v1.0.4 玩家横屏与滚动条收尾（2026-10-08）

最终同包验收 `2b3439ec…` 完成后，全部本轮工程进程退出，再按现有安全入口预览／核对／Apply。[两份打包暂存（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役462,612,776字节，[20个明确隔离验证副本（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役1,690,088,226字节，合计 **2,152,701,002字节（约2.005GiB）**。只放宽已确认停止使用副本的近期门限，保留路径／进程／链接／指纹与当前便携证明保护；没有清空tmp／artifacts，当前及失败截图、报告、原素材、规则资料、正式存档、旧交付证明与依赖缓存保留。

维护预览开始实测13,240,304,320逻辑字节（12.331GiB）；手动退役后[自动维护最终实测](../../artifacts/maintenance/v1.0.4/player-display/cleanup/maintenance-final.json) **11,087,647,639字节（10.326GiB）**。10GiB／8GiB规则下安全候选为0，186项保护／未知用途跳过，结果no-candidates；仍超门限如实记录，不扩大删除范围。逻辑变化与退役量的差额为新增审计／文档写入，不用NTFS物理节省折抵便携预算。

releases只保留当前运行ZIP与逐文件清单，SHA-256未变，未导出EXE／source ZIP或创建Release。[清理记录归档](../../artifacts/maintenance/v1.0.4/player-display/cleanup/cleanup-record-archive.json)原样移入cleanup-history/directories并更新索引，逐文件大小与SHA一致；两个记录目录不再散落maintenance直属。实际同包显示、远程、体积与待测边界见[验收](acceptance-2026-10-05-to-08.md#104滚动条与电脑玩家横屏2026-10-08)。

## 用户指定旧版本资料清理（2026-10-08）

用户明确要求清理此次只读审计发现的旧版本文件。按[精确逐文件清单](../../artifacts/maintenance/v1.0.4/old-version-cleanup-20261008/retirement-plan.json)先预览，再沿用当前ZIP便携通过证明、共享空闲保护器、30分钟近期保护、路径／链接／嵌套仓库、内容指纹、SHA-256及互斥保护执行；未扩大自动清理白名单，也未修改生产清理工具。

共退役 **8,716个文件、4,391,335,537逻辑字节（4.090GiB）**：99份旧构建输出434,000,892字节，旧版本及第一至六阶段验证图片3,468,375,656字节，5个旧ZIP 203,595,255字节，3份旧运行副本284,199,701字节，早期原型构建1,164,033字节。构建缓存保留当前开发快照、当前交付单元及每单元最近两份成功产物；`phase-*`中的规则原图、中文转录、美术原素材和文字验证记录继续保留。两个旧源码副本只删已审计的内层程序副本／ZIP，其源码、依赖junction与原清单不变；宝可梦体积验证的独立`data/`保持原位。

执行期间新工程进程启动，[首次记录](../../artifacts/maintenance/v1.0.4/old-version-cleanup-20261008/cleanup.json)立即停止，保留原失败原因及已执行结果；进程退出后，仅对剩余3个旧ZIP重新核验并[完成清理](../../artifacts/maintenance/v1.0.4/old-version-cleanup-20261008/cleanup-resume.json)。外部D盘下载目录运行的TableMax与本工作区无关，按既有共享保护器识别，不结束用户程序；构建缓存工具较宽的拦截仍保持原实现，本轮使用窄范围审计脚本。

[收尾核验](../../artifacts/maintenance/v1.0.4/old-version-cleanup-20261008/cleanup-summary.json)确认全部所列文件已移除，11处保留证据／清单／快照绑定及当前ZIP `a9ee8498…`未变；当前v1.0.4全部验收证据、原素材、规则资料、正式存档、依赖／工具缓存及清理历史原文件继续保留。修正[18处旧产物链接](../../artifacts/maintenance/v1.0.4/old-version-cleanup-20261008/link-repairs.json)，历史文字结论不改写；[项目文档与同包检查](../../artifacts/maintenance/v1.0.4/old-version-cleanup-20261008-project/project-checks.json)通过，实际ZIP及解压字节未变。

[开始容量](../../artifacts/maintenance/v1.0.4/old-version-cleanup-20261008/space-start.json)14,786,286,935字节，[结束实测](../../artifacts/maintenance/v1.0.4/old-version-cleanup-20261008/space-final.json) **10,398,636,452字节（9.684GiB）**，跳过1,370链接、零嵌套仓库。逻辑净下降4,387,650,483字节，与删除量的差额包括新增审计及并行开发写入；未测NTFS物理释放，不折抵便携包门禁。已低于10GiB，仍高于8GiB；本轮已确认候选全部处理，不扩展至用途待确认内容，后续工程写入可能改变水位。

用户随后要求仅清理不影响主对话运行的非缓存项。按[精确清单](../../artifacts/maintenance/v1.0.4/noncache-cleanup-20261008/plan.json)和[执行记录](../../artifacts/maintenance/v1.0.4/noncache-cleanup-20261008/cleanup.json)，追加退役11个历史运行ZIP、旧v1.0.3的246个清单内运行文件及1份与保留原件SHA完全相同的源码ZIP，共258文件／561,707,232字节（约0.523GiB）。当前`2b3439ec…`运行ZIP、`player-display`全部当前资料／备份、原素材、存档、配置、日志、清理历史原文件及全部缓存继续保留；12份保留绑定复核通过。6个较早临时目录已由主会话清理，本轮跳过、不重复计数。开始10.328GiB、结束9.802GiB，实际逻辑字节为10,525,210,267；[收尾及链接修复](../../artifacts/maintenance/v1.0.4/noncache-cleanup-20261008/summary.json)保留容量、原失败边界和退役记录，未结束进程或修改Git状态。

## v1.0.4 研究重设计与根入口收尾（2026-10-08）

最终运行ZIP `a9ee8498…` 的根入口、普通模式、研究图示／关键阶段、四变体入口及HTTPS等价远程故障全部通过，全部工程进程退出后才清理。[开始实测](../../artifacts/maintenance/v1.0.4/research-redesign-20261008/implementation/space-start.json)为 **12,687,373,228逻辑字节**。上一已验v1.0.4包与关键返修前原包保留各自SHA；releases只留当前运行ZIP和逐文件清单，未导出EXE或source ZIP。

先预览、核对再Apply：[13个打包暂存（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役 **3,006,662,446字节**，[34个已结束隔离验证副本（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役 **4,389,192,833字节**，合计 **7,395,855,279字节（约6.888GiB）**。仅使用精确六位后缀目录清单，当前包／清单、原素材、规则资料、正式存档、当前及失败／过渡验收截图报告继续保留；未清空artifacts／tmp。51项清理前缀保护检查通过，新验证入口不扩大至未知用途内容。

随后空闲执行 `Maintain-Project.ps1 -Apply`。[最终实际容量](../../artifacts/maintenance/v1.0.4/research-redesign-20261008/implementation/space-final.json)为 **14,785,532,381逻辑字节（13.770GiB）**，跳过1,370链接、零嵌套仓库；178项保护／未知用途跳过，安全候选零，仍超过10GiB且未达8GiB，不扩大删除范围。期间新增并保留多轮实际验收及关键失败画面、审计与原包，较开始净增2,098,159,153字节；删除量不能冒充容量净下降或NTFS物理节省，见[汇总](../../artifacts/maintenance/v1.0.4/research-redesign-20261008/implementation/cleanup-summary.json)。后续文档及Git写入略增。

两份结束记录[原样集中归档](../../artifacts/maintenance/v1.0.4/research-redesign-20261008/implementation/cleanup-record-archive.json)，移动前后逐文件大小／SHA-256不变，索引追加现路径，maintenance直属记录目录剩余零。按本轮用户授权提交并push源码，不创建标签或GitHub Release；本地包体积与瘦身逻辑水位分别计量。

## v1.0.4 手机玩家视窗与远程续验收尾（2026-10-08）

最终实际 ZIP `96518cad…` 的入口、盒子浮窗、等价 HTTPS 代理双向操作与换机恢复通过后，全部工程进程退出。[开始实测](../../artifacts/maintenance/v1.0.4/debug-20261008/implementation/space-start.json) **17,544,706,145 逻辑字节（16.340 GiB）**。前一已验 v1.0.3 ZIP 与清单[原样移入证据](../../artifacts/maintenance/v1.0.4/debug-20261008/previous-delivery/preserved.json)，大小及 SHA-256 不变；releases 仅保留当前 v1.0.4 运行 ZIP 和清单，不新增 EXE 或源码包。

按明确路径先预览、核对再 Apply：[六个打包暂存目录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役 **1,155,948,320 字节**，其中一个为空；[30 个已完成隔离验证目录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役 **3,743,379,188 字节**。新增已知前缀只匹配六位字母数字后缀，46 项隔离测试确认类似名称和近期保护；手机视窗截图、盒子联系表、远程成功／失败报告及补拍脚本均在外部证据目录保留，不清空 artifacts／tmp。

随后空闲执行 `Maintain-Project.ps1 -Apply`，再退役两份已过保护期的计时验证副本 **172,518 字节**。[最终维护实测](../../artifacts/maintenance/v1.0.4/debug-20261008/implementation/space-final.json)为 **12,645,263,472 逻辑字节（11.777 GiB）**，跳过 1,370 链接、零嵌套仓库。仍超过 10 GiB 且未达 8 GiB，安全候选已耗尽；原素材、正式存档、当前验收证据、依赖／工具缓存及必须原样保留的清理历史继续保护，不扩大删除范围。全部清理共退役 **4,899,500,026 字节**，实测净下降 **4,899,442,673 字节**，差额包括清理中新增的审计／文档，不能把删除量当成容量净变化或 NTFS 物理节省。详见[汇总](../../artifacts/maintenance/v1.0.4/debug-20261008/implementation/cleanup-summary.json)。

三份结束记录[逐文件核验后原样归档](../../artifacts/maintenance/v1.0.4/debug-20261008/implementation/cleanup-record-archive.json)，索引追加现路径，直属 `local-cleanup-*` 剩余零。后续文档和 Git 写入会略增；本轮仅本地提交，不 push 或发布。

## 10.7 浏览器恢复与换机验证的前轮清理（2026-10-08）

前轮 v1.0.3 `6761ef78…` 同包检查结束后，已退出的[两个打包暂存（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役 **462,351,034 字节**。当时未知的隔离验证前缀采用清理入口的原样保留模式：先保存原内容，再退役临时原路径，共约 1.89 GB；这些字节仍在审计目录中，不能计作净空间回收。中断、进程保护失败及恢复后的原报告均保留，四份结束目录[原样集中归档](../../artifacts/maintenance/v1.0.3/debug-20261007/implementation/cleanup-record-archive.json)，9,853 文件的大小与哈希不变。本轮新增精确前缀后，只清理新的可再生副本，不删除原样归档的旧记录内容。

## v1.0.3全量构建发布后的维护（2026-10-07）

本轮18单元零缓存全量构建、新ZIP正常游玩／三游戏恢复及完整EXE检查结束后，先[预览](../../artifacts/maintenance/v1.0.3/github-release-20261007/cleanup-preview.txt)再[应用](../../artifacts/maintenance/v1.0.3/github-release-20261007/cleanup-apply.txt)，删除5项再生组装／解压／测试副本 **702,173,302字节**，见[原样归档记录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)。前轮及本轮两份已结束清理目录[逐文件核验后集中归档](../../artifacts/maintenance/v1.0.3/github-release-20261007/cleanup-record-archive.json)，原记录字节不变。

[收尾实际体积](../../artifacts/maintenance/v1.0.3/github-release-20261007/space-final.json) **9,122,707,561字节（8.496GiB）**，低于10GiB，较上轮9,034,969,361字节净增87,738,200字节，包括发布EXE、旧包保留与当前验证证据；删除量与净变化分别报告。保持8GiB目标及既有安全候选耗尽边界，受保护原素材、当前截图、正式存档／迁移样本、依赖与工具继续保留。明确发布后release另保留当前完整EXE和最终提交的source ZIP，附件仅这两项。

## 扩展需求复查后的维护（2026-10-07）

当前v1.0.3 `511ab391…` 同包的演出、正常游玩、原版及三游戏恢复全部通过后，工程进程退出。手动入口先[预览](../../artifacts/maintenance/v1.0.3/pokemon-requirements-audit/cleanup-preview.txt)再[应用](../../artifacts/maintenance/v1.0.3/pokemon-requirements-audit/cleanup-apply.txt)，[实际清理记录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除7项再生打包／解压／隔离验证副本 **838,655,357字节**。保留当前ZIP／清单、63姿态及正常游玩截图、v1迁移样本与原备份、全部原素材／规则资料／正式存档和活动依赖。

[最终维护实测](../../artifacts/maintenance/v1.0.3/pokemon-requirements-audit/space-final.json) **9,034,969,361字节（8.414GiB）**，低于10GiB；相比前轮结束8,990,170,832字节净增44,798,529字节，主要新增当前验收证据与构建内容，净变化不冒充删除量。8GiB目标仍未达到，沿用已完成的深度审计保护边界：安全候选已处理，不能删除当前截图、原素材、正式存档或用途未确认源码以强行达标。本次只维护新增再生副本，不重复扫描历史图片或扩大删除范围。

## v1.0.3 扩展修订后的深度瘦身（2026-10-07）

开始[实际逻辑容量](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/space-start.json)12,434,523,306字节（11.581GiB）。当前ZIP `99f3be46…` 完成真实保存演出、63姿态、原版及三游戏恢复同包检查后，工程进程退出；release仅保留本轮运行ZIP与逐文件清单，无EXE、source ZIP或新发布。依用途、保留证据及逐文件哈希先预览再Apply，不按Git忽略或版本数字直接删除。

[再生验证／打包副本（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除2,210,645,948字节；[历史图片清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除1,592,866,952字节，包括旧界面截图及旧运行副本内派生图，当前v1.0.3验收截图、素材原图与规则资料保留。v1.0.4是本页已记录的2026-10-05历史交付，因此加入明确旧版本白名单，未知未来版本仍受保护；保留失败／通过文字结论及逐图哈希，原记录不改写。

[八项旧ZIP／解压（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除488,024,023字节；旧ZIP链接改指对应退役记录，原逐文件清单及历史验收保留。仅增加已审计的旧 `retained-*/package-*/size-verification` 解压边界与 `previous-delivery.zip` 文件名，仍要求完整哈希、外部证据、程序标记、零源码／存档；当前ZIP哈希的副本也不能按旧包删除。历史图片删除改变旧解压目录计数，保护检查阻止首次Apply，重新审计剩余文件并预览后才应用，旧清单和失败日志保留。

构建缓存保留当前开发与交付快照、每单元最新两份成功产物，删除25份旧产物35,728,434字节。[汇总](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/cleanup-summary.json)合计删除 **4,327,265,357字节**；[最终维护实测](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/space-final.json) **8,989,173,398字节（8.372GiB）**，逻辑容量净下降 **3,445,349,908字节**，与删除量区别记录，差额包括本轮构建／验收新增内容。低于10GiB；未达8GiB目标，已审计安全候选耗尽。当前验收、原素材、正式存档／迁移样本、活动依赖／工具缓存和用途未确认的临时源码继续保护，不扩大删除范围；NTFS节省不计作逻辑瘦身。

清理工具隔离229检查、原样归档16检查通过；归档夹具遗漏既有进程保护器和树快照依赖，补齐后重验通过，未放松生产保护。三份已结束清理目录逐文件哈希核对后[原样集中归档](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/cleanup-record-archive.json)，历史JSON字节未改写，映射追加至cleanup-history索引。后续文档和Git写入会略增；按用户授权仅提交本轮改动并push当前分支，无新标签或GitHub Release。

## 清理记录目录原样集中归档（2026-10-06）

按用户本轮要求新建 `artifacts/maintenance/cleanup-history/directories/`，将 maintenance 直属的49个已结束 `local-cleanup-*` 目录原样移入，含49份JSON、5,635,719逻辑字节；无文件删除或内容改写。移动前检查路径、链接、目标冲突及记录状态，移动前后逐文件大小与SHA-256一致，原路径／现路径映射追加到既有 `cleanup-history/index.json`，见[移动清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)。直属分散目录剩余0；文档引用已改到新位置，记录内部历史路径保留原文。维护规则要求每轮清理结束后归档，运行中的记录不移动；本次只整理目录，不计作空间回收。

## v1.0.3 电力公司数量采购与进度收尾（2026-10-06）

最终ZIP `15a0dd45…` 的六人／两人布局、原生显示和完整采购／回退／恢复验收通过，自有工程进程正常退出。先把最终两个原生验收的数据库、审计源码及逐文件SHA[另存](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/quantity-final-match/saved-audit-inventory.json)，此前完整交付ZIP与清单也在[previous-delivery](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/previous-delivery/TableMax-1.0.3-win-x64.zip.retired.json)保留；当前ZIP、原素材、规则资料、正式存档、截图及成功／失败JSON继续保留。

沿用已知副本的路径、进程、链接和内容变化保护，精确预览后按既有手动近期参数Apply：[release两组装目录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役462,062,602字节；[15个已退出隔离副本（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役1,418,900,135字节，另161项保护／未知用途跳过。合计1,880,962,737字节，见[汇总](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/cleanup-summary.json)。未清空artifacts／tmp，release仅当前运行ZIP与清单；未删除当前验收、缓存依赖或原资源。

最后空闲执行`Maintain-Project.ps1 -Apply`：[实际返回](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/maintenance-summary.json)为10,533,047,880逻辑字节（约9.81GiB），低于10GiB，本次自动维护不再删除；跳过1,370链接、零嵌套仓库。该水位是全部副本清理后实测，不以删除量推算或NTFS节省替代；随后文档及Git写入会略增。无常驻轮询，不推送或发布。

## v1.0.3 宝可梦深度界面与整合交付收尾（2026-10-06）

开始[实际盘点](../../artifacts/maintenance/v1.0.3/pokemon-ui-depth/space-handoff.md)11,865,613,393逻辑字节（11.0507GiB）。最终ZIP `6df0feb5…` 的界面、原生恢复、普通对局、声画及静音检查完成，工程进程退出后按精确清单先预览再Apply。当前ZIP／清单、前一份整合包、宝可梦独立旧验收包、原素材、规则资料、正式存档和当前实际截图保留。

[38项旧生成物（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役1,458,019,410字节，含23旧ZIP、两运行解压和13浏览器缓存；保留原清单、SHA及通过／失败文字结论。[16处链接](../../artifacts/maintenance/v1.0.3/pokemon-ui-depth/space-start/doc-link-retirement.json)改指保留证据。[519张旧截图（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)287,018,067字节退役；删除旧包刚更新历史根时间，默认30分钟保护先阻止截图Apply，核对原哈希后按已有手动规则使用近期参数重新预览／Apply，其他保护保持。

[release两打包残留（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)462,056,341字节和[四份过期验证副本（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)304,200,045字节退役；release仅当前ZIP／清单。首次[自动维护（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)实际10,987,358,640→10,950,666,982字节，删除八过期UI副本36,738,593字节、169项保护／未知用途，仍超10GiB。另核实三份已结束UI临时目录零数据库、只含可再生解压与网页，截图／结果外部保留；[内容边界](../../artifacts/maintenance/v1.0.3/pokemon-ui-depth/ui-temp-retirement.json)与[执行记录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)记319,145,664字节。仅对这三份明确副本使用既有手动近期参数，未扩大到其他近期资料。

最终工程进程退出后的[实测维护](../../artifacts/maintenance/v1.0.3/pokemon-ui-depth/final-maintenance.json)为**10,631,526,855逻辑字节（9.901GiB），低于10GiB**；无新增删除，跳过1,370链接、零嵌套仓库。本轮共退役2,867,178,120字节，容量净降1,234,086,538字节，差额包含新组装、验证、原图和审计。后续文档／Git写入略增；依赖、工具缓存与受保护内容保留，未测NTFS物理释放、不折抵便携门禁，不把此水位当作恒定值。

## v1.0.3 电力公司材质与综合资料收尾（2026-10-06）

当前运行ZIP SHA-256 `201de235e92fd763cf016bbbb526b407dd8a51aed4c76bb3849beb7e0259128e`与两项原生通过记录一致。前一份ZIP／清单、原地图／AI生成PNG与当前验收截图保留。清理前发现旧release解压目录存在数据库与配置，先将SQLite、配置、日志及浏览器状态共445文件43,230,361字节复制到本轮`previous-delivery/runtime-owned-state/`并逐文件核验哈希；[保留清单](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/previous-delivery/runtime-owned-state/state-backup-manifest.json)不包含存档内容。旧完整EXE也无损归档到本轮previous-delivery，[哈希记录](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/legacy-exe-archive.json)保留；不是删除旧程序，也没有生成新EXE。

工程进程全部退出后，`Clean-Releases.ps1 -KeepLatestOnly -MinimumAgeMinutes 0`先预览再Apply，仅退役两个release生成目录368,529,258字节；[实际清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)保留。release现仅当前ZIP与逐文件清单，旧完整交付及运行数据另行保留。

执行`Maintain-Project.ps1 -Apply`：[维护清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)退役四个过期验证／解压副本303,381,068字节；[最终返回实测](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/maintenance-summary.json)逻辑水位12,126,786,242→11,823,435,804字节（约11.011GiB），与清单的删除量推算值分开记录。两次合计退役671,910,326字节；移位归档旧EXE不改变逻辑字节。仍高于10GiB，安全候选耗尽，165项保护／未知用途及1,370链接跳过，零嵌套仓库；不扩大到当前证据、正式存档、原素材、依赖或工具缓存。后续文档／Git写入会略增，未用NTFS压缩量替代逻辑水位，未常驻轮询或发布。

## v1.0.3 文档整理与推送前维护（2026-10-06）

整理README、文档／任务索引及验收入口，明确当前源码包含两项界面维护，而宝可梦和电力公司仍各有独立冻结验收包；本轮不修改程序、重打包或发布。原包、清单、原素材、存档和全部当前验收证据保留。

工程空闲后，对已过30分钟保护的运行副本先预览再执行：[首组两套副本](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/doc-space-runtime-apply.json)188,773,778字节，[末组两套副本及隔离build](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/doc-final-runtime-apply.json)283,160,880字节。只退役精确生成目录，过程ZIP／清单、源码、冻结记录和依赖junction保持原位；沿用已有路径、链接、内容哈希、近期修改和忙进程保护。

`Maintain-Project.ps1 -Apply`的[实际清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除四个已结束验证目录283,014,794字节，维护水位11,879,904,695→11,596,920,535字节。本次合计删除754,949,452字节；末组退役后[最后实测](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/doc-space-final.json)为11,314,190,647字节（10.5372GiB），跳过1,370链接、零嵌套仓库。仍高于10GiB，已核验安全候选耗尽；保护或未知用途内容继续保留，不扩大删除、不常驻轮询。后续文档与Git写入会略增，逻辑空间不以NTFS物理压缩量替代。

## v1.0.3 宝可梦UI重设计收尾（2026-10-06）

本次固定交付ZIP及清单保留在 pokemon-ui-redesign/delivery/，SHA-256 943071ce…；并行电力公司随后更新共用release，两包的验收边界分别保留。原图、来源、用户音源、历史验收和原交付均保留，不生成源码包或发布。全部工程进程退出后，25项定向清理检查及[229项完整隔离回归](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/config/cleanup-prefix-tests/full-final/tool-tests.json)通过，新目录前缀沿用精确六位、30分钟及路径／链接／进程保护；早先被忙进程拦截的失败日志保留，未弱化保护。

先预览再应用：本轮[隔离构建／组装副本](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/isolated-build-apply.json)324,977,532字节、53项过期成功构建产物203,221,157字节、[旧解压副本（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)94,371,298字节，以及[额外三套运行副本](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/extra-runtime-apply.json)283,624,066字节。额外副本只删除旧电力公司暂存的两套解压和旧现代艺术build；过程ZIP／清单、冻结记录、源码、原素材和全部验收截图在目标之外继续保留。依赖和工具缓存保留；构建清理保留当前开发／交付及每单元两份最新成功产物。

执行 Maintain-Project.ps1 -Apply：[实际维护（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)从12,611,745,619降至12,353,217,869逻辑字节，另删除两项过期验证目录258,558,120字节，169项保护或未知内容跳过。以上本次删除总1,164,752,173字节，容量净变化与删除量分别计量。

补充窄范围退役后，[最后一次实际容量](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/final-space.json)为12,070,055,471字节（11.2411GiB），跳过1,370链接、零嵌套仓库。**未达到用户10GiB目标**；已核验的安全候选耗尽，两份近期打包副本、一份近期构建输出及未知用途目录继续保护，不扩大到原件、存档或当前证据，不常驻轮询。后续文档／Git写入略增；逻辑空间、ZIP预算与NTFS物理节省分开，未用压缩量代替目标。

## v1.0.3 电力公司地图优化收尾（2026-10-06）

最终ZIP与[原生通过记录](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/polish-shipping-match/results.json)哈希一致；原完整交付另存于 `power-grid-ui-polish-20261006/previous-delivery/`。工程验证进程退出后，`Clean-Releases.ps1 -KeepLatestOnly -MinimumAgeMinutes 0`先预览再Apply，删除两个已结束打包中间目录460,094,396字节；[清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)保留。最新ZIP／清单与既有受保护EXE保留，无发布或源码导出。

`Maintain-Project.ps1 -Apply`实际逻辑水位由14,767,674,848降至13,238,941,929字节（约12.33GiB），删除27个已核验隔离副本1,528,884,893字节；两次合计1,988,979,289字节。[维护记录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)关联当前ZIP SHA-256 `7946907f4423f6e0c399d14c083dabb7faa2164a25377d523ccfa92cff277963`。安全候选耗尽、仍高于10GiB，169项保护／未知用途内容及1370链接跳过；未扩大清理范围，依赖、缓存、原素材、正式存档、当前及历史证据保留。逻辑字节不以NTFS物理压缩量替代。

## v1.0.3 游戏介绍修复收尾（2026-10-06）

前一份EXE／ZIP／清单完整保留至 `game-introduction/previous-delivery/`，原初始化与迁移证据继续保留；release仅当前三份交付。自有工程进程全部退出后执行 `Maintain-Project.ps1 -Apply`：[维护审计（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)初始11,251,413,591逻辑字节（10.479GiB），删除一份已退出的旧隔离验证目录24,659,377字节，末次11,226,782,836字节（10.456GiB）。安全候选耗尽，161项保护／跳过；仍超过10GiB而未达8GiB，不扩大到近期验证、历史验收、存档、素材或缓存。

## v1.0.3 初始化微调收尾（2026-10-06）

单EXE初始化目录更新后，前一份EXE／ZIP／清单完整保留至本轮 `initialization-folder/previous-delivery/`，原验收证据继续保留；release仅当前v1.0.3 EXE、ZIP和清单。全部自有工程进程退出后执行 `Maintain-Project.ps1 -Apply`，[实测记录](../../artifacts/maintenance/v1.0.3/initialization-folder/maintenance-result.json)为10,791,283,069逻辑字节（10.050GiB），安全候选0、保护／跳过153项，删除0字节。超过10GiB而候选耗尽，近期验证、当前交付及原资料仍按保护保留，没有降低保护期或扩大清理。用户下载目录正在运行的独立旧实例保持运行，未停止或修改。

## v1.0.3 导出与旧资源退役（2026-10-06）

v1.0.3实际EXE／默认与自定义数据路径／3GB存档副本迁移验证通过后，执行先预览再Apply的[release清理（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)，删除旧v1.0.2 ZIP／清单及三份本次打包副本，共500,390,844字节；当前release仅保留v1.0.3 EXE、运行ZIP和逐文件清单，没有源码导出或发布。[隔离副本清理（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除本次两个已结束的存储验证目录，共3,559,438,389字节；正式C盘原库不在该范围。

另按明确旧资源清理范围，先核验旧C盘 `TableMax/app` 的所有权标记、162文件全部哈希、准确文件集、路径／链接与进程，再用专项[脚本](../../scripts/retire-old-local-runtime.ps1)退役95,313,076字节旧运行资源。[旧安装清单](../../artifacts/maintenance/v1.0.3/portable-storage/old-installed-runtime-manifest.json)及[逐文件退役记录](../../artifacts/maintenance/v1.0.3/portable-storage/old-installed-runtime-retirement.json)保留；父数据目录、room.sqlite、WAL／SHM、旧迁移候选及正式原存档均保留，删除后再次验证原库SHA-256完全一致。不是清理整个C盘TableMax目录。

全部工程进程退出后执行 `Maintain-Project.ps1 -Apply`：[维护结果](../../artifacts/maintenance/v1.0.3/portable-storage/maintenance-result.json)初始实测10,795,128,770逻辑字节（10.054GiB），超过10GiB；安全候选4项共506,155,285字节删除后，末次实测10,289,001,461字节（9.582GiB）。安全候选耗尽而未到8GiB，保护内容继续保留，没有扩大范围或用NTFS压缩替代逻辑空间。207项清理保护回归通过，旧同名交付链接转至[退役记录](../../artifacts/maintenance/v1.0.3/portable-storage/old-release-retirement.json)，保留历史哈希与固定验收边界。

## 测试静音与低于10GiB收尾（2026-10-06）

按用户最新指示完成测试默认静音、非必要生成资源清理，并将长任务完成后检查体积／安全瘦身纳入AGENTS与维护规则。初始一次实际盘点44,582,597,297逻辑字节（约41.52GiB），相关工程进程结束后[最终维护](../../artifacts/maintenance/v1.0.2/slimming-test-silence-20261006/final-maintenance.json)实测10,441,893,057字节（约9.725GiB），低于10GiB；后续文字、审计与Git写入会小幅增加，不把此数值当作恒定水位。统计跳过1,346链接、零嵌套仓库，NTFS物理节省未测量。

已核验删除四组：18个旧自动混合Worker主库28,302,213,120字节，见[退役清单](../../artifacts/maintenance/v1.0.2/slimming-test-silence-20261006/retired-test-databases.json)与[执行审计（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)；44个旧隔离验证目录5,745,138,266字节，见[目录清理（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)；两份旧打包解压副本188,741,298字节，见[副本审计（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)；140份旧成功构建产物687,371,269字节，见[缓存审计](../../artifacts/maintenance/v1.0.2/build-cache-cleanup/1791262316963-apply.json)。删除量与容量净降分开计量，期间新增验证、构建及旧包备份计入最终容量。

旧库限 `expansion-integration.test.ts Repository(worker-mixed)` 生成的模拟资料，先保留来源、原结果／源码哈希、只读SQLite版本／journal行数／当前Save摘要和完整文件SHA，再按精确路径预览／Apply。整段旧模拟journal已退役，旧通过／失败结论不改写；近期只读审计生成的WAL／SHM作为单独保留证据，哈希变化阻止删除主库。正式存档、原素材、规则资料及当前截图保留，旧迁移存档前后SHA一致；未按忽略规则删除，也未降低30分钟保护。

releases只保留当前v1.0.2运行ZIP与清单；本轮近期打包暂存以已核验绝对路径可恢复移入证据，逐文件哈希相同，见[保留记录](../../artifacts/maintenance/v1.0.2/slimming-test-silence-20261006/release-retention.json)，没有删除近期内容。旧运行ZIP与清单、已发布EXE／source ZIP原件保留。本轮只打包一次，18单元／16缓存命中，实际组装21,626ms；两次Edge参数核验失败、隔离清理夹具返修和后续通过分别保留。静音、206项清理／34项维护／34项精确退役检查及同包范围见[最新验收](acceptance-2026-10-05-to-08.md#102测试静音与资源瘦身2026-10-06)。

## 电力公司布局交付收尾（2026-10-06）

同版本新ZIP通过实际便携核验后，KeepLatestOnly先预览再执行，删除两个已退出打包目录，共460,493,527逻辑字节（约0.43GiB）；当前运行ZIP、清单、历史发布EXE／source ZIP及验收证据受保护，见[清理记录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)。首轮空闲自动维护实际计量22,003,251,312逻辑字节（约20.492GiB），安全候选0、保护／跳过73项；追加完整便携对局退出后的[最终水位](../../artifacts/maintenance/v1.0.2/power-grid-layout-20261006/final-maintenance.json)为23,444,356,311逻辑字节（约21.834GiB），安全候选0、保护／跳过76项。超10GiB且未达8GiB，候选耗尽后不扩大范围或删除素材／存档／当前证据。NTFS物理释放未测量。

## v1.0.2发布收尾（2026-10-05）

用户更新触发阈值为项目逻辑空间超过10GiB，默认清到8GiB或安全候选耗尽；此前5／4GiB数字仅保留在历史记录。普通候选由.NET快照统计元数据，删除前一次必要复核，全库开始和结束各实际计量一次，减少逐候选反复全库扫描。特定归档、重复图片和历史清单模式仍执行其必要内容哈希；不以提高速度为由删除素材、正式存档或当前验收。

窄范围 [Clean-ReleaseScreenshots.ps1](../../Clean-ReleaseScreenshots.ps1) 仅处理release直属已命名过程图片或纯图片目录，未知运行文件和maintenance证据不在范围内。实际预览／Apply检查确认只删除专用测试PNG、保留EXE哨兵；五项元数据回归覆盖1000文件、修改、链接和嵌套.git文件拒绝。完整快照9.78ms、仅PowerShell枚举43.13ms，此测量不代表完整旧清理流程或磁盘删除耗时，见 [回归边界](../../artifacts/maintenance/v1.0.2/github-release-20261005/cleanup-fast-tests.json)。

本轮完整EXE和source ZIP为明确发布额外交付，本地运行ZIP与清单继续保留；KeepLatestOnly也保护当前EXE和源码ZIP。上一已验v1.0.4包与清单已冻结在本轮previous-delivery目录，历史验收不改号。实际维护耗时、水位、删除字节和保护原因见 [收尾计量](../../artifacts/maintenance/v1.0.2/github-release-20261005/final-maintenance.json)。当前正式资源95,278,750字节，含EXE提取标记95,313,076字节，95MB工程预算超限如实记录，100MB硬限制通过。

全部工程进程结束后，模块缓存按预览删除26份旧成功产物、95,267,096字节，保留当前冻结快照与各单元最近两份。随后受保护维护实测30,642ms，删除14处过期隔离副本、8,203,707,205字节；工作区从42,928,285,243降至34,724,592,096逻辑字节（约32.34GiB）。安全候选耗尽，42项保护／跳过；未为了达到8GiB扩大到未知内容、当前证据、依赖或原素材。窄范围过程截图候选为0，进程保护7项通过；NTFS实际释放量未测，不把逻辑删除量写成物理释放量。

发布后KeepLatestOnly预览并执行，删除已冻结历史包原位及本次打包目录3项、272,086,701字节，保留当前EXE、source ZIP、本地运行ZIP和逐文件清单四份文件。最终空闲维护实测8,522ms，工作区34,466,471,177逻辑字节（约32.10GiB），安全候选0、保护／跳过47项；高于10GiB仍不扩大删除范围，见 [最终水位](../../artifacts/maintenance/v1.0.2/github-release-20261005/post-publication-maintenance.json)。本轮合计删除8,571,061,002逻辑字节，不包含仍保留的素材、依赖、存档及当前证据。

## v1.0.4 交付与空闲维护（2026-10-05）

按用户指定版本重新打包，ZIP40,627,069字节、实际解压95,141,960字节，双100MB硬限制通过；95MB工程预算仍超141,960字节。118个媒体资源及全部规则、策略与服务文件字节不变，原包及清单保留在本轮证据中；体积不使用NTFS物理压缩节省折算。

新包五份实际便携检查完成并核对同一哈希后，按预览执行KeepLatestOnly，删除release原位旧包／清单及三个打包目录，共733,463,378逻辑字节；仅留当前ZIP与清单。空闲维护预览后执行Apply：工作区12,310,593,146逻辑字节（约11.465GiB），21项受保护或跳过、安全候选为0，删除0字节，未扩大范围。近期验证目录、未知内容、原素材、当前验收及缓存保留；工作区仍超过5GiB且未降至4GiB，按保护规则如实记录。详细结果及实际日志见 [合包验收汇总](../../artifacts/maintenance/v1.0.4/final-delivery-20261005/final-checks.json)。

## 电力公司 debug 收尾（2026-10-05）

本轮方案分为运行包压缩和工作区退役：使用锁定 esbuild 压缩游戏／策略 CJS 及 Worker，保持源码可读、属性名、协议、存档、媒体原字节；先验三款实际解压游戏、规则、声画和原生安全，再清理生成副本。118 个媒体文件哈希未变，不采用降低图像质量或重编码用户声音来凑预算。最终运行 ZIP 40,626,986 字节，实际解压 151 文件／95,141,448 字节；比上一合并包少 21,768 字节，95 MB 工程预算仍超 141,448 字节，100 MB 硬限制通过。比较包含本轮新增代码，不能把净减少量全归功于压缩。[同包审计](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/final-delivery-checks.json)和[冻结清单](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/final-delivery-manifest.json)记录实际边界。

三处历史 previous-delivery ZIP 在验收后以精确路径重命名成受保护工具认可的版本包名，逐包大小和哈希进入 [退役清单](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/retired-packages.json)，保留各自原清单与通过／失败文字结果。旧链接改为清单，不再提供过时可运行程序。cleanup-history/preserved-history ZIP 是清理文字证据的无损归档，不是历史应用包，继续保留。当前 v1.0.3 验收图、素材原图、规则、正式存档、依赖与工具缓存保留；不按 Git 忽略状态删除内容。

清理顺序为 Clean-Releases 的已退出打包残留、显式退役历史包、已知隔离临时目录，均先预览后 Apply；最后空闲执行 Maintain-Project。[release 清理（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除 230,936,288 字节；[历史包清理（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除 121,697,794 字节；[40 个隔离目录清理（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除 19,056,787,081 字节。合计删除 19,409,421,163 逻辑字节，不通过手动递归删除绕过路径、链接、进程或近期保护。其他对话未提交的扩展草案、索引和增量构建方案不包含于本次提交。

最后空闲执行 [Maintain-Project 记录](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/final-maintenance.json)，工作区 5,388,318,267 逻辑字节（约 5.018 GiB），安全候选耗尽，未继续扩大范围。四处未识别的隔离构建／版本预览目录保留；原资料、当前证据、正式存档及工具／依赖缓存不删除，链接与嵌套仓库按规则排除。物理磁盘节省未单独测量，不能把逻辑删除量当作 NTFS 实际释放量。

## 宝可梦引导与动漫切入收尾（2026-10-05）

全部本轮原生验证退出后，先预览再执行受保护入口。`Clean-Releases.ps1 -KeepLatestOnly -MinimumAgeMinutes 0 -Apply` 删除两处已退出打包残留461,925,666字节，见 [release清理（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)，releases仅保留当前运行ZIP和逐文件清单；上一已验包及清单已冻结于本轮证据目录。

`Maintain-Project.ps1 -Apply` 删除140,540,184字节已过保护期的已知隔离验证目录，工作区从8,086,147,245降至7,945,615,176逻辑字节（约7.40GiB），见 [维护清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)。超过5GiB但安全候选耗尽；近期验证数据、证据、原素材、正式存档、依赖与工具缓存继续保护，没有降低保护时限或扩大清理范围。当前包实际解压95,163,216字节，工程预算超163,216字节但硬限制通过，NTFS节省不抵扣交付体积。

本页依据用户 2026-10-05 的清理与文档要求维护；合并深度检查完成后，用户又明确要求电力公司 agent 试玩、继续优化、导出 **v1.0.3** 并清理历史版本及临时文件。以下保留 v1.0.2 的历史执行数据，新交付另行审计；实际验收见 [验收记录](../reference/acceptance.md)，操作入口与安全保护见 [开发环境](../reference/development.md#清理本地中间物)。

## 运行包瘦身

新导出前，实际包 **95,582,529 字节**，超出 95 MB 工程预算。服务 CJS 仍保留大量可压缩的局部名称和语法；改用锁定版本 esbuild 的生产压缩，源码继续保留可读名称，资源不重编码，协议、存档格式与运行时版本不变。此变更需要重新运行完整服务与便携检查，不能仅凭编译成功交付。

v1.0.2 最终实际解压 **145 文件／94,941,528 字节**，减少 **641,001 字节**，95 MB 预算余 **58,472 字节**；ZIP **40,442,642 字节**。两项均严格低于 100,000,000 字节。SHA-256 为 `7b013ad0b9da74b862469bfddeecba36e0955672565c43bfc22d265a47cd5c68`。[冻结历史清单](../../artifacts/maintenance/v1.0.2/full-audit-20261005/delivery-manifest.json)记录全部文件大小及哈希。工作区 NTFS 压缩的物理节省不会计入此门禁。

## 执行结果

实际结果见 [瘦身审计](../../artifacts/maintenance/v1.0.2/full-audit-20261005/slimming-results.json)，以下仅计入已通过的操作：

| 操作                             | 处理量                                  | 逻辑删除字节                     |
| -------------------------------- | --------------------------------------- | -------------------------------- |
| releases 打包残留                | 3 个目录                                | 692,392,182                      |
| 已结束验证、隔离数据库和解压副本 | 97 个目录                               | 76,681,819,483                   |
| 历史包与废弃缓存                 | 41 个运行／源码 ZIP、2 个 Electron 缓存 | 2,137,346,816                    |
| 历史截图同字节去重               | 93 张 PNG，分两批／13 个目录            | 36,463,040                       |
| 补充核验的旧全屏测试副本         | 4 个目录                                | 298,377,871                      |
| 合计                             | 保留当前 ZIP／清单及所有独有证据        | **79,846,399,392（74.363 GiB）** |

删包前保留 **423 份独有源码／素材、7,108,112 字节**，按内容哈希归档；与当前素材相同的内容引用现有素材，旧文档和源码引用不可变的保留副本，不依赖后续会修改的主题文档。[最终保留核验](../../artifacts/maintenance/v1.0.2/full-audit-20261005/original-preservation-final.json)逐项检查 **4,688 个成员引用**。旧全屏夹具的窗口探测源码已另存；两个一次性文档／测试脚本通过手动入口逐字节归档后移出 tmp，归档量不计入释放量。正式玩家存档与两段指定 WAV 未被改动。

[无损压缩](../../artifacts/maintenance/workspace-compression-20261004-200436-604/compression.json)检查 **4,659 个文件**，其中 **4,656 个**减少占用，耗时 **163.29 秒**；物理节省 **296,372,524 字节（282.643 MiB）**，逐文件内容哈希未变，零失败／未确认项。该值对应压缩时的审计范围，随后退役了上述四个额外全屏副本；不与逻辑删除量相加，也不作为便携包体积减免。

[最终自动维护](../../artifacts/maintenance/v1.0.2/full-audit-20261005/maintenance-final-after-cleanup.log)再次确认空闲，工作区按路径统计 **14,674,360,355 字节（13.667 GiB）**，无安全候选；统计跳过 **1,338 个链接**，后续报告／文档写入会使数值小幅变化。剩余原始资料、独有截图、历史迁移数据库、依赖及活动缓存继续保留；唯一的隔离源码快照 `tmp/modern-art-isolated-build-BQZ0BZ` 含依赖链接，未递归删除。不为达到 4 GiB 扩大范围，也不把已保护的迁移样本或源码归为废弃内容。

退役清单与清理保护回归分别通过 **19 项／200 项**，自动维护 **34 项**、截图保护 **19 项**、无损压缩 **15 项**。最初重复截图清单因父子目录重叠被拒绝、零删除；拆为不重叠的两批后才执行。历史失败记录保留。后续开发仍按开发环境的安全入口处理新增中间物，不设置常驻清理或后台轮询。

## v1.0.3 再导出与增量清理

用户明确要求导出 v1.0.3。沿用已有生产压缩，不重编码素材：最终 ZIP **40,443,579 字节**，解压 **145 文件／94,945,348 字节**，95 MB 预算余 **54,652 字节**，双 100 MB 门禁通过。[该轮冻结清单](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/delivery-manifest.json)与 [同哈希实际便携结果](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/results.json)绑定；较 v1.0.2 解压增加 **3,820 字节**，来自 UI 更新，不将工作区压缩计作包节省。

先完成普通节奏 agent 试玩、最终组件矩阵、实际 ZIP 六人整局／恢复／原生显示、三端规则与原生安全，再按工具预览清理。v1.0.2 根 ZIP 原 SHA-256／清单与 Git 源码基线保留，[原素材保留审计](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/prior-release-retention.json)确认旧包 **112 项图片／声音／图标**均在当前包保留相同字节；[退役记录](../../artifacts/maintenance/v1.0.2/full-audit-20261005/TableMax-1.0.2-win-x64.zip.retired.json)关联实际删除报告，不覆盖旧验收。

| 实际操作           | 数量                                        | 逻辑删除字节                   |
| ------------------ | ------------------------------------------- | ------------------------------ |
| releases 仅留最新  | 旧 ZIP、旧清单与两个打包目录，共 4 项       | 501,186,275                    |
| 已结束验证临时目录 | 10 项；隔离对局数据库、浏览器副本及实际解压 | 8,879,442,719                  |
| 本轮合计           | 原素材、独有证据与正式存档保留              | **9,380,628,994（8.736 GiB）** |

[release 预览](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/releases-preview.log)与 [实际报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)对应；打包目录先清理后，[中间物重新预览](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/intermediates-preview-after-release.log)和 [实际报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)不重复计算目录。显式 `-MinimumAgeMinutes 0` 仅在确认本轮程序退出后使用，其余路径／进程／链接／指纹／当前通过包保护仍生效。保留包含依赖链接的旧隔离源码 `tmp/modern-art-isolated-build-BQZ0BZ`，不手写递归删除或删缓存达到容量目标。[收尾维护](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/maintenance-final.log)再次确认无安全候选，按路径统计剩余 **14,964,296,548 字节（约 13.937 GiB）**，跳过 1,338 个链接；后续证据／文档写入会使值小幅变化。原资料、独有证据、依赖及活动缓存使工作区仍超过阈值，不扩大删除范围。

## maintenance 历史残量专项（2026-10-05）

用户单独授权清理 `artifacts/maintenance` 内历史版本的非必要残量。本轮盘点原有 **19,772 文件／12,922,668,939 字节**，其中 PNG **12,508 张／10,628,255,605 字节**。逐文件 SHA-256 审计仅选择低于当前版本、存在同字节保留副本的截图；排除原素材、文档直接引用以及以前退役清单承诺保留的位置。历史代码、生成器、独有画面、JSON、日志和迁移数据库保持原位，不扩大到目录整体删除。

既有截图清理器的版本边界由固定 v1.0.0／v1.0.1 改为低于 `package.json` 当前版本，仍拒绝当前与更高版本。按目录深度分四份不重叠清单，逐批预览均为零跳过，然后通过 `Clean-Intermediates.ps1 -DuplicateScreenshotsManifest <清单> -Apply` 删除显式 PNG，保持默认 30 分钟近期保护与全部路径／链接／进程／指纹／互斥检查。

| 历史版本 | 删除的同字节副本 | 逻辑删除字节                  |
| -------- | ---------------- | ----------------------------- |
| v1.0.0   | 71 张            | 41,180,179                    |
| v1.0.1   | 2 张             | 2,118,790                     |
| v1.0.2   | 1,406 张         | 1,117,471,791                 |
| 合计     | 1,479 张         | 1,160,770,760（约 1.081 GiB） |

[专项审计结果](../../artifacts/maintenance/v1.0.3/maintenance-residual-cleanup-20261005/results.json)链接四份实际删除报告；[原始 PNG 盘点](../../artifacts/maintenance/v1.0.3/maintenance-residual-cleanup-20261005/png-inventory.json)和[清理计划索引](../../artifacts/maintenance/v1.0.3/maintenance-residual-cleanup-20261005/plan-summary.json)保留每文件哈希及同字节保留位置。删除后重新核验 **749 个保留副本的 SHA-256**，另 **11,029 张 PNG**大小与修改时间未变，**10,425 种独有 PNG 字节内容**均有保留。当前 v1.0.3 ZIP 大小及哈希与交付清单一致，本轮未重新导出运行包。

截图保护 **23 项**、共用手动清理 **200 项**和自动维护 **34 项**隔离检查通过；PowerShell 语法及文档／本地链接检查采用本轮证据。收尾维护仍无安全候选，唯一跳过项含依赖链接的旧隔离源码继续保留。工作区测量约 **12.861 GiB**，剩余历史存档、独有证据、原素材及依赖不因容量目标继续删除；本轮逻辑删除字节不计作运行 ZIP 或 NTFS 物理压缩的节省。

## 历史运行截图全量退役（2026-10-05）

用户随后明确要求修改截图保留要求并直接清理历史内容。当前策略允许历史版本的验收、试玩、界面截图及截图联系表全部退役，包括独有画面与失败截图；保留文字结论、失败原因、版本／构建边界、逐文件哈希与删除记录，保留当前版本验收截图、原素材、规则参考资料、源码和存档。上节同字节去重及更早报告中的保留图片位置属于当次状态，本轮清单明确其后续已删除，不回写旧验收通过／失败结果。

范围限定为 `artifacts/maintenance` 中已核验的 **14 个历史根目录**，包含 v1.0.0、v1.0.1、v1.0.2，以及版本重编号前的 v1.6.0 和旧未编号验证／归档副本。[显式清单](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/manifest.json)绑定当前通过 ZIP 哈希，记录全部待退役图片的准确路径、大小和 SHA-256；[用户授权与范围](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/authorization.json)作为保留文字证据。原素材和编译素材目录均排除，不能把历史版本目录整体删除。

[默认预览](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/preview.log)因上一轮刚完成去重而保护了三个版本目录；确认工程进程退出后，仅对这份清单显式采用 `-MinimumAgeMinutes 0`。[就绪预览](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/preview-ready.log)为 14 项、零跳过，再执行 `Clean-Intermediates.ps1 -HistoricalScreenshotsManifest <清单> -Apply`。路径、进程、当前便携证明、链接、嵌套 Git、互斥、目录指纹与删除前内容哈希保护继续执行，自动维护不使用这一范围。

[实际删除报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)确认删除 **10,346 张图片／9,095,642,340 字节（约 8.471 GiB）**。[删除后复核](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/results.json)确认所有选定图片已不存在；**2,650 份保留图片**及 **3,178 份历史非图片文件**大小与修改时间未变，其中数据库／旁文件保留 28 项。当前 v1.0.3 ZIP 仍为 **40,443,579 字节**，SHA-256 仍为 `661bbf7fef4470355027dc4ab00eea3190b4637c793906d902021ed9be785f87`，本轮未导出或修改运行包。

[引用修复记录](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/link-repairs.json)将历史验收文档的两处图片链接改为退役清单并标注已清理，保留原审查结论；JSON 中的旧截图路径保留为当时记录，从本轮清单追溯退役状态。新增全量退役保护 **26 项**、共用手动清理 **200 项**、自动维护 **34 项**、同字节去重 **23 项**、历史可再生副本 **19 项**均通过，另检查 PowerShell 语法、文档链接、格式与 diff。执行命令和后续保护规则见 [开发环境](../reference/development.md#手动历史截图全量退役)。

[收尾维护](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/maintenance-final.log)测量工作区 **4,724,785,696 字节（约 4.400 GiB）**，已低于 5 GiB 启动阈值，不再触发清理；跳过 1,338 个链接，保留依赖、工具缓存、历史数据库与原始资料。该值为测量时逻辑文件字节，后续文档／审计写入会小幅增加；截图删除不改变当前运行 ZIP 的大小与内容。

## 清理记录集中归档（2026-10-05）

用户明确要求清理分散的 `local-cleanup-*` 文件夹。已结束的 **52 个清理记录目录与 1 个旧工具记录目录**，共 **1,982 文件／1,247,824,993 字节**，包含历史源码和迁移数据库，不能整体丢弃。先将全部原文件无损归档，再保留 **57 份原字节可读记录／11,082,758 字节**，逐文件核验后才移除旧目录。

[无损归档（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)为 **64,022,981 字节**，SHA-256 为 `ce556253a49954a47dc35254265219b3de4a1a59c47d155f9fedac9faf17d364`；成员保留原仓库相对路径。[逐文件索引](../../artifacts/maintenance/cleanup-history/index.json)记录原路径、字节、哈希、归档成员及可读位置。扣除 ZIP 和可读记录后净减少 **1,172,719,254 字节（约 1.092 GiB）**，新清单和审计文件会占用少量空间；不把这个逻辑字节数计作运行包缩减或 NTFS 压缩物理收益。

[显式清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)经[预览（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)核对 **53 项、零跳过**，再通过既有手动入口执行。[实际操作记录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)与[删除后复核（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)确认旧目录全部移除、剩余 `local-cleanup-*` 目录为零，全部可读记录和保留 ZIP 哈希正确。保留当前 v1.0.3 运行 ZIP／清单，当前 ZIP 大小与 SHA-256 均未变化，未重新导出运行包。

[引用修复（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)更新 **4 份文档／26 个链接**，直接记录改指可读副本，归档成员改指恢复索引；旧 JSON 和日志内的原路径继续表达当时状态。清理工具新增全成员归档证明、可读报告保护及整理记录独立位置；仅对明确位于工程之外的独立 TableMax 成品排除误阻塞，不关闭用户程序，工程进程和未知路径仍受保护。

集中归档 **16 项**、共用手动清理 **200 项**、自动维护 **34 项**、同字节截图去重 **23 项**、可再生副本退役 **19 项**、历史截图退役 **26 项**共 **318 项隔离保护检查**通过。原审计目录已按2026-10-09要求退役，见[退役记录](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)，具体入口与当前边界见[开发环境](../reference/development.md#清理记录集中归档)。

[文档与运行包检查](../../artifacts/maintenance/v1.0.3/cleanup-history-consolidation-docs/project-checks.json)核验 64 份 Markdown、1,392 个本地链接与 273 个章节锚点，零失败；PowerShell 语法与 diff 检查通过。[收尾维护（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)测量工作区 **3,556,285,544 字节（约 3.312 GiB）**，低于 5 GiB 启动阈值，未追加删除；跳过 1,338 个链接。后续文档／审计写入会使字节数略有变化。

## 宝可梦人机与复用优化收尾（2026-10-05）

沿用 v1.0.3，最终运行 ZIP **40,452,032 字节**，实际解压 **94,975,611 字节**，95 MB 工程预算余 **24,389 字节**；哈希与实际便携／显示验收见 [当前验收](acceptance-2026-10-05-to-08.md#103宝可梦人机能力演出与版本复用2026-10-05)。原素材、存档、当前及历史证据保留，没有导出源码包。

确认相关工程进程退出后，先预览再执行 `Clean-Releases.ps1 -KeepLatestOnly -Apply` 与 `Maintain-Project.ps1 -Apply`。[包清理记录](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/release-cleanup.log)为零候选、四个近期打包目录受保护；未降低默认 30 分钟保护。[维护预览](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/maintenance-preview.log)与[实际维护](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/maintenance-final.log)删除一处过期隔离验证目录 **17,253,310 字节**，[删除报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)保留路径和执行结果。

维护后测量 **15,080,820,415 字节（约 14.045 GiB）**，跳过 1,338 个链接，25 项受保护；安全候选已耗尽，仍超过 5 GiB。近期便携解压／验证目录、依赖与工具缓存等继续按既有保护保留，不扩大范围强删。逻辑文件字节不计作便携包或 NTFS 物理压缩节省。

## 宝可梦原创规则图解收尾（2026-10-05）

同版本九张新图合计 **347,266 字节**，替代当前导入的三张规则截图；旧图及全部原 PNG 留存。最终 ZIP **40,620,970 字节**、实际解压 **95,150,329 字节**，超过 95 MB 工程预算 **150,329 字节**，双 100 MB 硬门禁通过；实际哈希和便携验证见 [本次验收](acceptance-2026-10-05-to-08.md#103宝可梦原创图文规则页2026-10-05)。上一已验包与清单复制到本次证据目录，历史通过结论仍绑定旧哈希。

工程进程退出后，[包清理预览](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/release-preview.log)及[执行](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/release-cleanup.log)均为零候选，一处近期打包目录继续保护。[维护预览](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/maintenance-preview.log)核验 18 处工作区 tmp 内过期隔离数据与便携解压目录，确认绝对路径及无目录链接后执行既有 `Maintain-Project.ps1 -Apply`。[实际报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除 **10,174,387,299 字节（约 9.48 GiB）**，正式存档、素材、当前及历史验收证据、已验运行包保留。

[收尾结果](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/maintenance-final.log)测量 **4,463,440,934 字节（约 4.157 GiB）**，跳过 1,338 个链接，六项继续保护，安全候选耗尽；已低于 5 GiB 启动阈值，未为降到 4 GiB 扩大范围。默认 30 分钟保护未降低，逻辑删除字节不计为运行包或 NTFS 物理压缩节省。

## 宝可梦扩展版续建收尾（2026-10-06）

本轮仍为本地v1.0.2，当前ZIP实际解压94,532,267字节，95MB工程预算剩467,733字节；服务Brotli内存恢复及Ogg主题音是实际运行文件减少，与工作区清理、NTFS物理节省分别计量。同包哈希和未完成素材边界见[验收](acceptance-2026-10-05-to-08.md#102扩展版续建预算与同包复核2026-10-06)。

全部构建／测试／原生验证退出后，执行既有 `Maintain-Project.ps1 -Apply`，沿用最新10GiB启动／8GiB目标、30分钟保护及当前同哈希便携通过证据。[实际清理（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除4个过期打包中间目录，共931,114,824字节。原素材、视频参考、PCM原件、存档、当前已验ZIP、现有发布EXE／源码包和全部验收证据保留，未扩大到未知临时目录或依赖缓存。

开始实测18,920,901,565字节，清理报告统计17,989,786,741字节；报告写入后控制台实测17,989,805,273字节，均为逻辑文件字节。跳过1,346个链接，60项受保护，安全候选耗尽，剩余超过10GiB；后续文档／审计写入会略增加，不扩大删除范围或常驻轮询。

## 宝可梦前瞻修复与隔离交付收尾（2026-10-06）

本轮v1.0.2正式ZIP实际解压94,532,561字节，95MB余额467,439字节；仅宝可梦策略及隔离目录重新编译的原生启动器变更，其他187个运行文件与上一已验包相同。共享工作区同时修改的电力公司地图未纳入正式包，混合试包及上次已验ZIP／清单都保留在[本轮交付证据](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-delivery)。相关统计、真正普通模式小局及同包边界见[验收](acceptance-2026-10-05-to-08.md#102前瞻均值修复与普通模式同包续验2026-10-06)。

本轮构建／验收进程退出后执行 `Maintain-Project.ps1 -Apply`，[实际报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除2个过期打包中间目录，共461,024,004字节。开始21,478,087,986字节、结束21,017,083,413字节，跳过1,346个链接，安全候选耗尽；仍超过10GiB，不扩大清理范围。当前包、原素材、存档和证据保留，其他任务改动不提交。隔离工作树的正式包／清单、冻结快照及审计均已复制回项目证据目录，再申请可恢复归档；工作区逻辑字节与包体节省分别计量。

## 宝可梦三胜与叫声续验收尾（2026-10-06）

全部本轮测量、打包和原生验证结束后，执行 `Maintain-Project.ps1 -Apply`；[实际控制台记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-delivery/maintenance.json)为24,337,756,255字节（22.666GiB），零合格候选／零删除，跳过1,346个链接及86项保护。脚本未返回独立cleanup报告路径，保留实际数值，不伪造文件。当前同哈希已验ZIP、声画原件、页面、存档、历史证据及依赖缓存保留；超过10GiB且安全候选耗尽，不扩大清理或常驻轮询。

本轮工作树沿用最近完成提交123fbaf，旧forecast归档实际恢复返回“snapshot is missing”；已提交源码、原包和冻结清单仍保留，新matches工作树保持活动继续完整计划。原始27叫声270,112字节保留，运行派生99,544字节；有损音频编码减小运行包，与逻辑空间维护及NTFS物理压缩分别记录。当前解压94,653,981字节、95MB余346,019字节，模块4MiB仅余1,883字节，不能因此承诺62帧剩余姿态空间，详见[验收](acceptance-2026-10-05-to-08.md#102扩展版三胜策略与叫声同包续验2026-10-06)。

## 普通收局与无损卡面续验收尾（2026-10-06）

火箭队原PNG保留，运行版采用RGBA逐字节一致的无损WebP，净省118,891字节；最新包实际解压94,535,185字节，95MB余464,815字节，其他游戏运行文件字节不变。这是包内格式节省，不计作新动作姿态或NTFS物理节省；依据见[最新验收](acceptance-2026-10-05-to-08.md#102普通收局前瞻与无损卡面续验2026-10-06)。

首次受保护维护从29,073,057,216字节开始，删除1,499,244,900字节过期验证副本后，因主负责人同时启动格式检查触发忙进程保护停止；[失败报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)保留。格式检查退出后重新执行，[完整报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)从27,573,830,748字节降至27,427,299,128字节，删除剩余两候选146,548,225字节。当前已验ZIP、原素材、正式存档及历史验收记录保留；安全候选耗尽，仍超过10GiB，不扩大清理范围。两次真实集成超时的正式数据库保留，存档／日志增长没有在本轮解决。

2026-10-06火箭队估值／角色无损格式续验完成后，全部工程与验证进程结束，执行 `Maintain-Project.ps1 -Apply`：项目逻辑字节29,381,345,156，零合格候选，91项保护／近期内容跳过，删除零字节。仍超过10GiB，安全候选耗尽，未扩大清理范围；原素材、正式存档及当前已验包保留。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-ability-review-20261006/maintenance.json)与[同包审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-ability-review-20261006/final-checks.json)分别记录空间和交付门禁，不将NTFS节省计入运行预算。

2026-10-06梦幻模型源码续建后，所有测试／服务／测量进程结束再执行安全维护：逻辑字节30,178,343,748，零候选、93项保护／近期内容跳过，删除零字节，安全候选耗尽，未扩大范围。当前 `42205330…` 已验ZIP、正式存档及原素材保留；[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-mew-model-20261006/maintenance.json)对应本轮容量，源码领先运行包的边界见[接续](pokemon-encounters-expansion-2026-10-05-to-06.md#梦幻完整交换估值续建2026-10-06)。

2026-10-06闪电鸟接力源码续建后，所有工程／测量进程结束再执行安全维护：逻辑字节31,600,246,188，零候选、95项保护／近期内容跳过，删除零字节，安全候选耗尽，原素材、正式存档和 `42205330…` 已验ZIP保留。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-relay-model-20261006/maintenance.json)对应本轮实际容量，未扩大清理范围；源码尚未更新该ZIP的边界见[接力续建](pokemon-encounters-expansion-2026-10-05-to-06.md#闪电鸟完整接力预测续建2026-10-06)。

2026-10-06火箭队双面取牌／超梦来源源码续建后，相关测试与真实服务／Worker、格式检查全部退出，再执行安全维护：逻辑字节32,508,859,820，零候选、99项保护／近期内容跳过，删除零字节；安全候选耗尽，未扩大清理范围。正式存档、原素材与当前已验ZIP保留。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-coin-source-model-20261006/maintenance.json)和[接续](pokemon-encounters-expansion-2026-10-05-to-06.md#火箭队双面取牌与超梦来源续建2026-10-06)分别记录实际容量与源码尚未进入运行包的边界。

2026-10-06路卡利欧可选取牌／终局潜力续建后，所有测试与真实服务／Worker、格式工具退出再执行维护：逻辑字节35,164,180,098，零候选、101项保护／近期内容跳过，删除零字节，安全候选耗尽。原素材、正式存档、首次冻结失败报告与当前已验ZIP保留，未扩大清理范围。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-lucario-model-20261006/maintenance.json)对应本轮实际容量，[接续](pokemon-encounters-expansion-2026-10-05-to-06.md#路卡利欧可选取牌与终局估值续建2026-10-06)记录最终源码重跑与尚未更新ZIP的边界。

2026-10-06累积能力模型同包续验后，150种子、隔离构建／打包与实际原生／普通UI进程全部退出，再执行维护：逻辑字节35,222,690,518，零候选、106项保护／近期内容跳过，删除零字节，安全候选耗尽。当前 `79ace556…` ZIP和旧 `42205330…` ZIP、正式存档、原素材与本轮实际截图／失败记录均保留，未扩大范围。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-combined-model-delivery-20261006/maintenance.json)给出实际容量，[同包审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-combined-model-delivery-20261006/final-checks.json)确认交付解压94,302,060字节，二者分开计量。

同轮 `Clean-Releases.ps1 -KeepLatestOnly` 预览为零候选；脚本除当前ZIP／清单外还明确保护已存在的同版本EXE与source ZIP（`cleanup-local.ps1` 的 `publishedFile` 保留分支），未执行删除或移动。两文件为本轮开始前已有产物，本轮只更新运行ZIP与清单，未重新生成或发布它们。记录进入上述维护JSON，未绕过保护强行收敛目录为两文件。

2026-10-06当前源码2–3人八种子三胜对照及分析／失配验证完成后、下一人数组启动前维护：逻辑字节35,223,908,812，零候选、108项保护／近期内容跳过，删除零字节，安全候选耗尽，未扩大清理范围。[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-analysis-20261006/maintenance.json)保留当前包、原素材、存档和完整对照证据。

四人八种子24场对照与分析退出、五人组尚未启动时执行维护：初次沙箱遍历拒绝访问且未改文件，正常权限重试后逻辑字节35,224,557,778，零候选、110项保护／近期内容跳过，删除零字节，安全候选耗尽。[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-matches/combined-source-holdout-4p-20261006/maintenance.json)保留本次权限边界及原素材、存档、当前包与全部对照证据，未扩大清理范围。

五人24场对照、来源请求、分析及格式工具均退出、六人组尚未启动时维护：逻辑字节35,225,296,315，零候选、114项保护／近期内容跳过，删除零字节，安全候选耗尽。[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-matches/combined-source-holdout-5p-20261006/maintenance.json)保留现有包、原素材、存档及完整对照／来源失败证据，未扩大范围。

六人测量、全人数合并／分析及格式工具全部退出后维护：逻辑字节35,228,844,777，零候选、115项保护／近期内容跳过，删除零字节，安全候选耗尽。[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-matches/combined-source-holdout-all-counts-20261006/maintenance.json)保留四份原报告、合并脚本与哈希、当前包、素材、存档及全部验收证据，未扩大范围。

循环自然观察、受控夹具、钩子恢复、测试与格式工具全部退出后维护：逻辑字节35,229,460,678，零候选、122项保护／近期内容跳过，删除零字节，安全候选耗尽。[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-flow-audit-20261006/maintenance.json)保留原型失败、校验器拒绝的夹具原因、最终自然／受控结果、当前ZIP、素材与存档，未扩大范围。新文件仅测量用途，生产14文件与既有对照测量器哈希不变，不重复打包。

2026-10-06策略预算诊断全部退出后执行安全维护：逻辑字节35,229,993,411，零候选／零删除、127项保护或近期内容跳过、1,346个链接跳过，未发现嵌套仓库。安全候选耗尽后不扩大范围；当前ZIP、存档、原素材与所有诊断证据保留，见[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-budget-diagnostic-20261006/maintenance.json)。

三胜修复、真实Worker、五场完整大局及同包普通／原生验证全部退出后维护：逻辑字节39,834,721,605，零候选／零删除、139项保护或近期内容跳过，1,346链接跳过、零嵌套仓库。新增真实SQLite和原包备份按验收证据保护，当前ZIP保留；[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-outcome-20261006/maintenance.json)说明安全候选耗尽，未扩大范围。

新策略2–4人96场独立对照及叫声来源补证全部退出后维护：按原脚本路径、近期修改与当前交付保护，仅删除已过保护期的可再生成打包暂存 `package-1.0.2-Mp5jm6`，229,536,884字节；151项内容、1,346链接和全部原素材／存档／证据保留。[清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)记录删除前39,836,458,127字节，结束容量统计39,606,959,541字节（含新写维护清单）。安全候选耗尽，仍高于10GiB，不扩大范围；当前71248726运行ZIP哈希再次核对一致，未删除当前或历史验收包。

新策略五人24场对照、分析与格式工具全部退出、六人组尚未启动时维护：逻辑字节39,607,829,665，零候选／零删除，154项保护或近期内容、1,346链接跳过，零嵌套仓库。脚本零候选不生成清单，[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-matches/match-outcome-holdout-5p-20261006/maintenance.json)保留实际终端结果；当前包、素材、存档与完整对照均保留，仍高于10GiB，不扩大范围。

新策略六人24场及全人数144场合并／分析／格式全部退出后维护：逻辑字节39,611,297,431，零候选／零删除，158项保护或近期内容、1,346链接跳过，零嵌套仓库。[终端记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-matches/match-outcome-holdout-all-counts-20261006/maintenance.json)保留零候选结果，当前71248726包、四份原报告、合并数据、素材与存档不变；仍高于10GiB，不扩大清理范围。

普通前瞻三胜续修的测试／完整大局／打包／两项实际程序验证全部退出后维护：首次沙箱拒绝读取、零删除；授权环境按原保护脚本执行，逻辑字节42,640,911,863，零候选／零删除、170项保护或近期内容、1,346链接跳过、零嵌套仓库。[终端记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-match-20261006/maintenance.json)保留边界；新增真实SQLite、旧包备份、当前e8023551包与正式证据均保留，超过10GiB但安全候选耗尽，不扩大范围。

2026-10-06扩展一次性技术收尾全部工程进程退出后，先预览／应用 `Clean-Releases.ps1 -KeepLatestOnly`，删除已过保护期的打包暂存229,537,914字节，[清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)保留路径与保护依据。脚本保护的两份近期暂存和既有发布EXE／source ZIP仅可恢复移入本轮证据目录，没有删除近期内容或原件；原发布文件与此前备份逐项SHA相同，当前ZIP／清单哈希不变，[保留记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006/release-retention.json)记录完整路径。`artifacts/releases/`现只留本次已验运行ZIP与清单，历史ZIP、失败迁移库、原素材、存档与当前截图继续保留。

随后 `Maintain-Project.ps1 -Apply` 按10GiB／8GiB边界执行：逻辑字节44,582,300,751→44,582,166,411（约41.52GiB），仅删除两个旧隔离倒计时验证目录共168,422字节；189项保护或近期内容、1,346链接跳过，零嵌套仓库。安全候选耗尽，仍超过10GiB，不扩大范围或重复全盘扫描。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006/maintenance.json)及[原清单（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)保留实际容量，NTFS物理节省不计入运行ZIP门禁。

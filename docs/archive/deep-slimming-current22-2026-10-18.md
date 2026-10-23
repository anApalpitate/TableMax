# current22恢复后的深度瘦身（2026-10-18）

用户免除1.0.7.34本轮正式验收，先按[指针恢复记录](current-pointer-repair-2026-10-18.md)恢复有实际证明的current22；34原安装器及冻结输入保持未验收候选。公开版本、标签和发行附件未改变。

## 范围与保全

清单仅覆盖已结束的运行／打包展开副本、隔离测试生成物、历史UI截图及完整字节归档的机器记录。源码、其他任务改动、原素材／规则／音频、正式数据、唯一旧局、原安装器、当前证明及真实安装runtime、历史模块、依赖／工具缓存、未知与待续输入、链接及嵌套仓库均保留。用户随后选择“保留服务，暂不执行删除”，因此项目维护Apply未执行，项目退役0文件／0字节；单次ID未消耗。

[原Node采样](../../artifacts/maintenance/deep-slimming-restore-current-1792303313464/capacity-before.json)为28,888,300,343字节。随后原生保护发现Node漏报的Global Junction，改用[原生不跟随完整基线](../../artifacts/maintenance/deep-slimming-restore-current-1792303313464/native-capacity-before.json)：29,222,735,742字节、124,654普通文件、1,783链接，零扫描错误。口径包含隐藏文件、主Git、全部嵌套仓库、归档和缓存；原生方法及SHA已保存在[方法绑定](../../artifacts/maintenance/deep-slimming-restore-current-1792303313464/native-capacity-method-binding.json)。不能将不同时点的Node样本与未来原生终值相减。

[精确清单（原件已退役）](history-cleanup-20261024.md)最终列30,276文件、19,593,512,650字节，绑定来源、普通文件SHA／字节／精确UTC ticks、current、保留文件和链接原始目标。该数字仅为候选，未发生回收。按本次原生基线投影仍约9.63GB，严格低于6GB的目标未完成，不能为数值扩大到受保护或未知内容。

预览修订保留原拒绝记录：冗余`.git`字段移除；4个并行游戏源码经[归属复核](../../artifacts/maintenance/deep-slimming-restore-current-1792303313464/parallel-source-protection-review.json)改为整个games目录保护；生产staging原manifest保留，静态程序逐成员对照manifest后完整归档。并行马尼拉文档提交后，定向核对39个历史范围、90项原结果／冻结验证器及全部Markdown入链，[来源复核](../../artifacts/maintenance/deep-slimming-restore-current-1792303313464/live-document-change-review.json)未发现历史依据变化或新增入链候选。

原生检查识别[11个Global链接](../../artifacts/maintenance/deep-slimming-restore-current-1792303313464/native-additional-links.json)，其中一个候选穿过`linked-candidate`。相交的102文件移出清单，完整fixture及实际目标保留；所有1,783链接均绑定目标，原1772条raw表示核验精确兼容。此过程未修复、跟随或删除测试链接。

## 历史查证与待续任务恢复

[归档索引（原件已退役）](history-deep-review-20261024.md)保存原路径、完整字节、逐成员SHA、归档SHA及方法参数。[保全汇总](../../artifacts/maintenance/deep-slimming-restore-current-1792303313464/preservation-storage-summary.json)共9归档、318,999,891字节，覆盖9,425,536,992源字节；部分源文件仍因直接入链或链接目标保护保留，且本轮未退役任何原位副本，不能据此宣布净节省。普通ZIP与`ustar-xz-v1`均已逐成员流式核验；不以摘要替代机器证据，不执行归档成员。原安装器及其原路径安全身份保持原位。

未来若执行精确退役，接续受影响的隔离任务或复查历史记录前，先确认索引中归档自身SHA，再仅恢复所需原路径，禁止覆盖现有文件或穿过链接，复核原成员长度和SHA；恢复程序副本不代表重新获得安装／系统验收通过。当前所有原位副本仍存在，无需现在恢复。solid归档可先通过`node tools/maintenance/verify-preserved-tar.mjs ustar-xz-v1 <归档绝对路径> <归档SHA> <固定系统tar SHA>`核对完整成员，参数详见[维护工具](../../tools/maintenance/README.md#人工深度瘦身)。

已结案历史UI截图允许按文字结论、失败原因、版本与逐图SHA退役，不承诺原图视觉回放。审计过程中产生的冗余`historical-proof-storage.tar.xz`也列入精确清单；保留其原成员与核验记录，旧程序成员仍可由保全的原payload恢复。当前／最新／未结案截图和原规则扫描不适用该退役结论。

## 适用检查与状态

归档解析、路径／损坏／链接拒绝及生产staging窄入口的初版隔离回归17场景、109检查通过。后续原生引用检查与O(1)引用查找保持全部实际校验：前16场景115检查通过，Global真实链接13检查、引用绑定及SHA大小写兼容9检查通过；原1,772条与新增11条实际链接核对通过。各范围复用不累加成新的通过统计。新增生产程序3,709个源文件额外数据流与元数据审计通过。真实入口Apply夹具被活动工程进程拒绝，保留失败和待验，不将静态检查当作通过。

[最终真实只读预览（原件已退役）](history-cleanup-20261024.md)已通过30,276文件、19,593,512,650字节；清单SHA为`c80a59c13dcff005fdf33ddf49e783a560d5897f83f0d7778ec87db079a2154c`。用户保留开发服务，本轮不执行项目删除或追加清理；须等用户恢复执行且工程空闲后补验真实入口，重新确认清单、来源、current、全部链接与近期保护，再以相同未消耗ID执行唯一一次Apply。需要实测完整原生终值和保护复验才能更新回收数字，严格低于6,000,000,000字节仍是未完成目标。

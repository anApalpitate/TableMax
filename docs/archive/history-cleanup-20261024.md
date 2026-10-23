# 历史临时内容与旧验收证据退役（2026-10-24）

用户明确授权清理历史过程中未采用最新集中管理原则的临时文件，非最新版本验收证据无需保存。现行规则归[工作区维护](../reference/workspace-maintenance.md#历史临时文件与非最新版本证据2026-10-24)。

## 本轮范围与状态

用户随后明确要求“忽略该构建相关内容，继续清理”，接续前次保留的20,806文件、1,533,337,015字节；当前build、缓存、最新交付／验收及所有新增／近期文件继续排除。该剩余范围已全部删除，原始总清单42,535文件、6,077,518,773字节现均不存在，逐文件流水与精确清单对应且无重复。当前交付、有效来源及现存链接最终复核通过；本次未停止任何其他进程，也未修改共享清理门禁。

接续先删2,000文件、6,444,183字节后，因无关盒子来源脚本变化中止。审阅确认其仅对应已经删完的历史目录后，按实际剩余目录保留所需生成器、安装辅助依赖与来源／交付证明，移除26项无关源码绑定。另一个任务已移除蟑螂沙拉源码及三个依赖链接；只从清理绑定中移除这三个不存在的链接，并将原目标显式加入保护前缀，没有触碰该任务内容。未消耗ID的预检曾因类型检查运行而停止，待其实际结束后继续；原始失败记录均保留。按用户排除构建内容的最新指示，本任务为三个精确命令设置范围例外：noEmit类型检查、默认当前构建及默认隔离开发入口；执行时核对所审输入SHA，显式旧候选路径和其他命令仍阻塞。7项自检通过，具体边界见[范围审阅](../../artifacts/maintenance/history-cleanup-20261024/scoped-process-review.json)与[隔离自检](../../artifacts/maintenance/history-cleanup-20261024/scoped-process-selftest.json)。共享脚本未改，先前进程中止的零删除记录保留。最终18,806文件、1,526,892,832字节一次执行通过。

完整逻辑最终采样11,471,096,727字节、106,933个普通文件，含Git、依赖和实际嵌套仓库，不跟随1,786个链接，扫描错误0项。并发任务及新增记录使净变化不等于删除量。**仍未达严格低于6GB目标**；本次已审安全清单耗尽，不扩大删除范围。[接续执行](../../artifacts/maintenance/history-cleanup-20261024/continue4-execution.json)、[最终成员核对](../../artifacts/maintenance/history-cleanup-20261024/continue-final-audit.json)与[最终容量](../../artifacts/maintenance/history-cleanup-20261024/capacity-after-continue.json)记录终态。

### 前次部分收尾与中止历史（由后续授权接续）

已审范围42,535文件、6,077,518,773字节；实际退役21,729文件、4,544,181,758字节。剩余20,806文件、1,533,337,015字节全部保留，逐文件metadata和完整SHA复核无变化。用户明确选择保留开发服务、本次清理到此收尾，**本次已结束，不再接续删除**。

首轮删除282文件、47,983,279字节后因验证并发被门禁中止；用户明确授权新轮和跨聊天暂停构建／验证。来源脚本SHA变化在新ID消耗前被拒绝，经审阅确认原临时目录生成路径未变后更新来源绑定，未修改或提交对方代码。新轮慢速worker实际已删11,804文件、831,852,642字节；用户要求“采用速度更快的手段”并指示“继续”后，核验身份并停止本任务worker，按磁盘核对剩余成员，保留原进度与失败记录。

编译批处理通过10项隔离保护自检，接续相同冻结清单（SHA `88610f5f90b650bda05142cf9eb52f702e653ce8adb84b2809d22c1ecd795ae0`），保留原生逐文件SHA／metadata／链接／嵌套仓库保护、相同互斥锁、入口及每2秒活动进程检查、每1,000文件保留绑定复核。实际再删9,643文件、3,664,345,837字节（流水逐项对应原清单且无重复）；批次journal最后持久化的9,000文件不是最终实测。新开发服务 `tools/dev/dev.mjs` PID23860于01:08:40启动后触发门禁中止，未终止此未知服务；已协调聊天确认不属于其任务，随后依用户选择停止后续清理。空父目录保留。

完整逻辑采样17,331,186,758→13,038,774,514字节，包含Git、依赖和两个实际嵌套仓库，不跟随1,789个链接；扫描错误0项。采样时开发服务保留，新增运行内容及后续文档／Git写入使净变化不等于逐文件删除量。**未达到严格低于6GB目标**，剩余候选不因目标差额追加删除。

候选包括已证明由现行工具生成的隔离验证／安装staging、旧浏览器profile、1.0.3导出源码副本、1.0.7.22临时运行副本、旧截图预览工作区、1.0.0–1.0.7及1.0.8.8的部分验收输出和过期清理工作清单。不是整目录清空，未列成员原位保留。

当前1.0.8.9的EXE、payload、清单及正式通过证明核验相符；当前源码专项、正式存档、old-electron-save迁移原档、已采用原素材、影音原件、旧局恢复载荷、工具／依赖缓存、链接目标、嵌套仓库、活动任务和30分钟近期内容均保护。未知来源不作为隔离数据删除。

## 原件与结论边界

前次部分收尾曾将仍在的1,881条旧证据入链恢复原路径；本次剩余成员全部退役后，相关链接重新指向本说明并标注“原件已退役”。历史文字结论及当时结果保持原意，不代表当前重新通过。已删与剩余成员的原路径、字节数和逐文件SHA从[精确清单](../../artifacts/maintenance/history-cleanup-20261024/reviewed-files.json)及最终成员核对查询，不生成旧证据完整备份。

[来源与排除审计](../../artifacts/maintenance/history-cleanup-20261024/origin-audit.json)记录生成器及保留边界；[原当前交付核验](../../artifacts/maintenance/history-cleanup-20261024/current-delivery-proof.json)仅证明本轮只读核对身份，不是重新安装验收。[首轮执行记录](../../artifacts/maintenance/reviewed-retirements/history-cleanup-20261024.json)、[已删文件核对](../../artifacts/maintenance/history-cleanup-20261024/deleted-files.json)、[来源变化审阅](../../artifacts/maintenance/history-cleanup-20261024/resume-input-review.json)及[新轮授权](../../artifacts/maintenance/history-cleanup-20261024/round-authorization.json)保留失败与授权边界。[快速中止记录](../../artifacts/maintenance/history-cleanup-20261024/fast-execution.json)、[逐文件流水](../../artifacts/maintenance/history-cleanup-20261024/fast-deleted.tsv)、[最终成员核对](../../artifacts/maintenance/history-cleanup-20261024/final-retirement-audit.json)、[保留保护复核](../../artifacts/maintenance/history-cleanup-20261024/final-preservation-audit.json)及[最终容量](../../artifacts/maintenance/history-cleanup-20261024/capacity-after.json)给出实测终态。当前交付仅只读复核，不算重新安装验收。

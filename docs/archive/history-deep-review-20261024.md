# 历史占用深度复审与退役（2026-10-24）

用户要求继续审查年代较久的占用，清理安全历史临时文件与旧验收证据，保留当前构建，目标严格小于6,000,000,000逻辑字节。文件年龄只用于筛选线索，实际退役依据为生成来源、版本替代、逐文件SHA及保留范围。

本轮继续审查剩余占用，单次已审Apply删除32,449文件、5,552,287,407逻辑字节，另非递归解除3个旧源码副本的缓存借用junction。完整逻辑实测11,473,674,412→7,641,809,001字节，**仍未低于6GB目标**。计入Git、依赖与实际嵌套仓库，不跟随1,783个链接，扫描错误0项。

初始容量减去实际删除量为5,921,387,005字节，但最终实测包含期间净新增／变化的1,720,421,996字节。最大新增项为当前源码验证任务tmp/retire-public-screen-20261024-f1，1,556,166,931字节、12,815文件；当前验收页引用其结果，该任务冻结记录证明尚未Apply。依用户保留当前构建相关内容的要求，本轮不纳入删除。该目录不因文件内容复制了旧mtime而推定为历史废物。详见[新增占用审查](../../artifacts/maintenance/history-deep-review-20261024/post-cleanup-growth-review.json)与[剩余tmp分类](../../artifacts/maintenance/history-deep-review-20261024/remaining-tmp-review.json)。单次Apply已完成，不追加同轮删除，目标未达。

退役范围包括旧验收运行展开内容、非最新报告与图片、已结束隔离夹具、重复打包暂存、两份带明确disposable标记的开发session及592个旧编译缓存根。逐文件SHA清单为[reviewed-files.json](../../artifacts/maintenance/history-deep-review-20261024/reviewed-files.json)，最终清单SHA `f4b323c2651887e539fc27d4be318db6a8c8165394595c5078a3bcbcaa8fd36c`；[执行记录](../../artifacts/maintenance/history-deep-review-20261024/fast-execution.json)和[逐文件流水](../../artifacts/maintenance/history-deep-review-20261024/fast-deleted.tsv)保留原路径、字节、SHA与结果，不复制待删备份。[最终核对](../../artifacts/maintenance/history-deep-review-20261024/final-audit.json)逐条核对流水与全部待删路径不存在；[容量实测](../../artifacts/maintenance/history-deep-review-20261024/capacity-after.json)记录完整口径。

当前1.0.8.9 installer、payload、current映射、原路径启动／安装证明全部保留。当前与最新开发snapshot对应编译单元、公开旧发行引用及每单元最新两次成功输出保留。维护采用既有build-cache-maintenance锁，阻止新构建进入缓存；不结束进程。锁内刷新最新开发快照保留集合，未增加候选。清理后只移除精确退役缓存根内的空目录，不递归删文件，维护锁已释放。

原素材、规则资料、正式旧存档（含约594.6MB旧Electron room.sqlite）、依赖／工具缓存、嵌套仓库及其他活动任务保留。所有canonical签名模块不动；旧staging中每个唯一完整SHA至少原位保留一份，仅退役同字节额外副本。来源及同字节证明见[副本保留](../../artifacts/maintenance/history-deep-review-20261024/historical-module-copy-retention.json)、[生成来源](../../artifacts/maintenance/history-deep-review-20261024/additional-origin-review.json)、[素材排除](../../artifacts/maintenance/history-deep-review-20261024/material-and-fixture-safety-review.json)。

3个旧源码副本的.cache仅删除junction对象本身，未跟随目标；隔离夹具验证及[目标证明](../../artifacts/maintenance/history-deep-review-20261024/retired-link-target-proof.json)确认canonical Node SHA不变。其余链接继续保护。先前预览因latest快照变化、旧借用链接保护而拒绝，均未进入Apply；纠正来源与锁范围后重做预览，执行仅一次。10项native guard、7项进程策略、9项扩展策略、4项维护锁进程、4项空目录和1项junction隔离检查通过；扩展测试初始脚本错误保留原失败，修正测试表达式后定向通过。此清理不产生产品或安装验收结论，已退役证据不得复用。

本轮临时审计脚本与输入集中于tmp/history-deep-review-20261024；[一键清理](../../artifacts/maintenance/history-deep-review-20261024/cleanup.cmd)先预览确认后退役本任务临时文件，保留30分钟保护及正式执行记录。旧任务仅被本轮删除的过期全库inventory从其待清清单移除，旧执行流水不改写。

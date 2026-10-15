# 安装与更新流程优化历史（2026-10-16）

本任务的实现、必需验收和证据封存已完成并归档。以下按原时点保留任务快照、失败、停止与接续记录；后续通过不改写旧结果。当前身份见[验收](../reference/acceptance.md#当前源码与本地交付)，失败门禁见[验证规则](../reference/validation.md#历史通过率与失败阈值)。

轮次01累计5失败后停止派发，以下“等待新轮授权／不自动开启新轮”是当时原记录。2026-10-16用户已明确允许证据驱动的实质修复或定向环境纠正后，在原授权范围内自动新建独立预算轮，无须另问；这不倒改旧轮失败，也不把未执行项写成通过。轮次02累计5失败后同样停止，轮次03在实质修复后接续，原报告和历史统计全部保留。

## 轮次02停止与轮次03接续

轮次02的[原账本](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/progress.json)累计5失败：IPC的CRLF／写端Dispose竞态、PS5根数组误包一层、事务CLI误传候选外清单，以及root-junction与candidate-junction的finally误认。前两项已实质修复并定向通过，CLI改为实际候选内清单。最后两项的原执行记录分别为[实际helper根拒绝10](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/transaction-preflight-02/logs/002-root-junction.log.json)和[候选拒绝10](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/transaction-preflight-02/logs/003-candidate-junction.log.json)；它们确已执行helper，整体[失败报告](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/transaction-preflight-02/report.json)保留，不改写为通过。

轮次03修复采用lstat与父目录Dirent双视图识别、精确非递归rmdir，并同时保留主体与清理异常。当前已通过的适用证据：

- 更新唤起12项：[首项修复](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/update-activation-first-fixed.log)与[其余11项](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/update-activation-remaining.log)。实际私有管道、同实例声明和真实RSA控制器；没有完整桌面／服务／系统安装链。
- 控制器[20项](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/update-controller.log)；原生启动[13项](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/native-launch.log)为独立组件，不替代账户或真实Apply。
- 资源[迁移／非空目标2项](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/resource-migration-01/report.json)与[删留4项](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/resource-cleanup-01/report.json)，合计6个case。调用真实MigrationLease／Migrate、helper卸载及包内Node，使用合成SQLite v2、Save／checkpoint与临时测试签名；覆盖同根默认／外D、共享旧发行、坏catalog／journal、未知资料及链接原件保全，不证明真实旧局或账户迁移。
- [junction隔离5项](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/junction-isolation.log)与[实际helper前置拒绝6项](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/transaction-preflight-01/report.json)通过；后者包含合成恢复日志，不是断电、健康启动或Inno证明。
- 实际向导迁移源[不存在](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/wizard-absent-01/report.json)与[存在](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/wizard-present-01/report.json)均完成中文返回／取消流程；没有点击Install。
- [场景纯隔离4项](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/scenario-isolation.log)通过；PS驱动[原4组通过与1组失败](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/production-driver-isolation.log)保留，失败组的[定向复验](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/production-driver-method-fixed.log)通过。证据复用不新增通过次数。

截至本阶段，round03累计3失败：一项ESLint缺少cause关联已[修复并定向通过](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/scenario-cause-fixed.log)；Updater入口[第一次](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/updater-entry-01/report.json)与[第二次](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/updater-entry-02/report.json)均未整体通过。第二次诊断实际确认按钮ID2，而验证器仅接受ID1；修复和后续实测由主agent串行接续，不倒改旧失败。

本地候选1.0.6.19的[封包记录](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/package-candidate-01.log)保留配方、逐成员、签名来源与当前指针保护绑定。完整EXE为35,754,061字节、SHA256 `aca93f5fc8f434ed9d9fb02c6a56bcff75214d09a30fb8e6d1a57a80a9641a69`；封包不代表实际安装体积、首次物化或正式系统验收通过。两份1.0.7.60000／60001 fixture仍只有[准备证明](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-02/handoff-prepare-01/report.json)。当前18、便携10来源与各历史原字节保持原范围，候选19未推广，尚无推广授权；没有新布局迁移账户通过结论。

## 轮次03正式系统链与清理完成（2026-10-16）

在前述阶段快照之后，round03累计4次失败：cause关联、两次Helper确认按钮假设，以及正式驱动入口列表拼接。原失败与诊断均保留；[入口组件4项](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/updater-entry-03/report.json)及[入口列表隔离3项](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/entrypoint-array-fixed.log)修复后通过，不清零旧账。

`production-account-19-02` 在真实新标准用户与profile内完成三条fixture链，每条8步通过：[默认D正向更新](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/application-handoff/report.json)、[长根外D正向更新](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/application-handoff-long-root-external-data/report.json)、[旧框架失败恢复](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/application-framework-recovery/report.json)。它们核验原prepared输入后执行真实Apply／持续新主机和默认卸载；fixture身份保持独立，不改写为生产GUID证明。

随后候选19的[正式GUID完整证明](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/shipping-executable-checks-full.json)通过，覆盖首装、同包复装、快捷方式、真实保存、默认卸载、保留D同根重装读回、再次默认卸载与首次完整容量门禁。[驱动终态](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02-completion.json)退出0，[隔离报告](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/isolated-account.json)确认账户／profile均已删除且errors为空。原执行材料与[独立封存证明](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/finalized-installation-19.json)分别保存；封存不重复产品执行，方法说明见[工具整理记录](tooling-delivery-organization-2026-10-15.md#方法拆分后的正式执行与独立封存2026-10-16)。正式SHA、容量分项与预警唯一正文见[验收](../reference/acceptance.md#当前源码与本地交付)。

本阶段记录时，真实便携10→19的 `portable-migration-19-01` 仍在执行，不能推定两case及清理终态通过。current18及其原证明仍保持原范围；剩余便携迁移、文档与commit／push从[当前任务](windows-installer-flow-2026-10-16.md)接续，不作全任务归档结论，不发布。

## 轮次01迁入快照

## 范围与契约

按用户确认计划实施，新结构作为未来v1.0.7及以后兼容基线：首次默认安装包所在目录/TableMax，内部配置及运行工作目录改为data；未来升级按登记原根执行。不为未发布18旧安装结构增加升级兼容层。保持当前公开版本，不发布附件或部署；冻结18及原证据、既有工作区改动保留。

迁移先勾选后显示，默认查找安装包同层TableMax；同根复制到data需冻结源清单、保留原件。完整简体中文；增加可见Updater入口与明确检查结果。卸载删除可重建资源，保留所有存档/checkpoint旧局依赖、共享引用、未知资料及原迁移源。

## 进度

- [x] 定向复验交付保护测试收尾，保留主断言和清理异常。
- [ ] 新data布局、可选迁移与完整中文语言文件。
- [ ] 卸载精确资源清理、旧局依赖保留与中文结果。
- [ ] Updater入口、同实例唤起及明确检查反馈。
- [ ] 静态、隔离、真实新布局更新恢复／卸载验证。
- [ ] 新完整候选及干净标准Windows账户验收。
- [ ] 更新唯一正文、阶段commit、push同步。

## 验证轮次

本需求新建独立轮次，默认累计5失败停止。前任务累计5失败及历史统计保留，不改写为新轮通过；本轮仅复验实际受影响项，动态操作由主agent串行控制。静态和隔离通过后才进入系统验收。证据目录为artifacts/maintenance/v1.0.6/installation-flow-20261015/round-01。

## 接续

本轮累计5失败，按用户确认门禁停测，不自动开启新轮。全部原日志与分组结果见[轮次回执](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-01/progress.json)。失败包括：旧路径门禁遗漏、新夹具大小字段、工具变量名、共享TEMP的NuGet锁权限，以及首次更新唤起用例的子进程诊断解码异常。前四项各自已修复并定向通过；第五项掩盖了子进程实际错误，不能推断管道成功，原始报告已归档，余下11项未执行。验证工具修复后仍需新轮授权，未自动重试。

已通过交付保护、准备／封存隔离、卸载回执／发布门禁、TypeScript及平台增量构建；最后平台构建使用任务独立TEMP/TMP，0警告0错误，仅Native与盒子网页重建，其余平台缓存命中。没有构建新正式候选、启动安装器或创建测试账户。冻结18、当前指针及原证明不变。

实现源已落盘：data布局／可选迁移／完整中文Inno语言；同根冻结迁移；按存档与签名目录计划的资源清理；Updater与同实例更新激活；中文明确状态及诊断。源码静态审查不能替代未做的helper编译、实际安装／迁移／更新／卸载、中文向导和干净标准账户验收，故上表相应项尚不打勾。

获准新轮后的最小顺序：先复验更新唤起首case，保留raw子进程流、真实退出与PE身份；通过后执行剩余组件与受影响工具隔离项；再封装两个1.0.7新布局fixture，覆盖同根迁移／非空目标／资源删留及长根外D更新恢复；最后生成新正式本地修订并做干净账户生命周期。新候选产生后再更新便携迁移工具中的候选SHA及四位构建断言，原便携10来源不换。不重建未变游戏，不覆写旧证明，不发布附件。

旧工具整理未通过的边界仍见[工程整理任务](tooling-delivery-organization-2026-10-15.md)；当前交付事实见[验收](../reference/acceptance.md#当前源码与本地交付)。工作区配置改动保留且不提交。

## 轮次03迁移失败与轮次04定向完成（2026-10-16）

round03第5次失败发生在[便携迁移验证报告](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/portable-migration-19-01/portable-migration/report.json)：真实default迁移及默认卸载已执行，但验证器identity投影未含productId，严格资源回执比较遇undefined使整体failed；[该轮账户清理报告](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/portable-migration-19-01/isolated-account.json)确认账户／profile清理成功。原失败不改写，round03累计5后停止。

只将verifyIdentity投影补齐productId、installationId、ownerSid、buildVersion四字段，产品与候选字节不变；按既有授权自动建立round04，仅重跑受影响的双迁移，没有重建或重跑正式系统链。[双case报告](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-04/portable-migration-19-01/portable-migration/report.json)确认defaultD与externalD各8checks passed，failures／prior／total均为0；[驱动终态](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-04/portable-migration-19-01-completion.json)exit0，[隔离清理](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-04/portable-migration-19-01/isolated-account.json)passed、accountRemoved／profileRemoved均true且errors为空。两个账户报告各自绑定原输入，不跨账户合成证明。

完成清单：

- [x] 新布局／可选迁移／中文向导与真实入口反馈。
- [x] 精确资源删留、旧局与共享依赖／未知资料／原迁移源保全。
- [x] 三条fixture各8步、正式19生命周期和容量门禁、独立封存及账户／profile清理。
- [x] 真实便携10→19默认／外置D迁移与默认卸载，各自真实账户终态。

正式旧方法hash及对应原portable源的恢复副本，已按原执行回执逐项精确SHA核对，见[historical-method-sources/receipt.json](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/historical-method-sources/receipt.json)；未重绑旧proof或把当前修复方法冒充当时方法。当前轮次规则见[验证](../reference/validation.md#历史通过率与失败阈值)，当前交付身份、SHA与容量只见[验收](../reference/acceptance.md#当前源码与本地交付)。任务已从进行中索引移除，现行方法与历史过程分别维护；本次不发布。

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

## 轮次05：安装器命名、预算与新增验收缺口（2026-10-16）

用户要求提高失败阈值、一次完成全部剩余内容，并使安装包名含installer；后续将本地推广范围交由agent选择。本轮选择全部严格验收通过后推广新候选，原10／18／19及其证明保留，不发布Release或部署Pages。默认预算10与修复后自动定向新轮并行生效，所有历史账本保留，不把提高阈值用于放宽断言。预算及命名阶段分别提交56d0e39、e67fed2。

原19的组件和系统证明仍按原范围有效；进一步盘点发现真实Updater到实际Native的冷／热入口以及I等于便携源B、目标为I/data的真实同根迁移尚需直接覆盖，不能以原合成入口或不同根迁移替代。本轮工具将新增检查嵌入普通fixture原8步，长根和恢复链不重复增加入口检查；双迁移保持原两个case与各8项检查。

轮次05失败记录：

1. 保存公开测试向量时误用强制文件克隆标志，Windows返回ENOSYS。原件未改；改成按原字节CreateNew保存后再换入新名签名向量。
2. installer新名的原生清理回归4项失败：实际InstallationCore仍拼旧资产名，真实元组门禁先拒绝，unknown／tamper／in-use边界尚未到达。单行修复规范路径，完整身份／SHA断言保留；4项定向复验全过。20保留为未完成候选，修复后分配21，不复用编号。
3. 新增冷CDP观察器缺少chromium导入，静态ESLint失败；补入既有依赖导入后原检查通过。
4. 第一次21标准账户执行中，真实Updater退出0且Native ready，但观察PS的输出管道由后代持有，execute只等close，超时kill后也未settle。通过本轮cold夹具既有quit.request正常退出，原8步报告记失败1、精确fixture卸载通过；driver退出1，账户／profile均删除，业务失败原错误保留。只修观察器为独立文件输出并按真实PS exit收尾，不改变产品或实际Updater／Native退出门禁。

以上累计7项失败，未清零。原向量、失败入口精确原件及逐轮细节见[轮次05账本](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/progress.json)；失败时入口经唯一差异逆向后核对原SHA702788ab59855ff71c15a8aaa8d1ba94906aa80cb0ff8de6a6421773c2c7c628才CreateNew保存，不用当前修复源重绑旧结果。正式复验终态另记，准备／静态通过不等于产品验收通过。

## 19原字节验收快照

[候选完整EXE](../../artifacts/releases/v1.0.6/1.0.6.19/TableMax-1.0.6.19-win-x64.exe)35,754,061字节，SHA `aca93f5fc8f434ed9d9fb02c6a56bcff75214d09a30fb8e6d1a57a80a9641a69`，绑定[冻结交付](../../artifacts/package-payloads/v1.0.6/73a3e367a1df-oc82Xk/full/installer-delivery.json)。snapshot `73a3e367a1df6efcf1539cc7575c99530b4854b805b4f050f4b9dbc893146dbb`，candidate SHA `ca033d009f85f566d7715e514dd9a34c3c465334308c180615ef21e5a24dd67a`，安装清单SHA `05b98d958e3f2da50d9011ca9ac0cf2aa3ec5db47eab541279b93fc5fc5cf09e`，当前映射SHA `ac917e6a9dd36a7b3dd6f084944b9e2528309eace79a294d11a39539fb844bf9`。该候选使用`I/data/app`新布局和独立Updater入口；公开版本仍为1.0.6。

round-03的[普通I／默认D](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/application-handoff/report.json)、[I198／短外D](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/application-handoff-long-root-external-data/report.json)和[旧框架失败恢复](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/application-framework-recovery/report.json)各8步实际通过、0失败。覆盖新布局双fixture的检查／下载／Apply、原父退出0、新持续主机、下一启动清理，以及健康失败时原A框架／登记／快捷方式保全和默认卸载。管理HTTP与临时签名fixture只证明对应交接；线上GitHub附件下载及原布局18直接升级19均不在此证明范围。

[正式GUID原始证明](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/shipping-executable-checks-full.json)4,272,152字节，SHA `bac36ae72ccd6acc71a9084d91a6e8dcafaa5c5ff88c4e444b56651b1c570bef`，通过真实首装、同包同根重复安装、玩家保存、两次默认卸载及保留数据后的同根重装读回。[driver终态](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02-completion.json)退出0；[账户隔离报告](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/isolated-account.json)SHA `efb622233ad1ac2b6db9b580019116ea96af7635aeff02f21331a5eb6ce1e7b8`确认SID1032、标准账户和真实profile、账户／profile删除且errors为空。

两次卸载分别归档[第一次资源receipt](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/first-uninstall-resources.json)（SHA `e5a4016706d005aa8a81e392b09295c77ee0be28a8bd9bd2e9e6ac21b6899dcb`）与[最终资源receipt](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/final-uninstall-resources.json)（SHA `36e28ac9183114c42718e606228324b1c456e469a152fd23a50e82b3bff24d53`）：两者均为`completed`、deferred为空，各删除192文件／7,381,690字节，保留56文件／3,252,538字节；存档引用发行`d7afeeed323c22c5bb077f8e03eae4720e7571f65441224f06a19f8bef98727f`及其依赖保留，配置、数据库、未知资料和重装读回均通过实际核验。私有分析TEMP审计仍记`retained`，测试profile随后由账户收尾删除。

首次安装健康启动后的同次完整采样113,623,963字节＝程序97,707,858＋框架5,266,061＋身份／receipt／配置15,816＋当前G10,634,228，低于120,000,000硬限并触发110,000,000工程预警。`preStartupSampled:false`；7阶段占用最大176,375,885字节、`isAbsolutePeak:false`，保存、缓存与暂存计量不冒充连续绝对峰值。

[独立封存证明](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/finalized-installation-19.json)1,762,709字节，SHA `34f7583ede9c4404ede1fbb1b16645bf022ad136de4784d695865a7a7f94b0d9`，已通过[封存执行](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/finalize-evidence-19.log)，精确绑定CreateNew保留的[执行proof](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/execution-proof.json)、[执行receipt](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/execution-receipt.json)、原交付与成功隔离结果。封存是只读核验原执行证据，未再次运行产品。

[便携10→19真实迁移](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-04/portable-migration-19-01/portable-migration/report.json)2,058,192字节，SHA `9492fa3786d67fa0a3133e66bec9fe534896f4fc6cc428662bbade2f32c3ae12`：默认D／外置D两case各8项通过，均实际运行19安装器与默认卸载，failures0／priorFailures0／totalFailures0。默认D复制、外置D保指针、原玩家／存档／发行恢复及旧来源、配置、未知资料和受引用游戏依赖保全均按报告核验。[driver终态](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-04/portable-migration-19-01-completion.json)退出0；[迁移隔离报告](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-04/portable-migration-19-01/isolated-account.json)31,940字节，SHA `1cb645d8c24141367eacf44e3508f71b025cbdb40d4ebfcec617f99b17e0c7bd`确认SID1034、账户／profile删除且errors为空。隔离报告记录绑定前迁移SHA `da24b2d05a8737e85747c0d633c500174795ca788edfbeaa12d520f874d5da4d`；最终报告SHA对应追加隔离绑定后的原字节。

round-04仅修复迁移验证器，冻结19产品未变；上述正式系统证明继续绑定其原执行方法与SHA，迁移证明按本次方法单独认定。19未推广current、未发布。此前失败与修复按[专项任务](../archive/windows-installer-flow-2026-10-16.md)和原轮次证据保留，组件通过不增加系统证明的范围。

## 轮次05完整验收与本地推广完成（2026-10-16）

21正式默认／长根／恢复三链各8步、正式GUID12项生命周期，以及便携10→21同根默认／外置D各8项全部通过。两个成功账户各自driver退出0，账户／profile均删除、errors为空；独立封存通过后使用既有严格入口推广本地current。完整身份、原SHA与边界归[当前验收](../reference/acceptance.md#10621installer命名与完整流程收尾2026-10-16)。复用原双版本已签材料时只读复核完整依赖；观察器修复没有重新封包或改写第一次失败。

另有一次锁定Node可执行路径拼写失误的只读命令失败，未触及产品或方法；轮次05最终累计8项，历史不清零。正式账户启动时prior7，迁移启动时prior8，按真实时点保留。原冷入口失败源与观察器探针方法已精确保存，中文向导复用仅指未变配方的原实际窗口，未把它标为21重新操作。

- [x] 默认预算10，PS／Node／C#联动及显式边界通过。
- [x] installer新名、旧冻结路径、签名及完成更新清理门禁通过。
- [x] 新平台候选、真实冷／热入口、三条fixture、正式安装卸载重装与容量通过。
- [x] 两种同根迁移、原件保全、账户清理、独立封存与本地推广通过。
- [x] 当前正文与历史分离、任务归档；最终格式、链接及Git同步由本轮收尾记录绑定。

本任务完成后撤出进行中列表；本轮不发布附件或部署站点，不新增未来待办占位。最终完整记录见[轮次05](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/progress.json)。

## 21验收快照

### 1.0.6.21：installer命名与完整流程收尾（2026-10-16）

[完整安装器](../../artifacts/releases/v1.0.6/1.0.6.21/TableMax-1.0.6.21-installer-win-x64.exe)35,745,780字节，SHA `1313f7af6390382968431211a8e86cef1523c850950acc5fe59ef9b34926e122`，绑定[冻结交付](../../artifacts/package-payloads/v1.0.6/46dc0e034588-4oLB4k/full/installer-delivery.json)。snapshot `46dc0e0345880ae265b3064513144b13c80e79268bf1816aebd39984d036057c`，candidate SHA `c1d52b4b38ffefb28588d1428f718208b67561a7bb39aa1a41cd3ce6e3c9555e`，安装清单SHA `74b435175dc7ec3d8369147b196ecd4227222d094bee1cef45638cb4c827c6a1`。6款正式游戏／7个玩法的31个构建单元复用，映射SHA `ac917e6a9dd36a7b3dd6f084944b9e2528309eace79a294d11a39539fb844bf9`未变，公开版本仍为1.0.6。

[默认D](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/production-account-21-02/application-handoff/report.json)、[I198／外置D](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/production-account-21-02/application-handoff-long-root-external-data/report.json)、[健康失败恢复](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/production-account-21-02/application-framework-recovery/report.json)三条新布局1.0.7.60000→60001实际链各8步通过、0失败。覆盖下载／验签／Apply、父退出、新持续主机、下一启动清理及原框架保全。默认链另直接运行真实无参Updater冷启动和两次热唤起，核实际PE／SID、原Native／服务PID、面板请求递增、实际中文窗口及无下载／Apply副作用。冷入口实际返回中文连接／发布信息错误，未冒称线上最新；热入口使用签名托管夹具显示可更新。冷Native另有持句柄正常退出0证据；不以Updater退出推定间接Native退出，不外推为游戏中人工操作或线上正向更新下载验收。

[正式原始证明](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/production-account-21-02/shipping-executable-checks-full.json)4,135,082字节，SHA `389345943305586af0cd820c25f3ce7ceaf096089d2895b607eb96ae0aa34a81`，12项核验覆盖首装、同包同根复装、保存、两次默认卸载、同根重装读回及精确快捷方式／登记／受管文件。[正式账户终态](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/production-account-21-02/isolated-account.json)passed、账户和profile删除、errors为空，[driver退出0](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/production-account-21-02-completion.json)。[独立封存证明](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/finalized-installation-21.json)1,720,121字节，SHA `774a8be2c8ef29f70f8ff016acc4c28bd134084f3924938c576e34437ddb5ce3`，绑定原执行receipt、同一账户清理、完整方法及保留runtime，没有重跑业务。

[第一次资源回执](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/production-account-21-02/first-uninstall-resources.json)和[最终资源回执](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/production-account-21-02/final-uninstall-resources.json)均completed、deferred为空，各删除192文件／7,381,690字节，因存档发行及依赖保留56文件／3,252,538字节。配置、数据库、未知资料和旧局依赖保留并经重装恢复。只读分析TEMP回执仍按原记录retained，测试profile随后由账户收尾删除，不改写为单项TEMP清理通过。

[便携10→21同根迁移](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/portable-migration-21-01/portable-migration/report.json)2,057,581字节，SHA `c471f6d8b314f7cba8cf6cce55b873f89e59278e588b6a8466cd4ff2f2f4f66c`；默认／外置D两case各8项通过、0失败，prior／total均8。实际I等于原便携B，新B为I/data；目标创建前冻结源清单，核全部原成员SHA、玩家／存档／发行恢复、卸载删留及原件保全。[迁移隔离终态](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/portable-migration-21-01/isolated-account.json)账户／profile删除且errors为空，[driver退出0](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/portable-migration-21-01-completion.json)。两个账户各自绑定自己的输入、执行与清理，不拼接证明。

首次完成安装并健康启动后的同次程序采样113,624,443字节＝程序97,708,338＋框架5,266,061＋身份／配置15,816＋当前G10,634,228，严格低于120,000,000硬限，触发110,000,000工程预警。preStartupSampled为false；阶段占用最大180,062,993字节包含数据／缓存／暂存，isAbsolutePeak为false。封包的EXE／ZIP／实际提取检查见[封包日志](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/package-candidate-21.log)。

中文向导的源发现、返回编辑、默认／自选路径、跳页及取消确认复用原双场景实际窗口证明；[复用校核](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/reused-wizard-evidence.json)逐字节核对未变Inno配方与简体中文语言，不声称21逐页重新操作。签名命名的JS及Native定向回归、观察器实进程复验、全部旧失败见[专项归档](../archive/windows-installer-flow-2026-10-16.md#轮次05安装器命名预算与新增验收缺口2026-10-16)。

[推广回执](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/promotion21-receipt.json)确认既有严格门禁原子切换current；[推广后保护复核](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-05/protection-after-promotion.json)核15项基线，只有授权的修订／活动指针变化，18原指针另保留精确原始字节，10／18／19及原证明、用户工作区配置均保全。项目RSA与Windows Authenticode分开；本轮未发布附件、source ZIP或Pages，浏览器下载标记／SmartScreen信誉／真实断电／实体手机LAN不在本次验收范围。

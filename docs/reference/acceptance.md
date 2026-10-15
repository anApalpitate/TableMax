# 当前交付与验收

本页维护当前本地完整EXE、仍有效的证明及历史导航；旧候选只按原字节、方法和范围认定。

当前结论统一见[当前源码与本地交付](#当前源码与本地交付)，本页各版本章节只说明对应原字节与证明范围。

## 1.0.6.19：新布局正式验收（2026-10-16）

[候选完整EXE](../../artifacts/releases/v1.0.6/1.0.6.19/TableMax-1.0.6.19-win-x64.exe)35,754,061字节，SHA `aca93f5fc8f434ed9d9fb02c6a56bcff75214d09a30fb8e6d1a57a80a9641a69`，绑定[冻结交付](../../artifacts/package-payloads/v1.0.6/73a3e367a1df-oc82Xk/full/installer-delivery.json)。snapshot `73a3e367a1df6efcf1539cc7575c99530b4854b805b4f050f4b9dbc893146dbb`，candidate SHA `ca033d009f85f566d7715e514dd9a34c3c465334308c180615ef21e5a24dd67a`，安装清单SHA `05b98d958e3f2da50d9011ca9ac0cf2aa3ec5db47eab541279b93fc5fc5cf09e`，当前映射SHA `ac917e6a9dd36a7b3dd6f084944b9e2528309eace79a294d11a39539fb844bf9`。该候选使用`I/data/app`新布局和独立Updater入口；公开版本仍为1.0.6。

round-03的[普通I／默认D](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/application-handoff/report.json)、[I198／短外D](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/application-handoff-long-root-external-data/report.json)和[旧框架失败恢复](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/application-framework-recovery/report.json)各8步实际通过、0失败。覆盖新布局双fixture的检查／下载／Apply、原父退出0、新持续主机、下一启动清理，以及健康失败时原A框架／登记／快捷方式保全和默认卸载。管理HTTP与临时签名fixture只证明对应交接；线上GitHub附件下载及原布局18直接升级19均不在此证明范围。

[正式GUID原始证明](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/shipping-executable-checks-full.json)4,272,152字节，SHA `bac36ae72ccd6acc71a9084d91a6e8dcafaa5c5ff88c4e444b56651b1c570bef`，通过真实首装、同包同根重复安装、玩家保存、两次默认卸载及保留数据后的同根重装读回。[driver终态](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02-completion.json)退出0；[账户隔离报告](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/isolated-account.json)SHA `efb622233ad1ac2b6db9b580019116ea96af7635aeff02f21331a5eb6ce1e7b8`确认SID1032、标准账户和真实profile、账户／profile删除且errors为空。

两次卸载分别归档[第一次资源receipt](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/first-uninstall-resources.json)（SHA `e5a4016706d005aa8a81e392b09295c77ee0be28a8bd9bd2e9e6ac21b6899dcb`）与[最终资源receipt](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/final-uninstall-resources.json)（SHA `36e28ac9183114c42718e606228324b1c456e469a152fd23a50e82b3bff24d53`）：两者均为`completed`、deferred为空，各删除192文件／7,381,690字节，保留56文件／3,252,538字节；存档引用发行`d7afeeed323c22c5bb077f8e03eae4720e7571f65441224f06a19f8bef98727f`及其依赖保留，配置、数据库、未知资料和重装读回均通过实际核验。私有分析TEMP审计仍记`retained`，测试profile随后由账户收尾删除。

首次安装健康启动后的同次完整采样113,623,963字节＝程序97,707,858＋框架5,266,061＋身份／receipt／配置15,816＋当前G10,634,228，低于120,000,000硬限并触发110,000,000工程预警。`preStartupSampled:false`；7阶段占用最大176,375,885字节、`isAbsolutePeak:false`，保存、缓存与暂存计量不冒充连续绝对峰值。

[独立封存证明](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/finalized-installation-19.json)1,762,709字节，SHA `34f7583ede9c4404ede1fbb1b16645bf022ad136de4784d695865a7a7f94b0d9`，已通过[封存执行](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/finalize-evidence-19.log)，精确绑定CreateNew保留的[执行proof](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/execution-proof.json)、[执行receipt](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-03/production-account-19-02/execution-receipt.json)、原交付与成功隔离结果。封存是只读核验原执行证据，未再次运行产品。

[便携10→19真实迁移](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-04/portable-migration-19-01/portable-migration/report.json)2,058,192字节，SHA `9492fa3786d67fa0a3133e66bec9fe534896f4fc6cc428662bbade2f32c3ae12`：默认D／外置D两case各8项通过，均实际运行19安装器与默认卸载，failures0／priorFailures0／totalFailures0。默认D复制、外置D保指针、原玩家／存档／发行恢复及旧来源、配置、未知资料和受引用游戏依赖保全均按报告核验。[driver终态](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-04/portable-migration-19-01-completion.json)退出0；[迁移隔离报告](../../artifacts/maintenance/v1.0.6/installation-flow-20261015/round-04/portable-migration-19-01/isolated-account.json)31,940字节，SHA `1cb645d8c24141367eacf44e3508f71b025cbdb40d4ebfcec617f99b17e0c7bd`确认SID1034、账户／profile删除且errors为空。隔离报告记录绑定前迁移SHA `da24b2d05a8737e85747c0d633c500174795ca788edfbeaa12d520f874d5da4d`；最终报告SHA对应追加隔离绑定后的原字节。

round-04仅修复迁移验证器，冻结19产品未变；上述正式系统证明继续绑定其原执行方法与SHA，迁移证明按本次方法单独认定。19未推广current、未发布。此前失败与修复按[专项任务](../archive/windows-installer-flow-2026-10-16.md)和原轮次证据保留，组件通过不增加系统证明的范围。

## 1.0.6.18：正式系统验收（2026-10-15）

[当前指针](../../artifacts/package-payloads/v1.0.6/current.json)绑定[完整EXE](../../artifacts/releases/TableMax-1.0.6.18-win-x64.exe)和[冻结交付](../../artifacts/package-payloads/v1.0.6/170327301894-Iw3W34/full/installer-delivery.json)：EXE35,711,499字节，SHA `323eb595b2160fdf6c75bf65d8a8c22bc5fb9bf6cc85aa2ce179eb26f1c16a19`；snapshot `1703273018946f4de0c96b98cdc207f86bc4316848889b09a529f0a4e36aa4e9`，candidate SHA `543abe981640d1f99f243bfccbe9aba1c517a835e67e3c13a6efbd6f42fa8ab2`。原31游戏单元使用冻结缓存，未重建游戏。

[闭包9项](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/production-seal-18/results.json)及[实际生产根校核](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/production-signature-18/report.json)通过，Native／helper各22项、launcher12项。[普通I／默认D](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/production-account-18-01/application-handoff/report.json)、[I198／短外D](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/production-account-18-01/application-handoff-long-root-external-data/report.json)和[旧框架失败恢复](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/production-account-18-01/application-framework-recovery/report.json)各8步实际通过、0失败，覆盖不同PE Apply、原父退出0、新持续主机、真实下一启动清理、7／40准备拒绝、原A框架／登记／快捷方式保全及live helper缺失后的实际默认卸载。双fixture与管理HTTP只证明对应系统交接，不冒称线上新资产下载。

[正式GUID规范证明](../../artifacts/maintenance/v1.0.6/windows-editions/1703273018946f4de0c96b98cdc207f86bc4316848889b09a529f0a4e36aa4e9/shipping-executable-checks-full.json)3,191,663字节，SHA `da1f2bcba013f25aa3668220464fc37364c7c128b62af72d427fe2d84a8af4ad`：真实首装、同包同根重复安装、玩家保存、两次默认卸载及卸载后重装读回原玩家／存档／发行均通过，三条桌面／开始菜单链接移除。原unins.exe消失与日志关闭经过有界观察（795／764毫秒），不重跑产品卸载。[正式账户收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/production-account-18-01/isolated-account.json)SHA `1033b2ec5b4645902e242bef51bb46acd9dd0b495f213898dfcf4bf0e6c35626`确认SID1029、driver退出0、账户／profile删除、errors为空。

首次安装完成后的同次完整采样113,288,936字节＝程序97,491,591＋框架5,147,027＋身份／receipt／配置16,090＋当前G10,634,228；低于120,000,000硬限、触发110,000,000工程预警。内部ZIP44,009,587字节，实际提取97,098,555字节。Inno返回前已启动健康确认，`preStartupSampled:false`，不是独立启动前后两样本。7阶段占用最大175,493,508字节，包含数据／缓存／暂存且`isAbsolutePeak:false`，不与程序硬限混算。[共用门禁及保留runtime重算](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/formal18-crosscheck.json)通过。

[便携10→安装18迁移](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/portable-migration-18-02/portable-migration/report.json)971,193字节，SHA `33e8d3daa67f2de0380519d4e1e6953297e3602bdfc28f6c7b610135ebf0099a`；默认D与外置D两case均各8项通过，failures0／priorFailures2／totalFailures2。旧10实际生成并保存玩家；默认D复制、外置D保指针，两项均实际运行18 Inno及默认卸载，旧来源、原存档、G、配置和未知资料按证明保全。[迁移收尾](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/portable-migration-18-02/isolated-account.json)1,748字节，SHA `05dfa928364734e774aff198ffefbf292392429348f9c9a5b356b3c1858122ac`确认SID1031账户／profile删除、errors为空；[driver终态](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/portable-migration-18-02-completion.json)退出0。隔离报告另保存绑定前SHA `04a60c0bb8ae340b28f72fc3715dafad7cce745901d547588b3900eb2c94170a`；上面的最终报告SHA对应追加隔离绑定后的原字节，未捏造独立的绑定前原始文件。

[最终证据汇总](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/final18-evidence.json)96,575字节，SHA `a25e9aff672de1a1b8cf2bff5bb9d276a404e8b5caca93acd0a27d8d725406a8`，绑定76文件；该汇总形成于推广前，原`promoted:false`保留。[随后推广回执](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-11/promotion18-receipt.json)SHA `12598b0b894b25f766c1e1c190f353aca14593d356c6f41411c8918c19969cf9`确认current原子切换18，current SHA `3101f207916e60c21b1232c08ce99811820140a98c1a38a9fcd9ffb5f2eea4b9`。11累计2项历史方法失败未清零；16桌面卸载记录缺陷、17构建失败无候选及03–10各轮原SHA均见归档。

仅本地交付完成，未创建新线上Release、发布source ZIP或部署Pages。项目RSA签名与Windows代码签名分开；NotSigned／无ZoneIdentifier不证明浏览器下载、SmartScreen信誉或系统信任。密钥轮换、异地备份及未来发布不写成已执行。

## 工具接口重组边界

版本／构建分组已用于19候选的实际产物路径；执行proof／receipt保留及独立封存已由[19正式隔离证明](#10619新布局正式验收2026-10-16)验证。路径／链接检查与初轮失败分别保留于整理归档，不把单项证明外推到未覆盖条件。18原证明与current保持原字节及原范围，不能替代新方法的证据。接口和其余接续见[验证要求](validation.md#正式执行记录与证明封存)和[整理任务](../archive/tooling-delivery-organization-2026-10-15.md)。

## 续行09–11：候选16重装缺陷与候选18冻结（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行0911候选16重装缺陷与候选18冻结2026-10-15)；仅按当时版本与范围认定，不覆盖当前18证明。

## 续行08：旧框架保全时序修复（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行08旧框架保全时序修复2026-10-15)；仅按当时版本与范围认定，不覆盖当前18证明。

## 1.0.6.15：候选冻结与续行07（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#10615候选冻结与续行072026-10-15)；仅按当时版本与范围认定，不覆盖当前18证明。

## 续行06：数据路径分类与共用门禁（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行06数据路径分类与共用门禁2026-10-15)；仅按当时版本与范围认定，不覆盖当前18证明。

## 续行05：活跃卸载通过与长路径启动诊断（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行05活跃卸载通过与长路径启动诊断2026-10-15)；仅按当时版本与范围认定，不覆盖当前18证明。

## 续行04：组件复验与活动卸载失败（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行04组件复验与活动卸载失败2026-10-15)；仅按当时版本与范围认定，不覆盖当前18证明。

## 续行03：真实首装与剩余故障（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行03真实首装与剩余故障2026-10-15)；仅按当时版本与范围认定，不覆盖当前18证明。

## 1.0.6.14：安装候选与标准账户诊断（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#10614安装候选与标准账户诊断2026-10-15)；仅按当时版本与范围认定，不覆盖当前18证明。

## 协调器修复与三失败停止（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#协调器修复与三失败停止2026-10-15)；仅按当时版本与范围认定，不覆盖当前18证明。

## 1.0.6.13：安装候选与专项证据（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#10613安装候选与专项证据2026-10-15)；仅按当时版本与范围认定，不覆盖当前18证明。

## 1.0.6.10：宝可梦新设计应用（2026-10-12）

该旧便携EXE、源码与同包专项、原失败和未测边界见[整理归档](../archive/tooling-delivery-organization-2026-10-15.md#10610宝可梦新设计应用2026-10-12)。不将旧包通过改写为当前包新增验证；当前待测游戏事项从[扩展任务](../tasks/pokemon-encounters-expansion.md)接续。

## 当前源码与本地交付

新data布局与安装流程的[19候选正式隔离验收及便携10→19两种迁移](#10619新布局正式验收2026-10-16)均已通过。19尚未推广；18证明对应原布局，只按原字节与范围保留。剩余接续见[专项任务](../archive/windows-installer-flow-2026-10-16.md)。

当前本地交付为[完整安装器1.0.6.18](#10618正式系统验收2026-10-15)，公开版本1.0.6，已原子推广current。完整安装／更新恢复、正式保存卸载重装及便携两种布局迁移的实际证明见该版本章节；预装6款正式游戏／7个玩法，新局固定本EXE核验映射，旧局按原精确发行继续。旧便携及其他历史构建只按各自SHA、方法和原结果认定。

EXE、内部载荷、原图、签名仓库和本地验收不随源码push上传。线上已发布附件仍保持2026-10-11原字节，本地1.0.6.18未发布。提交／推送不授权Release或Pages部署，不生成发布source ZIP。

工作区占用、原包保留及逐文件退役以[项目瘦身](project-slimming.md)的对应批次记录为准，不改变历史包的原SHA和验证结论。

历史运行ZIP的唯一迁移输入及原SHA见[整理归档](../archive/tooling-delivery-organization-2026-10-15.md#旧运行zip的迁移输入)；下方旧标题仅保留历史导航，不提供当前下载或重复验证指令。

## 1.0.6.3：关闭与WebView2资源释放（2026-10-12）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#1063关闭与webview2资源释放2026-10-12)。

## 1.0.6：唯一完整 EXE（2026-10-12）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106唯一完整-exe2026-10-12)。

## 1.0.6：版本适应性与本地四位版本（2026-10-12）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106版本适应性与本地四位版本2026-10-12)。

## 1.0.6：游戏包失败原因细化（2026-10-12，源码）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106游戏包失败原因细化2026-10-12源码)。

## 1.0.6：下载文字与EXE命名微调（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106下载文字与exe命名微调2026-10-11)。

## 1.0.6：阿瓦隆唯一配置与并发密投（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106阿瓦隆唯一配置与并发密投2026-10-11)。

## 1.0.6：安装索引并发与临时journal恢复修复（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106安装索引并发与临时journal恢复修复2026-10-11)。

## 1.0.6：测试选择与证据复用（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106测试选择与证据复用2026-10-11)。

## 1.0.6：安装故障矩阵与验收范围调整（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106安装故障矩阵与验收范围调整2026-10-11)。

## 1.0.6：轻量目录与统一玩法控件（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106轻量目录与统一玩法控件2026-10-11)。

## 1.0.6：空盒子大厅与两种Windows EXE（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106空盒子大厅与两种windows-exe2026-10-11)。

## 1.0.6：Pages部署与同版本重新发布（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106pages部署与同版本重新发布2026-10-11)。

## 1.0.6：Pages准备、盒子界面与人机发言（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106pages准备盒子界面与人机发言2026-10-11)。

## 1.0.6：独立游戏包与公共作者契约（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106独立游戏包与公共作者契约2026-10-11)。

## 1.0.6：手写改动单第1项（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106手写改动单第1项2026-10-11)。

## 1.0.6：UNO右侧白边与手牌宽度（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106uno右侧白边与手牌宽度2026-10-11)。

## 1.0.6：拉密交互完善与恢复开放（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106拉密交互完善与恢复开放2026-10-11)。

## 1.0.6：手写bug第5–7条修复（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106手写bug第57条修复2026-10-11)。

## 1.0.6：手写bug前四条修复（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106手写bug前四条修复2026-10-11)。

## 1.0.6：盒子12席显示兼容（2026-10-10，源码专项）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106盒子12席显示兼容2026-10-10源码专项)。

## 1.0.6：经典阿瓦隆（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106经典阿瓦隆2026-10-10)。

## 1.0.6：更新构建（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106更新构建2026-10-10)。

## 1.0.6：UNO 交互优化（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106uno-交互优化2026-10-10)。

## 1.0.5：经典 UNO 完整本地交付（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105经典-uno-完整本地交付2026-10-10)。

## 1.0.5：发言面板优化（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105发言面板优化2026-10-09)。

## 1.0.5：盒子初始选择与网址入口（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105盒子初始选择与网址入口2026-10-09)。

## 1.0.5：玩家互动音效触摸解锁（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105玩家互动音效触摸解锁2026-10-09)。

## 1.0.5：拉密经典版本地完整交付（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105拉密经典版本地完整交付2026-10-09)。

## 1.0.5：GitHub发布核验（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105github发布核验2026-10-09)。

## 1.0.5：菜单、互动并发与手机同步（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105菜单互动并发与手机同步2026-10-09)。

## 1.0.5：互动精修与即时覆盖（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105互动精修与即时覆盖2026-10-09)。

## 1.0.5：盒子调整与跨游戏互动（2026-10-08）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105盒子调整与跨游戏互动2026-10-08)。

## 1.0.4：网络连接与多设备页面适配（2026-10-08）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#104网络连接与多设备页面适配2026-10-08)。

## 1.0.4：玩家比例与游戏工作区修订（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104玩家比例与游戏工作区修订2026-10-08)。

## 1.0.4：滚动条与电脑玩家横屏（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104滚动条与电脑玩家横屏2026-10-08)。

## 1.0.4：根入口、研究风险与公开缓冲重设计（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104根入口研究风险与公开缓冲重设计2026-10-08)。

## 1.0.4：电脑玩家手机视窗、盒子排版与远程续验（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104电脑玩家手机视窗盒子排版与远程续验2026-10-08)。

## 1.0.3：10.7 浏览器玩家、实时恢复与换机（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103107-浏览器玩家实时恢复与换机2026-10-08)。

## 1.0.3：全量构建与GitHub发布交付（2026-10-07）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103全量构建与github发布交付2026-10-07)。

## 1.0.3：扩展需求复查与演出时序（2026-10-07）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103扩展需求复查与演出时序2026-10-07)。

## 1.0.3：扩展版能力消耗、原版演出与全量构建（2026-10-07）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103扩展版能力消耗原版演出与全量构建2026-10-07)。

## 1.0.3：电力公司数量采购、进度与稳定反馈（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司数量采购进度与稳定反馈2026-10-06)。

## 1.0.3：宝可梦扩展深度界面与整合交付（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦扩展深度界面与整合交付2026-10-06)。

## 1.0.3：电力公司地图材质、动画与综合资料细化（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司地图材质动画与综合资料细化2026-10-06)。

## 1.0.3：电力公司地图与带图公司卡优化（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司地图与带图公司卡优化2026-10-06)。

## 1.0.3：宝可梦扩展版UI重设计（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦扩展版ui重设计2026-10-06)。

## 1.0.3：游戏介绍弹窗布局修复（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103游戏介绍弹窗布局修复2026-10-06)。

## 1.0.3：单EXE专属目录初始化微调（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103单exe专属目录初始化微调2026-10-06)。

## 1.0.3：便携存储配置与大存档启动修复（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103便携存储配置与大存档启动修复2026-10-06)。

## 1.0.2：测试静音与资源瘦身（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102测试静音与资源瘦身2026-10-06)。

## 1.0.2：扩展版一次性技术收尾（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102扩展版一次性技术收尾2026-10-06)。

## 1.0.2：普通前瞻三胜目标同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102普通前瞻三胜目标同包续验2026-10-06)。

## 1.0.2：三胜目标修复同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102三胜目标修复同包续验2026-10-06)。

## 1.0.2：累积能力模型同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102累积能力模型同包续验2026-10-06)。

## 1.0.2：火箭队能力估值与角色无损格式续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102火箭队能力估值与角色无损格式续验2026-10-06)。

## 1.0.2：普通收局前瞻与无损卡面续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102普通收局前瞻与无损卡面续验2026-10-06)。

## 1.0.2：扩展版三胜策略与叫声同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102扩展版三胜策略与叫声同包续验2026-10-06)。

## 1.0.2：电力公司地图背景与阶段抽屉（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102电力公司地图背景与阶段抽屉2026-10-06)。

## 1.0.2：前瞻均值修复与普通模式同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102前瞻均值修复与普通模式同包续验2026-10-06)。

## 1.0.2：扩展版续建、预算与同包复核（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102扩展版续建预算与同包复核2026-10-06)。

## 1.0.2：本地宝可梦扩展版技术可玩包（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102本地宝可梦扩展版技术可玩包2026-10-05)。

## 1.0.2：完整EXE发布与维护规则更新（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102完整exe发布与维护规则更新2026-10-05)。

## 1.0.4：独立增量构建与分块组装（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104独立增量构建与分块组装2026-10-05)。

## 1.0.4：新手引导开关与同版本更新（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104新手引导开关与同版本更新2026-10-05)。

## 1.0.4：合并打包与实际便携检查（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104合并打包与实际便携检查2026-10-05)。

## 1.0.3：任务完成后合并重打包与复核（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103任务完成后合并重打包与复核2026-10-05)。

## 1.0.3：电力公司人机、分页与声画 debug（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司人机分页与声画-debug2026-10-05)。

## 1.0.3：宝可梦操作引导、同值归零与动漫切入（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦操作引导同值归零与动漫切入2026-10-05)。

## 1.0.3：宝可梦原创图文规则页（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦原创图文规则页2026-10-05)。

## 1.0.3：宝可梦人机、能力演出与版本复用（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦人机能力演出与版本复用2026-10-05)。

## 1.0.3：电力公司真实 UI 试玩与第二轮优化（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司真实-ui-试玩与第二轮优化2026-10-05)。

## 1.0.2：合并深度检查与项目瘦身（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102合并深度检查与项目瘦身2026-10-05)。

## 1.0.2：电力公司界面与原创规则图解（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102电力公司界面与原创规则图解2026-10-05)。

## 1.0.2：宝可梦声画与手机优化（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102宝可梦声画与手机优化2026-10-05)。

## 1.0.2：现代艺术优化（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102现代艺术优化2026-10-05)。

## 1.0.2：盒子 debug（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102盒子-debug2026-10-04)。

## 1.0.2：本地重新导出与 releases 清理（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102本地重新导出与-releases-清理2026-10-04)。

## 历史截图去重（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#历史截图去重2026-10-04)。

## 本地项目整理与瘦身（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#本地项目整理与瘦身2026-10-04)。

## 历史验收导航

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#历史验收导航)。

## 1.0.2：电力公司 debug，横向地图、价区与声画（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#102电力公司-debug横向地图价区与声画2026-10-04)。

## 1.0.2：通用视觉、规则说明与项目瘦身（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102通用视觉规则说明与项目瘦身2026-10-04)。

## 1.0.2：现代艺术 debug 修复（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#102现代艺术-debug-修复2026-10-04)。

## 1.0.2：版本导出与历史清理（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#102版本导出与历史清理2026-10-04)。

## 1.0.1：电力公司经典德国版（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101电力公司经典德国版2026-10-04)。

## 1.0.1：现代艺术真实对局排查（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101现代艺术真实对局排查2026-10-04)。

## 1.0.1：现代艺术视听与共用倒计时（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101现代艺术视听与共用倒计时2026-10-04)。

## 1.0.1：盒子头像与游戏介绍（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101盒子头像与游戏介绍2026-10-04)。

## 1.0.1：宝可梦画面与动效返修（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101宝可梦画面与动效返修2026-10-04)。

## 1.0.1：应用图标更新（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101应用图标更新2026-10-03)。

## 1.0.1：GitHub Release（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101github-release2026-10-03)。

## 执行与证据

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#执行与证据)。

## AC 对照

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#ac-对照)。

## 首版维护：独立牌桌与操作简化

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护独立牌桌与操作简化)。

## 使用与维护

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#使用与维护)。

## 首版维护：视觉纠错与场景打磨

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护视觉纠错与场景打磨)。

## 首版维护：角色卡面与管理员体验

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护角色卡面与管理员体验)。

## 首版维护：聚会可靠性与连续游玩

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护聚会可靠性与连续游玩)。

## 首版维护：手机围桌与三档人机

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护手机围桌与三档人机)。

## 首版维护：游玩节奏与六人提示

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护游玩节奏与六人提示)。

## 首版维护：电脑多分辨率显示

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护电脑多分辨率显示)。

## 1.6.0：盒子、对局体验与可靠性

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#160盒子对局体验与可靠性)。

## v1.0.0：版本归一与开发效率优化

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#v100版本归一与开发效率优化)。

## 1.0.0：同版本视觉优化（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100同版本视觉优化2026-10-03)。

## 1.0.0：独立视觉审查与返修（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100独立视觉审查与返修2026-10-03)。

## 1.0.0：便携包语言精简（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100便携包语言精简2026-10-03)。

## 1.0.0：原生桌面与小体积交付（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100原生桌面与小体积交付2026-10-03)。

## 1.0.0：现代艺术独立接入（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100现代艺术独立接入2026-10-03)。

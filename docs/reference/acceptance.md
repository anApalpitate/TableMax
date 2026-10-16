# 当前交付与验收

本页维护当前本地完整EXE、仍有效的证明及历史导航；旧候选只按原字节、方法和范围认定。

当前结论统一见[当前源码与本地交付](#当前源码与本地交付)，本页各版本章节只说明对应原字节与证明范围。

## 马尼拉本地候选（2026-10-16）

本轮体验优化及安装验收已完成，当前本地交付为[完整安装器1.0.7.9](../../artifacts/releases/v1.0.7/1.0.7.9/TableMax-1.0.7.9-installer-win-x64.exe)：七款游戏、八个玩法；EXE36,616,557字节，SHA `7b1c6e470552f0b5a16ce591f017ba69b492bac76855a2a96b93a522eb16d8b1`；内部ZIP44,861,683字节、提取97,752,749字节，运行前后98成员逐SHA一致。[封包记录](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/package-09.json)绑定实际交付。

已修复公开最高竞价／领先者缺失、非付款玩家错误融资提示、同分名次差异，并补领航草稿结果／清空。最新3项UI回归通过；候选8通过三端26布局、保存动态及6航次136动作；候选9专门复验融资首屏可见完整抵押按钮，6布局及5航次137动作通过。未受影响的规则／策略／服务／Worker原检查按[执行字节等价](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/runtime-equivalence-07-09.json)复用，不增加统计。

用户明确授权后，在同一新标准账户／真实Medium profile完成[中文向导浏览与取消](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/installer-wizard/report.json)、[默认D](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/application-handoff/report.json)、[I198／短外置D](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/application-handoff-long-root-external-data/report.json)及[旧框架失败恢复](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/application-framework-recovery/report.json)三条完整8步链，均0失败。更新链使用独立夹具GUID；[正式产品原始证明](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/shipping-executable-checks-full.json)则执行精确1.0.7.9正式GUID安装包，12项通过，含首装、同包复装、登记／快捷方式、保存、两次默认卸载、同根重装读回原玩家及发行、精确受管成员与数据保全。

两次游戏资源清理回执均为completed，各删除201文件、保留56文件、deferred为空；实际保存依赖、数据库、配置和未知文件保全。该数据来自正式安装后的实际回执，不以向导取消或fixture链替代。

[账户终态](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/isolated-account.json)及[外层回执](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02-completion.json)确认退出0、账户及profile均删除、errors为空。[独立封存证明](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/finalized-installation-09.json)1,801,414字节，SHA `4a05baa446a0e900870723f51959505e7ac23c77393a48fe8f30467836825759`，只读重核同次receipt、完整方法、三链、清理与99文件保留runtime。[本地current回执](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/promotion-receipt-09.json)通过严格门禁后将本地交付切换为1.0.7.9；公开1.0.7及原附件保持不变，未发布、部署或生成发布source ZIP。

首次安装完成并健康启动的同次程序采样114,824,311字节＝程序98,361,129＋框架5,273,757＋身份／配置16,371＋当前G11,173,054，低于120,000,000硬限，触发110,000,000工程预警。preStartupSampled为false；阶段观测最大178,430,359字节包含数据／缓存／暂存，isAbsolutePeak为false。向导与系统链通过不代表浏览器SmartScreen、真实断电、实体手机LAN或物理DPI通过。原失败、工具修复及单次维护见[归档](../archive/manila-2026-10-16.md#安装验收与体验优化接续2026-10-16)；剩余设备范围见[接续任务](../tasks/manila-development.md)。

### 原交付EXE安全标记与直接启动补证（2026-10-16）

用户追加原EXE门禁后，[实际初查](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-security-before.json)发现1.0.7.9原文件继承Low完整性标签；此前系统验收使用同SHA的新profile副本，只证明对应范围，未证明原路径启动。对可信最终产物执行单文件Low→Medium修正，[修正回执](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-security-normalization.json)核字节、SHA、owner、DACL及全部数据流不变；EXE仍为36,616,557字节和本节原SHA，不重封、不新增修订。原文件无ADS／Zone.Identifier，Authenticode为NotSigned，项目RSA应用签名与其分别认定。

[原路径实际报告](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-account-09-02/original-executable/report.json)从原交付路径直接启动原EXE，实际bootstrap及向导子进程均为同一新标准SID、Medium且未提权；中文向导、实际默认路径、返回及取消通过，原进程正常取消码2，自有Job自然归零，登记／目标目录未创建，原EXE元数据和源目录内容保持不变。实际截图已人工核对。[账户终态](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-account-09-02/isolated-account.json)及[外层回执](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-account-09-02-completion.json)确认退出0、账户／profile删除、errors为空。

[原始补证](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-account-09-02/original-executable-evidence.json)31,841字节，SHA `9b8d70fd6fa7059c1ea0277eecbad2a5c304995145e345dfbe6b68e1684ea6d8`，已由[原子附加回执](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/attach-current-09-02.json)关联到本地current。[最终门禁重核](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/gate-revalidation-04.json)读取实际原始截图、进程／清理证明及当前安全元数据后通过。后续缺该补证或安全标记／原路径身份不符时，本地current切换与发布预检拒绝。原24步更新／恢复及12项正式系统证明保持原字节，不重复计数；本轮没有发布或追加工程清理。

首轮补测因工具过滤掉profile守卫变量，在原EXE启动前失败，纠正后实际原路径通过；只读附加阶段另遇Low Node无法向系统TEMP写编译临时文件，改用自有profile／工程tmp目录后只读复验通过，未重跑账户或产品操作。对应失败、独立预算和实质原因保留于该证据根。相关32项工具用例通过；最新受影响24项复验通过，另外8项未变用例按先前通过复用，不重复计数。此补证使用CreateProcess直接启动，不冒称浏览器下载、Explorer双击安全提示或SmartScreen信誉验证。

### 首轮开发候选1.0.7.7

[完整安装候选1.0.7.7](../../artifacts/releases/v1.0.7/1.0.7.7/TableMax-1.0.7.7-installer-win-x64.exe)包含七款游戏、八个玩法，新增2005经典《马尼拉》3–5人、三档本地策略和写实动态沙盘。EXE为36,616,229字节，SHA `f986705422062dcfae0cda86ebaff1842eab31aee8e84f5a12bca4c0010931ec`；内部ZIP44,861,285字节、实际提取97,752,337字节，运行前后98成员逐SHA一致。[封包记录](../../artifacts/manila/validation/package-candidate07.json)绑定候选及安装清单。

本游戏37项规则／策略、2项真实Socket／SQLite、4项实际Worker检查通过；最终三端20项布局与保存动态、手机6项定向布局／真实操作、5人自然整局均有对应证据。主机／公共实际CSS视口达3840×2160，缩放读回平台125%／150%独立偏好并断言对应视口。后续候选的权威执行字节相同，复用范围、失败返修及实际版次见[马尼拉验证](../games/manila/validation-scenarios.md)。

此候选未执行干净Windows账户的系统首装／升级／卸载认证，未做实体手机、真实LAN或物理DPI验收。正式current与公开1.0.7仍保持1.0.7.2原字节；没有发布Release、source ZIP或部署Pages。已完成开发过程见[归档](../archive/manila-2026-10-16.md)，后续设备／推广工作见[任务](../tasks/manila-development.md)。

## 1.0.7.2：安装进度与版本交付（2026-10-16）

[完整安装器](../../artifacts/releases/v1.0.7/1.0.7.2/TableMax-1.0.7.2-installer-win-x64.exe)35,750,777字节，SHA `1eabdd13bdbea2712c731d6a77b00e1bdd2756331318194e685fc71a6cf3aa83`；snapshot `91e13f6af698a964df479b8233ecf5e2f063d9579f09f9e1f7f2d652542e7ca5`，candidate SHA `95e6e3df7a13836cd37e9697e1cc25486ff3dbc27921beabf56e152db51e6cf8`，安装清单SHA `3a53c159cc5f3a33dcf3e3f7a2209fad82411ec649c4c4672b0eee43dcc89886`。[资源复用证明](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/retained-games-proof.json)确认6款正式游戏／7个玩法的31个游戏构建单元、25条原签名发行、24个blob及完整签名目录原字节保留，当前映射SHA `ac917e6a9dd36a7b3dd6f084944b9e2528309eace79a294d11a39539fb844bf9`未变。

[默认D](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/production-account-02-02/application-handoff/report.json)、[I198／外置D](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/production-account-02-02/application-handoff-long-root-external-data/report.json)、[健康失败恢复](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/production-account-02-02/application-framework-recovery/report.json)三条新布局1.0.7.60000→60001实际链各8步通过、0失败，覆盖真实更新入口、下载／验签／Apply、父退出、新持续主机、下一启动清理、旧框架保全及最终卸载。[真实进度窗口](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/production-account-02-02/application-handoff/installer-progress/report.json)在隔离安装夹具上核对同一进度实现的实际中文活动进度、文件计数和Inno原生0–65535控件位置，保留真实PNG；安装进程持句柄退出0，自有Job自然归零、恢复并关闭私有桌面。向导迁移选择等沿用既有实现，本轮没有逐页重跑全部向导交互。

[正式原始证明](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/production-account-02-02/shipping-executable-checks-full.json)12项通过，覆盖实际首装、同根复装、保存、两次卸载、重装读回、登记／快捷方式及精确受管成员。两次资源回执均删除192文件、因存档引用保留56文件，deferred为空；数据库、配置、未知文件和旧局依赖保留。[正式账户终态](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/production-account-02-02/isolated-account.json)及[驱动终态](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/production-account-02-02-completion.json)确认退出0、账户和profile删除、errors为空。[独立封存证明](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/finalized-installation-02.json)1,765,090字节，SHA `a0260b54b0af811aa561ecae57e5c6ce65bc61cb28bb15769624ad0f220c1e92`，绑定同次receipt、完整方法、同账户清理和保留runtime，不重复业务。

[便携10→1.0.7.2同根迁移](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/portable-migration-02-01/portable-migration/report.json)默认／外置D两场景各8项通过、0失败；实际安装根等于原便携配置根，新配置根为I/data，核原件逐文件SHA、存档及玩家恢复、卸载删留。[迁移账户终态](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/portable-migration-02-01/isolated-account.json)及[迁移驱动终态](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/portable-migration-02-01-completion.json)确认独立账户退出0并删除账户／profile，errors为空；不跨账户拼接证明。

首次完成安装并健康启动后同次程序采样113,633,179字节＝程序97,709,380＋框架5,273,757＋身份／配置15,814＋当前G10,634,228，低于120,000,000硬限，触发110,000,000工程预警。preStartupSampled为false；阶段观测最大176,174,176字节包含数据／缓存／暂存，isAbsolutePeak为false。[封包日志](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/package-candidate-02.log)核EXE、ZIP及实际提取内容；[推广回执](../../artifacts/maintenance/v1.0.7/installer-progress-release-20261016/round-01/promotion-receipt.json)绑定严格门禁和新v1.0.7/current，推广时旧v1.0.6/current及原10／18／19／21字节保全；发布后本地旧EXE／sidecar已获授权退役，见[退役记录](../archive/local-release-retirement-2026-10-16.md)。

采用项目免费RSA应用签名，不提供Authenticode或SmartScreen信誉。浏览器下载标记、真实断电、实体手机LAN及线上正向更新UI下载未在本轮重测。原失败与过程见[本轮归档](../archive/installer-progress-v107-release-2026-10-16.md)。

## 1.0.6.21：installer命名与完整流程收尾（2026-10-16）

原身份、实测、容量与当时推广结论见[21验收快照](../archive/windows-installer-flow-2026-10-16.md#21验收快照)。

## 1.0.6.19：新布局正式验收（2026-10-16）

原字节、完整正式证明、迁移与未推广边界见[19验收快照](../archive/windows-installer-flow-2026-10-16.md#19原字节验收快照)。

## 1.0.6.18：正式系统验收（2026-10-15）

原字节、正式系统证明、便携迁移及当时推广回执见[18验收快照](../archive/windows-installation-update-2026-10-15.md#18推广后验收快照)。

## 工具接口重组边界

接口及证据要求见[验证](validation.md#正式执行记录与证明封存)，无损归组、职责盘点与原失败见[整理归档](../archive/tooling-delivery-organization-2026-10-15.md)。各旧包按原方法与原字节认定，不能替代当前交付证明。

## 续行09–11：候选16重装缺陷与候选18冻结（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行0911候选16重装缺陷与候选18冻结2026-10-15)；仅按当时版本与范围认定，不覆盖后续交付证明。

## 续行08：旧框架保全时序修复（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行08旧框架保全时序修复2026-10-15)；仅按当时版本与范围认定，不覆盖后续交付证明。

## 1.0.6.15：候选冻结与续行07（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#10615候选冻结与续行072026-10-15)；仅按当时版本与范围认定，不覆盖后续交付证明。

## 续行06：数据路径分类与共用门禁（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行06数据路径分类与共用门禁2026-10-15)；仅按当时版本与范围认定，不覆盖后续交付证明。

## 续行05：活跃卸载通过与长路径启动诊断（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行05活跃卸载通过与长路径启动诊断2026-10-15)；仅按当时版本与范围认定，不覆盖后续交付证明。

## 续行04：组件复验与活动卸载失败（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行04组件复验与活动卸载失败2026-10-15)；仅按当时版本与范围认定，不覆盖后续交付证明。

## 续行03：真实首装与剩余故障（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#续行03真实首装与剩余故障2026-10-15)；仅按当时版本与范围认定，不覆盖后续交付证明。

## 1.0.6.14：安装候选与标准账户诊断（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#10614安装候选与标准账户诊断2026-10-15)；仅按当时版本与范围认定，不覆盖后续交付证明。

## 协调器修复与三失败停止（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#协调器修复与三失败停止2026-10-15)；仅按当时版本与范围认定，不覆盖后续交付证明。

## 1.0.6.13：安装候选与专项证据（2026-10-15）

本节原候选、失败、方法与SHA完整保留于[安装完成归档](../archive/windows-installation-update-2026-10-15.md#10613安装候选与专项证据2026-10-15)；仅按当时版本与范围认定，不覆盖后续交付证明。

## 1.0.6.10：宝可梦新设计应用（2026-10-12）

该旧便携EXE、源码与同包专项、原失败和未测边界见[整理归档](../archive/tooling-delivery-organization-2026-10-15.md#10610宝可梦新设计应用2026-10-12)。不将旧包通过改写为当前包新增验证；当前待测游戏事项从[扩展任务](../tasks/pokemon-encounters-expansion.md)接续。

## 当前源码与本地交付

当前本地current为[完整安装器1.0.7.9](#马尼拉本地候选2026-10-16)，含全部七款游戏／八个玩法，已完成本轮正式系统安装验收，暂不发布。公开版本仍为1.0.7，线上附件仍对应[1.0.7.2原字节](#1072安装进度与版本交付2026-10-16)。旧1.0.6/current、内部载荷和原证明按历史身份保留；对应本地旧EXE／sidecar已退役，原路径不能再作为现存安装器或迁移复验输入，见[退役记录](../archive/local-release-retirement-2026-10-16.md)。

源码与本地完整交付已包含经典马尼拉；本地current切换不覆盖线上附件、标签或原发行SHA映射。

[GitHub v1.0.7](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.7)已正式发布并为latest，非草稿、非预发布。附件仅[installer](https://github.com/anApalpitate/TableMax/releases/download/v1.0.7/TableMax-1.0.7-installer-win-x64.exe)与[source ZIP](https://github.com/anApalpitate/TableMax/releases/download/v1.0.7/TableMax-1.0.7-source.zip)；公开installer与本地1.0.7.2完全同字节。source ZIP为86,438,358字节，SHA `83d9080b3a0d54b8d01269710dd3a9bec7c417413e4d18429e9d4fc0c5660963`，由标签源码提交 `c1207fd0be68b05b2fa88e2989a2c7444ca3527b`导出；标签对象 `14e0eef4272aeaea5648f9bc08fb43de998e09d7`。[发布审计](../../artifacts/maintenance/v1.0.7/windows-editions/91e13f6af698a964df479b8233ecf5e2f063d9579f09f9e1f7f2d652542e7ca5/github-publication.json)核对两附件远端摘要、源码映射及RSA签名正文。历史附件保留，不部署Pages；失败和操作方法差异见[发布归档](../archive/installer-progress-v107-release-2026-10-16.md)。

工作区占用及逐文件退役见[项目瘦身](project-slimming.md)；1.0.7.2发布任务未追加清理，马尼拉任务的单次维护单独记录。旧运行ZIP唯一迁移输入见[整理归档](../archive/tooling-delivery-organization-2026-10-15.md#旧运行zip的迁移输入)；下方旧标题保留历史导航。

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

# 工作区维护

本页替代[开发环境](development.md)中同职责章节，保留原规范；命令全文只在对应[工具索引](../../tools/README.md)入口维护。默认先列标题，再按章节读取。历史版本描述仅表示当时边界，当前交付以唯一完整EXE与[Release流程](release.md)为准。

## 清理本地中间物

### 容量触发与深度瘦身（2026-10-15）

2026-10-15用户新增维护要求：发现项目完整逻辑体积 **超过15GB** 时，必须启动[深度瘦身方案](deep-slimming-methodology.md)，目标 **严格小于6GB**。GB为十进制：触发条件 `B > 15,000,000,000` 字节，完成条件 `B < 6,000,000,000` 字节；不混同日常GiB门槛。

完整口径计入项目根下的普通文件、主Git元数据、依赖／工具缓存、产物、归档与实际嵌套仓库；不跟随链接重复计量目标，不用NTFS压缩或硬链接共享的物理节省代替逻辑长度。空间工具默认跳过嵌套仓库，深度触发及最终验收必须补计并列明口径，不能拿部分扫描声明未触发或已达标。

| 本轮开始时的容量／条件                     | 维护分支                                                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 完整逻辑体积超过15,000,000,000字节         | 深度分支优先：立即启动只读容量／来源审计、保护清单与候选预算；在工程全部退出且预览通过后，使用跨目录逐文件清单执行一次Apply，目标严格低于6GB |
| 未触发深度分支，但日常口径超过10GiB        | 沿用已有日常安全维护，目标8GiB或安全候选耗尽                                                                                                 |
| 未超过上述门槛，仍有已结束登记产物         | 沿用现有窄范围到期维护，不扩大为深度删除                                                                                                     |
| 活动进程、近期内容、未知来源或安全候选不足 | 可以审计并记录深度待处理状态；不进入或继续Apply、不停止其他任务、不放宽保护，明确目标尚未达成                                                |

「启动方案」包括主动审计与安排安全空闲边界，不等于发现超标就立即删文件。深度本轮不先做一次日常Apply再追加深度Apply，也不在深度后叠加另一轮删除；已开始的单次ID不复用，部分失败不换ID续删。最终容量不足以达标时保留实际回收量、原因与剩余范围，不把安全候选耗尽写成达到6GB。

规则在本次文档更新后生效，仍使用下文现有预览／SHA绑定入口；本轮文档更新未修改自动维护脚本的10GiB／8GiB参数、未新增常驻监控，也不执行清理。深度分支由agent依本规则选择并审计，不宣称现有脚本已经自动生成跨目录深度清单。日常规则与过往一次性目标保留原历史边界。

一次父轮安全维护可包含既有缓存、登记产物和日常容量阶段，但不能完成后再追加另一轮删除或切换深度分支续删。2026-10-15安装任务已完成一次维护，仍未达到8GiB；[真实结果与接续边界](project-slimming.md#windows安装交付任务单次维护2026-10-15)保留于瘦身记录，后续补齐同任务正式安装验收不再追加本轮清理。待验收的冻结安装器、双PE交接材料及实际失败／通过证据继续保护；只有已完整验收的交付才能作为 current 维护门禁，不能将候选封包证明当成正式安装证明。

### 跨目录精确文件退役（2026-10-12）

深度瘦身使用 `scripts/Clean-Intermediates.ps1 -ReviewedFilesManifest <maintenance内清单>` 先预览，再以预览打印的 `-ReviewedFilesManifestSha256 <SHA-256>` 执行一次 `-Apply`。它只删除人工核验来源的普通生成文件，可覆盖 `tmp/`、历史打包副本、隔离验证运行目录和过期截图；不整目录递归删除，不复制内容作恢复归档，不接入自动维护。源码、原资料、秘密、正式存档、当前交付及最新验收仍受保护；测试数据库必须有独立隔离来源证明。

清单绑定当前发行载荷、保护文件与来源引用的SHA，并逐文件列出精确路径、字节、UTC修改时间和SHA。链接及入链目标、嵌套仓库、30分钟近期修改、未列文件、新增内容、活动进程与共享互斥继续保护。开始删除即永久消耗ID，部分失败不重试或换ID；收尾只统计容量和核对保护内容，不追加第二次删除。实现与隔离回归见[维护工具](../../tools/maintenance/README.md#人工深度瘦身)。2026-10-12当次6GB目标的实际结果见[项目瘦身](project-slimming.md)；日常10GiB／8GiB继续保留，2026-10-15新增的15GB深度触发按上节执行。

2026-10-13同一逐文件入口补充已核验的编译／组装输出，限desktop、native、native-obj；保留冻结快照与指针，并将它们的SHA绑定为删除前置条件。历史机器报告若需要继续保存完整内容，应作为正式证据全文无损归档，核验归档每个成员的字节与SHA，保留可读结论及原路径映射；这与丢弃临时副本不同，不把归档当作节省逻辑体积的排除项。

同一入口允许以完整归档证明保存不再原位使用的历史冻结JSON；原内容、数字字面量、逐文件SHA映射及恢复路径全部保留。当前latest、快照、assembly和运行／旧局恢复所需文件继续原位保护；显式复查历史构建ID时，先按索引还原对应完整成员。当前验收图片只按完整字节SHA去重，保留每组原图、捕获引用映射与修改前完整报告；仅迁移报告中的图片路径，不改检查、结果、时间或其他字段。

### tmp 临时内容的生命周期（2026-10-11）

`tmp/` 只保存尚在使用的临时输入、隔离测试与可再生输出，不保存可恢复档案。已结束且后续不再需要或仅低频回看的源码副本、旧包、基线、暂存索引、日志、一次性脚本、测试库和未采用候选均可经人工审计退役；可重新取得的低频工具也列为候选，先明确删除后受影响入口。已采用唯一原素材、规则原件、正式存档与当前交付／验收证据放在所属正式目录，不以整份临时目录备份代替分类。实际使用的FFmpeg已移至 `.cache/tools/ffmpeg-7.1/`，锁定记录为 [ffmpeg-tool.json](../../tools/assets/ffmpeg-tool.json)，正式音频脚本不再依赖临时目录。

`-TemporaryNames` 仍仅选择精确直属项，默认预览；已核验内容直接删除，不创建 `temporary-scripts`、`reviewed-temporary-content`、ZIP或其他恢复副本。未知名称先审计，不自动扩大清理范围。含链接或混合内容时，使用 `scripts/Clean-Intermediates.ps1 -TemporaryManifest <清单>` 预览，核对后只调用一次 `-Apply`：清单只列待删普通文件，链接及链接目标、新增或未列文件原位保留，目录仅在为空时移除，不递归删除混合根目录。

单次清单位于 `artifacts/maintenance/`，字段为 `version: 1`、`authorization: retire-reviewed-tmp-once`、唯一 `id`、`currentVersion`、当前版本已验证载荷的 `archivePath`／`archiveSha256`、实际通过证据 `proofPath` 与 `entries`。仅清理tmp时允许绑定同版本已通过的载荷，而后继候选仍在验收；工具同时冻结并核验原载荷、证据、当前EXE、载荷及目录索引的哈希，任何正式交付均不进入删除范围，不把旧通过升级为新候选通过。每项包含精确直属 `name`、用途核验 `reason` 和 `files`；每个文件为项目相对 `path`（必须在该 `tmp/<name>` 内）、`bytes`、`lastWriteTimeUtcTicks`。清单不支持通配符、路径跳转、反斜线或重复文件，沿用当前交付证明、30分钟近期修改、活动进程、祖先链接、嵌套仓库、文件元数据变化及共享清理互斥保护。执行前复核清单SHA-256，逐项删除前复核文件；任何新增文件不扩展删除集合。

开始删除时在 `artifacts/maintenance/tmp-retirements/<id>.json` 登记已消耗状态，记录清单SHA-256、范围、跳过理由、实际文件数／字节和结果，不复制内容。部分失败也不自动重试或复用该ID；预览不会消耗ID。该入口只供明确人工授权，不接入自动维护、定时任务或后台轮询。本轮限定一次清理，收尾仅统计容量，不再追加 `Maintain-Project.ps1 -Apply` 等第二轮删除。隔离回归为 `powershell.exe -NoProfile -File tools/maintenance/temporary-retirement.test.ps1`，并按共享入口影响执行既有清理与维护回归。

以下旧清理过程按当时规则追溯；与本节冲突的tmp归档说明不再适用。

2026-10-11前四条修复交付收尾：当前ZIP的实际解压／运行、313成员与源码冻结输入已核验，保留当前交付、旧包历史证据、截图及存档。手动预览后删除一个到龄生成夹具2,013,769字节；release预览0候选／2近期保护，本轮过程目录保持原处，不绕过30分钟保护。最终空闲 `scripts/Maintain-Project.ps1 -Apply` 为8.144GiB，低于10GiB阈值，广域删除0。细节见[项目瘦身](project-slimming.md#前四条修复交付收尾2026-10-11)及[交付证明](../../artifacts/maintenance/v1.0.6/bug-first-four/results.json)。

截图存储采用[统一维护策略](../../tools/maintenance/README.md#截图与产物归属)：重复成功尺寸保持全部断言，拍摄前筛选代表；关键 PNG 保留真实 DPI，普通预览与额外 process 图采用 WebP 品质90，盒子联系表仅引用原图。Python 编码依赖与预检见[资源工具](../../tools/assets/README.md)。已核验旧候选／矩阵及同 SHA 派生资源按逐文件清单通过 `scripts/Clean-Intermediates.ps1 -ImageCopiesManifest <maintenance内清单>` 先预览再 `-Apply`；仅删图片，保留报告、失败、必要代表、原素材、规则、存档和当前交付。该人工入口不接入自动维护，继续保护30分钟近期修改、文档链接、内容变化、路径／链接／嵌套仓库、活跃进程和互斥。实际结果见[项目瘦身](project-slimming.md#截图精简与普通预览2026-10-10)。

2026-10-10已接入[构建与验证自动维护](../../tools/maintenance/README.md)：工程任务结束后在空闲收尾阶段，由一次隐藏任务核验协调进程身份、真实父子关系、其他工程空闲与当前 ZIP 便携证明，再预览／修剪过期模块缓存和成功验证登记的临时产物；这两类不等待10GiB门槛。UNO／阿瓦隆默认精选截图，保留完整断言矩阵、代表图和失败现场；盒子座位验证同步登记生成目录。成员清单在空闲时冻结，继续执行30分钟、精确哈希、文档引用、路径／链接、进程和互斥保护；未登记内容不猜测删除。原有10GiB→8GiB维护用于更广瘦身，以下旧“自动入口仅容量触发”的说明不覆盖本次新增的窄范围维护。

2026-10-06 用户补充定期清理验证产物要求：每轮集中验证结束、新交付验收通过及长任务收尾时，检查 `artifacts/` 和 `tmp/` 中本轮及遗留的验证生成物。已完成且无后续用途的解压程序、浏览器 profile、缓存、打包副本和其他可再生中间物，应按现有手动清理入口先预览、核对再退役，不必等项目超过10GiB；自动维护入口仍沿用10GiB触发、8GiB目标，不新增定时任务或后台轮询。

清理前确认相关工程进程全部退出，沿用当前便携通过证明、精确路径、近期修改、链接、候选变化及互斥保护。原素材、规则资料、正式存档、当前已验证交付与验收证据继续保留；历史截图仅按已有明确授权和专用清单退役，保留文字结论、失败原因、构建边界与哈希并修复文档引用。未知内容或不受现有工具支持的用途先审计并保留，不清空整个 `artifacts/` 或 `tmp/`。执行后记录实际回收字节、保留／跳过原因和逻辑水位，结果归 [项目瘦身](project-slimming.md)。

v1.0.3新增已知隔离副本 `tmp/portable-storage-<六位随机后缀>`，通过后才按精确清单清理。用户明确授权退役旧安装资源时，专项 `tools/maintenance/retire-old-local-runtime.ps1` 默认预览，核对后加 `-Apply`；仅处理旧LOCALAPPDATA下的受管理 `TableMax/app`，要求当前实际存储／迁移通过证据、原库SHA不变、旧版本所有权标记、准确文件集及全文件哈希、无链接与运行占用。逐文件记录和旧清单保存在当前版本的portable-storage证据，旧存档及其父目录始终保留。缺少这些证据时拒绝删除，不作为通用C盘清理命令。

2026-10-05更新：项目逻辑空间超过10GiB时瘦身，默认目标8GiB；安全候选耗尽仍超标只记录，不扩大范围。容量仅在开始与结束各实测一次，中间按已校验删除字节估计停止条件；候选元数据快照改用.NET遍历，删除前保留一次指纹／链接复核和进程检查。原素材、正式存档、当前交付和验收证据继续受保护。

`scripts/Clean-ReleaseScreenshots.ps1` 是窄范围入口，默认预览，显式 `-Apply` 才删除：仅匹配release直属的已命名过程图片或纯图片目录，不扫描maintenance或assets，不处理运行／源码文件；保留30分钟保护、共享清理互斥和删除前复核，不要求对无保留价值的生成截图逐像素／内容哈希验证。

日常本地运行 `pnpm package:win`，只生成唯一完整EXE和本地清单；`--edition`已明确拒绝。内部payload ZIP及逐文件manifest留 `artifacts/package-payloads/v<版本>/`，不作为用户运行ZIP。仅在用户明确声明发布到GitHub时才准备source ZIP；现有本地打包入口不会自动生成源码包，也不执行发布。

`scripts/` 提供三个可从任意工作目录运行的 PowerShell 清理与维护入口，共用 [清理实现](../../tools/maintenance/cleanup-local.ps1)：

- [scripts/Clean-Releases.ps1](../../scripts/Clean-Releases.ps1)：清理 `artifacts/releases` 中低于 `package.json` 当前版本的程序／源码 ZIP、配套交付／逐文件清单、解压程序和独立打包目录；当前／未来版本及不认识的名称默认保留。版本重新编号后，可用 `-RetiredVersions 1.6.0` 显式指定已退役标签，仍执行全部安全检查；禁止指定当前版本，自动维护不接受该选项。
- 用户明确要求本地只留最新导出时，手动 `scripts/Clean-Releases.ps1 -KeepLatestOnly`先预览，核对后加 `-Apply`。该模式只处理 `artifacts/releases/`直属项；新格式读取 `artifacts/package-payloads/v<版本>/current.json`并保护唯一完整EXE、payload、manifest及指针，要求实际EXE通过证明和双哈希一致；读取历史双格式时仍逐项保护原edition。已有同版旧已发布EXE／ZIP／source／manifest仍保留，明确逐文件SHA备份后才能退役原位置；不清理其他历史证据目录或内部payload目录。无新格式指针时兼容旧ZIP及匹配清单保护。沿用进程、路径、链接、近期修改、指纹及互斥保护，不与其他清理选择模式或自动维护混用。
- [scripts/Clean-Intermediates.ps1](../../scripts/Clean-Intermediates.ps1)：清理已知验证脚本生成的 `tmp/<用途>-<六位随机后缀>`、便携解压副本、已完成的打包工作目录及 builder 诊断文件；已识别的一次性脚本直接退役，不建恢复归档。未知及低频内容先审计，再按精确名称或单次文件清单处理，不清空整个 `tmp/`。原始素材、资料与历史截图／JSON 证据不在范围内。
- [scripts/Maintain-Project.ps1](../../scripts/Maintain-Project.ps1)：工程操作前后空闲时检查主工作区磁盘占用；超过 10 GiB 才按最旧候选优先清理上述两类内容，达到 8 GiB 或合格候选耗尽即停止。容量是逻辑文件字节总量，不是运行内存；流式扫描跳过链接和嵌套仓库，不重复统计主工作区与 worktree，也不跨无关项目。

全库计量使用 .NET 流式枚举，包含隐藏和系统文件；待扫描目录出栈后刷新属性，再判断链接和嵌套仓库。开始和结束各真实计量一次工作区；逐项删除按已核验候选字节估算停止点，结束时以实际计量记录水位。编译的计量类型只在当前 PowerShell 进程复用，不安装工具或创建后台服务。

三个入口默认只预览，保留最近 30 分钟修改过的候选，不删除也不写清理日志。两个手动清理入口默认处理脚本所在 checkout；维护入口默认从同一 Git 仓库发现主工作区，三个入口均支持 `-ProjectRoot <绝对路径>` 显式选择同仓库 checkout，拒绝无关项目。先退出 TableMax，并完成开发／测试／打包；手动核对后加 `-Apply`，日常维护按已授权规则在空闲边界自动调用维护入口的 `-Apply`，不创建常驻或定时任务，不在仍运行的 package／verify 父进程里绕过空闲检查。

删除前核对当前完整EXE和内部payload的SHA，要求相同snapshot的实际EXE通过证明；只有历史ZIP格式才使用匹配档案哈希的 `portable: true`／`result: passed`记录。缺包、未验证、字节变化或容量超标但无候选时安全保留并报告。执行前及逐项删除前检查进程，解析绝对路径并核对仓库边界，拒绝 junction／符号链接和嵌套仓库；同目录清理互斥，候选的逐项路径／字节／修改时间指纹在删除前复核。不能读进程、候选变化或检查失败时停止，不结束用户进程。部分失败保留已执行清单供复查。

[操作命令唯一入口](../../tools/maintenance/README.md#开发环境操作tmp-临时内容的生命周期2026-10-11)

`build/` 供 `pnpm start` 使用，默认保留；手动 `scripts/Clean-Intermediates.ps1` 明确要删除时可加 `-IncludeBuild`，之后先执行 `pnpm build` 再启动。已确认最近候选停止使用时，手动入口可显式设置 `-MinimumAgeMinutes 0`，它不跳过其他安全检查。自动维护禁止这两种放宽；阈值可用 `-HighWaterGiB`、`-LowWaterGiB` 调整，低水位必须小于高水位。`.pnpm-store/`、`node_modules/`、工具缓存、正式存档、原始素材和历史证据继续保留；保护内容占用过大时只报告，不为达到阈值扩大删除范围。脚本不更改 PowerShell 执行策略、正式用户数据或其他项目环境。

只清理已核对的特定临时项时，使用 `scripts/Clean-Intermediates.ps1 -TemporaryNames @('game-ui-ABC123', 'review-tools')` 预览，核对后追加 `-Apply`。名称必须是 `tmp/` 直属项的精确名称，不允许路径、重复或不存在的项；此模式不扫描打包目录，不与 `-IncludeBuild` 或自动维护结合，未列出的内容保持原位。显式选择的未知临时内容经人工用途核验后直接删除，不建立 `reviewed-temporary-content/` 或其他恢复备份；路径、进程、近期修改、链接、嵌套仓库和当前已验证 ZIP 保护仍生效。原始资料与历史证据应先核对其归档，不能因为放在 `tmp/` 就视为可丢弃。

电力公司旧音频验证将解压程序与浏览器 profile 混放在历史证据中。手动 `scripts/Clean-Intermediates.ps1 -VerificationCopies <相对路径数组>` 只接受 `artifacts/maintenance/v1.0.2/<维护名>/native-audio/<run>/work-<六位后缀>/extracted` 或该 work 内六类 `checkpoint-<cue>/desktop` 的精确目录；拒绝空清单、通配符、文件、整个 work／checkpoint、其他证据路径或重复项。每个 run 的 `results.json` 必须是与当前 ZIP 哈希一致的便携通过结果，其中 `work` 必须与所选目录所属的实际工作目录一致，并保留在原位；SQLite、源码、JSON、截图及当前程序包也保留。先预览再 `-Apply`，仍执行全部近期／路径／进程／链接／指纹保护，此模式只处理列出的副本，不与其他手动模式或自动维护混用。清理记录关联具体目录和父级通过证据，不能将它推广为清空 `artifacts/`。

实际执行记录写入 `artifacts/maintenance/local-cleanup-<UTC时间>-<类别>/cleanup.json`，逐项记录路径、字节、删除状态、跳过原因及保留的当前 ZIP 哈希；维护模式另记目标工作区、水位和前后字节。一次性脚本不再归档；报告仅记录精确路径、理由、字节与结果。记录保持文件树可见、Git 忽略。`tmp/modern-art-verify-*` 仅对应已核验的旧现代艺术整局隔离数据（六位随机后缀），不包含 UI 工具、研究或截图证据目录；`tmp/experience-*` 仅用于新版操作验证的隔离数据和便携解压，`tmp/runtime-memory-*` 仅用于内存测量；均按已知前缀清理，正式证据按版本保留在 `artifacts/maintenance/v<版本>/`，不参与临时文件清理。

`tmp/app-icon-verify-*` 与 `tmp/tablemax-sqlite-migration-*` 的六位随机后缀目录分别是图标验证／便携解压及服务迁移验证的隔离副本，归入已知中间物；图标原素材和迁移原始存档仍保留在资源及历史证据目录。

v1.0.4 将 `tmp/box-layout-*`、`tmp/debug-portable-*`、`tmp/debug-recovery-*`、`tmp/debug-remote-*`、`tmp/game-review-*` 和 `tmp/root-entry-*` 纳入已知隔离副本，只匹配六位字母数字后缀；分别用于盒子、游戏与连接、恢复、远程双向验证、只读游戏视图补拍及根入口检查。实际图和报告保留在 `artifacts/maintenance/v1.0.4/`，当前截图和报告不参与临时目录清理。使用 `tools/maintenance/cleanup-local.test.ps1 -VerificationPrefixesOnly` 复核精确匹配及类似名称／近期／链接保护；本次 51 项隔离夹具检查通过，证据在 `research-redesign-20261008/implementation/cleanup-prefix-tests/`，新增前缀不扩大至未知临时内容。

修改工具后运行 `powershell.exe -NoProfile -File tools/maintenance/cleanup-local.test.ps1` 与 `powershell.exe -NoProfile -File tools/maintenance/project-maintenance.test.ps1`。前者检查手动预览、ZIP／进程／链接／白名单／近期保护、脚本无恢复备份退役及显式构建清理；后者用隔离 Git 主仓库和 worktree 检查目录发现、不重复计量、高低水位、最旧优先、互斥及候选耗尽。测试不清理真实 release，结果分别保存在 `artifacts/maintenance/cleanup-history/tool-checks/current/tool-tests.json` 和 `artifacts/maintenance/project-maintenance-tools/tool-tests.json`。

### 手动历史截图去重

用户明确要求清理历史证据时，可用 `scripts/Clean-Intermediates.ps1 -DuplicateScreenshotsManifest <清单路径>` 先预览，核对后加 `-Apply`。清单位于 `artifacts/maintenance/`，版本字段为 `1`，`groups` 列出不重叠的历史目录及其直接 PNG 文件；每项含 `path`、`bytes`、`sha256` 和 `retainedPath`。仅接受 `artifacts/maintenance/v<版本>/` 下低于当前 `package.json` 版本的经人工审计截图；当前与更高版本拒绝退役，不接受整个目录删除，不与其他手动选择或自动维护混用。

预览与删除前都逐文件核验源与保留 PNG 的大小和 SHA-256，保留文件不得在删除集合中；仍执行当前便携证明、路径、链接、嵌套仓库、进程、30 分钟近期、目录指纹和互斥保护。删除只针对显式 PNG 文件，目录里的 JSON、日志、存档、独有图片和其他文件保持原位。执行报告保留每张退役截图的哈希与同字节保留位置；旧验收结果正文不改写，清理后的历史副本从该清单追溯。来源图及正文直接引用图片须在生成清单时排除，不能仅根据名称或 Git 忽略判断。

相关隔离验证为 `powershell -NoProfile -File tools/maintenance/duplicate-screenshots-cleanup.test.ps1`；修改共用清理实现还需既有手动／自动保护回归。该模式不减少当前交付 ZIP 的内容，也不导出源码包。

### 手动历史截图全量退役

按 2026-10-05 用户授权，清理历史内容时不再要求保留独有截图：旧版本验收、试玩和界面截图及其联系表可全部删除，失败原因、文字结论、版本／构建边界、逐文件哈希与清理记录继续保留。当前版本验收截图、素材原图、规则参考资料、源代码和存档保持原位。既有同字节去重清单属于当时记录，后续全量退役可以删除其中的保留图片，须用新清单说明这一状态变化。

使用 `scripts/Clean-Intermediates.ps1 -HistoricalScreenshotsManifest <清单>` 先预览，核对后加 `-Apply`。清单位于 maintenance，包含 `version: 1`、明确 `authorization: retire-historical-screenshots`、当前版本与通过 ZIP 的 SHA-256；每个历史根目录列出确切图片路径、字节数、SHA-256、理由和当前版本内保留的文字授权证据／哈希。工具只删除所列 PNG／JPEG／WebP，保留目录、其他文件及文字记录；当前版本、未知版本、未知目录、素材／研究目录、非图片、路径逃逸、重复路径、链接、嵌套 Git、变化的内容或文字证据均拒绝。历史 v1.6.0 是已记录的版本重编号前交付；旧未编号目录和归档验证副本仅接受入口中的已核验白名单，不据大小或名字模糊清理。

默认仍有 30 分钟近期保护，且执行当前便携证明、工程进程、互斥、目录指纹和删除前逐文件哈希检查。若同一已结束清理刚改变历史目录时间，可在核对清单且无工程进程时显式用 `-MinimumAgeMinutes 0`，其他保护保持。该模式只支持手动中间物清理，不能与其他手动选择混用，自动维护不采用此范围。删除后将文档截图链接改到退役清单并标注已清理，不将清单作为图片显示，也不改写当时通过／失败结果。

相关隔离检查为 `powershell.exe -NoProfile -File tools/maintenance/historical-screenshots.test.ps1`；修改共用入口同时执行既有手动、自动维护、同字节去重和历史可再生副本退役回归。实际执行结果进入 [项目瘦身](project-slimming.md)，运行 ZIP 内容与版本号不因截图清理改变。

### 手动可再生副本与旧包退役

同类型也允许精确选择上述测试目录中的单个旧 `room.sqlite`。目录若有近期辅助文件，将它们作为独立保留证据绑定SHA-256，任何变化阻止删除主库；只删除已过保护期的主库，不降低30分钟保护、不移动或删除近期WAL／SHM。原审计仍记录整个测试数据库文件组；这一选择限已退出且不再运行的模拟夹具，不用于业务数据库。

2026-10-06增加手动 `isolated-test-database` 类型：仅接受 `artifacts/maintenance/v<版本>/pokemon-expansion-verification/integration/run-<数字>-<八位十六进制>/worker-mixed`，目录内只能有 `room.sqlite` 及其WAL／SHM。清单完整记录所有文件哈希；另含 `audit.path/sha256`，对应保留证据中的数据库只读摘要（来源、路径、SHA-256、v1／v2、journal行数），并保留相邻 `results.json` 的源码哈希／原结论。只用于已结束的自动模拟测试，运行进程、近期修改及其他保护照常生效；正式存档和未知目录拒绝处理。

自动隔离中间物新增已核验的六位随机后缀 `tmp/pokemon-expansion-runtime-*`、`tmp/pokemon-expansion-normal-play-*`、`tmp/pokemon-expansion-effects-*` 和 `tmp/portable-storage-games-*`，分别由现有扩展实际窗口／普通节奏／特效／三游戏恢复验证生成。类似的素材、资料目录仍保留。长任务完成后必须核查逻辑体积并安全维护，结果归[项目瘦身](project-slimming.md)。

用户 2026-10-05 授权完整检查通过后清理无后续用途内容。方案及实际结果见 [项目瘦身](project-slimming.md)。`scripts/Clean-Intermediates.ps1 -RetiredGeneratedManifest <相对清单>` 默认预览，核对后追加 `-Apply`；不与其他清理模式组合，不进入自动维护。

清单位于 `artifacts/maintenance/`，版本为 1，绑定当前 ZIP 的 SHA-256。`entries` 每项含精确 `path`、`kind`、`reason`、完整 `files`（path／bytes／sha256）及保留 `evidence`（path／sha256）。接受维护版本目录中的具体解压程序、带 Chromium 标记且不含平台存档的浏览器 profile、单个历史 TableMax ZIP，以及已退出活动依赖的 `.cache/electron`／`.cache/electron-builder`；另支持下节已完整保留的旧清理目录集中归档。每项及删除前都核验逐文件内容，保留证据不能处于任何删除集合中；沿用当前便携证明、路径／链接／嵌套 Git、进程、近期修改、候选指纹与互斥保护。清理报告保存原清单、全部哈希及保留位置。

新增的六位 `tmp/modern-art-polish-v2-*`、`tmp/desktop-fullscreen-*`、`tmp/modern-art-fullscreen-*` 及八位十六进制 `tmp/fullscreen-portable-*` 均已从实际验证脚本／结果确认用途，属于已知隔离中间物；其他相似名称和未知后缀仍保留。工具回归增加 `powershell.exe -NoProfile -File tools/maintenance/retired-generated.test.ps1`，并执行既有手动、自动和截图保护测试。

`node tools/maintenance/verify-project.mjs --evidence=<独立名>` 检查整个 Markdown 库的本地文件／章节链接与当前运行包哈希、文件总量、必要模块、体积和排除规则。结果进入当前版本对应的独立维护目录；省略名称时使用时间戳，避免覆盖旧验收。历史退役后先修复指向包的文档链接，再执行此检查；运行时安全、规则、显示和对局验收仍用对应真实验证器。

### 清理记录集中归档

2026-10-09用户更新要求：清理历史归档不再需要；历史版本内容核对无需复用后可删除。此要求取代下述2026-10-06的完整归档保留约定，不再把已退役的临时程序、浏览器数据或旧清理记录原样归档以抵消空间回收。当前交付与验收、原素材、规则资料、正式存档及可复用内容继续保留。删除采用明确清单，沿用路径、链接、嵌套仓库、工程进程、近期修改、互斥与当前交付保护；只留本轮精简删除清单和结果，失效文档链接改指本轮记录。历史归档说明仅用于追溯旧行为。

2026-10-08用户指定的旧版本审计采用独立窄范围脚本，复用上述当前ZIP证明、共享进程保护器及路径／近期／指纹／哈希／互斥检查；仅处理明确清单中的旧截图、旧程序副本、ZIP、原型构建与过期构建输出，不扩展自动维护范围。过程、中途工程进程保护停止及恢复结果见[瘦身记录](../archive/project-slimming-2026-10-05-to-08.md#用户指定旧版本资料清理2026-10-08)，原始资料、存档、当前验收与原清理历史保持保护。

2026-10-06 用户明确要求新建归档目录并原样移入 `local-cleanup-*`。每轮清理操作结束后，将 maintenance 直属的已结束记录目录移入 `artifacts/maintenance/cleanup-history/directories/`，保留原目录名、全部文件及记录原字节，不删除、不合并目录内容，不覆盖同名目标。清理工具当前仍在直属目录生成记录，归档由收尾步骤完成；运行中的记录不得移动。

移动前解析源、目标的绝对路径并核对项目边界，拒绝链接、嵌套仓库、目标冲突或仍在写入的记录；先列出准确目录与文件清单并记录大小、SHA-256，移动前复核源内容，移动后逐文件核验。`cleanup-history/index.json` 保存原路径、现路径、字节及哈希，操作清单直接保存在 `cleanup-history/operations/`，避免再次产生分散目录。同步修正文档引用；JSON／日志内部的历史路径保留原文，由索引追溯，不改写当时结论。移动只整理目录，不作为回收逻辑空间的清理量。

既有 `records/`、`tool-checks/legacy/` 与 `preserved-history-<日期>.zip` 继续保留。以下手动无损 ZIP 退役模式兼容旧归档，不作为原样移动目录的必经步骤：

沿用 `-RetiredGeneratedManifest` 手动入口，清单类型为 `consolidated-cleanup-history`，仅接受上述精确目录名。每项增加保留 ZIP 的 `archive`（`path`／`sha256`）；可读记录增加 `retainedPath`。工具核验整个 ZIP 哈希及每个解压成员的路径、字节、SHA-256，逐文件确认原内容全部可恢复，并检查原清理报告有独立可读副本，再允许删除目录。先预览、核对再 `-Apply`，不会自动扫描或清空 maintenance；操作记录进入 `cleanup-history/operations/`，避免此次整理再生成分散目录。相关隔离检查为 `tools/maintenance/cleanup-history.test.ps1`，共用入口变化同时回归既有清理保护。

进程检查持续阻止使用目标工作区或工具来源工作区的应用及构建／验证进程。只有可确认可执行文件和命令行均与这两个工作区无关的外部 `TableMax.exe` 才不阻止清理；无法确认路径或命令行的进程仍按保护处理。工具不结束用户运行的应用。

## 工作目录透明压缩

[scripts/Compress-Workspace.ps1](../../scripts/Compress-Workspace.ps1) 为 Windows NTFS 工作目录提供逐文件透明压缩。默认只审计，确认构建、应用和验证均退出后显式执行：

[操作命令唯一入口](../../tools/maintenance/README.md#开发环境操作工作目录透明压缩)

工具不删除或重编码素材、存档、源码、历史证据、依赖或程序包。它按文件身份去重计算实际分配，跳过链接目录、嵌套仓库、只读／加密／稀疏文件以及具有审计范围外硬链接的文件；默认候选至少 64 KiB，已经压缩的文件跳过。完全位于本工作区的硬链接仅压缩一次。写入前复查身份与别名，持有排除并发写入和删除的句柄，并通过 [GetFinalPathNameByHandleW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew) 确认主文件及每个硬链接别名的实际路径仍位于工作区内，拒绝父目录移出后用 Junction 回指的情况。压缩前后 SHA-256 必须一致，无收益时撤销压缩。只读属性保持原样，不为压缩临时修改 Git 对象或原始资料的属性。

需要覆盖较小文件时，可先用 `-MinimumBytes 4096` 预览，再按同一参数执行；此参数仅降低普通文件的大小门槛，不取消上述保护。

操作与清理工具共用互斥保护；活动项目进程存在时拒绝执行，不关闭用户程序。`artifacts/maintenance/workspace-compression-*/` 保存开始报告、逐文件 JSONL 审计和最终汇总；异常或中止后的 started 条目不能视为已核验成功。逻辑字节、按路径累计字节和按文件身份去重的实际磁盘分配分别记录；便携 ZIP 及实际解压字节门禁仍按原始字节计算。后续新增文件不自动进入本次压缩，不建立后台轮询。

底层采用 [FSCTL_SET_COMPRESSION](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/77f650a3-e3a2-4a25-baac-4bf9b36bcc46)、[FILE_STANDARD_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_standard_info) 与 [GetCompressedFileSizeW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getcompressedfilesizew)；隔离回归执行 `powershell.exe -NoProfile -File tools/maintenance/compress-workspace.test.ps1 -EvidenceDirectory <项目内 artifacts/maintenance 的绝对路径>`，新回归不得覆盖旧版本证据；覆盖无损内容、普通读写、硬链接边界、嵌套仓库、链接目录、无收益撤销和活动进程拒绝。

## Agent入口迁入的执行约束

以下为原入口的有效约束，2026-10-13按主题迁入；不是新增产品要求。入口仅保留关键规则与阅读路由。

- 按2026-10-11最新要求，`tmp/` 只存临时工作输入与输出，不保留恢复归档；已结束且不再需要或使用频率低的源码快照、旧包、测试数据、日志、脚本及候选均可经审计列为删除项。唯一已采用原素材、规则原件、正式存档与当前交付／验收应放在正式目录；清理不复制待删内容作备份，只留简明清单与结果。人工精确清理及一次性清单见[开发环境](development.md#tmp-临时内容的生命周期2026-10-11)，仍保护活动进程、近期变化、路径、链接目标和嵌套仓库。本轮只执行一次清理，不新增自动任务或追加第二轮删除。

- 长任务完成后必须检查项目逻辑体积，按[分层容量规则](#容量触发与深度瘦身2026-10-15)选择深度或日常分支，在全部工程进程退出后执行一次安全瘦身并记录实际结果；不以NTFS压缩节省替代逻辑体积。

- 定期检查并清理验证产生的 `artifacts/` 与 `tmp/`：每轮集中验证结束、新交付验收通过及长任务收尾时，按 [定期验证产物清理要求](development.md#清理本地中间物)核对并退役已无后续用途的生成副本，不必等到超过10GiB。保留原素材、规则资料、正式存档、当前交付与验收证据，沿用现有清理入口及全部安全保护，不整目录清空。

- 按2026-10-09最新要求，清理历史归档不再需要保留；旧版本内容经核对无需复用后可删除，不再将临时程序副本移入清理归档长期保存。当前交付与验收、原素材、规则资料、正式存档及仍有复用价值的内容继续保护；本轮清理只留精简范围与结果，修复失效引用。具体边界见 [清理记录集中归档](development.md#清理记录集中归档)。

- 发现完整逻辑体积超过15GB时优先启动深度瘦身，目标严格低于6GB；未触发深度分支时，日常超过10GiB清至8GiB或安全候选耗尽。方法见[深度瘦身方法论](deep-slimming-methodology.md)，具体口径、一次Apply与未达标处理见[分层容量规则](#容量触发与深度瘦身2026-10-15)；减少重复全盘统计和无关哈希，不扩大删除范围。

- 原始资料、正式存档、原素材及当前已验证完整EXE、内部载荷／清单和验收证据必须保留；用户明确要求清理历史内容时，历史版本的验收、试玩和界面截图可按清单全部删除，含独有画面与失败截图。保留文字结论、失败原因、版本／构建边界、逐文件哈希及删除记录，修复文档引用；素材原图和规则参考资料另行保留。Git 忽略、文件树隐藏、搜索与监听排除分别维护；被忽略不等于可删除，原始资料与最终产物仍保持文件树可见。

- 手动清理用 `scripts/Clean-Releases.ps1`／`scripts/Clean-Intermediates.ps1`，先预览、核对再 `-Apply`；先结束运行／验证，不绕过路径、进程、链接或近期修改保护。日常分支使用 `scripts/Maintain-Project.ps1 -Apply`，超过10GiB清到8GiB或安全候选耗尽；深度分支使用已审逐文件入口，不叠加日常第二次删除。保留依赖与工具缓存，未达标报告原因，不扩大范围或常驻轮询。

- 无损压缩用 `scripts/Compress-Workspace.ps1`，先预览、空闲时 `-Apply`；保留语义字节，跳过链接、嵌套仓库及审计范围外硬链接，逐文件哈希核验并留报告。物理节省与逻辑字节分开计量，NTFS 节省不计入便携包门禁；具体操作见 [开发环境](development.md)。

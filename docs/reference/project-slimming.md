# 项目瘦身方案与执行记录

## 电力公司布局交付收尾（2026-10-06）

同版本新ZIP通过实际便携核验后，KeepLatestOnly先预览再执行，删除两个已退出打包目录，共460,493,527逻辑字节（约0.43GiB）；当前运行ZIP、清单、历史发布EXE／source ZIP及验收证据受保护，见[清理记录](../../artifacts/maintenance/local-cleanup-20261005-180608-811-releases/cleanup.json)。首轮空闲自动维护实际计量22,003,251,312逻辑字节（约20.492GiB），安全候选0、保护／跳过73项；追加完整便携对局退出后的[最终水位](../../artifacts/maintenance/v1.0.2/power-grid-layout-20261006/final-maintenance.json)为23,444,356,311逻辑字节（约21.834GiB），安全候选0、保护／跳过76项。超10GiB且未达8GiB，候选耗尽后不扩大范围或删除素材／存档／当前证据。NTFS物理释放未测量。

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

清理顺序为 Clean-Releases 的已退出打包残留、显式退役历史包、已知隔离临时目录，均先预览后 Apply；最后空闲执行 Maintain-Project。[release 清理](../../artifacts/maintenance/local-cleanup-20261005-100131-440-releases/cleanup.json)删除 230,936,288 字节；[历史包清理](../../artifacts/maintenance/local-cleanup-20261005-100533-347-intermediates/cleanup.json)删除 121,697,794 字节；[40 个隔离目录清理](../../artifacts/maintenance/local-cleanup-20261005-100744-349-intermediates/cleanup.json)删除 19,056,787,081 字节。合计删除 19,409,421,163 逻辑字节，不通过手动递归删除绕过路径、链接、进程或近期保护。其他对话未提交的扩展草案、索引和增量构建方案不包含于本次提交。

最后空闲执行 [Maintain-Project 记录](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/final-maintenance.json)，工作区 5,388,318,267 逻辑字节（约 5.018 GiB），安全候选耗尽，未继续扩大范围。四处未识别的隔离构建／版本预览目录保留；原资料、当前证据、正式存档及工具／依赖缓存不删除，链接与嵌套仓库按规则排除。物理磁盘节省未单独测量，不能把逻辑删除量当作 NTFS 实际释放量。

## 宝可梦引导与动漫切入收尾（2026-10-05）

全部本轮原生验证退出后，先预览再执行受保护入口。`Clean-Releases.ps1 -KeepLatestOnly -MinimumAgeMinutes 0 -Apply` 删除两处已退出打包残留461,925,666字节，见 [release清理](../../artifacts/maintenance/local-cleanup-20261005-081210-006-releases/cleanup.json)，releases仅保留当前运行ZIP和逐文件清单；上一已验包及清单已冻结于本轮证据目录。

`Maintain-Project.ps1 -Apply` 删除140,540,184字节已过保护期的已知隔离验证目录，工作区从8,086,147,245降至7,945,615,176逻辑字节（约7.40GiB），见 [维护清单](../../artifacts/maintenance/local-cleanup-20261005-081317-284-maintenance/cleanup.json)。超过5GiB但安全候选耗尽；近期验证数据、证据、原素材、正式存档、依赖与工具缓存继续保护，没有降低保护时限或扩大清理范围。当前包实际解压95,163,216字节，工程预算超163,216字节但硬限制通过，NTFS节省不抵扣交付体积。

本页依据用户 2026-10-05 的清理与文档要求维护；合并深度检查完成后，用户又明确要求电力公司 agent 试玩、继续优化、导出 **v1.0.3** 并清理历史版本及临时文件。以下保留 v1.0.2 的历史执行数据，新交付另行审计；实际验收见 [验收记录](acceptance.md)，操作入口与安全保护见 [开发环境](development.md#清理本地中间物)。

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

新导出前，实际包 **95,582,529 字节**，超出 95 MB 工程预算。服务 CJS 仍保留大量可压缩的局部名称和语法；改用锁定版本 esbuild 的生产压缩，源码继续保留可读名称，资源不重编码，协议、存档格式与运行时版本不变。此变更需要重新运行完整服务与便携检查，不能仅凭编译成功交付。

v1.0.2 最终实际解压 **145 文件／94,941,528 字节**，减少 **641,001 字节**，95 MB 预算余 **58,472 字节**；ZIP **40,442,642 字节**。两项均严格低于 100,000,000 字节。SHA-256 为 `7b013ad0b9da74b862469bfddeecba36e0955672565c43bfc22d265a47cd5c68`。[冻结历史清单](../../artifacts/maintenance/v1.0.2/full-audit-20261005/delivery-manifest.json)记录全部文件大小及哈希。工作区 NTFS 压缩的物理节省不会计入此门禁。

## 工作区清理路径

先完成全部应用／构建／验证并确认退出，再预览清理，核对后 Apply。按顺序处理当前 releases 的打包残留、已知验证临时目录、显式历史包／可再生副本及重复截图；最后执行自动维护和无损透明压缩。

手动历史退役使用 `Clean-Intermediates.ps1 -RetiredGeneratedManifest <清单>`。清单必须绑定当前通过便携检查的 ZIP 哈希，逐项注明精确路径、类别、理由、完整文件大小／SHA-256 和保留证据路径／SHA-256。工具复核目录边界、链接、嵌套 Git、近期修改、进程、互斥及删除前内容；拒绝整个证据目录、平台存档、源码或不认识的类别。默认预览不写日志、不删除；自动维护不采用这一扩展范围。旧缓存限于无活动依赖的两个 Electron 缓存，不能推广为清空 .cache。

不通过手写递归删除绕过保护。存在链接、未知临时内容或唯一资料时，保留并记录原因；空间目标不能优先于资料完整性。剩余资料可用 NTFS 逐文件透明压缩，保持语义字节与 SHA-256，跳过范围外硬链接、链接目录、只读或无收益文件。

## 历史包退役

旧验收继续保留原哈希、大小、通过／失败、当时边界与清单。历史包链接转到同位置的 `.zip.retired.json`，说明旧包字节已按本次授权删除，并指向当前交付及完整退役清单。历史过程不得宣称旧包仍可下载，也不得把原通过结果升级为新包通过。

本次原始盘点、清理清单、工具检查与最终容量报告保存在 [专项证据目录](../../artifacts/maintenance/v1.0.2/full-audit-20261005/)。逻辑删除字节、按路径统计的工作区字节和按文件身份去重的 NTFS 物理节省分别计量；并行验证耗时不相加冒充总耗时。

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

[release 预览](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/releases-preview.log)与 [实际报告](../../artifacts/maintenance/cleanup-history/records/20261004-210601-029-releases.json)对应；打包目录先清理后，[中间物重新预览](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/intermediates-preview-after-release.log)和 [实际报告](../../artifacts/maintenance/cleanup-history/records/20261004-210826-855-intermediates.json)不重复计算目录。显式 `-MinimumAgeMinutes 0` 仅在确认本轮程序退出后使用，其余路径／进程／链接／指纹／当前通过包保护仍生效。保留包含依赖链接的旧隔离源码 `tmp/modern-art-isolated-build-BQZ0BZ`，不手写递归删除或删缓存达到容量目标。[收尾维护](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/maintenance-final.log)再次确认无安全候选，按路径统计剩余 **14,964,296,548 字节（约 13.937 GiB）**，跳过 1,338 个链接；后续证据／文档写入会使值小幅变化。原资料、独有证据、依赖及活动缓存使工作区仍超过阈值，不扩大删除范围。

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

[实际删除报告](../../artifacts/maintenance/cleanup-history/records/20261005-025431-850-intermediates.json)确认删除 **10,346 张图片／9,095,642,340 字节（约 8.471 GiB）**。[删除后复核](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/results.json)确认所有选定图片已不存在；**2,650 份保留图片**及 **3,178 份历史非图片文件**大小与修改时间未变，其中数据库／旁文件保留 28 项。当前 v1.0.3 ZIP 仍为 **40,443,579 字节**，SHA-256 仍为 `661bbf7fef4470355027dc4ab00eea3190b4637c793906d902021ed9be785f87`，本轮未导出或修改运行包。

[引用修复记录](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/link-repairs.json)将历史验收文档的两处图片链接改为退役清单并标注已清理，保留原审查结论；JSON 中的旧截图路径保留为当时记录，从本轮清单追溯退役状态。新增全量退役保护 **26 项**、共用手动清理 **200 项**、自动维护 **34 项**、同字节去重 **23 项**、历史可再生副本 **19 项**均通过，另检查 PowerShell 语法、文档链接、格式与 diff。执行命令和后续保护规则见 [开发环境](development.md#手动历史截图全量退役)。

[收尾维护](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/maintenance-final.log)测量工作区 **4,724,785,696 字节（约 4.400 GiB）**，已低于 5 GiB 启动阈值，不再触发清理；跳过 1,338 个链接，保留依赖、工具缓存、历史数据库与原始资料。该值为测量时逻辑文件字节，后续文档／审计写入会小幅增加；截图删除不改变当前运行 ZIP 的大小与内容。

## 清理记录集中归档（2026-10-05）

用户明确要求清理分散的 `local-cleanup-*` 文件夹。已结束的 **52 个清理记录目录与 1 个旧工具记录目录**，共 **1,982 文件／1,247,824,993 字节**，包含历史源码和迁移数据库，不能整体丢弃。先将全部原文件无损归档，再保留 **57 份原字节可读记录／11,082,758 字节**，逐文件核验后才移除旧目录。

[无损归档](../../artifacts/maintenance/cleanup-history/preserved-history-20261005.zip)为 **64,022,981 字节**，SHA-256 为 `ce556253a49954a47dc35254265219b3de4a1a59c47d155f9fedac9faf17d364`；成员保留原仓库相对路径。[逐文件索引](../../artifacts/maintenance/cleanup-history/index.json)记录原路径、字节、哈希、归档成员及可读位置。扣除 ZIP 和可读记录后净减少 **1,172,719,254 字节（约 1.092 GiB）**，新清单和审计文件会占用少量空间；不把这个逻辑字节数计作运行包缩减或 NTFS 压缩物理收益。

[显式清单](../../artifacts/maintenance/cleanup-history/consolidation-20261005/manifest.json)经[预览](../../artifacts/maintenance/cleanup-history/consolidation-20261005/preview.log)核对 **53 项、零跳过**，再通过既有手动入口执行。[实际操作记录](../../artifacts/maintenance/cleanup-history/operations/20261005-032020-397-intermediates/cleanup.json)与[删除后复核](../../artifacts/maintenance/cleanup-history/consolidation-20261005/results.json)确认旧目录全部移除、剩余 `local-cleanup-*` 目录为零，全部可读记录和保留 ZIP 哈希正确。保留当前 v1.0.3 运行 ZIP／清单，当前 ZIP 大小与 SHA-256 均未变化，未重新导出运行包。

[引用修复](../../artifacts/maintenance/cleanup-history/consolidation-20261005/link-repairs.json)更新 **4 份文档／26 个链接**，直接记录改指可读副本，归档成员改指恢复索引；旧 JSON 和日志内的原路径继续表达当时状态。清理工具新增全成员归档证明、可读报告保护及整理记录独立位置；仅对明确位于工程之外的独立 TableMax 成品排除误阻塞，不关闭用户程序，工程进程和未知路径仍受保护。

集中归档 **16 项**、共用手动清理 **200 项**、自动维护 **34 项**、同字节截图去重 **23 项**、可再生副本退役 **19 项**、历史截图退役 **26 项**共 **318 项隔离保护检查**通过。证据保存在[本轮审计目录](../../artifacts/maintenance/cleanup-history/consolidation-20261005/)，具体入口与恢复位置见[开发环境](development.md#清理记录集中归档)。

[文档与运行包检查](../../artifacts/maintenance/v1.0.3/cleanup-history-consolidation-docs/project-checks.json)核验 64 份 Markdown、1,392 个本地链接与 273 个章节锚点，零失败；PowerShell 语法与 diff 检查通过。[收尾维护](../../artifacts/maintenance/cleanup-history/consolidation-20261005/maintenance-final.log)测量工作区 **3,556,285,544 字节（约 3.312 GiB）**，低于 5 GiB 启动阈值，未追加删除；跳过 1,338 个链接。后续文档／审计写入会使字节数略有变化。

## 宝可梦人机与复用优化收尾（2026-10-05）

沿用 v1.0.3，最终运行 ZIP **40,452,032 字节**，实际解压 **94,975,611 字节**，95 MB 工程预算余 **24,389 字节**；哈希与实际便携／显示验收见 [当前验收](acceptance.md#103宝可梦人机能力演出与版本复用2026-10-05)。原素材、存档、当前及历史证据保留，没有导出源码包。

确认相关工程进程退出后，先预览再执行 `Clean-Releases.ps1 -KeepLatestOnly -Apply` 与 `Maintain-Project.ps1 -Apply`。[包清理记录](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/release-cleanup.log)为零候选、四个近期打包目录受保护；未降低默认 30 分钟保护。[维护预览](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/maintenance-preview.log)与[实际维护](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/maintenance-final.log)删除一处过期隔离验证目录 **17,253,310 字节**，[删除报告](../../artifacts/maintenance/local-cleanup-20261005-051210-835-maintenance/cleanup.json)保留路径和执行结果。

维护后测量 **15,080,820,415 字节（约 14.045 GiB）**，跳过 1,338 个链接，25 项受保护；安全候选已耗尽，仍超过 5 GiB。近期便携解压／验证目录、依赖与工具缓存等继续按既有保护保留，不扩大范围强删。逻辑文件字节不计作便携包或 NTFS 物理压缩节省。

## 宝可梦原创规则图解收尾（2026-10-05）

同版本九张新图合计 **347,266 字节**，替代当前导入的三张规则截图；旧图及全部原 PNG 留存。最终 ZIP **40,620,970 字节**、实际解压 **95,150,329 字节**，超过 95 MB 工程预算 **150,329 字节**，双 100 MB 硬门禁通过；实际哈希和便携验证见 [本次验收](acceptance.md#103宝可梦原创图文规则页2026-10-05)。上一已验包与清单复制到本次证据目录，历史通过结论仍绑定旧哈希。

工程进程退出后，[包清理预览](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/release-preview.log)及[执行](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/release-cleanup.log)均为零候选，一处近期打包目录继续保护。[维护预览](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/maintenance-preview.log)核验 18 处工作区 tmp 内过期隔离数据与便携解压目录，确认绝对路径及无目录链接后执行既有 `Maintain-Project.ps1 -Apply`。[实际报告](../../artifacts/maintenance/local-cleanup-20261005-060737-718-maintenance/cleanup.json)删除 **10,174,387,299 字节（约 9.48 GiB）**，正式存档、素材、当前及历史验收证据、已验运行包保留。

[收尾结果](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/maintenance-final.log)测量 **4,463,440,934 字节（约 4.157 GiB）**，跳过 1,338 个链接，六项继续保护，安全候选耗尽；已低于 5 GiB 启动阈值，未为降到 4 GiB 扩大范围。默认 30 分钟保护未降低，逻辑删除字节不计为运行包或 NTFS 物理压缩节省。

## 宝可梦扩展版续建收尾（2026-10-06）

本轮仍为本地v1.0.2，当前ZIP实际解压94,532,267字节，95MB工程预算剩467,733字节；服务Brotli内存恢复及Ogg主题音是实际运行文件减少，与工作区清理、NTFS物理节省分别计量。同包哈希和未完成素材边界见[验收](acceptance.md#102扩展版续建预算与同包复核2026-10-06)。

全部构建／测试／原生验证退出后，执行既有 `Maintain-Project.ps1 -Apply`，沿用最新10GiB启动／8GiB目标、30分钟保护及当前同哈希便携通过证据。[实际清理](../../artifacts/maintenance/local-cleanup-20261005-162230-673-maintenance/cleanup.json)删除4个过期打包中间目录，共931,114,824字节。原素材、视频参考、PCM原件、存档、当前已验ZIP、现有发布EXE／源码包和全部验收证据保留，未扩大到未知临时目录或依赖缓存。

开始实测18,920,901,565字节，清理报告统计17,989,786,741字节；报告写入后控制台实测17,989,805,273字节，均为逻辑文件字节。跳过1,346个链接，60项受保护，安全候选耗尽，剩余超过10GiB；后续文档／审计写入会略增加，不扩大删除范围或常驻轮询。

## 宝可梦前瞻修复与隔离交付收尾（2026-10-06）

本轮v1.0.2正式ZIP实际解压94,532,561字节，95MB余额467,439字节；仅宝可梦策略及隔离目录重新编译的原生启动器变更，其他187个运行文件与上一已验包相同。共享工作区同时修改的电力公司地图未纳入正式包，混合试包及上次已验ZIP／清单都保留在[本轮交付证据](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-delivery/)。相关统计、真正普通模式小局及同包边界见[验收](acceptance.md#102前瞻均值修复与普通模式同包续验2026-10-06)。

本轮构建／验收进程退出后执行 `Maintain-Project.ps1 -Apply`，[实际报告](../../artifacts/maintenance/local-cleanup-20261005-172021-441-maintenance/cleanup.json)删除2个过期打包中间目录，共461,024,004字节。开始21,478,087,986字节、结束21,017,083,413字节，跳过1,346个链接，安全候选耗尽；仍超过10GiB，不扩大清理范围。当前包、原素材、存档和证据保留，其他任务改动不提交。隔离工作树的正式包／清单、冻结快照及审计均已复制回项目证据目录，再申请可恢复归档；工作区逻辑字节与包体节省分别计量。

## 宝可梦三胜与叫声续验收尾（2026-10-06）

全部本轮测量、打包和原生验证结束后，执行 `Maintain-Project.ps1 -Apply`；[实际控制台记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-delivery/maintenance.json)为24,337,756,255字节（22.666GiB），零合格候选／零删除，跳过1,346个链接及86项保护。脚本未返回独立cleanup报告路径，保留实际数值，不伪造文件。当前同哈希已验ZIP、声画原件、页面、存档、历史证据及依赖缓存保留；超过10GiB且安全候选耗尽，不扩大清理或常驻轮询。

本轮工作树沿用最近完成提交123fbaf，旧forecast归档实际恢复返回“snapshot is missing”；已提交源码、原包和冻结清单仍保留，新matches工作树保持活动继续完整计划。原始27叫声270,112字节保留，运行派生99,544字节；有损音频编码减小运行包，与逻辑空间维护及NTFS物理压缩分别记录。当前解压94,653,981字节、95MB余346,019字节，模块4MiB仅余1,883字节，不能因此承诺62帧剩余姿态空间，详见[验收](acceptance.md#102扩展版三胜策略与叫声同包续验2026-10-06)。

## 普通收局与无损卡面续验收尾（2026-10-06）

火箭队原PNG保留，运行版采用RGBA逐字节一致的无损WebP，净省118,891字节；最新包实际解压94,535,185字节，95MB余464,815字节，其他游戏运行文件字节不变。这是包内格式节省，不计作新动作姿态或NTFS物理节省；依据见[最新验收](acceptance.md#102普通收局前瞻与无损卡面续验2026-10-06)。

首次受保护维护从29,073,057,216字节开始，删除1,499,244,900字节过期验证副本后，因主负责人同时启动格式检查触发忙进程保护停止；[失败报告](../../artifacts/maintenance/local-cleanup-20261005-185743-901-maintenance/cleanup.json)保留。格式检查退出后重新执行，[完整报告](../../artifacts/maintenance/local-cleanup-20261005-185842-758-maintenance/cleanup.json)从27,573,830,748字节降至27,427,299,128字节，删除剩余两候选146,548,225字节。当前已验ZIP、原素材、正式存档及历史验收记录保留；安全候选耗尽，仍超过10GiB，不扩大清理范围。两次真实集成超时的正式数据库保留，存档／日志增长没有在本轮解决。

2026-10-06火箭队估值／角色无损格式续验完成后，全部工程与验证进程结束，执行 `Maintain-Project.ps1 -Apply`：项目逻辑字节29,381,345,156，零合格候选，91项保护／近期内容跳过，删除零字节。仍超过10GiB，安全候选耗尽，未扩大清理范围；原素材、正式存档及当前已验包保留。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-ability-review-20261006/maintenance.json)与[同包审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-ability-review-20261006/final-checks.json)分别记录空间和交付门禁，不将NTFS节省计入运行预算。

2026-10-06梦幻模型源码续建后，所有测试／服务／测量进程结束再执行安全维护：逻辑字节30,178,343,748，零候选、93项保护／近期内容跳过，删除零字节，安全候选耗尽，未扩大范围。当前 `42205330…` 已验ZIP、正式存档及原素材保留；[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-mew-model-20261006/maintenance.json)对应本轮容量，源码领先运行包的边界见[接续](../tasks/pokemon-encounters-expansion.md#梦幻完整交换估值续建2026-10-06)。

2026-10-06闪电鸟接力源码续建后，所有工程／测量进程结束再执行安全维护：逻辑字节31,600,246,188，零候选、95项保护／近期内容跳过，删除零字节，安全候选耗尽，原素材、正式存档和 `42205330…` 已验ZIP保留。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-relay-model-20261006/maintenance.json)对应本轮实际容量，未扩大清理范围；源码尚未更新该ZIP的边界见[接力续建](../tasks/pokemon-encounters-expansion.md#闪电鸟完整接力预测续建2026-10-06)。

2026-10-06火箭队双面取牌／超梦来源源码续建后，相关测试与真实服务／Worker、格式检查全部退出，再执行安全维护：逻辑字节32,508,859,820，零候选、99项保护／近期内容跳过，删除零字节；安全候选耗尽，未扩大清理范围。正式存档、原素材与当前已验ZIP保留。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-coin-source-model-20261006/maintenance.json)和[接续](../tasks/pokemon-encounters-expansion.md#火箭队双面取牌与超梦来源续建2026-10-06)分别记录实际容量与源码尚未进入运行包的边界。

2026-10-06路卡利欧可选取牌／终局潜力续建后，所有测试与真实服务／Worker、格式工具退出再执行维护：逻辑字节35,164,180,098，零候选、101项保护／近期内容跳过，删除零字节，安全候选耗尽。原素材、正式存档、首次冻结失败报告与当前已验ZIP保留，未扩大清理范围。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-lucario-model-20261006/maintenance.json)对应本轮实际容量，[接续](../tasks/pokemon-encounters-expansion.md#路卡利欧可选取牌与终局估值续建2026-10-06)记录最终源码重跑与尚未更新ZIP的边界。

2026-10-06累积能力模型同包续验后，150种子、隔离构建／打包与实际原生／普通UI进程全部退出，再执行维护：逻辑字节35,222,690,518，零候选、106项保护／近期内容跳过，删除零字节，安全候选耗尽。当前 `79ace556…` ZIP和旧 `42205330…` ZIP、正式存档、原素材与本轮实际截图／失败记录均保留，未扩大范围。[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-combined-model-delivery-20261006/maintenance.json)给出实际容量，[同包审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-combined-model-delivery-20261006/final-checks.json)确认交付解压94,302,060字节，二者分开计量。

同轮 `Clean-Releases.ps1 -KeepLatestOnly` 预览为零候选；脚本除当前ZIP／清单外还明确保护已存在的同版本EXE与source ZIP（`cleanup-local.ps1` 的 `publishedFile` 保留分支），未执行删除或移动。两文件为本轮开始前已有产物，本轮只更新运行ZIP与清单，未重新生成或发布它们。记录进入上述维护JSON，未绕过保护强行收敛目录为两文件。

2026-10-06当前源码2–3人八种子三胜对照及分析／失配验证完成后、下一人数组启动前维护：逻辑字节35,223,908,812，零候选、108项保护／近期内容跳过，删除零字节，安全候选耗尽，未扩大清理范围。[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-analysis-20261006/maintenance.json)保留当前包、原素材、存档和完整对照证据。

四人八种子24场对照与分析退出、五人组尚未启动时执行维护：初次沙箱遍历拒绝访问且未改文件，正常权限重试后逻辑字节35,224,557,778，零候选、110项保护／近期内容跳过，删除零字节，安全候选耗尽。[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-matches/combined-source-holdout-4p-20261006/maintenance.json)保留本次权限边界及原素材、存档、当前包与全部对照证据，未扩大清理范围。

五人24场对照、来源请求、分析及格式工具均退出、六人组尚未启动时维护：逻辑字节35,225,296,315，零候选、114项保护／近期内容跳过，删除零字节，安全候选耗尽。[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-matches/combined-source-holdout-5p-20261006/maintenance.json)保留现有包、原素材、存档及完整对照／来源失败证据，未扩大范围。

六人测量、全人数合并／分析及格式工具全部退出后维护：逻辑字节35,228,844,777，零候选、115项保护／近期内容跳过，删除零字节，安全候选耗尽。[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-matches/combined-source-holdout-all-counts-20261006/maintenance.json)保留四份原报告、合并脚本与哈希、当前包、素材、存档及全部验收证据，未扩大范围。

循环自然观察、受控夹具、钩子恢复、测试与格式工具全部退出后维护：逻辑字节35,229,460,678，零候选、122项保护／近期内容跳过，删除零字节，安全候选耗尽。[记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-flow-audit-20261006/maintenance.json)保留原型失败、校验器拒绝的夹具原因、最终自然／受控结果、当前ZIP、素材与存档，未扩大范围。新文件仅测量用途，生产14文件与既有对照测量器哈希不变，不重复打包。

2026-10-06策略预算诊断全部退出后执行安全维护：逻辑字节35,229,993,411，零候选／零删除、127项保护或近期内容跳过、1,346个链接跳过，未发现嵌套仓库。安全候选耗尽后不扩大范围；当前ZIP、存档、原素材与所有诊断证据保留，见[维护记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-budget-diagnostic-20261006/maintenance.json)。

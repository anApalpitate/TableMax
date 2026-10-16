# 打包与交付

`pnpm package:win`增量构建并导出预装全部正式游戏与玩法的唯一完整EXE和本地清单；`pnpm package:release`只重新封装当前已验证内部载荷，不分配新修订号。`--edition`已退役并明确拒绝，部分游戏载荷不能交付。新构建EXE／sidecar按构建分组，历史交付按记录的精确路径读取，布局与旧路径边界见[目录职责](../../docs/reference/project-structure.md#交付文件布局与历史元数据)；内部payload／manifest／指针不随之移动，内部ZIP不是用户下载包。

本页维护打包、签名和推广的精确操作参数；当前已验交付及线上边界统一见[验收](../../docs/reference/acceptance.md#当前源码与本地交付)，产品发布规则见[Release流程](../../docs/reference/release.md)。

新安装器先用 `--candidate` 封包：正常新构建原子分配四位修订，失败编号不复用，但保留已有 `current.json`。stdout 返回 `candidatePath`；该记录冻结候选交付和原 current 的原始 SHA，同目录 `full/installer-delivery.json` 供描述生成及实际安装验收。`--platform-from` 按原快照身份及游戏缓存逐成员 SHA 保留正式游戏，只刷新当前平台和组装器并生成新快照、新修订；可跨公开版本，但新快照必须记录目标版本与 `retainedGameVersion`，保留原游戏来源证明。`--snapshot` 则恢复原冻结快照，不分配新修订。

平台变更而游戏未变时，使用下列占位参数保留原游戏单元；先核对实际冻结快照和内部游戏源，不能直接复制历史候选路径。完整冻结恢复使用 --snapshot，与生成新平台候选区分。

```powershell
node tools/release/package.mjs --candidate "--platform-from=<已核验冻结快照.json>" "--games=<该快照对应的完整内部游戏目录>"
```

跨公开版本时，目标内部目录使用新tag的catalog和build-record，不把旧tag目录直接当作新目录；原游戏单元、受信任历史玩法正文及blob ZIP逐项核验。正文除目标平台releaseTag外完全相同才复用原完整玩法记录及其releaseId／releaseTag，未变游戏不重新编译、改名或重压。玩法或可信来源不匹配即拒绝，不降级为未核验复用。

新公开版本尚无current时，双fixture准备显式指定旧正式current原件；不能临时改版本、假推广或在执行模式寻找来源回退。先完成目标版本源码和配方，提供目标Native依赖模板、server／web单元及全新证据目录：

```powershell
node tools/test/installation/verify-application-handoff.mjs --prepare-only "--source-pointer=<旧公开版本current.json原件>" "--native-template=<目标Native依赖目录>" "--server=<目标server单元files目录>" "--web=<目标box单元files目录>" "--evidence=<新准备证据目录>"
```

`--source-pointer`仅用于prepare-only，路径须在工作区且没有链接。准备先核原指针、完整EXE、payload、安装清单及快照的版本和SHA，报告记录原指针路径／字节数／SHA，每份fixture保留原始指针副本。prepared复验只使用这些冻结材料，不重新读取current选择来源；不传参数时仍按当前公开版本current选择。fixture Native／helper及安装配方来自当前源码／package版本，借用的只是原完整签名游戏与载荷基础，不构成新正式产品或系统验收。

封好最终 EXE 后，将下列占位符替换为实际新路径，显式读取候选的交付 JSON，避免读取仍保留旧交付的 current。描述绑定最终 EXE 大小／SHA、安装清单及 current 映射；签名工具从受保护文件读取独立应用 RSA 私钥，用仓库公开根自验，输出不覆盖既有审阅文件。

```powershell
node tools/release/installation-description.mjs "--delivery=<候选目录>/full/installer-delivery.json" "--out=<新描述.json>"
$env:TABLEMAX_APPLICATION_UPDATE_KEY_ID = 'tablemax-rsa-2026-01'
$env:TABLEMAX_APPLICATION_UPDATE_PRIVATE_KEY_FILE = 'secrets/application-update/release-rsa3072.pem'
node tools/release/sign-application-update.mjs "--description=<新描述.json>" "--notes=<已审人类说明.md>" "--out=<新完整正文.md>" "--envelope-out=<新签名JSON>"
```

installation-promote只接受同一候选的正式GUID证明，核对候选冻结时的原current SHA并原子切换，不重新分配修订。必需系统范围、隔离与容量要求统一见[验证规格](../../docs/reference/validation.md#完整安装与程序更新的证据分层)；fixture、helper-only及keep-installed诊断不能进入正式证明。

推广与发布共用 verifyInstallationAcceptance。实际保存／卸载后重装、容量口径及退出完成观察以[证明要求](../../docs/reference/validation.md#完整安装与程序更新的证据分层)为准；门禁纯测试不是系统验收。

```powershell
node tools/release/installation-promote.mjs "--candidate=<封包输出candidatePath>" "--proof=<最终正式proof.json>"
```

正式执行结束并成功清理账户／profile后，由[finalize-evidence](../test/README.md#正式执行记录与证明封存)只读核验execution receipt绑定的原始proof、隔离报告及完整方法源，并创建新proof。它不执行installer，不替代实际verifier CLI，也不授权推广；实际通过范围只在[验收](../../docs/reference/acceptance.md#当前源码与本地交付)维护。

签名、切换current与本地验收不代表发布授权；最终EXE字节变化须重新绑定SHA、验收与签名。账户与profile操作须另有明确授权，不能通过环境变量、改DACL或取消登记绕过系统证明。

前置条件是锁定工具链、有效预算、冻结输入和全部正式模块完整性。游戏仍独立组织、增量构建，内部签名模块按字节变化复用或生成；正式模板不计入当前游戏库。独立游戏导出、Pages准备／部署和安装型作者工具包导出已停止，保留文件仅说明内部实现或历史验证边界。

重封内部fixture时，先把release manifest原字节复制到本轮独立工作目录，再传给 createInstallationExecutable；工厂会在输入manifest旁写固定名installation manifest，不能把旧冻结目录作为可写输出。原sidecar覆盖事件与恢复摘要见[整理归档](../../docs/archive/tooling-delivery-organization-2026-10-15.md#fixture-sidecar覆盖与恢复)。

安装器在PrepareToInstall内显式提取并调用helper `--commit --progress`，成功健康确认后才交给Inno登记框架。进度协议是可选stdout行 `TABLEMAX-INSTALL-PROGRESS-V1|<phase>|<completed>|<total>`：snapshot／stage／switch的整数来自实际已完成文件检查／复制校验／切换，未知总量的提取和健康等待显示marquee。阶段计数不能作为总字节百分比或成功凭证；stderr、最终结果与退出码继续独立核验。省略 `--progress` 保持原JSON结果输出，其他helper操作不接受该选项；进度显示通道失败不改变事务或保存门禁。

本地程序使用四位 `1.x.x.y`，公开版本／附件使用三位 `1.x.x`，分配、冻结与发布映射见[版本流程](../../docs/reference/release.md#三位公开版本与四位本地构建2026-10-12)。只有获明确发布授权后才执行 `pnpm release:github -- --publish --notes=<已审文件>`，创建完整EXE与发布提交source ZIP两附件；本地导出和普通push不发布。

安装器发行先上传草稿，通过CLI的 `release view --json apiUrl`取得精确REST ID，再按ID核对正文及两附件后公开。若本次新建草稿在上传后中断，已核对其ID、标签、完整正文及两附件摘要后，可用同一命令追加 `--created-draft-id=<本次草稿ID>`接续；入口保留完整源码／证明／签名门禁，不重传附件、不删除其他版本，只有仍为草稿且内容完全一致才公开。该参数不能用于已发布Release，也不代替其他草稿的替换流程。冻结源码检查按64项分批传给Git，逐项覆盖全部输入，避免Windows命令行长度上限。

[构建与运行规范](../../docs/reference/build-and-run.md)维护运行和验收要求，[工具总索引](../README.md)用于按任务定位。内部辅助不是独立业务命令。

内部code／resource blob逐项复用：先由生产`verifyCatalog`与`readZip`核验项目公钥签名、schema、完整依赖闭包、归档SHA和全部成员。未变内容ID保留原可信ZIP字节，不因Node／zlib或压缩实现改变重压历史ID；新ID才压缩。缺失、损坏、签名不符、链接或非法成员拒绝，不能从失败的信任核验降级为复用。构建记录增加`blobReuse`，记录复用数量／字节、核验／压缩耗时、读取／写入实现指纹、Node／zlib版本、公钥指纹及原目录／归档SHA。

打包清单增加实际阶段`timings`：构建组装、内部模块准备与核验、物化、清单哈希、ZIP压缩、实际提取及EXE编译分别计时。本地EXE清单的总耗时含最终EXE封装；内部冻结payload清单只记录完成冻结时的payload耗时，避免事后修改嵌入EXE的清单。EXE、payload和实际提取三项体积与逐成员校验仍独立执行。

| 工具                                                                                              | 入口／用途                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [package.mjs](package.mjs)                                                                        | `pnpm package:win -- --candidate [--platform-from=<冻结快照>]`：封唯一完整安装器候选；保留已有 current                                                                                                                                   |
| [package-release.mjs](package-release.mjs)                                                        | `pnpm package:release`：当前完整载荷重封                                                                                                                                                                                                 |
| [package-limits.mjs](package-limits.mjs)                                                          | 完整交付与内部模块预算                                                                                                                                                                                                                   |
| [prepare-internal-games.mjs](prepare-internal-games.mjs)                                          | 从冻结单元准备内部签名游戏载荷                                                                                                                                                                                                           |
| [game-packages.mjs](game-packages.mjs)                                                            | 内部模块组装；直接独立导出拒绝执行                                                                                                                                                                                                       |
| [game-package-format.mjs](game-package-format.mjs)                                                | 签名目录与包格式纯辅助                                                                                                                                                                                                                   |
| [blob-reuse.mjs](blob-reuse.mjs)                                                                  | 生产信任与ZIP验证器驱动的逐blob复用                                                                                                                                                                                                      |
| [blob-reuse.test.mjs](blob-reuse.test.mjs)                                                        | `node --test tools/release/blob-reuse.test.mjs`；签名、目录、成员及历史字节反例                                                                                                                                                          |
| [game-release-assets.mjs](game-release-assets.mjs)                                                | 内部目录精确成员／哈希核验，兼容原历史资产                                                                                                                                                                                               |
| [catalog-history.mjs](catalog-history.mjs)                                                        | 内部签名历史合并及旧协议目录兼容                                                                                                                                                                                                         |
| [catalog-history.test.mjs](catalog-history.test.mjs)                                              | `node --import tsx --test tools/release/catalog-history.test.mjs`                                                                                                                                                                        |
| [windows-executable-name.mjs](windows-executable-name.mjs)                                        | 当前installer EXE命名及历史便携／box名称的显式识别                                                                                                                                                                                       |
| [release-executable.mjs](release-executable.mjs)                                                  | EXE封装辅助，由打包入口调用                                                                                                                                                                                                              |
| [installation-package.mjs](installation-package.mjs)                                              | 冻结完整载荷的Inno安装器、稳定入口和helper；正式产品ID固定，测试ID独立                                                                                                                                                                   |
| [installation-toolchain.mjs](installation-toolchain.mjs)、[锁定清单](installation-toolchain.json) | 项目缓存内准备6.7.3编译器，核对官方安装包、ISSigTool及逐文件SHA；不全局安装                                                                                                                                                              |
| [installation-fixture.mjs](installation-fixture.mjs)                                              | `--native=<目录> --server=<目录> --web=<目录>`；精确旧正式游戏＋显式新候选单元，生成独立测试产品完整安装器                                                                                                                               |
| [installation-verifier.mjs](installation-verifier.mjs)                                            | `--delivery=<交付JSON> --evidence=<新证明JSON>`；实际首装／同包复装／保存后默认卸载／同根重装读回／再次卸载与完整首次启动计量；卸载首段0后另核原EXE消失及日志独占可读；正式ID只在真实隔离账户下使用 `--isolated-windows`                 |
| [delivery-paths.mjs](delivery-paths.mjs)                                                          | 构建分组输出、历史精确路径及SHA校验，拒绝越界与链接；不递归猜测EXE                                                                                                                                                                       |
| [installation-evidence.mjs](installation-evidence.mjs)                                            | 保留runtime成员核验、容量清单与日志归档；实际产品执行由installation-verifier CLI编排                                                                                                                                                     |
| [installation-verifier.test.mjs](installation-verifier.test.mjs)                                  | `node --test tools/release/installation-verifier.test.mjs`；隐藏回环健康检查环境、卸载日志独占等待、保留 runtime 副本及篡改拒绝                                                                                                          |
| [installation-description.mjs](installation-description.mjs)                                      | `--out=<新JSON> [--delivery=<冻结交付JSON>]`；绑定实际installer和安装清单生成待签名描述                                                                                                                                                  |
| [sign-application-update.mjs](sign-application-update.mjs)                                        | `--description=<JSON> --notes=<更新说明MD> --out=<新发布正文MD> [--envelope-out=<新JSON>]`；私钥文件及keyId由进程环境 `TABLEMAX_APPLICATION_UPDATE_PRIVATE_KEY_FILE`／`TABLEMAX_APPLICATION_UPDATE_KEY_ID`传入，内置公钥自验；不上传私钥 |
| [installation-publication.mjs](installation-publication.mjs)                                      | current 切换与发布共用正式安装验收门禁；核验隔离账户清理报告、精确 installer／manifest／映射及发布正文 RSA；正式发布仍需授权                                                                                                             |
| [installation-publication.test.mjs](installation-publication.test.mjs)                            | `node --test tools/release/installation-publication.test.mjs`；正式证明与 RSA 绑定、错误身份／字节／映射／隔离证明拒绝                                                                                                                   |
| [installation-promote.mjs](installation-promote.mjs)                                              | `--candidate=<候选记录JSON> --proof=<正式证明JSON>`；完整验收后锁定原 current SHA 并原子切换；不重新分配修订                                                                                                                             |
| [installation-promote.test.mjs](installation-promote.test.mjs)                                    | `node --test tools/release/installation-promote.test.mjs`；精确候选、陈旧 current、证明篡改、容量与隔离门禁                                                                                                                              |
| [verify-release-executable.mjs](verify-release-executable.mjs)                                    | 指定EXE提取核验，参数见源码                                                                                                                                                                                                              |
| [verify-shipping-executable.mjs](verify-shipping-executable.mjs)                                  | 当前完整交付验证入口；installer 要求实际隔离验收，拒绝便携 `--extract-only`；历史便携交付仍按原协议核验                                                                                                                                  |
| [publish-release.mjs](publish-release.mjs)                                                        | 获授权后发布完整EXE与source ZIP                                                                                                                                                                                                          |
| [prepare-pages.mjs](prepare-pages.mjs)、[verify-pages.mjs](verify-pages.mjs)                      | 已退役独立分发入口，明确拒绝执行                                                                                                                                                                                                         |
| [prepare-pages-history.mjs](prepare-pages-history.mjs)                                            | 原Pages历史合并实现；无现行导出入口                                                                                                                                                                                                      |
| [verify-game-packages.mjs](verify-game-packages.mjs)                                              | 内部签名模块、闭包与逐文件核验                                                                                                                                                                                                           |
| [verify-pages-install.mjs](verify-pages-install.mjs)                                              | 原Pages安装体系历史验证，不认证现行产品入口                                                                                                                                                                                              |
| [verify-version-adaptability.mjs](verify-version-adaptability.mjs)                                | 原双版本与稳定目录的精确恢复历史验证                                                                                                                                                                                                     |
| [verify-windows-editions.mjs](verify-windows-editions.mjs)                                        | 原full／box交付组合历史验证                                                                                                                                                                                                              |

历史双版本、线上目录及安装型作者工具包通过记录只限定原构建，不代替当前完整EXE验收。SDK、模板和源码接入继续维护，见[游戏开发指南](../../docs/reference/game-development.md)。

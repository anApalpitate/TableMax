# 打包与交付

`pnpm package:win`增量构建并导出预装全部正式游戏与玩法的唯一完整EXE和本地清单；`pnpm package:release`只重新封装当前已验证内部载荷，不分配新修订号。`--edition`已退役并明确拒绝，部分游戏载荷不能交付。EXE在 `artifacts/releases/`，内部payload ZIP、manifest和当前指针在 `artifacts/package-payloads/`；内部ZIP不是用户下载包。

截至2026-10-15，current为便携1.0.6.10；安装候选1.0.6.14原字节保留、尚未推广或发布。[冻结delivery](../../artifacts/package-payloads/v1.0.6/ff8eb35cb3f0-9mGOFX/full/installer-delivery.json)的EXE SHA为 `48cb4a6e2bc80ee409e41afd68356b684e0a949e17735b0d05c4f4be27bf4396`。后续源码已通过下载／清理组件和真实活跃卸载；I198默认深D的控制器超时与同I短外D成功分别保留。新的完整Apply／框架／正式系统链和修复后新候选尚待闭合；[验收](../../docs/reference/acceptance.md)记录精确来源及失败，账户／profile均已清理。达到三失败停止原run，实质修复后按原验证规则定向复验，不另设用户审批门槛。

新安装器先用 `--candidate` 封包：正常新构建原子分配四位修订，失败编号不复用，但保留已有 `current.json`。stdout 返回 `candidatePath`；该记录冻结候选交付和原 current 的原始 SHA，同目录 `full/installer-delivery.json` 供描述生成及实际安装验收。`--platform-from` 按原快照身份及游戏缓存逐成员 SHA 保留正式游戏，只刷新当前平台和组装器并生成新快照、新修订；`--snapshot` 则恢复原冻结快照，不分配新修订。

候选14已按下列命令从候选13保留同一31个游戏单元，显式使用原内部签名游戏源，避免误用另一份game-packages/current。后续新代码封包仍先candidate，以下保留该轮输入说明，不自动重复构建。任务期间关闭逐项维护，已有一次安全维护不追加第二轮。

```powershell
$env:TABLEMAX_AUTO_MAINTENANCE = '0'
$env:TABLEMAX_TEST_MAINTENANCE = '0'
pnpm package:win -- --candidate --platform-from=build/snapshots/4e4f4f05f0a938f831d5f5da406b76c88e6f0f8d7db25d29077d743aa7cb1ade.json --games=artifacts/package-payloads/v1.0.6/internal-games-MdGykg
```

封好最终 EXE 后，将下列占位符替换为实际新路径，显式读取候选的交付 JSON，避免读取仍保留旧交付的 current。描述绑定最终 EXE 大小／SHA、安装清单及 current 映射；签名工具从受保护文件读取独立应用 RSA 私钥，用仓库公开根自验，输出不覆盖既有审阅文件。

```powershell
node tools/release/installation-description.mjs "--delivery=<候选目录>/full/installer-delivery.json" "--out=<新描述.json>"
$env:TABLEMAX_APPLICATION_UPDATE_KEY_ID = 'tablemax-rsa-2026-01'
$env:TABLEMAX_APPLICATION_UPDATE_PRIVATE_KEY_FILE = 'secrets/application-update/release-rsa3072.pem'
node tools/release/sign-application-update.mjs "--description=<新描述.json>" "--notes=<已审人类说明.md>" "--out=<新完整正文.md>" "--envelope-out=<新签名JSON>"
```

`installation-promote` 只接受同一候选的正式产品 GUID 完整证明：真实干净标准 Windows 账户的首装、同包重复安装、登记与快捷方式、完整首启动体积、默认卸载、卸载后保留 runtime 精确副本，以及新账户／profile 清理成功的原始报告。容量须包含当前必需G物化、helper及框架卸载文件，不能用程序暂存替代。隔离标志、测试 GUID、仅 helper 健康、只读闭包、向导取消或 `--keep-installed` 诊断均不能替代此证明；不同PE实际更新另须真实Apply链。候选冻结后原 current 的 SHA 必须仍匹配；完整验收通过后，按已授权完整交付范围原子切换，不再分配修订。

推广和未来发布共用 `verifyInstallationAcceptance`：还要求真实保存数据→默认卸载→同根重装读回→再次默认卸载，不能用卸载前的同包重装替代。容量分列实际安装文件／框架／清单与当前G的同次测量；installer返回前已完成健康启动，不能把该采样写成prestart。历史模块、存档、缓存、事务及临时目录另记录观测值，`maxObserved`只表示采样下界，不称绝对峰值。门禁纯测试不等于系统验收已通过。

```powershell
node tools/release/installation-promote.mjs "--candidate=<封包输出candidatePath>" "--proof=<最终正式proof.json>"
```

签名、切换current和本地验收不代表发布授权；最终EXE字节变化须重新计算SHA、验收与签名。临时标准账户及UAC已授权，真实profile、登记和完整系统证明仍必需；当前新候选包含恢复和内嵌解码修复，标准用户首装的工程Low标签问题改用经授权的普通测试目录验收，不通过环境变量、改DACL或取消系统登记绕过。发布边界见[验收](../../docs/reference/acceptance.md)与[Release流程](../../docs/reference/release.md)。[一次安全维护](../../artifacts/maintenance/v1.0.6/installation-remaining/maintenance-once/result.json)已结束，不追加第二轮。

前置条件是锁定工具链、有效预算、冻结输入和全部正式模块完整性。游戏仍独立组织、增量构建，内部签名模块按字节变化复用或生成；正式模板不计入当前游戏库。独立游戏导出、Pages准备／部署和安装型作者工具包导出已停止，保留文件仅说明内部实现或历史验证边界。

重封内部fixture时先把release manifest按原字节复制到本轮独立工作目录，再传给 `createInstallationExecutable`；该工厂会在输入manifest旁写出固定名称的installation manifest，不能复用旧冻结目录作为可写输出。2026-10-15一次旧tmp sidecar覆盖已按原SHA恢复，原ZIP／release manifest／EXE未变，原失败保留于[轮次记录](../../artifacts/maintenance/v1.0.6/installation-remaining/account-round-20261015.json)。

本地程序使用四位 `1.x.x.y`，公开版本／附件使用三位 `1.x.x`，分配、冻结与发布映射见[版本流程](../../docs/reference/release.md#三位公开版本与四位本地构建2026-10-12)。只有获明确发布授权后才执行 `pnpm release:github -- --publish --notes=<已审文件>`，创建完整EXE与发布提交source ZIP两附件；本地导出和普通push不发布。

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
| [windows-executable-name.mjs](windows-executable-name.mjs)                                        | 当前无后缀EXE命名及历史双格式识别                                                                                                                                                                                                        |
| [release-executable.mjs](release-executable.mjs)                                                  | EXE封装辅助，由打包入口调用                                                                                                                                                                                                              |
| [installation-package.mjs](installation-package.mjs)                                              | 冻结完整载荷的Inno安装器、稳定入口和helper；正式产品ID固定，测试ID独立                                                                                                                                                                   |
| [installation-toolchain.mjs](installation-toolchain.mjs)、[锁定清单](installation-toolchain.json) | 项目缓存内准备6.7.3编译器，核对官方安装包、ISSigTool及逐文件SHA；不全局安装                                                                                                                                                              |
| [installation-fixture.mjs](installation-fixture.mjs)                                              | `--native=<目录> --server=<目录> --web=<目录>`；精确旧正式游戏＋显式新候选单元，生成独立测试产品完整安装器                                                                                                                               |
| [installation-verifier.mjs](installation-verifier.mjs)                                            | `--delivery=<交付JSON> --evidence=<新证明JSON>`；实际fixture首装／复装／默认卸载与完整首次启动计量；正式ID只在真实隔离账户下使用 `--isolated-windows`                                                                                    |
| [installation-verifier.test.mjs](installation-verifier.test.mjs)                                  | `node --test tools/release/installation-verifier.test.mjs`；隐藏回环健康检查环境、卸载后保留 runtime 副本及篡改拒绝                                                                                                                      |
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

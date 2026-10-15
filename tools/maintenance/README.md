# 构建与验证自动维护

容量分支按[工作区维护](../../docs/reference/workspace-maintenance.md#容量触发与深度瘦身2026-10-15)选择：完整逻辑体积超过15,000,000,000字节时优先启动人工深度审计，目标严格低于6,000,000,000字节；未触发时沿用日常10GiB／8GiB或安全候选耗尽。完整口径包含根Git和实际嵌套仓库、不跟随链接；现有日常容量扫描跳过嵌套仓库，须补计后再判断深度门槛，不能相减不同口径。工具参数尚未改为自动15GB触发，也没有常驻监控。

每个父轮只执行一次安全维护流程，既有缓存、登记产物及日常容量阶段统一收尾；深度分支使用已审逐文件入口，不先跑日常删除再补深度删除。2026-10-15安装任务的一次实际结果见[瘦身记录](../../docs/reference/project-slimming.md#windows安装交付任务单次维护2026-10-15)，后续正式安装验收不追加本轮清理。

## 人工深度瘦身

精确生成根也可为单个普通文件；仍逐文件执行全部保护。目录不能冒充文件，未列兄弟成员不受影响。

`scripts/Clean-Intermediates.ps1 -ReviewedFilesManifest <maintenance内清单>` 是人工审计后的单次入口，不参与自动维护。预览打印清单SHA，Apply必须另传 `-ReviewedFilesManifestSha256 <相同SHA>`；只删除清单列出的普通生成文件，空目录仅在无未列成员时移除。跨临时、旧载荷、隔离运行和历史图的清单统一绑定当前交付、保护前缀／文件、来源引用和入链目标，每文件核验SHA、字节、修改时间、路径、祖先链接和嵌套仓库，并保留进程、30分钟与互斥门禁。

清单 `version: 1`、`authorization: retire-reviewed-generated-once`、唯一 `id`、`currentVersion`、`currentArchiveSha256`、`protectedPrefixes`、`protectedFiles`、`references`、`links` 及 `entries`。每项为精确生成根 `path`、`origin`（`generated-copy`／`isolated-test`／`retired-cache`）、来源说明 `reason` 和普通 `files`（`path`、`bytes`、`lastWriteTimeUtcTicks`、`sha256`）。测试库仅允许已证实隔离的 `isolated-test`；正式数据、原件、源码、签名模块仓库与当前交付不得列入。记录在 `artifacts/maintenance/reviewed-retirements/<id>.json`，开始即消耗ID，部分失败也不复用、重试或追加第二轮，不创建恢复副本。

经独立核验的编译／组装输出可在同一精确清单中选择 `build/desktop`、`build/native`、`build/native-obj`，仅接受 `generated-copy`。必须在 `references` 绑定未变的 `build/snapshots/latest.json` 和完整64位SHA命名的冻结快照；冻结快照、未知build目录、依赖／工具缓存及未列成员不进入清理。仍逐文件核验来源、SHA、近期修改、进程与路径，不能仅凭目录名选择所有成员。

历史机器报告或冻结快照需要保留完整内容时，文件可带 `preservedArchive`（永久maintenance ZIP的`path`／`sha256`，与原文件路径完全相同的`entryPath`）。ZIP必须同时登记为 `references`，工具逐成员解压核验原字节及SHA，删除期间持续绑定归档哈希。`build/snapshots`只接受64位SHA命名的历史JSON及assembly JSON，且必须提供此完整归档证明；latest、当前引用快照、未知名称及未列文件保留。历史ID复查前按原路径还原相应归档成员，当前启动和旧局恢复无需还原；临时副本仍直接退役，不为待删文件创建备份。

内部实现 [reviewed-files.ps1](reviewed-files.ps1)，隔离回归 [reviewed-files.test.ps1](reviewed-files.test.ps1)：`powershell.exe -NoProfile -File tools/maintenance/reviewed-files.test.ps1`。范围和本次容量目标见[开发环境](../../docs/reference/development.md#跨目录精确文件退役2026-10-12)。

2026-10-11验收去重：version 2统一计划关闭子检查自动维护，结束后只尝试一次父轮收尾；多阶段同任务使用`TABLEMAX_AUTO_MAINTENANCE=0`并最后统一维护。当前完整EXE的证明直接定位到指针snapshot下的shipping报告，读取历史双格式时仍逐项匹配，缺失或哈希不符即拒绝，不回退历史全树查找。缓存预览`--plan=<精确JSON>`生成SHA绑定候选，Apply必须提供同一路径和`--plan-sha256=<预览SHA>`；保留引用变化即停止，删除前仍复核进程、锁、路径、链接、近期修改和成员哈希。旧无plan命令保留兼容行为。计时分开记录交付证明、缓存库存、成员校验、进程查询和容量／退役；没有旧分类数据时不拆算旧总耗时。

新增内部辅助为[cache-plan.mjs](cache-plan.mjs)，其隔离回归`node --test tools/maintenance/cache-plan.test.mjs`检查清单损坏、引用变化、重复／越界／保留候选拒绝。

当前交付读取（兼容2026-10-11的full／box历史格式）：`current-delivery.ps1`与 `current-delivery.mjs`读取 `artifacts/package-payloads/v<版本>/current.json`，核对当前唯一完整EXE、内部payload与manifest的路径、大小和SHA。历史双指针仍逐项核对；清理额外要求匹配实际EXE通过证明（`executableSha256`与 `payloadSha256`），缺项即停止。installer还须精确绑定正式产品身份、安装清单及完整首启动体积的真实隔离安装证明；封包候选或测试身份不能代替。当前内部载荷及指针、待验收冻结候选与双PE素材继续保护；已有同版旧单EXE／ZIP和发布源码仍保留。当前current为正式验收通过的1.0.6.18完整安装器，维护门禁已实际核验其规范proof与内部载荷；未发布13–16候选已在独立深度维护中退役，原报告／逐文件SHA及剩余范围见[瘦身记录](../../docs/reference/project-slimming.md#深度瘦身与剩余空间2026-10-15)，不能按历史候选路径假定旧字节仍在。

2026-10-10 已接入。构建、运行包导出，以及使用公共浏览器／桌面验证助手的检查，在 Node 进入最终空闲阶段时执行一次隐藏收尾任务，同一进程只触发一次。构建、验证和产品工作已结束，协调 Node 等待维护完成再退出，避免执行环境回收脱离的子进程。没有常驻任务、周期轮询或结束用户进程的动作。

任务日志与结果在 `artifacts/maintenance/v<当前版本>/automatic-maintenance/<本轮>/`；命令结束会打印具体目录。先检查 `result.json`，阻塞原因及预览见 `task.log`。正常 Windows 环境中生效；沙箱不能查询进程时保留并报告。没有匹配当前完整EXE和payload双哈希的实际通过证明时，不执行自动删除；旧ZIP证明仅用于历史格式。

## 执行顺序

以下为未触发深度分支的日常流程；已选择深度分支时只审计并使用前述人工单次入口，不叠加执行此流程。

1. 检查工程进程。仅豁免通过命令、创建时间、实际父子关系和空闲记录核验的收尾协调者及其等待中的 npm／pnpm 父进程，其他构建／验证／产品进程继续阻止清理。核对当前完整EXE、内部payload与同snapshot实际通过证明；历史ZIP按原格式核验。
2. 预览并修剪过期模块缓存，保护当前开发／交付引用、每单元最近两份成功产物、活动锁／工作目录，以及全部成员的30分钟近期修改。
3. 读取成功验证登记的临时目录。近期内容记录跳过，不重复哈希；到期后冻结精确成员／SHA-256，审查文档引用，生成 `retirement-plan.json`。
4. 通过现有 `cleanup-local.ps1` 先预览、再执行登记产物清理。只支持专用生成目录，保留当前交付证明、进程、路径／链接／嵌套仓库、清单与结果哈希、内容变化、30分钟及互斥保护。
5. 执行原有 `scripts/Maintain-Project.ps1 -Apply`，超过10GiB才进行更广瘦身，目标8GiB或安全候选耗尽。模块缓存与明确登记的临时产物不等待容量门槛。

保护未到期或其他进程正在运行时，等下一次构建／验证或手动收尾，不自动重试。阻塞不会把构建或验证结果改为失败，但维护结果会明确记录 `blocked`。构建异常另保存在 `artifacts/maintenance/v<版本>/build-failures/`，不覆盖当前通过快照。

## 截图与产物归属

目前 UNO、阿瓦隆、盒子座位／布局与拉密 UI 验证登记产物，其余旧产物不从目录名猜测用途。通过结果、代表截图、规则／素材原件、正式存档与当前交付继续保留。失败验证不登记可退役目标，保留定位现场。验证登记在 `artifacts/maintenance/v<版本>/artifact-runs/`，仅证明该次验证拥有对应临时生成目录；成员哈希在空闲收尾时冻结，并在删除前复核。

所有保存验证截图的入口已接入共享策略。UNO／阿瓦隆、盒子布局和拉密 UI 沿用既有 `representative`；现代艺术画廊／打磨、电脑显示／玩家显示、宝可梦布局／重设计及阶段 UI 矩阵也在拍摄前筛选成功代表。完整布局与行为断言照常执行，保留状态、端侧、人数／牌架数量、窄屏／短横屏／4K、缩放和实际 DPI；同组更窄或更短的画面再次捕获，不能被较宽代表覆盖。关键验收和失败保持原尺寸 PNG。盒子联系表改为按需加载原图的 HTML，不再复制成 PNG 或嵌入 base64。

普通盒子 QR／拉密封面预览和 `all` 模式的额外 `process/` 图采用 WebP 品质90，不覆盖原素材，不降低渲染尺寸。预览有损，不能替代精细或 DPI 验收。共享 writer 返回实际后缀，`previewEncodings` 记录原 PNG／WebP 的 SHA、字节、尺寸、品质与编码器；相同内容仅在同种用途之间引用永久文件，`screenshotAliases` 记录实际保留文件 SHA。两种节省分别计量，不能重复相加。预览依赖 Python 与锁定的 Pillow 11.1.0／WebP，见[编码器](../assets/README.md)；缺失时保留明确失败原因，不静默降级。

其余入口使用[截图助手](../test/support/screenshots.mjs)，普通原型美术预览及额外逐步走查保存 WebP90，未知用途默认关键 PNG。普通预览、代表、关键与失败须显式区分，不能仅据工具名称降质。各输出目录的 `screenshot-index.json` 记录实际路径、用途、尺寸／SHA、预览编码及拍摄前跳过的请求；报告引用返回的实际路径。代表丢失或被覆盖时重新捕获。旧报告中的关键 PNG 路径继续有效；生成规则素材的三个显式函数保持原 PNG 捕获，不接入预览筛选。

新增截图须使用公共入口，禁止直接保存 Playwright 截图；[入口覆盖回归](../test/support/screenshots.test.mjs)检查所有验证源码及明确的素材例外。公共层回归同时核验真实隐藏浏览器、原 Buffer／捕获选项契约、WebP90、关键／失败 PNG、路径、不同状态／端侧／人数／DPI／缩放及更窄／短边界。截图接入不扩大自动退役白名单；未登记的旧目录与额外 `process/` 图片仍须人工审计，默认代表模式避免生成它们。

```powershell
# 可选：完整矩阵。代表 PNG 永久保留，额外画面以 WebP90 归 process/。
$env:TABLEMAX_TEST_SCREENSHOTS = 'all'
node tools/test/games/uno/verify-uno.mjs --sample --layout-only --seats=2 --evidence=my-debug-run
Remove-Item Env:TABLEMAX_TEST_SCREENSHOTS

# 特殊检查期间暂时关闭自动收尾，仅影响当前进程环境。
$env:TABLEMAX_AUTO_MAINTENANCE = '0'
node tools/build/build.mjs --only=platform
Remove-Item Env:TABLEMAX_AUTO_MAINTENANCE
```

登记后的生成目录由维护流程管理，不用它存放个人资料。当前未登记的历史截图、冻结源码、研究资料和未知目录继续保留；要退役须先审计。`node.exe` 只随已确认结束的生成目录或过期模块缓存清理，正式包、当前构建及开发工具缓存保留。Node 构建指纹入口为 `tools/build/node-runtime-inputs.mjs`，仅取目标版本／架构／锁定校验值及运行时准备实现。

## 手动执行与回归

在工程空闲时从项目根目录执行同一流程，输出必须是本项目维护目录：

```powershell
$taskOutput = Join-Path (Get-Location) ('artifacts/maintenance/v1.0.6/automatic-maintenance/manual-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $taskOutput | Out-Null
& tools/maintenance/finish-task.ps1 -OutputDirectory $taskOutput
node --test tools/maintenance/maintenance.test.mjs
```

单次报告保留结果、跳过原因及精确退役清单，旧清理记录按项目既有退役规则处理。测试覆盖指纹稳定性、截图选取／精确复用、失败保留、文档引用、近期／变更保护，以及隔离夹具中的真实预览和删除；不代表重新验收运行包或整局游戏。

## 手动与专项工具索引

`tmp/` 不保存恢复归档；已结束的一次性脚本、源码快照、旧包、日志、测试数据及低频候选经审计可删除。`-TemporaryNames` 仍只选择精确直属项，但不再复制待删内容。含链接或混合内容时，`scripts/Clean-Intermediates.ps1 -TemporaryManifest <maintenance内清单>` 先预览，再 `-Apply`，只删列出的普通文件并清除空目录；链接、链接目标和新增文件原位保留。同一清单ID一旦开始执行即永久消耗，失败或部分删除也不自动重试。当前交付证明、30分钟、进程、路径、嵌套仓库、文件变化和共享互斥继续生效；只留简明结果，不归档文件字节。格式与单次范围见[开发环境](../../docs/reference/development.md#tmp-临时内容的生命周期2026-10-11)。

已审查的旧候选包图、重复矩阵和与源资产完全相同的生成副本使用 `scripts/Clean-Intermediates.ps1 -ImageCopiesManifest <maintenance内清单>`，先预览后 `-Apply`。清单须绑定当前内部载荷SHA、保护文件和保留报告；源副本须与 `assets/` 原件字节／SHA 一致。仅处理列出的图片，保留目录、报告、源码、存档、独有失败和关键代表，不纳入自动维护。只接受工具内明确核验过的旧 UNO／拉密目录与生成 bundle/assets 子路径；新增类别先审计并补隔离回归。哈希、文档引用、路径／链接／嵌套仓库、30分钟、进程和互斥保护仍有效。详见[开发环境](../../docs/reference/development.md#清理本地中间物)。

日常清理优先使用 `scripts/Clean-Releases.ps1`、`scripts/Clean-Intermediates.ps1`、`scripts/Maintain-Project.ps1`，压缩使用 `scripts/Compress-Workspace.ps1`。入口参数保持不变；手动先预览，核对后才 `-Apply`。

`retire-old-local-runtime.ps1` 只处理有迁移证明的旧用户运行目录，仍为显式专项工具，不纳入自动清理。历史截图／旧清单工具保留精确清单与证据保护；名称带历史不代表可直接删除。`verify-project.mjs` 检查文档、配置和交付清单，写证据报告，不修改EXE或内部载荷。

| 工具                                                                             | 入口／用途                                                                                           |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [clean-build-cache.mjs](clean-build-cache.mjs)                                   | `node tools/maintenance/clean-build-cache.mjs`                                                       |
| [cleanup-guard.ps1](cleanup-guard.ps1)                                           | 内部辅助；由清理入口加载                                                                             |
| [cleanup-history.ps1](cleanup-history.ps1)                                       | 内部辅助；由清理入口加载                                                                             |
| [cleanup-history.test.ps1](cleanup-history.test.ps1)                             | 工具隔离回归：`powershell -NoProfile -File tools/maintenance/cleanup-history.test.ps1`               |
| [cleanup-local.ps1](cleanup-local.ps1)                                           | `powershell -NoProfile -File tools/maintenance/cleanup-local.ps1`                                    |
| [cleanup-local.test.ps1](cleanup-local.test.ps1)                                 | 工具隔离回归：`powershell -NoProfile -File tools/maintenance/cleanup-local.test.ps1`                 |
| [compress-workspace.ps1](compress-workspace.ps1)                                 | `powershell -NoProfile -File tools/maintenance/compress-workspace.ps1`                               |
| [compress-workspace.test.ps1](compress-workspace.test.ps1)                       | 工具隔离回归：`powershell -NoProfile -File tools/maintenance/compress-workspace.test.ps1`            |
| [coordinator.test.mjs](coordinator.test.mjs)                                     | 工具隔离回归：`node --test tools/maintenance/coordinator.test.mjs`                                   |
| [duplicate-screenshots-cleanup.test.ps1](duplicate-screenshots-cleanup.test.ps1) | 工具隔离回归：`powershell -NoProfile -File tools/maintenance/duplicate-screenshots-cleanup.test.ps1` |
| [finish-task.ps1](finish-task.ps1)                                               | `powershell -NoProfile -File tools/maintenance/finish-task.ps1 -OutputDirectory <维护证据目录>`      |
| [historical-screenshots.ps1](historical-screenshots.ps1)                         | 内部辅助；由清理入口加载                                                                             |
| [historical-screenshots.test.ps1](historical-screenshots.test.ps1)               | 工具隔离回归：`powershell -NoProfile -File tools/maintenance/historical-screenshots.test.ps1`        |
| [image-copies.ps1](image-copies.ps1)                                             | 内部辅助；由 `scripts/Clean-Intermediates.ps1 -ImageCopiesManifest <清单>` 加载                      |
| [image-copies.test.ps1](image-copies.test.ps1)                                   | 隔离回归：`powershell -NoProfile -File tools/maintenance/image-copies.test.ps1`                      |
| [lifecycle.mjs](lifecycle.mjs)                                                   | 内部辅助；由构建／验证入口调用                                                                       |
| [maintenance.test.mjs](maintenance.test.mjs)                                     | 工具隔离回归：`node --test tools/maintenance/maintenance.test.mjs`                                   |
| [screenshot-preview.test.mjs](screenshot-preview.test.mjs)                       | 编码、关键 PNG、选择边界与实际别名回归：`node --test tools/maintenance/screenshot-preview.test.mjs`  |
| [project-maintenance.test.ps1](project-maintenance.test.ps1)                     | 工具隔离回归：`powershell -NoProfile -File tools/maintenance/project-maintenance.test.ps1`           |
| [registered-artifacts.ps1](registered-artifacts.ps1)                             | 内部辅助；由清理入口加载                                                                             |
| [retire-old-local-runtime.ps1](retire-old-local-runtime.ps1)                     | `powershell -NoProfile -File tools/maintenance/retire-old-local-runtime.ps1`                         |
| [retired-generated.ps1](retired-generated.ps1)                                   | 内部辅助；由清理入口加载                                                                             |
| [retired-generated.test.ps1](retired-generated.test.ps1)                         | 工具隔离回归：`powershell -NoProfile -File tools/maintenance/retired-generated.test.ps1`             |
| [reviewed-files.ps1](reviewed-files.ps1)                                         | 人工跨目录精确清单内部实现，由 `Clean-Intermediates.ps1` 加载                                        |
| [reviewed-files.test.ps1](reviewed-files.test.ps1)                               | 隔离回归：`powershell -NoProfile -File tools/maintenance/reviewed-files.test.ps1`                    |
| [verification-artifacts.mjs](verification-artifacts.mjs)                         | `node tools/maintenance/verification-artifacts.mjs`                                                  |
| [verify-cleanup-fast.ps1](verify-cleanup-fast.ps1)                               | `powershell -NoProfile -File tools/maintenance/verify-cleanup-fast.ps1`                              |
| [verify-cleanup-idle.ps1](verify-cleanup-idle.ps1)                               | `powershell -NoProfile -File tools/maintenance/verify-cleanup-idle.ps1`                              |
| [verify-project.mjs](verify-project.mjs)                                         | `node tools/maintenance/verify-project.mjs`                                                          |
| [WorkspaceSnapshot.cs](WorkspaceSnapshot.cs)                                     | 内部辅助／声明／夹具；由对应入口调用                                                                 |

[temporary-retirement.ps1](temporary-retirement.ps1) 为单次tmp清单内部实现；[temporary-retirement.test.ps1](temporary-retirement.test.ps1) 为路径、变化、链接、无备份与防重复执行隔离回归。

## 定向Markdown读取与迁移审计

`read-doc.mjs`只读取仓库内Markdown源码，拒绝越界／生成物路径，默认8KiB输出（含行号和续读提示）。标题需精确且唯一；同名标题只列候选，不猜测。cursor是1起始行号与0起始Unicode码点列号，续读保留原文件行号；MORE不表示省略内容不存在。工具本身不修改文件。

```powershell
pnpm docs:read docs/reference/validation.md --outline
pnpm docs:read docs/reference/validation.md --heading="按变更范围选择检查"
# 仅使用上一结果给出的cursor；有heading时续读保留同一heading
pnpm docs:read docs/reference/validation.md --cursor=40:0
node --test tools/maintenance/read-doc.test.mjs
node --test tools/maintenance/audit-efficiency-docs.test.mjs
```

`audit-efficiency-docs.mjs`只检查源文档链接／真实标题、8KiB根入口和可选迁移对照，不启动产品、不执行容量／交付扫描或清理。全量入链读取用于正文迁移，既有失败与新增失败分别记录；已有缺口不能替新增失败通过。报告仅写指定仓库内证据路径。

```powershell
node tools/maintenance/audit-efficiency-docs.mjs --baseline=artifacts/maintenance/development-efficiency/docs/link-baseline.json --migration=artifacts/maintenance/development-efficiency/docs/migration.json --report=artifacts/maintenance/development-efficiency/docs/link-final.json
```

普通文档检查不必指定本轮migration；无baseline时所有坏链接都算失败。工具／验证日志回传默认结论约2KiB、失败约8KiB，完整日志留现有证据；预算之外明确截断，不重跑同一检查来获取相同输出。

## 开发环境操作：tmp 临时内容的生命周期（2026-10-11）

原开发环境的操作全文迁入，规范和保护见[工作区维护](../../docs/reference/workspace-maintenance.md)。

```powershell
# 在 TableMax 根目录预览
.\scripts\Clean-Releases.ps1
.\scripts\Clean-Intermediates.ps1
# 核对后分别执行
.\scripts\Clean-Releases.ps1 -Apply
.\scripts\Clean-Intermediates.ps1 -Apply
# 日常维护：默认发现本仓库主工作区，超过 10 GiB 才执行
.\scripts\Maintain-Project.ps1
.\scripts\Maintain-Project.ps1 -Apply
# 或明确指定同仓库 checkout；路径替换为实际主工作区
.\scripts\Maintain-Project.ps1 -Apply -ProjectRoot C:\Projects\TableMax
```

## 开发环境操作：工作目录透明压缩

原开发环境的操作全文迁入，规范和保护见[工作区维护](../../docs/reference/workspace-maintenance.md)。

```powershell
.\scripts\Compress-Workspace.ps1
.\scripts\Compress-Workspace.ps1 -Apply
.\scripts\Compress-Workspace.ps1 -Apply -MinimumBytes 4096
```

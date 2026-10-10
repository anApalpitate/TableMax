# 构建与验证自动维护

2026-10-10 已接入。构建、运行包导出，以及使用公共浏览器／桌面验证助手的检查，在 Node 进入最终空闲阶段时执行一次隐藏收尾任务，同一进程只触发一次。构建、验证和产品工作已结束，协调 Node 等待维护完成再退出，避免执行环境回收脱离的子进程。没有常驻任务、周期轮询或结束用户进程的动作。

任务日志与结果在 `artifacts/maintenance/v<当前版本>/automatic-maintenance/<本轮>/`；命令结束会打印具体目录。先检查 `result.json`，阻塞原因及预览见 `task.log`。正常 Windows 环境中生效；沙箱不能查询进程时保留并报告。没有匹配当前 ZIP 哈希的便携通过证明时，不执行自动删除。

## 执行顺序

1. 检查工程进程。仅豁免通过命令、创建时间、实际父子关系和空闲记录核验的收尾协调者及其等待中的 npm／pnpm 父进程，其他构建／验证／产品进程继续阻止清理。核对当前运行 ZIP 与既有便携通过证明。
2. 预览并修剪过期模块缓存，保护当前开发／交付引用、每单元最近两份成功产物、活动锁／工作目录，以及全部成员的30分钟近期修改。
3. 读取成功验证登记的临时目录。近期内容记录跳过，不重复哈希；到期后冻结精确成员／SHA-256，审查文档引用，生成 `retirement-plan.json`。
4. 通过现有 `cleanup-local.ps1` 先预览、再执行登记产物清理。只支持专用生成目录，保留当前 ZIP 证明、进程、路径／链接／嵌套仓库、清单与结果哈希、内容变化、30分钟及互斥保护。
5. 执行原有 `Maintain-Project.ps1 -Apply`，超过10GiB才进行更广瘦身，目标8GiB或安全候选耗尽。模块缓存与明确登记的临时产物不等待容量门槛。

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

已审查的旧候选包图、重复矩阵和与源资产完全相同的生成副本使用 `Clean-Intermediates.ps1 -ImageCopiesManifest <maintenance内清单>`，先预览后 `-Apply`。清单须绑定当前 ZIP、保护文件和保留报告；源副本须与 `assets/` 原件字节／SHA 一致。仅处理列出的图片，保留目录、报告、源码、存档、独有失败和关键代表，不纳入自动维护。只接受工具内明确核验过的旧 UNO／拉密目录与生成 bundle/assets 子路径；新增类别先审计并补隔离回归。哈希、文档引用、路径／链接／嵌套仓库、30分钟、进程和互斥保护仍有效。详见[开发环境](../../docs/reference/development.md#清理本地中间物)。

日常清理优先使用根目录 `Clean-Releases.ps1`、`Clean-Intermediates.ps1`、`Maintain-Project.ps1`，压缩使用 `Compress-Workspace.ps1`。根入口参数保持不变；手动先预览，核对后才 `-Apply`。

`retire-old-local-runtime.ps1` 只处理有迁移证明的旧用户运行目录，仍为显式专项工具，不纳入自动清理。历史截图／旧清单工具保留精确清单与证据保护；名称带历史不代表可直接删除。`verify-project.mjs` 检查文档、配置和交付清单，写证据报告，不修改交付 ZIP。

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
| [image-copies.ps1](image-copies.ps1)                                             | 内部辅助；由 `Clean-Intermediates.ps1 -ImageCopiesManifest <清单>` 加载                              |
| [image-copies.test.ps1](image-copies.test.ps1)                                   | 隔离回归：`powershell -NoProfile -File tools/maintenance/image-copies.test.ps1`                      |
| [lifecycle.mjs](lifecycle.mjs)                                                   | 内部辅助；由构建／验证入口调用                                                                       |
| [maintenance.test.mjs](maintenance.test.mjs)                                     | 工具隔离回归：`node --test tools/maintenance/maintenance.test.mjs`                                   |
| [screenshot-preview.test.mjs](screenshot-preview.test.mjs)                       | 编码、关键 PNG、选择边界与实际别名回归：`node --test tools/maintenance/screenshot-preview.test.mjs`  |
| [project-maintenance.test.ps1](project-maintenance.test.ps1)                     | 工具隔离回归：`powershell -NoProfile -File tools/maintenance/project-maintenance.test.ps1`           |
| [registered-artifacts.ps1](registered-artifacts.ps1)                             | 内部辅助；由清理入口加载                                                                             |
| [retire-old-local-runtime.ps1](retire-old-local-runtime.ps1)                     | `powershell -NoProfile -File tools/maintenance/retire-old-local-runtime.ps1`                         |
| [retired-generated.ps1](retired-generated.ps1)                                   | 内部辅助；由清理入口加载                                                                             |
| [retired-generated.test.ps1](retired-generated.test.ps1)                         | 工具隔离回归：`powershell -NoProfile -File tools/maintenance/retired-generated.test.ps1`             |
| [verification-artifacts.mjs](verification-artifacts.mjs)                         | `node tools/maintenance/verification-artifacts.mjs`                                                  |
| [verify-cleanup-fast.ps1](verify-cleanup-fast.ps1)                               | `powershell -NoProfile -File tools/maintenance/verify-cleanup-fast.ps1`                              |
| [verify-cleanup-idle.ps1](verify-cleanup-idle.ps1)                               | `powershell -NoProfile -File tools/maintenance/verify-cleanup-idle.ps1`                              |
| [verify-project.mjs](verify-project.mjs)                                         | `node tools/maintenance/verify-project.mjs`                                                          |
| [WorkspaceSnapshot.cs](WorkspaceSnapshot.cs)                                     | 内部辅助／声明／夹具；由对应入口调用                                                                 |

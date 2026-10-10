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

目前 UNO、阿瓦隆与盒子座位验证登记产物，其余旧产物不从目录名猜测用途。通过结果、代表截图、规则／素材原件、正式存档与当前交付继续保留。失败验证不登记可退役目标，保留定位现场。验证登记在 `artifacts/maintenance/v<版本>/artifact-runs/`，仅证明该次验证拥有对应临时生成目录；成员哈希在空闲收尾时冻结，并在删除前复核。

UNO／阿瓦隆默认 `representative`：布局矩阵依然全部检查，只保留各状态／端侧的代表图、横屏与4K边界，以及独立关键状态／失败画面。PNG不重编码，不降低实际 DPI 渲染；相同字节的图片引用已有永久证据，SHA与节省字节记录在结果的 `screenshotAliases`。

```powershell
# 可选：完整矩阵。代表图仍永久保留，额外画面归本轮 process/ 临时目录。
$env:TABLEMAX_TEST_SCREENSHOTS = 'all'
node scripts/verify-uno.mjs --sample --layout-only --seats=2 --evidence=my-debug-run
Remove-Item Env:TABLEMAX_TEST_SCREENSHOTS

# 特殊检查期间暂时关闭自动收尾，仅影响当前进程环境。
$env:TABLEMAX_AUTO_MAINTENANCE = '0'
node scripts/build.mjs --only=platform
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

# 验证工具

version 2内容绑定计划、`--changes`、`--force`、环境绑定和单轮收尾见[开发入口](../../docs/reference/development.md#内容绑定的验收计划2026-10-11)。新增runner辅助为[evidence.mjs](runner/evidence.mjs)、[plan.mjs](runner/plan.mjs)、[run-plan.mjs](runner/run-plan.mjs)和[round.mjs](runner/round.mjs)；隔离回归为[evidence.test.mjs](runner/evidence.test.mjs)、[plan.test.mjs](runner/plan.test.mjs)。[support/delivery-session.mjs](support/delivery-session.mjs)一次实际EXE启动顺序覆盖相关界面，[desktop/verify-delivery-session.mjs](desktop/verify-delivery-session.mjs)保留原空box三端代表检查，只适用于对应历史包；[support/download-loopback.mjs](support/download-loopback.mjs)与[platform/verify-download-loopback.mjs](platform/verify-download-loopback.mjs)提供生产安装器回环故障夹具（需`node --import=tsx`）。下载回环入口只检查内部事务／原安装行为，不表示现行仍有游戏下载入口；这些检查不等于游戏完整矩阵、当前完整EXE或真实线上／设备验收。

`--preset=rules|ui|resources|tooling` 可用逗号选择实际受影响类别，必须同时给出 `--scope` 和本任务 `--changes` SHA 清单；不能混用 `--plan` 或准确文件筛选。预设从 [scopes.mjs](runner/scopes.mjs) 的现有范围登记选择准确测试文件和已登记的工具回归，产品包／设备矩阵仍用显式计划。`--list` 显示执行、复用和排除及其理由；变化清单过期直接拒绝。游戏及动态输入尚未审完的项保守选择受影响范围，执行但不缓存，不能把预设输出当作完整产品验收。

```powershell
node tools/test/runner/test-scoped.mjs --scope=game:modern-art --preset=ui --changes=<owned.json> --list
node tools/test/runner/test-scoped.mjs --scope=tooling --preset=tooling --changes=<owned.json>
```

version 1、version 2 和准确文件 Vitest 入口均关闭子项自动维护，由父轮至多尝试一次。多阶段任务设置 `TABLEMAX_AUTO_MAINTENANCE=0`，最终统一安全收尾；不改变低通过率排序、串行、累计默认三失败停止或历史统计规则。阶段读缓存只共享本阶段真实读取的字节和环境查询；执行前后另建阶段重新 SHA 核验，不使用 mtime 放行。结果附加规划／执行前／执行后指纹、证据复验、环境查询、读取次数和字节、执行与收尾耗时。

运行入口不继承子进程大输出：stdout／stderr 原文完整保存在本轮日志文件，终端结论预算 2KiB，失败详情预算 8KiB。达到预算显示截断提示及完整日志／结果入口；仅截断显示，不修改原始证据、检查结果、退出码或统计。预设 `--list` 将完整选择及排除理由写入固定 `artifacts/maintenance/test-history/preset-list.json`（或 `TABLEMAX_TEST_HISTORY_DIR` 下同名文件），小于预算仍显示完整 JSON；超限显示执行／复用／排除数量、明确截断提示和证据路径。旧 direct／显式 plan 的 `--list` 返回形式保持兼容。

先按本次修改范围选择检查。统一入口为 `pnpm test -- --scope=<范围>`；用 `--list` 只列清单，用 `--plan=<批次JSON路径>` 执行明确 Node／PowerShell 批次。范围支持 `box`、`shared`、`tooling`、`game:<id>` 或明确组合；不以目录或文件名前缀替代实际范围注册。默认按历史低通过率排序、累计三项失败停止，不自动重试。

验证默认静音、回环监听、隐藏窗口；真实验证可能构建、启动服务并写 `tmp/`、`artifacts/` 和测试历史，不能把执行验证当作只读查询。各入口保留已有 `--game`、`--portable`、`--mode`、`--evidence` 等参数和结果位置，参数不通用，先查对应代码／开发说明。runner 为统计与调度；support 为公共运行助手；fixtures 只生成合法测试状态。混合矩阵保留在平台组，不能伪装成单游戏检查。

[开发环境](../../docs/reference/development.md)维护具体运行要求；[工具总索引](../README.md)用于按任务定位。下表覆盖本分类文件，内部辅助不作为独立业务命令。

截图统一通过 [support/screenshots.mjs](support/screenshots.mjs) 或既有共享 writer 保存。默认保留关键／失败 PNG；普通预览显式使用 WebP 品质90，矩阵代表筛选保留完整断言与必要边界，报告须消费返回的实际路径。输出目录的 `screenshot-index.json` 留存请求与代表／编码关系。规则素材捕获保留原格式。公共回归包含隐藏 Edge／WebView2 实测，需当前开发 EXE、系统 Edge 与锁定的 Python／Pillow；原生 profile 随进程关闭后交给既有临时目录维护，继续保护近期文件。策略、依赖与自动维护边界见[截图与产物归属](../maintenance/README.md#截图与产物归属)。

| 工具                                                                                                                                     | 入口／用途                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [support/screenshots.mjs](support/screenshots.mjs)                                                                                       | 内部截图保存、代表筛选与索引；普通预览 WebP90，关键／失败 PNG                        |
| [support/screenshots.test.mjs](support/screenshots.test.mjs)                                                                             | 工具回归：`node --test tools/test/support/screenshots.test.mjs`；包含隐藏浏览器实测  |
| [box/verify-box-avatars.mjs](box/verify-box-avatars.mjs)                                                                                 | `node tools/test/box/verify-box-avatars.mjs`                                         |
| [box/verify-box-debug.mjs](box/verify-box-debug.mjs)                                                                                     | `node tools/test/box/verify-box-debug.mjs`                                           |
| [box/verify-box-layout.mjs](box/verify-box-layout.mjs)                                                                                   | `node tools/test/box/verify-box-layout.mjs`                                          |
| [box/verify-box-notifications.mjs](box/verify-box-notifications.mjs)                                                                     | `node tools/test/box/verify-box-notifications.mjs`                                   |
| [box/verify-box-repository.mjs](box/verify-box-repository.mjs)                                                                           | `node tools/test/box/verify-box-repository.mjs`                                      |
| [box/verify-box-seats.mjs](box/verify-box-seats.mjs)                                                                                     | `node tools/test/box/verify-box-seats.mjs`                                           |
| [box/verify-game-library.mjs](box/verify-game-library.mjs)                                                                               | `node tools/test/box/verify-game-library.mjs`                                        |
| [desktop/verify-desktop.mjs](desktop/verify-desktop.mjs)                                                                                 | `node tools/test/desktop/verify-desktop.mjs`                                         |
| [desktop/verify-display.mjs](desktop/verify-display.mjs)                                                                                 | `pnpm verify:display`                                                                |
| [desktop/verify-fullscreen.mjs](desktop/verify-fullscreen.mjs)                                                                           | `node tools/test/desktop/verify-fullscreen.mjs`                                      |
| [desktop/verify-shutdown.mjs](desktop/verify-shutdown.mjs)                                                                               | `node tools/test/desktop/verify-shutdown.mjs`                                        |
| [desktop/verify-native-safety.mjs](desktop/verify-native-safety.mjs)                                                                     | `node tools/test/desktop/verify-native-safety.mjs`                                   |
| [desktop/verify-player-display.mjs](desktop/verify-player-display.mjs)                                                                   | `node tools/test/desktop/verify-player-display.mjs`                                  |
| [desktop/verify-portable-storage.mjs](desktop/verify-portable-storage.mjs)                                                               | `node tools/test/desktop/verify-portable-storage.mjs`                                |
| [desktop/verify-runtime-memory.mjs](desktop/verify-runtime-memory.mjs)                                                                   | `pnpm verify:memory`                                                                 |
| [fixtures/crash-pokemon.ts](fixtures/crash-pokemon.ts)                                                                                   | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/crash-service.ts](fixtures/crash-service.ts)                                                                                   | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/measure-copy-memory.mjs](fixtures/measure-copy-memory.mjs)                                                                     | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/memory-save.ts](fixtures/memory-save.ts)                                                                                       | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/pokemon-expansion-awards.tsx](fixtures/pokemon-expansion-awards.tsx)                                                           | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/pokemon-expansion-effects.tsx](fixtures/pokemon-expansion-effects.tsx)                                                         | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/pokemon-polish-layout.tsx](fixtures/pokemon-polish-layout.tsx)                                                                 | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/pokemon-ui-redesign.tsx](fixtures/pokemon-ui-redesign.tsx)                                                                     | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/prepare-modern-art-polish.ts](fixtures/prepare-modern-art-polish.ts)                                                           | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/prepare-module-fixture.ts](fixtures/prepare-module-fixture.ts)                                                                 | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/prepare-pokemon.ts](fixtures/prepare-pokemon.ts)                                                                               | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/prepare-rules-guides.ts](fixtures/prepare-rules-guides.ts)                                                                     | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/prepare-uno-ui.ts](fixtures/prepare-uno-ui.ts)                                                                                 | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [fixtures/safe-http-port.ts](fixtures/safe-http-port.ts)                                                                                 | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [games/avalon/verify-avalon.mjs](games/avalon/verify-avalon.mjs)                                                                         | `node tools/test/games/avalon/verify-avalon.mjs`                                     |
| [games/modern-art/verify-modern-art-audio.mjs](games/modern-art/verify-modern-art-audio.mjs)                                             | `node tools/test/games/modern-art/verify-modern-art-audio.mjs`                       |
| [games/modern-art/verify-modern-art-debug.mjs](games/modern-art/verify-modern-art-debug.mjs)                                             | `node tools/test/games/modern-art/verify-modern-art-debug.mjs`                       |
| [games/modern-art/verify-modern-art-empty-gallery.mjs](games/modern-art/verify-modern-art-empty-gallery.mjs)                             | `node tools/test/games/modern-art/verify-modern-art-empty-gallery.mjs`               |
| [games/modern-art/verify-modern-art-polish-v2.mjs](games/modern-art/verify-modern-art-polish-v2.mjs)                                     | `node tools/test/games/modern-art/verify-modern-art-polish-v2.mjs`                   |
| [games/pokemon-encounters/verify-pokemon-audio.mjs](games/pokemon-encounters/verify-pokemon-audio.mjs)                                   | `node tools/test/games/pokemon-encounters/verify-pokemon-audio.mjs`                  |
| [games/pokemon-encounters/verify-pokemon-effects.mjs](games/pokemon-encounters/verify-pokemon-effects.mjs)                               | `pnpm verify:effects`                                                                |
| [games/pokemon-encounters/verify-pokemon-expansion-awards.mjs](games/pokemon-encounters/verify-pokemon-expansion-awards.mjs)             | `node tools/test/games/pokemon-encounters/verify-pokemon-expansion-awards.mjs`       |
| [games/pokemon-encounters/verify-pokemon-expansion-effects.mjs](games/pokemon-encounters/verify-pokemon-expansion-effects.mjs)           | `node tools/test/games/pokemon-encounters/verify-pokemon-expansion-effects.mjs`      |
| [games/pokemon-encounters/verify-pokemon-expansion-play.mjs](games/pokemon-encounters/verify-pokemon-expansion-play.mjs)                 | `node tools/test/games/pokemon-encounters/verify-pokemon-expansion-play.mjs`         |
| [games/pokemon-encounters/verify-pokemon-expansion.mjs](games/pokemon-encounters/verify-pokemon-expansion.mjs)                           | `node tools/test/games/pokemon-encounters/verify-pokemon-expansion.mjs`              |
| [games/pokemon-encounters/verify-pokemon-original-compatibility.mjs](games/pokemon-encounters/verify-pokemon-original-compatibility.mjs) | `node tools/test/games/pokemon-encounters/verify-pokemon-original-compatibility.mjs` |
| [games/pokemon-encounters/verify-pokemon-polish.mjs](games/pokemon-encounters/verify-pokemon-polish.mjs)                                 | `node tools/test/games/pokemon-encounters/verify-pokemon-polish.mjs`                 |
| [games/pokemon-encounters/verify-pokemon-ui-redesign.mjs](games/pokemon-encounters/verify-pokemon-ui-redesign.mjs)                       | `node tools/test/games/pokemon-encounters/verify-pokemon-ui-redesign.mjs`            |
| [games/pokemon-encounters/verify-pokemon-version.mjs](games/pokemon-encounters/verify-pokemon-version.mjs)                               | `node tools/test/games/pokemon-encounters/verify-pokemon-version.mjs`                |
| [games/power-grid/power-grid-board-checks.mjs](games/power-grid/power-grid-board-checks.mjs)                                             | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [games/power-grid/power-grid-purchase-progress-checks.mjs](games/power-grid/power-grid-purchase-progress-checks.mjs)                     | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [games/power-grid/power-grid-ui-polish-checks.mjs](games/power-grid/power-grid-ui-polish-checks.mjs)                                     | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [games/power-grid/power-grid-ui-refinement-checks.mjs](games/power-grid/power-grid-ui-refinement-checks.mjs)                             | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [games/power-grid/verify-power-grid-audio.mjs](games/power-grid/verify-power-grid-audio.mjs)                                             | `node tools/test/games/power-grid/verify-power-grid-audio.mjs`                       |
| [games/power-grid/verify-power-grid-ui.mjs](games/power-grid/verify-power-grid-ui.mjs)                                                   | `pnpm verify:power-grid-ui`                                                          |
| [games/rummikub/verify-rummikub-runtime.mjs](games/rummikub/verify-rummikub-runtime.mjs)                                                 | `node tools/test/games/rummikub/verify-rummikub-runtime.mjs`                         |
| [games/rummikub/verify-rummikub-ui.mjs](games/rummikub/verify-rummikub-ui.mjs)                                                           | `node tools/test/games/rummikub/verify-rummikub-ui.mjs`                              |
| [games/uno/verify-uno.mjs](games/uno/verify-uno.mjs)                                                                                     | `node tools/test/games/uno/verify-uno.mjs`                                           |
| [platform/verify-card-layout.mjs](platform/verify-card-layout.mjs)                                                                       | `pnpm verify:cards`                                                                  |
| [platform/verify-connection-entry.mjs](platform/verify-connection-entry.mjs)                                                             | `node tools/test/platform/verify-connection-entry.mjs`                               |
| [platform/verify-debug-20261007.mjs](platform/verify-debug-20261007.mjs)                                                                 | `node tools/test/platform/verify-debug-20261007.mjs`                                 |
| [platform/verify-debug-recovery.mjs](platform/verify-debug-recovery.mjs)                                                                 | `node tools/test/platform/verify-debug-recovery.mjs`                                 |
| [platform/verify-debug-remote.mjs](platform/verify-debug-remote.mjs)                                                                     | `node tools/test/platform/verify-debug-remote.mjs`                                   |
| [platform/verify-experience.mjs](platform/verify-experience.mjs)                                                                         | `pnpm verify:experience`                                                             |
| [platform/verify-game-introduction.mjs](platform/verify-game-introduction.mjs)                                                           | `node tools/test/platform/verify-game-introduction.mjs`                              |
| [platform/verify-game-prototype.mjs](platform/verify-game-prototype.mjs)                                                                 | `pnpm prototype:verify:game`                                                         |
| [platform/verify-game-ui.mjs](platform/verify-game-ui.mjs)                                                                               | `pnpm verify:game-ui`                                                                |
| [platform/verify-interactions.mjs](platform/verify-interactions.mjs)                                                                     | `node tools/test/platform/verify-interactions.mjs`                                   |
| [platform/verify-modern-art-polish.mjs](platform/verify-modern-art-polish.mjs)                                                           | `node tools/test/platform/verify-modern-art-polish.mjs`                              |
| [platform/verify-modern-art.mjs](platform/verify-modern-art.mjs)                                                                         | `pnpm verify:modern-art`                                                             |
| [platform/verify-party.mjs](platform/verify-party.mjs)                                                                                   | `pnpm verify:party`                                                                  |
| [platform/verify-play-presentation.mjs](platform/verify-play-presentation.mjs)                                                           | `pnpm verify:presentation`                                                           |
| [platform/verify-player-interaction-audio.mjs](platform/verify-player-interaction-audio.mjs)                                             | `node tools/test/platform/verify-player-interaction-audio.mjs`                       |
| [platform/verify-pokemon.mjs](platform/verify-pokemon.mjs)                                                                               | `pnpm verify:desktop`；`pnpm verify:portable`                                        |
| [platform/verify-power-grid.mjs](platform/verify-power-grid.mjs)                                                                         | `pnpm verify:power-grid`                                                             |
| [platform/verify-prototype.mjs](platform/verify-prototype.mjs)                                                                           | `pnpm prototype:verify`                                                              |
| [platform/verify-room-levels.mjs](platform/verify-room-levels.mjs)                                                                       | `pnpm verify:room-levels`                                                            |
| [platform/verify-root-entry.mjs](platform/verify-root-entry.mjs)                                                                         | `node tools/test/platform/verify-root-entry.mjs`                                     |
| [platform/verify-rules-guides.mjs](platform/verify-rules-guides.mjs)                                                                     | `node tools/test/platform/verify-rules-guides.mjs`                                   |
| [platform/verify-save-storage-games.mjs](platform/verify-save-storage-games.mjs)                                                         | `node tools/test/platform/verify-save-storage-games.mjs`                             |
| [platform/verify-speech-panel.mjs](platform/verify-speech-panel.mjs)                                                                     | `node tools/test/platform/verify-speech-panel.mjs`                                   |
| [platform/verify-test-silence.mjs](platform/verify-test-silence.mjs)                                                                     | `node tools/test/platform/verify-test-silence.mjs`                                   |
| [runner/history-runner.mjs](runner/history-runner.mjs)                                                                                   | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [platform/verify-package-fault-matrix.mjs](platform/verify-package-fault-matrix.mjs)                                                     | 安装写入／下载故障矩阵；独立回环目录、逐项历史及失败阈值，支持精确`--only`           |
| [platform/package-fault-child.mjs](platform/package-fault-child.mjs)                                                                     | 上述矩阵的私有注入／恢复子进程，不直接启动                                           |
| [runner/history.mjs](runner/history.mjs)                                                                                                 | `node tools/test/runner/history.mjs`                                                 |
| [runner/history.test.mjs](runner/history.test.mjs)                                                                                       | 工具隔离回归：`node --test tools/test/runner/history.test.mjs`                       |
| [runner/scopes.d.mts](runner/scopes.d.mts)                                                                                               | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [runner/scopes.mjs](runner/scopes.mjs)                                                                                                   | `node tools/test/runner/scopes.mjs`                                                  |
| [runner/scopes.test.mjs](runner/scopes.test.mjs)                                                                                         | 工具隔离回归：`node --test tools/test/runner/scopes.test.mjs`                        |
| [runner/test-batch.mjs](runner/test-batch.mjs)                                                                                           | `node tools/test/runner/test-batch.mjs`                                              |
| [runner/test-history.mjs](runner/test-history.mjs)                                                                                       | `node tools/test/runner/test-history.mjs`                                            |
| [runner/test-scoped.mjs](runner/test-scoped.mjs)                                                                                         | `pnpm test`                                                                          |
| [runner/typecheck.mjs](runner/typecheck.mjs)                                                                                             | `pnpm typecheck`；完整 TypeScript CLI 与目录链接回退                                 |
| [runner/typecheck.test.mjs](runner/typecheck.test.mjs)                                                                                   | 工具回归：目录链接、缺失路径、真实类型错误拒绝                                       |
| [runner/presets.mjs](runner/presets.mjs)                                                                                                 | 内部预设选择；沿用既有范围权威与 owned SHA 清单                                      |
| [runner/presets.test.mjs](runner/presets.test.mjs)                                                                                       | 工具回归：类别／范围／变化选择、动态缺口、复用及不重复计次                           |
| [runner/run-unit.mjs](runner/run-unit.mjs)                                                                                               | 准确 Vitest 文件入口的父轮统计与一次收尾                                             |
| [runner/round.test.mjs](runner/round.test.mjs)                                                                                           | 工具回归：旧批次／准确文件父轮、关闭子项维护及异常收尾                               |
| [runner/log-output.mjs](runner/log-output.mjs)                                                                                           | 父轮结论／失败详情字节预算；完整日志保留与 UTF-8 尾部摘要                            |
| [runner/log-output.test.mjs](runner/log-output.test.mjs)                                                                                 | 工具回归：预算／截断／原文哈希及真实子进程大输出                                     |
| [runner/benchmark-efficiency.mjs](runner/benchmark-efficiency.mjs)                                                                       | 固定工具夹具：指定提交的指纹基线与当前阶段缓存、锁定 TS 普通／增量冷暖诊断比较       |
| [runner/vitest-history.d.mts](runner/vitest-history.d.mts)                                                                               | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [runner/vitest-history.mjs](runner/vitest-history.mjs)                                                                                   | `node tools/test/runner/vitest-history.mjs`                                          |
| [support/browser-test.mjs](support/browser-test.mjs)                                                                                     | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [support/budget-trace.mjs](support/budget-trace.mjs)                                                                                     | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [support/desktop-test.mjs](support/desktop-test.mjs)                                                                                     | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [support/fixture-server.mjs](support/fixture-server.mjs)                                                                                 | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [support/player-test.mjs](support/player-test.mjs)                                                                                       | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [support/verification-output.mjs](support/verification-output.mjs)                                                                       | 内部辅助／声明／夹具；由对应入口调用                                                 |

`pnpm typecheck` 使用 [typecheck.mjs](runner/typecheck.mjs) 调用锁定的 TypeScript CLI，保留原参数、诊断和退出码。Windows 原生 realpath 无法读取 pnpm 目录链接时，回退到普通 realpath；都失败时保留编译器原有缺失文件行为，不跳过测试或放宽类型。机制回归：`node --test tools/test/runner/typecheck.test.mjs`。

显式 `--incremental-cache` 在 `.cache/typecheck/` 使用锁定 TypeScript 的增量信息，或用 `--incremental-cache=<仓库内目录>` 指定隔离目录；不裁减原 tsconfig 文件范围。参数、编译器版本和工作区构成缓存身份，编译器仍读取源码并检查内容版本；不能与 `--build`、显式 `--incremental`／`--tsBuildInfoFile` 混用。诊断正文与成功／失败保持一致，TypeScript 自身的非零退出码可能因增量信息输出为 1 或 2，入口原样保留，不将其视为通过。该参数默认关闭，首次构建不保证加速。

```powershell
node tools/test/runner/typecheck.mjs --noEmit --incremental-cache
node tools/test/runner/benchmark-efficiency.mjs
```

基准仅检查固定 Node／TypeScript 工具夹具；输出 `artifacts/maintenance/development-efficiency/verification/benchmark-<名称>.json`，临时输入在 `tmp/efficiency-verification-<名称>/`，不自动清理，不启动游戏或导出包。单次本机冷暖数据不能作为产品运行性能结论。

## 开发环境操作：内容绑定的验收计划（2026-10-11）

version 2 明确内容、方法、环境与输入边界；清单和方案先预览。

```powershell
node tools/test/runner/test-scoped.mjs --scope=tooling --plan=<version-2.json> --changes=<owned.json> --list
node tools/test/runner/test-scoped.mjs --scope=tooling --plan=<version-2.json> --changes=<owned.json>
```

## 开发环境操作：按变更范围选择检查

准确文件或实际受影响范围；不运行其他游戏。

```powershell
node tools/test/runner/test-scoped.mjs --scope=box --list
node tools/test/runner/test-scoped.mjs --scope=box apps/server/src/avatar.test.ts
node tools/test/runner/test-scoped.mjs --scope=game:modern-art games/modern-art/ui/sorting.test.ts
```

## 开发环境操作：历史通过率与失败阈值

范围入口见上一节。version 1 批次保持兼容，不提供自动证据复用；下方包哈希和证据名须换为实际输入。

```powershell

# 可选：本轮只容许1项失败；不设置时为3，合法范围1–1000
$env:TABLEMAX_TEST_MAX_FAILURES = '1'
node tools/test/runner/test-scoped.mjs --scope=shared apps/server/src/countdown.test.ts
Remove-Item Env:TABLEMAX_TEST_MAX_FAILURES

# 查看累计通过次数、完成次数、百分比及通过次数/完成次数
node tools/test/runner/test-history.mjs

# 仅导入有逐项结果和startTime的完整Vitest JSON，重复导入不重复计数
node tools/test/runner/test-history.mjs --import artifacts/<已有逐项报告>.json

# 测试工具本身的隔离回归，不启动正式桌面或服务
node --test tools/test/runner/history.test.mjs
node --test tools/test/runner/scopes.test.mjs
```

```json
{
  "version": 1,
  "tests": [
    {
      "id": "box/layout",
      "runtime": "node",
      "script": "tools/test/box/verify-box-layout.mjs",
      "args": ["--sha256=<当前包SHA256>", "--evidence=<本轮独立名>"]
    }
  ]
}
```

## 开发环境操作：图文规则维护与验证

下列为原专项工具参数示例，运行前选择本次受影响游戏和新证据名；旧目录不能作为当前完整 EXE 验收。

```powershell
# 宝可梦三个实际区域；capture-rules 不允许同时使用 --portable
node tools/test/platform/verify-rules-guides.mjs --capture-rules --evidence=capture-regions

# 电力公司五个实际区域的独立组件渲染；每轮采用新证据名
node tools/test/games/power-grid/verify-power-grid-ui.mjs --maintenance=power-grid-debug-20261004 --capture-rules-only --evidence=rule-capture-run

# 三游戏 PNG→WebP，无损并逐像素核验；按需加 --game=power-grid 等限定
python tools/assets/rules/compress-rule-captures.py --report=artifacts/maintenance/v1.0.2/shared-visual-20261004/rules-compression.json
```

## 保存关闭屏障与隔离底座

- [installation-fixture.mjs](support/installation-fixture.mjs)：仅文件系统形状、路径边界及前后SHA状态，绝不安装程序或登记系统入口。其[回归](support/installation-fixture.test.mjs)用 Node --test，登记 tooling。
- [verify-service-stop.mjs](desktop/verify-service-stop.mjs)：使用[原生C#夹具](support/service-stop-harness.cs)和[私有子服务夹具](support/service-stop-child.mjs)，编译实际ServiceProcess、验证8种关闭状态并接入当前源码服务＋SQLite；登记 shared,tooling。固定SDK／net48引用与Node缓存，不生成发布密钥或完整EXE。动态夹具不缓存。
- [verify-shutdown.mjs](desktop/verify-shutdown.mjs)支持 --native 与 --server 两份相互匹配的候选目录；报告分别绑定原完整EXE来源和候选哈希，不能把候选覆盖视为新完整EXE通过。

```powershell
node tools/test/runner/test-scoped.mjs --scope=shared packages/platform-core/src/room-shutdown.test.ts
node tools/test/runner/test-scoped.mjs --scope=shared apps/server/src/service-shutdown.test.ts
node --test tools/test/support/installation-fixture.test.mjs
node tools/test/desktop/verify-service-stop.mjs
node tools/test/desktop/verify-shutdown.mjs --native=<已编译原生目录> --server=<同源服务目录>
```

批次沿用version2计划，Node／Vitest文件逐项登记与筛选；中文空格及Junction拒绝在受管临时根验证。系统临时目录权限或缓存不可靠时，只给该隔离测试进程设置工程内TEMP／TMP，不改用户全局环境。源码、实际进程与安装／上线边界见[验证规格](../../docs/reference/validation.md#保存关闭与安装隔离底座2026-10-15)。

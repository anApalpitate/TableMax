# 验证工具

## 文档工具定向回归

读取、查找及审计的参数、输出预算和写报告边界见[维护工具](../maintenance/README.md#定向markdown读取与迁移审计)。对应Node单测为`read-doc.test.mjs`、`find-doc.test.mjs`、`audit-efficiency-docs.test.mjs`，均归现有tooling范围，通过显式version 2计划选择，Node使用`--test`；无需游戏测试、构建或安装器。

新会话技能评估脚本虽归tooling，但会调用模型、创建证据且需要检查实际路由，不能因文档改动自动运行。静态技能检查、只读路由、隔离写入和产品验收分别认定。实际环境修复及本轮证据见[文档优化记录](../../docs/archive/documentation-optimization-2026-10-18.md)。

## 计划、预设与业务入口

version 2内容绑定计划、`--changes`、`--force`、环境绑定和单轮收尾见[开发入口](../../docs/reference/development.md#内容绑定的验收计划2026-10-11)。新增runner辅助为[evidence.mjs](runner/evidence.mjs)、[plan.mjs](runner/plan.mjs)、[run-plan.mjs](runner/run-plan.mjs)和[round.mjs](runner/round.mjs)；隔离回归为[evidence.test.mjs](runner/evidence.test.mjs)、[plan.test.mjs](runner/plan.test.mjs)。[support/delivery-session.mjs](support/delivery-session.mjs)一次实际EXE启动顺序覆盖相关界面，[desktop/verify-delivery-session.mjs](desktop/verify-delivery-session.mjs)保留原空box三端代表检查，只适用于对应历史包；[support/download-loopback.mjs](support/download-loopback.mjs)与[platform/verify-download-loopback.mjs](platform/verify-download-loopback.mjs)提供生产安装器回环故障夹具（需`node --import=tsx`）。下载回环入口只检查内部事务／原安装行为，不表示现行仍有游戏下载入口；这些检查不等于游戏完整矩阵、当前完整EXE或真实线上／设备验收。

`--preset=rules|ui|resources|tooling` 可用逗号选择实际受影响类别，必须同时给出 `--scope` 和本任务 `--changes` SHA 清单；不能混用 `--plan` 或准确文件筛选。预设从 [scopes.mjs](runner/scopes.mjs) 的现有范围登记选择准确测试文件和已登记的工具回归，产品包／设备矩阵仍用显式计划。`--list` 显示执行、复用和排除及其理由；变化清单过期直接拒绝。游戏及动态输入尚未审完的项保守选择受影响范围，执行但不缓存，不能把预设输出当作完整产品验收。

```powershell
node tools/test/runner/test-scoped.mjs --scope=game:modern-art --preset=ui --changes=<owned.json> --list
node tools/test/runner/test-scoped.mjs --scope=tooling --preset=tooling --changes=<owned.json>
```

version 1、version 2 和准确文件 Vitest 入口均关闭子项自动维护，由父轮至多尝试一次。多阶段任务设置 `TABLEMAX_AUTO_MAINTENANCE=0`，最终统一安全收尾；不改变低通过率排序、串行、[统一失败阈值](../../docs/reference/validation.md#历史通过率与失败阈值)或历史统计规则。阶段读缓存只共享本阶段真实读取的字节和环境查询；执行前后另建阶段重新 SHA 核验，不使用 mtime 放行。结果附加规划／执行前／执行后指纹、证据复验、环境查询、读取次数和字节、执行与收尾耗时。

运行入口不继承子进程大输出：stdout／stderr 原文完整保存在本轮日志文件，终端结论预算 2KiB，失败详情预算 8KiB。达到预算显示截断提示及完整日志／结果入口；仅截断显示，不修改原始证据、检查结果、退出码或统计。预设 `--list` 将完整选择及排除理由写入固定 `artifacts/maintenance/test-history/preset-list.json`（或 `TABLEMAX_TEST_HISTORY_DIR` 下同名文件），小于预算仍显示完整 JSON；超限显示执行／复用／排除数量、明确截断提示和证据路径。旧 direct／显式 plan 的 `--list` 返回形式保持兼容。

先按本次修改范围选择检查。统一入口为 `pnpm test -- --scope=<范围>`；用 `--list` 只列清单，用 `--plan=<批次JSON路径>` 执行明确 Node／PowerShell 批次。范围支持 `box`、`shared`、`tooling`、`game:<id>` 或明确组合；不以目录或文件名前缀替代实际范围注册。默认按历史低通过率排序，按[统一失败阈值](../../docs/reference/validation.md#历史通过率与失败阈值)停止；实质修复后按该规则自动接续定向新轮，无变化不重试。共享默认失败预算为10，显式预算或 `TABLEMAX_TEST_MAX_FAILURES`可覆盖；`--prior-failures`及PS的 `-PriorFailures`均为小于该轮实际预算的非负整数，不限定旧0–4。PS父入口读取同一策略并冻结到子执行计划，不能由子进程清零累计失败。

《马尼拉》定向单测使用 `node tools/test/runner/test-scoped.mjs --scope=game:manila`；增量构建使用 `node tools/build/build.mjs --only=game:manila`。实际页面与载荷验证入口为 `node tools/test/games/manila/verify-manila.mjs --executable=<实际TableMax.exe> --zip=<对应内部payload.zip> --seats=5 --only=all --evidence=<新安全名称>`：人数接受3/4/5；`only=layout|phone|match|all`分别选择三端布局与保存动态、手机定向复验、自然完整对局或完整范围。布局包含真实竞价/回退、具体岗位草稿/确认及图文规则；手机复验固定移动UA和触摸，要求横屏实际内容宽至少800px，并核验浮球不遮挡必要信息或操作。每轮保存验证源码及SHA，载荷逐成员SHA在运行前后复核。默认静音隐藏、127.0.0.1隔离数据，支持320px短手机/横屏及720p至4K；内部ZIP仅核验输入，不作为用户交付。脚本需经 `game:manila` 批次计划运行以保留统一排序与失败账本。实现及实际验证结果见[马尼拉验证](../../docs/games/manila/validation-scenarios.md)。

马尼拉触控源码验证使用 `node tools/test/games/manila/verify-manila-touch.mjs --evidence=<新安全名称> --only=setup,pilot-small,pilot-large,auction,waiting,labels,round-result`，可用 `--widths=320,390,430,844` 定向。真实React与合法投影检查44px箭头、起点和9、领航预算、草稿确认、操作列表居中、64px出价及手机房主下一航次。证据保留在 `artifacts/maintenance/manila-touch-layout-20261017/touch/<名称>`，默认静音隐藏、127.0.0.1；模拟触控不替代真实设备或完整安装系统链。

马尼拉完整港湾定向验证使用 `node tools/test/games/manila/verify-manila-harbor.mjs --evidence=<新安全名称> --widths=320,390,430,844`，`--only=structure,setup,pilot-small,pilot-large,stability,boundary,payment,permissions,guards,rotation,viewport,tie,tail` 可选择组。真实React与合法投影检查唯一主滚动区、持续挂载、64px控制槽、非零滚动选择／取消／保存、按需付款与抵押原位状态、旧决策提交拦截和权限；模拟触控与假运输不替代真实手机、服务端保存或完整安装验收。证据进入 `artifacts/maintenance/manila-harbor-rebuild-20261017/mobile/<名称>`。

马尼拉整图返修增加 `node tools/test/games/manila/verify-manila-harbor.mjs --suite=composition --evidence=<新安全名称> --only=share,entries --widths=320,390,430,844`。`share`测“不购买股份／股份操作”外框同高、文字中心与入口尺寸；`entries`覆盖各行动阶段热区。原稳定性／权限组仍可按`--only`定向运行，证据进入 `artifacts/maintenance/manila-board-composition-20261017/mobile/<名称>`；假运输和模拟触控不代表真实服务、设备或安装验收。

马尼拉体验深化验证增加触摸无效／取消／合法落点、旋转保留草稿、货物与起点／领航拖放、点击与键盘及长按详情、确认区避让、手机显式声音开启与旧事件不补播、真实音频解码、终局演出和完整UI航次。`box/verify-box-layout.mjs --settings-only --zip=<实际payload.zip> --sha256=<SHA> --evidence=<新名>`执行三设置页正常／文字压力布局；共用几何方法为[settings-layout-measurement.mjs](box/settings-layout-measurement.mjs)。[installed-update-layout.mjs](installation/installed-update-layout.mjs)仅由正式安装验收在同次真实Native中调用，核支持状态、16项布局及身份／静音／窗口恢复，截图与报告进入安装证明；不触发在线检查、下载或更新。文字压力仅为明确标注的文本布局夹具，不代表真实错误或进度状态已发生。

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

预装实际载荷回归 `apps/server/src/game-packages/preinstalled.test.ts` 可显式指定 `TABLEMAX_TEST_GAME_PACKAGES`（签名包目录）、`TABLEMAX_TEST_GAME_CATALOG`（该目录中的原catalog文件名）和 `TABLEMAX_TEST_APPLICATION_POINTER`（真实冻结current或candidate.json）。默认历史输入保持不变；候选包装须为schema 1／installation-candidate，实际Worker仍按对应冻结manifest核字节SHA，不能用任意本地Worker替代。旧玩法恢复用原签名历史catalog，不重造已退役EXE来填补夹具。

准确文件或实际受影响范围；不运行其他游戏。

```powershell
node tools/test/runner/test-scoped.mjs --scope=box --list
node tools/test/runner/test-scoped.mjs --scope=box apps/server/src/avatar.test.ts
node tools/test/runner/test-scoped.mjs --scope=game:modern-art games/modern-art/ui/sorting.test.ts
```

## 开发环境操作：历史通过率与失败阈值

范围入口见上一节。version 1 批次保持兼容，不提供自动证据复用；下方包哈希和证据名须换为实际输入。

```powershell

# 可选：本轮只容许1项失败；不设置时为5，合法范围1–1000
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

批次沿用version2计划，Node／Vitest文件逐项登记与筛选；中文空格及Junction拒绝在受管临时根验证。系统临时目录权限或缓存不可靠时，只给该隔离测试进程设置工程内TEMP／TMP，不改用户全局环境。源码、实际进程与安装／上线边界见[验证规格](../../docs/reference/installation-validation.md#保存关闭与安装隔离底座2026-10-15)。

## 正式执行记录与证明封存

实际安装／保存／卸载由[installation-verifier CLI](../release/installation-verifier.mjs)执行，成员核验、容量与日志辅助归[installation-evidence](../release/installation-evidence.mjs)；独立封存只核验同一次执行的原始材料，不重复产品操作或改写既有报告。具体产物与通过范围见[验收](../../docs/reference/acceptance.md#当前源码与本地交付)。

- [execution-method.mjs](installation/execution-method.mjs)：只读复用runner version2方法指纹，显式包括PowerShell父／子执行文件及动态编译C#源，不另建registry。输出冻结方法依赖，不执行账户或产品。

- [verify-production-user.ps1](installation/verify-production-user.ps1)在正式执行与账户／profile清理成功后，先CreateNew保留 execution-proof.json 和 execution-receipt.json；receipt绑定delivery、proof、isolation及方法源的路径、字节数和SHA。后续绑定失败保留这些原件及成功isolation，另写 acceptance-binding-error.json 并退出1，不倒写成功账户执行结果。

- [finalize-evidence.mjs](installation/finalize-evidence.mjs)：`node tools/test/installation/finalize-evidence.mjs --report=<execution-receipt.json> --out=<全新proof.json>`。输入和输出限定工程maintenance证据范围，输出不覆盖；核验正式产品／隔离成功、日志、三链、交付、payload／安装清单及保留runtime绑定后才封存。仅封存正式隔离proof，不运行产品、账户、服务或维护；不能传fixture-only或便携迁移报告扩大证明。

## 正式执行记录与证明封存（接口待验证）

旧标题入口，正文见[正式执行记录与证明封存](#正式执行记录与证明封存)。

## 完整安装与程序更新验证

正式账户驱动可显式传`-IncludeWizardAcceptance`，先在同一干净标准profile中核验实际中文向导与取消保全，再执行既有完整更新／恢复／正式安装链；该选项仅适用于`-UseProfileAcceptance`完整生产链，不接受fixture-only或便携迁移模式。默认关闭，不能因当前用户已有产品登记而删除登记或跳过门禁。父驱动核对向导通过及同一installer SHA，方法指纹包含向导来源；仍需临时账户与profile操作的明确授权。

需要UAC提权启动时，外层必须持续等待自有提权进程并保留完成回执；不能启动后立即退出，避免宿主结束进程树使账户清理中断。向导profile解析使用子驱动已设置的`TABLEMAX_INSTALLATION_HANDOFF_TMP`，核验实际成功状态`actual-wizard-cancel-passed`；它仅证明向导浏览和取消，完整系统链仍须逐项通过。意外中断后先按本次记录的精确SID核对并清理自有测试账户／profile，再用新证据目录执行实质纠正后的独立轮次。

本节维护安装／更新脚本、参数和报告契约；证明层次见[验证规格](../../docs/reference/installation-validation.md#完整安装与程序更新的证据分层)，实际结果只在[验收](../../docs/reference/acceptance.md#当前源码与本地交付)及相应归档维护。组件、向导取消、解码探针或双PE准备不能升级为实际系统证明。

- [verify-update-activation.mjs](installation/verify-update-activation.mjs)：`--only=<已知caseID[,]> --prior-failures=<本轮累计>`；使用实际同用户私有named pipe、双方进程／安装身份与测试RSA签名，核验重复唤起、越界／额外字段／外来PE拒绝，以及可信同版、远端旧版、信任水位和签名错误结果。只验证组件，不启动桌面服务、安装器或账户；不代表真实窗口、GitHub网络或完整安装验收。报告含完整方法指纹，登记shared,tooling。
- [verify-resource-cleanup.mjs](installation/verify-resource-cleanup.mjs)／[C#迁移夹具](installation/resource-cleanup-harness.cs)：`--evidence=<全新maintenance目录> [--only=<已知caseID[,]>] --prior-failures=<本轮累计>`，登记shared,tooling。六项为`same-root-migration`（默认／外置D）、`nonempty-data`、`cleanup-current`、`cleanup-references`、`cleanup-damaged`（损坏catalog／journal）和`cleanup-unknown-link`；共用失败预算，不重试。迁移反射调用真实`MigrationLease/Migrate`，资源清理由实际编译helper的`--uninstall`及包内Node执行，核验精确删留receipt、原件SHA与未知／链接保全。临时Ed25519私钥只在内存，公开根替换仅限本次planner资源；其配方和方法源均入报告。存档为合成SQLite v2及format-1 Save／checkpoint，其他PE／模块为不执行字节，不启动Native、installer、账户、登记或网络；组件不替代完整Commit／健康、真实旧局恢复或系统迁移验收。依赖锁定.NET SDK／net48、现有esbuild与包内Node22.14.0；默认保留隔离输出并关闭自动维护。
- [native-update-harness.mjs](installation/native-update-harness.mjs)：编译实际 .NET 更新管理，临时RSA仅在Node进程内，受管理HTTP模拟检查／下载／取消。`--only=<已知caseID[,]> --prior-failures=<小于当前失败预算的非负整数>`按原顺序选项，执行遵守[统一失败阈值](../../docs/reference/validation.md#历史通过率与失败阈值)，不重试；`long-path-download`固定合法启动根长200，使真实下载目录、最终文件与临时文件超过260，核验原签envelope／receipt／高水位和partial清理。临时文件长度按生产命名公式推导，不是成功中间文件的独立采样。取消、断流和摘要错误场景另核partial清理，范围绑定报告源码，不抵扣实际Apply。登记 shared,tooling，动态输入不可缓存；合成安装成员不启动Native／服务，不代表真实GitHub附件或installer执行，不修改Windows长路径策略。
- [native-launch-harness.mjs](installation/native-launch-harness.mjs)：编译实际 `InstallationLaunch`，以不可执行的合成字节核验新短目录ACL、原件／副本／元数据绑定，拒绝磁盘根TEMP、非私有目录、目标或元数据篡改及未知成员，并验证仅清理自建且摘要相同的文件。`--only=<已知caseID[,]> --prior-failures=<小于当前失败预算的非负整数>` 定向执行，登记 shared,tooling；进程内TEMP恢复、历史失败和未知文件保全均留报告。原目录创建／副本验证组件之外，`completed-cleanup`、`completed-cleanup-pending`、`completed-cleanup-unknown`、`completed-cleanup-tamper`、`completed-cleanup-in-use`共5项覆盖同版／历史成功目标、幂等、pending／未知／篡改／占用保全及按原句柄删除。新增项用进程内临时RSA真实验签，进程观察是合成的不存在PID记录，canonical下载实际保留并计缓存；不运行helper、Native、installer或账户管理，不能替代实际进程模块路径、签名交接和下一启动证明。
- [native-long-path-harness.mjs](installation/native-long-path-harness.mjs)、[native-migration-lease-harness.mjs](installation/native-migration-lease-harness.mjs)、[native-recovery-harness.mjs](installation/native-recovery-harness.mjs)：实际内部长路径、持续文件租约、完整数据库指纹与恢复门禁；后者可 `--playing-only` 定向复验。原生私有pipe跨进程验证须在普通用户token中执行，AppContainer连接超时不通过弱化ACL解决；登记 shared,tooling。
- [native-confirm-harness.mjs](installation/native-confirm-harness.mjs)／[C#夹具](installation/native-confirm-harness.cs)：编译实际helper选择新Native启动方式的4项专项，C#源SHA记录在证据中。生产路径持续运行新主机；只有隔离验收显式设置 `TABLEMAX_INSTALLATION_HEALTH_CHECK=1` 时使用已有静音、后台、loopback健康检查出口。测试分支不替代真实持续新主机的Apply链；两文件登记 shared,tooling，无独立preset。
- [verify-installed-legacy-save.mjs](installation/verify-installed-legacy-save.mjs)：`--delivery=<fixture冻结JSON> --helper=<实际fixture helper>`；复制真实1063旧档，核验原玩家／checkpoint／发行恢复、actual playing拒绝pending恢复及新局当前映射。固定隔离D、清继承注入环境并保留原件；登记 box,shared,tooling,game:pokemon-encounters。组合输入／helper证明不代替外层installer系统验收。
- [verify-application-handoff.mjs](installation/verify-application-handoff.mjs)：先 `--prepare-only --evidence=<新目录>` 生成不同四位PE和进程内RSA签名的完整双fixture；实际隔离账户通过 `--prepared-report=<原准备报告> --evidence=<新目录>` 精确复验后执行旧Native检查／下载／Apply→正常关闭→同Inno升级→新helper／持续Native健康。`--verify-prepared-only` 只核哈希，不执行安装；登记 box,shared,tooling。未执行报告不可写成升级通过。
  从launchDesktop返回后原字节保存旧Native双流，各限2MiB并记录实际退出码，超限或未到EOF不能称完整捕获；早期启动字节不可重放。readline关闭可能暂停原流，最终等待前恢复仍连接归档的双流；提前脱离归档会锁存为不完整，晚到EOF不能覆盖。实际卸载前及finally结束前回存实际D下desktop.log原字节／SHA，默认D仍为B；日志可能包含新旧主机记录，不能据此补推间接启动新版主机的退出码。先执行真实active卸载，失败不重试或提前关闭绕过；后续正常关闭也须退出0。
  完整正向默认使用私有工作目录下普通长度的 `安装 根` 和默认D=B；`--long-root-external-data --prepared-report=<原准备报告>` 使用I198与同一私有工作目录内全新短D，G仍在B，配置指针原字节须保持。两条均要求8个唯一passed步骤：`verify-prepared-materials`、`actual-old-inno-install`、`actual-old-host-transport`、`actual-check-download`、`real-apply-parent-handoff`、`actual-new-persistent-host`、`handoff-helper-and-data`、`exact-fixture-uninstall-cleanup`。首装明确 `/TASKS=!desktopicon`，旧装及新installer完成后分别核验桌面入口缺失、开始菜单启动及卸载入口存在。长根模式仅允许真实profile和prepared输入，与prepare／compile／reverify／active／framework互斥；不是较短启动诊断的别名。
  普通根、默认D的完整正向另运行真实无参Updater冷／热入口：无Native时由Updater启动实际Program／DesktopContext并显示中文「程序更新」面板；已有Native时连续两次唤起，核对固定`--check-updates`、原Native／服务PID及更新文件状态保持、实际渲染截图和受持句柄观察的Updater退出码0。冷入口在HTTP替换前使用默认HTTP，可能联系GitHub；终态可以是明确网络／签名错误，不证明纯托管HTTP或线上附件可用，也不请求下载／Apply。其后签名检查、下载及Apply仍使用受管理HTTP夹具。间接Native的argv／PID／模块有独立记录，不能从Updater退出码推导其退出码；这些入口检查没有开始游戏，不外推为活动对局保全。
  `--active-uninstall-only --prepared-report=<原准备报告>` 仅执行四个固定步骤：`verify-prepared-materials`、`actual-old-inno-install`、`actual-old-host-transport`、`exact-fixture-uninstall-cleanup`；卸载前必须证明原child仍活动，随后执行原finally中的真实默认卸载及exit0／日志检查，不运行检查、下载、Apply或框架恢复。该模式使用短根，scenario为`active-uninstall`。加 `--short-external-data` 则为独立的 `startup-external-data`：保持I198、D固定为本次profile工作目录内全新短D，实际ready须吻合D/B，G仍在B且配置指针保全。后者只用于启动分类，不能抵扣默认D完整链或Apply。二者与prepare／compile／reverify／framework模式互斥，不作正式GUID证明。
  长根完整链的B内原helper及下载EXE路径分别为273、317字符，fixture重定向的最长开始菜单快捷方式为259，避免测试自身触及Shell普通路径边界；默认完整链仍覆盖下载partial超过260的命名路径。计划长度不作实际启动证明：真实交接记录必须含从实际进程句柄查询的helper／installer模块路径与PID、路径观察标记，并与原字节来源、双副本、原签envelope及metadata／B审计的rawSHA相符。成功后短installer可能已被同SHA清理，工具据真实完成记录、cleanup结果及保留元数据判定；保留helper须实际重算SHA。公共JSON回存证据，不据间接进程记录推导退出码，也不冒称工具独立查询了目录ACL。不承诺任意深I/D；原启动分类调查见[整理归档](../../docs/archive/tooling-delivery-organization-2026-10-15.md#深路径webview2启动调查)。整链与正式交付的实际结果统一见[安装归档](../../docs/archive/windows-installation-update-2026-10-15.md)和[验收](../../docs/reference/acceptance.md#当前源码与本地交付)。
  `handoff-helper-and-data`另验证真实下一启动清理：先归档原交接公共JSON／rawSHA并取得已健康新版PID的真实句柄、模块与SID，通过已有fixture `quit.request`调用实际正常退出，核验退出0；再独立启动同版已安装Native，确认构造期间本地清理已知h／可存在i／元数据及B旧helper，核验`cleanup.json`和原B审计保全。canonical下载须实际仍在且SHA相同，配置／G／未知文件保持；正常服务启动会写foundation计数，不将两库所有字节不变作为错误前提。组件和真实下一启动分别按自身范围认定。
- [fixture-application-update.mjs](support/fixture-application-update.mjs)及[签名隔离回归](installation/fixture-application-update.test.mjs)：双PE夹具只签署并验证测试GUID的原始描述字节，RSA私钥仅在生成进程内，公钥只进入显式fixture编译资源。测试与生产产品ID相互拒绝，不修改生产签名器／信任根，也不把测试GUID改成生产GUID来获取签名。生产根互操作仍由实际正式程序集单独验证。
- [verify-update-transaction.mjs](installation/verify-update-transaction.mjs)：`--candidate=<目录> --manifest=<JSON> --helper=<EXE> --installer-source=<EXE> --evidence=<新JSON> [--only=<场景列表>]`，`--list`列场景；仅独立fixture产品ID和工程临时根，实际helper保存／切换／健康／迁移／保全。登记 shared,tooling；持久日志构造用于恢复入口，不冒称断电实测。

交接夹具的WinForms计时器在生产 `Program.Main` 启用视觉样式并进入消息循环后，才通过一次性 `Application.Idle` 回调启动；触发后移除回调，finally停止计时器并解除订阅。不能在调用生产入口前 `Timer.Start()`，使隐藏窗口抢先创建并破坏初始化顺序。该方法只修正夹具启动时点，不修改生产入口或把素材编译通过当作实际Apply通过。

协调器复合场景为 `pending-coordinator-repro`（旧fixture预期拒绝）与 `pending-coordinator-recovery`（完整目标精确匹配后恢复协调器、两种故障、候选／源安装器不符、无效签名目标拒绝及保全）；`--prior-failures=<小于当前失败预算的非负整数>`接收本轮此前已发生的失败数，编排方串行汇总并遵守[统一失败阈值](../../docs/reference/validation.md#历史通过率与失败阈值)。组件报告的新增失败0不清零本轮失败；真实框架卸载和不同PE失败恢复另验，历史轮次及授权见[安装归档](../../docs/archive/windows-installation-update-2026-10-15.md)。

同一handoff入口以 `--framework-recovery-only --prepared-report=<原准备报告> --evidence=<新目录>` 单独验证旧框架恢复，不混入正向Apply链。报告固定为 `<evidence>/report.json`，要求 `scenario:framework-recovery`、`result:passed`、`failures:0`，并保留 `preparedInput.path/sha256`。除 `verify-prepared-materials` 外，以下7个步骤必须各有且仅有一次passed，共8步：

1. `framework-old-inno-install`：实际A完整Inno安装及登记。
2. `framework-old-bootstrap-baseline`：记录A的unins EXE/dat、旧helper、配置与10成员指纹。
3. `framework-new-inno-expected-health-failure`：实际B切换后，fixture专用入口用包内Node合法写隔离foundation库并返回42；核对B失败、health-failed事务和数据库指纹变化。
4. `framework-old-uninstaller-retained`：A框架EXE/dat原字节和A登记保留，live helper已为B。
5. `framework-missing-live-helper`：只移走本轮live helper并保全原字节／SHA。
6. `framework-actual-old-default-uninstall`：执行实际A框架，由其内嵌固定SHA的A helper默认卸载。
7. `framework-preserved-data-and-registration`：受管程序、框架及精确登记移除，D/G/config与未知资料原字节保全。

故障请求仅被fixture alternate Main在检查／持续启动分支前接受，限定fixtureGUID、60001、隔离根、默认D、安装身份／receipt与包内NodeSHA；生产入口不可达。B健康失败是预期断言，成功触发不计产品失败。helper健康40与Inno准备拒绝7分别核验，A框架EXE／dat／登记／快捷方式原字节保留，live helper缺失后实际默认卸载保全D/G/config。Base64全字节／真实helper探针仍只证明解码保真，不证明完整容量。

- [verify-update-ui.mjs](installation/verify-update-ui.mjs)：`--root=<真实已安装fixture默认数据根> [--browser-channel=msedge] [--only=permissions|layout]`；实际隐藏WinForms／WebView2主机、公共屏、frame和普通浏览器权限及短屏截图。已有Edge可用于独立headless普通浏览器；不下载或升级全局浏览器。登记 box,shared,tooling；真实GitHub仅主动检查，未授权发布的新附件不模拟成在线下载通过。
- [verify-save-barrier.mjs](installation/verify-save-barrier.mjs)：`--root=<真实已安装fixture默认数据根>`；仅fixture SQLite本轮trigger拒绝保存，经实际私有安装管道请求更新，核对Native失败退出、原状态和进程保全。只清除本轮成功创建的trigger；登记 box,shared,tooling。
- [verify-production-user.ps1](installation/verify-production-user.ps1)：`-DeliveryPath <正式冻结交付JSON> -HandoffPreparedReport <双fixture准备报告> -OutputDirectory <全新证据目录> -AllowTemporaryAccount -UseProfileAcceptance`；必须先获用户明确授权，且由管理员启动。只创建随机标准测试账户及新profile，凭据仅进程内；依次要求默认D正向、长I／短外D正向、旧框架失败恢复三条fixture链全部通过，再运行正式产品ID首装／同包复装／快捷方式／真实保存后默认卸载／保留D同根重装读回／再次默认卸载及首次启动分项计量。每条各8个唯一passed步骤；三份报告均绑定同一prepared规范路径／rawSHA，驱动另记录各报告自身路径／rawSHA。子进程核对实际SID和profile，归一实际profile环境；PS5.1用raw `ProcessStartInfo`、UTF-8双流并行排空和真实ExitCode判定，日志独立保存。收尾按精确SID、固定句柄和创建时间有界清理进程，只移除本次账户与精确闲置profile；清理成功后才把隔离报告SHA绑定正式证明。工具不自我提升，fixture或环境变量不能替代实际干净用户。
  正式验证器收到卸载外层首段退出0后，仍独立有界观察原卸载EXE消失、日志能以 `FileShare.None` 独占读取，再将原字节／SHA回存工程；报告分别记录进程结果和 `completionObservation`。未达条件仍失败，不重试卸载或代删原EXE；首段0不能当作自删除及全部清理已经结束。
  可选 `-FixtureScenario active-uninstall|startup-external-data|long-root-external-data|chains`，要求同时提供 `-UseProfileAcceptance` 和prepared报告，与迁移模式互斥；前三者分别执行活动卸载4步、启动分类4步、长I／短外D完整正向8步，`chains`严格串行执行默认正向、长I／短外D正向、框架恢复三链，均不执行正式候选。三链报告依次为 `application-handoff/report.json`、`application-handoff-long-root-external-data/report.json`、`application-framework-recovery/report.json`。driver核验实际报告、精确双EXE副本、Medium SID／profile及账户清理后，才创建绑定原报告与隔离报告rawSHA的 `fixture-only-evidence.json`，明确 `formalInstallerExecuted:false`，不能生成正式shipping证明。省略模式时仍强制三链，不提供跳过其中一链的正式验收入口。
  当工程或输入EXE继承Low完整性标记时，正常标准用户也会以Low运行，不能写正常HKCU卸载登记。profile模式仅在已获授权的实际新用户LocalAppData/TableMaxAcceptance/随机32hex根中按原始字节物化Node和outer，源SHA保留；根、工作目录、实际SID及Node／系统PS两个Medium token都须核验。安装、Native／helper、下载与卸载临时执行均在该私有根，源码和冻结输入仍在原工程；不修改源标签、token或DACL。三条fixture链及正式证明记录executionProfile与精确执行副本，日志原字节回存工程，最后删除新账户与整个新profile。原环境失败与当前结果统一见[安装归档](../../docs/archive/windows-installation-update-2026-10-15.md)和[验收](../../docs/reference/acceptance.md#当前源码与本地交付)，不由fixture通过推定全部正式证明完成。

- [verify-portable-migration.mjs](installation/verify-portable-migration.mjs)：`--delivery=<1.0.6.21交付JSON> --portable-pointer=<便携current原始字节冻结副本> --evidence=<全新工程maintenance目录> --prior-failures=<小于当前失败预算的非负整数>`；登记 box,shared,tooling。当前工具输入固定为便携1.0.6.10→候选安装器1.0.6.21，冻结SHA白名单限制原指针及两份EXE；这说明输入与方法，不代表候选已经通过验收。未来候选变化须重新审查输入和方法，不能直接传另一个版本，也不表示更旧存档格式均兼容。历史候选与原证据范围统一见[验收](../../docs/reference/acceptance.md#当前源码与本地交付)，不随新输入改写。
  工具先实际启动冻结便携程序，用真实服务API保存玩家并正常关闭，再调用同SHA完整installer的 `/TABLEMAXMIGRATION=<原B>`，安装根I就是原便携B，新B为I/data。两个case串行运行：`defaultD`核对默认D及G复制、原件保留；`externalD`通过真实存储设置保留外置D指针并复制G。各自核验新版本恢复原玩家身份／发行、原B冻结成员SHA及实际默认卸载后的数据、配置、旧局依赖与未知资料保全，并核对资源删留receipt；原模块由真实便携启动物化，不合成非法目录。报告为 `<evidence>/report.json`，要求schema1、`scenario:portable-migration`、两个唯一case及各自实际安装／默认卸载通过，绑定原输入、四份执行副本、源码、实际SID和profile。旧便携启动前按冻结manifest校验传统路径预算，不把新安装器的长路径支持倒推给旧EXE。工具准备或静态检查不能替代这两项系统验收。
  独立账户模式使用 `verify-production-user.ps1 -DeliveryPath <1.0.6.21交付JSON> -OutputDirectory <新目录> -AllowTemporaryAccount -UseProfileAcceptance -PortableMigrationOnly -PortablePointer <冻结指针副本> -PriorFailures <小于当前失败预算的非负整数>`，不传 `-HandoffPreparedReport`；原完整链仍要求该prepared报告。迁移模式必须使用真实Medium profile能力，`TABLEMAX_INSTALLATION_MIGRATION_TMP`为同一私有根的 `work`，不在日常用户的个人目录运行。每个case前后须无该产品登记，失败先诊断修复，再按统一失败门禁定向复验；原始日志回存工程，账户／profile清理成功后由driver绑定隔离报告SHA。driver的通用编排不扩大此迁移工具的版本或证明范围，不外推到其他旧版本或候选；实际结果见[验收](../../docs/reference/acceptance.md#当前源码与本地交付)。

- [verify-installer-wizard.mjs](installation/verify-installer-wizard.mjs)／[C#夹具](installation/verify-installer-wizard.cs)：`--delivery=<冻结交付JSON> --migration-source=absent|present --evidence=<全新maintenance目录>`；两种源发现情况分别使用新证据目录。`--compile-only`／`--probe-only`可独立使用且不需delivery，分别只编译／运行自有窗口API探针。实际模式把同SHA installer复制到工程tmp中文空格目录，在未切换的私有桌面核对默认src/TableMax、精确提示、中文目标、快捷方式关／开／关、迁移不勾选跳页／勾选显示、同层源发现／留空、返回编辑保留、准备页及中文取消确认。仅自有Job PID／SID／路径的HWND可操作，明确禁止Install，正常退出后核对登记前后为空、目标和受管文件未生成、未知资料和原EXE SHA保全。PrintWindow实际截图经共享入口保存，记录DPI、物理WinRect和PNG尺寸；初始选中文本未绘出时目录由原生控件值证明。编译／probe不算Inno通过；两文件登记 shared,tooling，无独立preset。普通用户token的私有桌面所需权限不能以关闭保护或用户桌面fallback解决；实际取消不替代安装登记、卸载、UAC／SmartScreen。
  `--updater-entry --delivery=<fixture冻结交付JSON> --evidence=<全新maintenance目录>`为独立入口组件模式，与`--compile-only`／`--probe-only`互斥，要求普通用户token。它复用冻结fixture的真实Updater／Helper，核验私有桌面上的首个中文反馈、固定`--check-updates`转交、helper无参中文说明和正常退出；Native仅为合成身份下的argv回执夹具，Node／server不执行。此模式不运行Inno、桌面服务、账户、登记或网络，也不证明既有Native的IPC唤起、实际更新窗口及完整系统安装；不能拿组件回执扩展证明范围。
- 实际Inno交付和签名工具参数集中于[发布工具](../release/README.md)。installer不能再使用便携 `--extract-only`：通过实际安装后保存核验成员副本，后续组件测试只复用逐成员哈希绑定的副本；系统安装／升级必须另有实际证明。

中间检查设置进程环境 `TABLEMAX_AUTO_MAINTENANCE=0`／`TABLEMAX_TEST_MAINTENANCE=0`，结束工程进程后由主agent按任务记录统一安全维护一次，不因文档收尾追加。保存失败、权限失败或静音不充分继续留作失败，并区分工具／环境错误与产品结果，不把隐藏窗口等同静音。最终证明绑定installer、payload、安装manifest、当前映射、安装实例、B／D和实际Native／Node身份；完整首次启动计量包含当前G、helper及框架卸载文件。动态系统状态不可缓存，卸载后精确runtime副本只能供组件验证；正式系统证明仍需当前实际账户与登记边界。

## 原交付EXE的安全标记与原路径启动

完整installer交付另需独立证明原文件本身可运行。封包记录原EXE的SHA／字节、owner／DACL、mandatory label、备用数据流及Authenticode状态；验收前后再次读取。原EXE须为正常Medium，无Zone.Identifier／MOTW，Authenticode仅允许Valid或本项目的NotSigned。此检查不等于杀毒扫描、浏览器下载或SmartScreen信誉证明。

`tools/shared/windows-executable-security.mjs`提供只读`readWindowsExecutableSecurity`、门禁`assertWindowsExecutableSecurity`和可信本地产物的`normalizeBuiltExecutableSecurity`。底层系统PowerShell脚本只通过显式参数接收路径；归一化仅允许工程artifacts／tmp下单个已核SHA的本地EXE由Low改为Medium，必须保全原字节、owner、DACL及全部数据流。不得递归改工程标签、清除下载标记、调整源Node标签、token或系统安全策略。Low执行环境无权限修正时保持失败，改由真实Medium／管理员进程调用同一窄范围工具，不绕过门禁。

只补原文件验收时使用：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/test/installation/verify-production-user.ps1 -DeliveryPath <完整installer-delivery.json> -OutputDirectory <全新maintenance目录> -AllowTemporaryAccount -UseProfileAcceptance -OriginalExecutableOnly
```

此模式与迁移、fixture-only、HandoffPreparedReport及IncludeWizardAcceptance互斥；完整生产链默认先执行同一原EXE检查。它在新标准账户／真实profile中以CreateProcess直接启动冻结交付路径的原EXE，不复制EXE、不向源目录写入夹具；核真实原bootstrap及向导子进程的映像、SID、Medium、非提权令牌，实际中文向导、默认路径、返回及正常取消。只有原进程返回Inno正常取消码2、自有Job自然归零、登记及目标目录未改、原EXE逐SHA及安全标记未变、源目录内容未变，并删除测试账户／profile后，才写`original-executable-evidence.json`。这补充原完整系统证明，不将取消操作算作安装通过，也不重跑未受影响安装链。

完整生产链把该补充记录绑定到execution-receipt，独立封存保留引用；本地current切换及发布预检读取其原始报告、截图、账户清理记录并重新读取原EXE安全标记，缺失、路径为副本、内容或元数据改变均拒绝。对既有已验收current补证使用`node tools/release/original-executable-acceptance.mjs --current=<当前current.json> --proof=<补充证明>`，仅原子附加证明引用，不改原系统证明、候选、EXE、版本或公开附件。

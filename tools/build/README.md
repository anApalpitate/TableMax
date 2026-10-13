# 构建与运行时准备

常用入口：`pnpm setup:desktop`、`pnpm build`、`pnpm assemble:win <快照路径>`。准备工具沿用锁定版本与工作区缓存；模块构建写 `.cache/build-modules/v1/` 和 `build/snapshots/`，组装写 `build/desktop/`。`--only`、`--production` 等已有参数以各入口校验为准；只选择实际受影响单元。迁移后的旧冻结快照可能因源路径变化被拒绝，不改写旧指纹。工具回归放在实现旁。

[构建与运行规范](../../docs/reference/build-and-run.md)维护运行要求；[工具总索引](../README.md)用于按任务定位。内部辅助不作为独立业务命令。

`pnpm build -- --jobs=1|2|4`严格接受这三个值，默认1；重复或缺值均拒绝。Node运行时准备与原生编译顺序完成，再按并发上限执行独立单元；结果保持原单元顺序。失败会等待已开始单元结束，不发布不完整冻结快照。冻结发布与中心组装各自独占，`--only`不组装中心目录。

读取、源码解析和SHA只在同一阶段复用；编译后、冻结前及组装前后重新读取核验，不跨阶段相信mtime。命中结果的`originalBuildDurationMs`保留原构建耗时，`currentDurationMs`及`timings`记录本次读取／核验；`readPhases`记录实际读取字节、哈希和解析次数。现有`durationMs`兼容保留。

固定双游戏小夹具基准用`node tools/build/measure-efficiency.mjs`，输出至`artifacts/maintenance/development-efficiency/build/<独立时间>/`，源码及缓存仅在`tmp/efficiency-build-<六位随机后缀>/`。它使用真实esbuild/Vite，比较jobs1／2的冷、暖与单游戏变化，绑定夹具／方法／工具哈希，不导出EXE。当前仅单样本且内存为父Node高水位RSS，不足以修改默认并发；只有代表性样本提速至少10%、整个进程树峰值不超过1.5倍且产物一致后才考虑默认2。

| 工具                                                                                                 | 入口／用途                                                                           |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [assemble.mjs](assemble.mjs)                                                                         | `pnpm assemble:win`                                                                  |
| [build-idle.test.mjs](build-idle.test.mjs)                                                           | 工具隔离回归：`node --test tools/build/build-idle.test.mjs`                          |
| [build.mjs](build.mjs)                                                                               | `pnpm build`                                                                         |
| [unit-scheduler.mjs](unit-scheduler.mjs)、[read-phase.mjs](read-phase.mjs)                           | 有界单元调度及阶段内读取复用                                                         |
| [efficiency.test.mjs](efficiency.test.mjs)、[module-efficiency.test.mjs](module-efficiency.test.mjs) | `node --test tools/build/efficiency.test.mjs tools/build/module-efficiency.test.mjs` |
| [measure-efficiency.mjs](measure-efficiency.mjs)                                                     | 固定夹具冷／暖／单游戏变化及jobs1／2基准                                             |
| [module-build.mjs](module-build.mjs)                                                                 | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [Move-BuildCache.ps1](Move-BuildCache.ps1)                                                           | `powershell -NoProfile -File tools/build/Move-BuildCache.ps1`                        |
| [node-runtime-inputs.mjs](node-runtime-inputs.mjs)                                                   | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [pokemon-bot-brotli.test.mjs](pokemon-bot-brotli.test.mjs)                                           | 工具隔离回归：`node --import=tsx --test tools/build/pokemon-bot-brotli.test.mjs`     |
| [service-brotli.mjs](service-brotli.mjs)                                                             | 内部辅助／声明／夹具；由对应入口调用                                                 |
| [service-brotli.test.mjs](service-brotli.test.mjs)                                                   | 工具隔离回归：`node --test tools/build/service-brotli.test.mjs`                      |
| [setup-desktop.mjs](setup-desktop.mjs)                                                               | `pnpm setup:desktop`                                                                 |
| [verify-cache-failures.mjs](verify-cache-failures.mjs)                                               | `node tools/build/verify-cache-failures.mjs`                                         |
| [verify-module-build.mjs](verify-module-build.mjs)                                                   | `node tools/build/verify-module-build.mjs`                                           |
| [verify-module-runtime-input.mjs](verify-module-runtime-input.mjs)                                   | `node tools/build/verify-module-runtime-input.mjs`                                   |

## 开发环境操作：初次配置

首次工程基线按下列顺序；日常验证只选择实际改动范围，不重复首次全量流程。

```powershell
node --version
pnpm --version
dotnet --version
pnpm install --frozen-lockfile
pnpm setup:desktop
$env:TABLEMAX_TEST_SCOPE = 'full' # 首次工程基线核验；日常按实际变更设置范围
pnpm check
Remove-Item Env:TABLEMAX_TEST_SCOPE
pnpm build
pnpm verify:desktop
```

## 开发环境操作：独立原型的运行与检查

原型走查不代替真实交付验收；网络监听及静音沿用构建与运行规范。

```powershell
pnpm prototype:dev
```

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm prototype:build
pnpm prototype:verify
pnpm prototype:verify:game
```

## 开发环境操作：增量构建与分块组装需求

只选择相关模块；完整导出入口已经包含正式单元构建，不预先重复全量build。

```powershell
pnpm build
pnpm build -- --only=platform
pnpm build -- --only=game:modern-art --part=web
pnpm build -- --full
pnpm assemble:win -- --snapshot=build/snapshots/<哈希>.json
pnpm package:win
```

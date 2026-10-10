# 构建与运行时准备

常用入口：`pnpm setup:desktop`、`pnpm build`、`pnpm assemble:win <快照路径>`。准备工具沿用锁定版本与工作区缓存；模块构建写 `.cache/build-modules/v1/` 和 `build/snapshots/`，组装写 `build/desktop/`。`--only`、`--production` 等已有参数以各入口校验为准；只选择实际受影响单元。迁移后的旧冻结快照可能因源路径变化被拒绝，不改写旧指纹。工具回归放在实现旁。

[开发环境](../../docs/reference/development.md)维护具体运行要求；[工具总索引](../README.md)用于按任务定位。下表覆盖本分类文件，内部辅助不作为独立业务命令。

| 工具                                                               | 入口／用途                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [assemble.mjs](assemble.mjs)                                       | `pnpm assemble:win`                                                              |
| [build-idle.test.mjs](build-idle.test.mjs)                         | 工具隔离回归：`node --test tools/build/build-idle.test.mjs`                      |
| [build.mjs](build.mjs)                                             | `pnpm build`                                                                     |
| [module-build.mjs](module-build.mjs)                               | 内部辅助／声明／夹具；由对应入口调用                                             |
| [Move-BuildCache.ps1](Move-BuildCache.ps1)                         | `powershell -NoProfile -File tools/build/Move-BuildCache.ps1`                    |
| [node-runtime-inputs.mjs](node-runtime-inputs.mjs)                 | 内部辅助／声明／夹具；由对应入口调用                                             |
| [pokemon-bot-brotli.test.mjs](pokemon-bot-brotli.test.mjs)         | 工具隔离回归：`node --import=tsx --test tools/build/pokemon-bot-brotli.test.mjs` |
| [service-brotli.mjs](service-brotli.mjs)                           | 内部辅助／声明／夹具；由对应入口调用                                             |
| [service-brotli.test.mjs](service-brotli.test.mjs)                 | 工具隔离回归：`node --test tools/build/service-brotli.test.mjs`                  |
| [setup-desktop.mjs](setup-desktop.mjs)                             | `pnpm setup:desktop`                                                             |
| [verify-cache-failures.mjs](verify-cache-failures.mjs)             | `node tools/build/verify-cache-failures.mjs`                                     |
| [verify-module-build.mjs](verify-module-build.mjs)                 | `node tools/build/verify-module-build.mjs`                                       |
| [verify-module-runtime-input.mjs](verify-module-runtime-input.mjs) | `node tools/build/verify-module-runtime-input.mjs`                               |

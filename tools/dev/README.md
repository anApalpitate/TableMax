# 开发与启动

从项目根目录运行。`pnpm dev` 会先构建，再启动本机开发服务；`pnpm start` 启动已有桌面构建。开发监听遵循回环规则，正常运行配置沿用原行为。输出为 `build/` 与开发日志，进程占用期间维护保持阻塞。

[开发环境](../../docs/reference/development.md)维护具体运行要求；[工具总索引](../README.md)用于按任务定位。下表覆盖本分类文件，内部辅助不作为独立业务命令。

| 工具                     | 入口／用途   |
| ------------------------ | ------------ |
| [dev.mjs](dev.mjs)       | `pnpm dev`   |
| [launch.mjs](launch.mjs) | `pnpm start` |

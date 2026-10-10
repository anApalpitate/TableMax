# 跨分类辅助

工作区根定位与直接执行判断供 Node 入口复用；Node 命令须从项目根目录运行，错误 cwd 在产生输出前拒绝。迁移映射为唯一旧→新路径表，仅用于覆盖核对、历史身份兼容与展示，不提供旧路径执行转发。历史 ID 和文件统计查询保留旧逻辑路径，真实执行使用新位置，原数据库和已完成报告不改写。

[开发环境](../../docs/reference/development.md)维护具体运行要求；[工具总索引](../README.md)用于按任务定位。下表覆盖本分类文件，内部辅助不作为独立业务命令。

| 工具                                             | 入口／用途                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| [migration-paths.json](migration-paths.json)     | 内部辅助／声明／夹具；由对应入口调用                                   |
| [migration-paths.mjs](migration-paths.mjs)       | 内部辅助／声明／夹具；由对应入口调用                                   |
| [migration.test.mjs](migration.test.mjs)         | 工具隔离回归：`node --test tools/shared/migration.test.mjs`            |
| [workspace-root.mjs](workspace-root.mjs)         | 内部辅助／声明／夹具；由对应入口调用                                   |
| [screenshot-preview.mjs](screenshot-preview.mjs) | 内部预览编码桥接；隐藏 Python 子进程、根目录与输出格式核验，不改原素材 |

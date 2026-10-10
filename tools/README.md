# 工具索引

工具已由 `scripts/` 统一迁入 `tools/`，按用途分目录，不另建 npm 包。现有 pnpm 命令名与根目录维护 PowerShell 入口保持不变；直接脚本调用使用下列新路径，旧路径不提供转发。

| 要做的事                   | 分类入口                             | 常用入口与影响                                                         |
| -------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| 开发、启动                 | [dev](dev/README.md)                 | `pnpm dev`／`pnpm start`；构建或启动进程                               |
| 准备运行时、构建、组装     | [build](build/README.md)             | `pnpm setup:desktop`／`pnpm build`／`pnpm assemble:win`；写缓存与构建  |
| 导包、交付验证、发布       | [release](release/README.md)         | `pnpm package:win`／`pnpm package:release`；写交付产物，发布需明确授权 |
| 按范围验证、查询历史       | [test](test/README.md)               | `pnpm test -- --scope=<范围>`；默认静音，按实际范围选择                |
| 生成、转换与审计资源       | [assets](assets/README.md)           | 按平台／游戏／规则资料分类；可能写正式素材或清单                       |
| 空间、预算、内存和策略分析 | [analysis](analysis/README.md)       | 各工具分别说明只读报告、模拟或写入参数                                 |
| 清理、压缩、自动收尾       | [maintenance](maintenance/README.md) | 根目录维护入口不变；预览、精确清单与保护继续生效                       |
| 工作区与迁移辅助           | [shared](shared/README.md)           | 跨分类内部接口；测试历史身份兼容                                       |

Node／Python 工具从项目根目录运行，Node 子进程显式使用项目工作目录。PowerShell 维护默认按脚本位置定位源码根，保留受校验的 `-ProjectRoot`。参数、证据及产物位置沿用现有行为，迁移不扩大执行或删除范围。

新增工具放入已有职责分类；工具自身回归与实现同目录，产品验证按真实依赖分组。`package.json` 保留命令别名，测试范围以 runner/scopes 为权威，统计以测试历史实现为权威；不再建设重复注册表。迁移映射只维护路径与历史兼容。

详细操作见[开发环境](../docs/reference/development.md)，源码与产物边界见[目录职责](../docs/reference/project-structure.md)。

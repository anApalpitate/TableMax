# 打包与交付

`pnpm package:win` 导出本地运行 ZIP 和清单；`pnpm package:release` 制作完整 EXE。前置条件为锁定工具链、有效预算与冻结构建输入，输出在 `artifacts/releases/` 和版本维护证据目录；这些命令会写交付产物，不作普通路径检查使用。`pnpm release:github -- --notes=<说明路径>` 会创建线上 Release，仅在用户明确授权发布时执行。源码包由发布流程使用已提交 Git 源码生成，运行包不收录工具目录。

[开发环境](../../docs/reference/development.md)维护具体运行要求；[工具总索引](../README.md)用于按任务定位。下表覆盖本分类文件，内部辅助不作为独立业务命令。

| 工具                                                             | 入口／用途                                          |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| [package-limits.mjs](package-limits.mjs)                         | 内部辅助／声明／夹具；由对应入口调用                |
| [package-release.mjs](package-release.mjs)                       | `pnpm package:release`                              |
| [package.mjs](package.mjs)                                       | `pnpm package:win`                                  |
| [publish-release.mjs](publish-release.mjs)                       | `pnpm release:github`                               |
| [release-executable.mjs](release-executable.mjs)                 | `node tools/release/release-executable.mjs`         |
| [verify-release-executable.mjs](verify-release-executable.mjs)   | `node tools/release/verify-release-executable.mjs`  |
| [verify-shipping-executable.mjs](verify-shipping-executable.mjs) | `node tools/release/verify-shipping-executable.mjs` |

# 打包与交付

`pnpm package:win`增量构建并导出预装全部正式游戏与玩法的唯一完整EXE和本地清单；`pnpm package:release`只重新封装当前已验证内部载荷，不分配新修订号。`--edition`已退役并明确拒绝，部分游戏载荷不能交付。EXE在 `artifacts/releases/`，内部payload ZIP、manifest和当前指针在 `artifacts/package-payloads/`；内部ZIP不是用户下载包。

前置条件是锁定工具链、有效预算、冻结输入和全部正式模块完整性。游戏仍独立组织、增量构建，内部签名模块按字节变化复用或生成；正式模板不计入当前游戏库。独立游戏导出、Pages准备／部署和安装型作者工具包导出已停止，保留文件仅说明内部实现或历史验证边界。

本地程序使用四位 `1.x.x.y`，公开版本／附件使用三位 `1.x.x`，分配、冻结与发布映射见[版本流程](../../docs/reference/release.md#三位公开版本与四位本地构建2026-10-12)。只有获明确发布授权后才执行 `pnpm release:github -- --publish --notes=<已审文件>`，创建完整EXE与发布提交source ZIP两附件；本地导出和普通push不发布。

[开发环境](../../docs/reference/development.md)维护运行和验收要求，[工具总索引](../README.md)用于按任务定位。内部辅助不是独立业务命令。

| 工具                                                                         | 入口／用途                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [package.mjs](package.mjs)                                                   | `pnpm package:win`：唯一完整EXE                                   |
| [package-release.mjs](package-release.mjs)                                   | `pnpm package:release`：当前完整载荷重封                          |
| [package-limits.mjs](package-limits.mjs)                                     | 完整交付与内部模块预算                                            |
| [prepare-internal-games.mjs](prepare-internal-games.mjs)                     | 从冻结单元准备内部签名游戏载荷                                    |
| [game-packages.mjs](game-packages.mjs)                                       | 内部模块组装；直接独立导出拒绝执行                                |
| [game-package-format.mjs](game-package-format.mjs)                           | 签名目录与包格式纯辅助                                            |
| [game-release-assets.mjs](game-release-assets.mjs)                           | 内部目录精确成员／哈希核验，兼容原历史资产                        |
| [catalog-history.mjs](catalog-history.mjs)                                   | 内部签名历史合并及旧协议目录兼容                                  |
| [catalog-history.test.mjs](catalog-history.test.mjs)                         | `node --import tsx --test tools/release/catalog-history.test.mjs` |
| [windows-executable-name.mjs](windows-executable-name.mjs)                   | 当前无后缀EXE命名及历史双格式识别                                 |
| [release-executable.mjs](release-executable.mjs)                             | EXE封装辅助，由打包入口调用                                       |
| [verify-release-executable.mjs](verify-release-executable.mjs)               | 指定EXE提取核验，参数见源码                                       |
| [verify-shipping-executable.mjs](verify-shipping-executable.mjs)             | 实际当前完整EXE提取、哈希与原生安全，不传edition                  |
| [publish-release.mjs](publish-release.mjs)                                   | 获授权后发布完整EXE与source ZIP                                   |
| [prepare-pages.mjs](prepare-pages.mjs)、[verify-pages.mjs](verify-pages.mjs) | 已退役独立分发入口，明确拒绝执行                                  |
| [prepare-pages-history.mjs](prepare-pages-history.mjs)                       | 原Pages历史合并实现；无现行导出入口                               |
| [verify-game-packages.mjs](verify-game-packages.mjs)                         | 内部签名模块、闭包与逐文件核验                                    |
| [verify-pages-install.mjs](verify-pages-install.mjs)                         | 原Pages安装体系历史验证，不认证现行产品入口                       |
| [verify-version-adaptability.mjs](verify-version-adaptability.mjs)           | 原双版本与稳定目录的精确恢复历史验证                              |
| [verify-windows-editions.mjs](verify-windows-editions.mjs)                   | 原full／box交付组合历史验证                                       |

历史双版本、线上目录及安装型作者工具包通过记录只限定原构建，不代替当前完整EXE验收。SDK、模板和源码接入继续维护，见[游戏开发指南](../../docs/reference/game-development.md)。

# PowerShell 操作入口

从项目根目录使用 `scripts/` 中的入口；脚本按自身位置定位工作区，也可从其他工作目录通过绝对路径运行。参数及安全保护沿用原入口，默认预览，核对后才使用 `-Apply`。

| 入口                                                         | 用途                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| [Clean-Releases.ps1](Clean-Releases.ps1)                     | 清理旧EXE／历史运行包及打包残留；`-KeepLatestOnly` 保留当前已验证交付 |
| [Clean-Intermediates.ps1](Clean-Intermediates.ps1)           | 清理已核验的临时验证副本及精确清单中的生成内容                        |
| [Clean-ReleaseScreenshots.ps1](Clean-ReleaseScreenshots.ps1) | 清理 releases 直属目录内已结束的过程截图                              |
| [Maintain-Project.ps1](Maintain-Project.ps1)                 | 空闲时维护逻辑容量，默认超过 10GiB 后清至 8GiB 或安全候选耗尽         |
| [Compress-Workspace.ps1](Compress-Workspace.ps1)             | 审计及无损 NTFS 压缩，物理节省与逻辑容量分别计量                      |

清理和压缩的参数、保护范围见[开发环境](../docs/reference/development.md#清理本地中间物)，内部实现与工具回归见[维护工具](../tools/maintenance/README.md)。

当前交付只保护一个完整EXE、内部payload、manifest及匹配实际证明；历史full／box与ZIP由兼容读取器按原SHA保护。人工深度瘦身使用 `Clean-Intermediates.ps1 -ReviewedFilesManifest <精确清单>`，先预览，再携相同清单SHA执行唯一一次Apply；不绕过进程、路径、链接、近期修改、原件／存档和当前验收保护。本次6GB目标及实际结果见[瘦身记录](../docs/reference/project-slimming.md#深度瘦身至6gb内2026-10-12)，日常10GiB／8GiB阈值不变。

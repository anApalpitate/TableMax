# PowerShell 操作入口

从项目根目录使用 `scripts/` 中的入口；脚本按自身位置定位工作区，也可从其他工作目录通过绝对路径运行。参数及安全保护沿用原入口，默认预览，核对后才使用 `-Apply`。

| 入口                                                         | 用途                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| [Clean-Releases.ps1](Clean-Releases.ps1)                     | 清理旧运行包和打包残留；`-KeepLatestOnly` 保留当前已验证交付  |
| [Clean-Intermediates.ps1](Clean-Intermediates.ps1)           | 清理已核验的临时验证副本及精确清单中的生成内容                |
| [Clean-ReleaseScreenshots.ps1](Clean-ReleaseScreenshots.ps1) | 清理 releases 直属目录内已结束的过程截图                      |
| [Maintain-Project.ps1](Maintain-Project.ps1)                 | 空闲时维护逻辑容量，默认超过 10GiB 后清至 8GiB 或安全候选耗尽 |
| [Compress-Workspace.ps1](Compress-Workspace.ps1)             | 审计及无损 NTFS 压缩，物理节省与逻辑容量分别计量              |

清理和压缩的参数、保护范围见[开发环境](../docs/reference/development.md#清理本地中间物)，内部实现与工具回归见[维护工具](../tools/maintenance/README.md)。

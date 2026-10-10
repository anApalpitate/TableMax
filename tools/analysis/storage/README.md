# 空间分析工具

将旧验收目录里的一次扫描与快照聚合方法整理为常用 Node 工具，无新增依赖。适用于空间异常定位及清理前的候选分析；**不删除内容、不启动产品、不修改运行包**。

从项目根目录运行；使用项目既有 Node 22.14.0，报告路径每轮换一个名字：

```powershell
node tools/analysis/storage/space-analysis.mjs scan --output=artifacts/maintenance/space-analysis/inventory-20261010.json
node tools/analysis/storage/space-analysis.mjs analyze --input=artifacts/maintenance/space-analysis/inventory-20261010.json --output=artifacts/maintenance/space-analysis/report-20261010.json
node tools/analysis/storage/space-analysis.mjs analyze --input=artifacts/maintenance/space-analysis/inventory-20261010.json --hash-duplicates --output=artifacts/maintenance/space-analysis/duplicates-20261010.json
```

| 操作                        | 输入／输出                                              | 使用时机                                                                                 |
| --------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `scan`                      | 默认当前目录；可用 `--root=<目录>`；必须给新 `--output` | 开始分析时扫描一次。记录文件长度及修改时间，跳过链接和嵌套仓库，报告读取错误             |
| `analyze`                   | `--input=<快照>`；可选新 `--output`，否则打印 JSON      | 复用快照统计逻辑容量、目录、扩展名、大文件、生成图片及各个 `node.exe`；不重扫目录        |
| `analyze --hash-duplicates` | 同上，额外读取同大小的生成图片及 Node 文件              | 确实需要判断重复时使用，SHA-256 精确比对；修改时间／大小变化或出现链接时拒绝该文件并报告 |

报告中的截图是 `artifacts/maintenance/`、`artifacts/<游戏>/validation/` 与 `tmp/` 下生成图片的路径候选，排除原素材等目录；路径分类不能证明图片可删除，也不能涵盖所有另存截图。全部 PNG 的总体积另查 `extensions`。`node.exe` 清单不代表可清理运行时，必须进一步确认所在目录用途。重复字节只是理论冗余，不能直接等同可释放容量。

所有容量为逻辑文件长度，未减去 NTFS 压缩或硬链接共享空间。输出默认禁止覆盖；出现读取／哈希错误返回非零退出码，部分统计不能当完整测量。快照记录的是当时状态，后续删除前仍由现有清理入口复核路径、进程、近期修改及当前交付保护。

```powershell
node --test tools/analysis/storage/space-analysis.test.mjs
```

## 截图与运行副本自动维护

已于2026-10-10接入构建与公共验证助手，实施入口、截图选取、登记范围、保护和回归统一见[自动维护](../../maintenance/README.md)。下面保留分析依据及设计取舍；按完整运行包哈希复用验证解压缓存仍是技术建议，当前采用专属 Node 指纹及到期临时目录清理。

依据用户导出的 2026-10-10 20:02–20:11 只读分析，当时项目逻辑体积约 9.614 GiB，31 份 Node 内容相同，其中 12 份来自构建缓存；UNO 的 409 张截图约 1.406 GiB，66 张 5760×3240 高 DPI 截图约 825.2 MiB。这些是该时点的统计，候选容量与重复字节有重叠，不能相加视为清理收益。

当前采用减少截图生成、精确复用、专属 Node 缓存指纹及成功验证目录到期退役。原始高 DPI 代表图保持字节不变；不按视觉相似度自动删除，不把完整运行包中的 Node 移除。具体命令与保留边界只在自动维护说明维护。

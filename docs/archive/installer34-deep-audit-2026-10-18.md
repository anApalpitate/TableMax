# 完整安装器1.0.7.34与深度瘦身审计（2026-10-18）

用户要求先构建最新安装器，再开始深度瘦身。本轮完成完整候选封包和只读审计；没有执行清理Apply，也没有推广或发布。接续只见[任务页](../tasks/installer-and-deep-slimming.md)。

## 构建与原件

- [完整安装器](../../artifacts/releases/v1.0.7/1.0.7.34/TableMax-1.0.7.34-installer-win-x64.exe)：38112431字节，SHA256 15230898d50fbafc52761a7735561d42352d0f24fe564485bed5ee71cce6d32c；内部ZIP 46361026字节、实际提取99286588字节，三项均严格小于120,000,000字节。公开版本仍为1.0.7，四位修订由33原子分配到34。
- 冻结快照f89176a10cf652ee2e4e49c2ca4629f18d42d4cf892446d440478df7d23a0c15；42构建单元完成，内部签名目录8个发行／15个blob核验通过，覆盖七款正式游戏／八玩法。实际命令、输出及候选原件身份见[封包记录](../../artifacts/maintenance/build-and-deep-slimming-1792301636386/package-summary.json)。
- 封包继承Low标签；已核原SHA后仅将这个EXE归一化为Medium，原字节、owner、DACL与数据流保全，见[归一化凭据](../../artifacts/maintenance/build-and-deep-slimming-1792301636386/executable-security-normalization.json)。原路径新标准账户实际启动／取消及完整安装链尚未执行；当前会话为非管理员，无法创建所需隔离账户，不冒称通过。
- 为防止构建阶段先清理，临时显式延后安装器退役，并设置TABLEMAX_AUTO_MAINTENANCE=0；构建使用的方法源码留在本轮证据，之后按任务前SHA精确恢复工具原件，其他任务的未提交工具修改保留。没有叠加日常维护。

## current不一致与工具门禁

任务开始时磁盘current已指向1.0.7.33、snapshot b0058547c40fade54cd9a03440c648239bcd87551948a250cddae65a7bfdef69；本轮封包前后原指针SHA相同。其对应shipping-executable-checks-full.json缺失，53份现有shipping／finalized／execution证明中也没有33版本或33 EXE SHA匹配，见[证明定位核对](../../artifacts/maintenance/build-and-deep-slimming-1792301636386/proof-location-review.json)。文档原记载的已验收1.0.7.22不能代替33证明。

installer-retention只读预览实际因缺失原证明拒绝；首次另起系统PS5预览被脚本签名策略拒绝，未执行清理；改用当前既有PowerShell宿主后，current-delivery.ps1:46明确拒绝No passing actual EXE evidence。未修改执行策略、指针或断言。账户操作已有授权，缺少的是管理员执行环境和真实通过证据。

## 容量、候选与保护

完整前采样27422357103逻辑字节，含两个嵌套仓库；主快照唯一ENOENT经独立检查确认是断开的Junction，不跟随、不计普通文件字节。原始错误保留，见[补计与链接记录](../../artifacts/maintenance/build-and-deep-slimming-1792301636386/inventory-completion.json)。

只读草案：临时安装器／fixture构建根176个，快照估计9027426379字节；旧载荷派生副本与被最终轮覆盖的中间图78个根，快照估计3578171697字节。两者总预算12605598076字节，仅表示待进一步复核的潜在候选，未冻结为可执行逐文件清单，也不够据此承诺6GB目标。见[临时副本审查](../../artifacts/maintenance/build-and-deep-slimming-1792301636386/audit-tmp.json)及[载荷与截图审查](../../artifacts/maintenance/build-and-deep-slimming-1792301636386/audit-artifacts.json)。

保护33与34全树、原资料、正式与旧Electron存档、历史签名模块、ZIP／manifest、原证明／日志／源码、最新及仍需审查截图、三个verified-runtime、依赖／工具缓存、嵌套仓库、链接与目标、近期变化及其他任务修改。删除0文件、0字节，未消费Apply；严格低于6GB目标未达成。最终采样及文件保护核对留在本轮证据目录，统计不使用NTFS物理节省。

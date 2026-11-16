# 文档索引

按任务直达正文。需求、源码实现和验收结果分别核对。

## 开始开发

- **改盒子或游戏 UI**：先查[用户美术偏好](reference/art-preferences.md#agent-使用入口)和[通用视觉](reference/visual-design.md)，再查[盒子视觉](reference/box-visual-design.md)或[游戏索引](games/README.md)。复用边界见[界面复用](reference/ui-composition.md)。
- **改手机布局**：查[三类工作区](reference/visual-design.md#三类布局与宽高比适配)和[手机横向的门禁、恢复与验收](reference/visual-design.md#手机仅竖屏与横屏提示2026-10-28)。游戏特例直达[马尼拉航道与宽屏](games/manila/visual-design.md#三类工作区与净区2026-10-29)、[阿瓦隆座位与断点](games/avalon/interaction.md#三类布局落地2026-10-29)或对应[游戏](games/README.md)。源码与真机证据见[布局接续](tasks/all-games-layout-rollout.md)。
- **改游戏规则或人机**：从[游戏索引](games/README.md)查采用版次、来源、秘密及验证。共享人机边界见[人机规格](reference/bot-players.md)，新模块见[扩展指南](reference/game-development.md)。
- **改入座、权限或同步**：查[身份、房主与信息权限](reference/phase-02-platform-spec.md#身份房主与信息权限)和[连接与连续游玩](reference/phase-02-platform-spec.md#连接与连续游玩)。
- **改换机、回退或旧档恢复**：查[换机审批、撤销与重启领回](reference/phase-02-platform-spec.md#浏览器入座换机与外部连接2026-10-07)、[决策点回退与分支状态](reference/phase-02-platform-spec.md#提交回退与恢复语义)。旧档分别查[旧绑定字段兼容](reference/phase-02-platform-spec.md#160游戏选择手机房主与独立提交)和[发行匹配与旧模块缺失](games/README.md#模块交付与旧局恢复)。
- **运行或验证**：查[构建与运行](reference/build-and-run.md)、[按变更范围选检查](reference/validation.md#按变更范围选择检查)、[源码视觉验证](reference/source-visual-verification.md)和[工具命令](../tools/README.md)。
- **导出安装器或核对交付**：查[冻结与更新契约](reference/build-and-run.md#windows-安装与整个程序更新)、[安装验收](reference/installation-validation.md)、[Release 流程](reference/release.md)与[实际交付](reference/acceptance.md#当前源码与本地交付)。

产品范围见[需求基线](requirements.md)，实现概况见[项目说明](../README.md)。工程结构见[架构](reference/architecture.md)、[目录职责](reference/project-structure.md)及[优化进展](reference/architecture-improvements.md)。

## 定向查询

已知章节用 docs:read 直读，未知时先按所属目录搜索。查找结果只作定位，补读适用范围、例外和状态；续读使用原 SHA 对应的游标。命令与参数见[文档工具](../tools/maintenance/README.md#定向markdown读取与迁移审计)。

## 维护与追溯

- [参考主题](reference/README.md)、[待办与接续](tasks/README.md)、[重要决策](decisions/README.md)、[协作职责](subagent/README.md)。
- [维护、来源与迁移规则](reference/maintenance.md)、[历史归档](archive/README.md)、[历史证据可用性核查](archive/historical-evidence-audit-2026-10-23.md)。
- [已导入资源](../assets/README.md)、[原始素材工作区](../../TMP/TableMaxMaterial/AGENTS.md)、[用户偏好原话](reference/art-preferences-sources.md)。
- [工作区维护](reference/workspace-maintenance.md)、[深度瘦身](reference/deep-slimming-methodology.md)、[历次容量结果](reference/project-slimming.md)。

## 开发效率速查

[开发环境](reference/development.md)与[项目技能](reference/maintenance.md#项目技能与按需加载)按需阅读。[任务收尾检查](reference/maintenance.md#任务完成检查)、[文档优化接续](tasks/documentation-wiki-and-skills.md)和[实际任务提效观察](tasks/development-efficiency.md)各维护自己的证据。

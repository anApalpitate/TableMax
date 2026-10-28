# 文档索引

按问题进入唯一正文；要求、实现和验证分别判断。首次核对Git状态与本任务diff，已读且未变的章节只补变化，不通读全库。

## 开始开发

- 产品要求、现行与未来范围：[需求基线](requirements.md)；实现概况见[项目说明](../README.md)。
- 当前源码、本地current、待验候选与公开版本：[当前交付与边界](reference/acceptance.md#当前源码与本地交付)。四者不互相替代。
- 身份、房主、换机与秘密：[平台权限](reference/phase-02-platform-spec.md#身份房主与信息权限)；动作、保存及回退查[提交与恢复](reference/phase-02-platform-spec.md#动作提交与恢复)。
- 连接与连续游玩：[连接规格](reference/phase-02-platform-spec.md#连接与连续游玩)；计时、缩放及互动查[显示与互动](reference/phase-02-platform-spec.md#计时显示与互动)。
- 工程依赖和模块边界：[架构](reference/architecture.md)；文件与产物归属查[目录职责](reference/project-structure.md)。
- 界面共性提炼与统一组织：[界面复用](reference/ui-composition.md)，区分已有宿主能力、游戏专属组合及待实施接口。
- 全部游戏的适配批次、区域重排与验收：[落地计划](tasks/all-games-layout-rollout.md)；公共控件去重与兼容迁移见[架构优化](reference/architecture.md#面向本轮适配的架构优化计划)。
- 固定工具链、启动、构建、安装目录和冻结：[构建与运行](reference/build-and-run.md)。实际命令查[工具索引](../tools/README.md)。
- 选择检查、证据复用及失败处理：[验证](reference/validation.md#按变更范围选择检查)；安装／更新证据和原EXE直接启动查[安装验收](reference/installation-validation.md)。
- 源码视觉检查：[源码视觉验证](reference/source-visual-verification.md)。源码通过不证明安装器或实体设备通过。
- UI、插画、声音及视觉审查：先查[用户美术偏好](reference/art-preferences.md#agent-使用入口)，按问题表选通用／游戏条目，原话追溯查[偏好来源](reference/art-preferences-sources.md)；再查[通用视觉](reference/visual-design.md)；大厅、头像、游戏库及设置查[盒子视觉](reference/box-visual-design.md)，游戏查对应主题。视觉改造收尾交付变化展示HTML。
- 玩法、采用版本、来源、秘密、策略、资源及验证：[游戏索引](games/README.md)。宝可梦原版／扩展、电力公司、现代艺术、拉密、UNO、阿瓦隆和马尼拉均从所属主题进入。
- 新游戏接入：[扩展指南](reference/game-development.md)；电脑玩家配置与调度查[人机规格](reference/bot-players.md)。
- 来源变化、冲突与采用理由：[来源复核](reference/maintenance.md#来源身份与变化复核)；迁移、旧锚点与入链查[小批迁移](reference/maintenance.md#小批迁移与闭合)。
- 待办与接续：[任务索引](tasks/README.md)；重要取舍查[决策索引](decisions/README.md)，开发协作查[职责索引](subagent/README.md)。
- 容量、清理保护与透明压缩：[工作区维护](reference/workspace-maintenance.md)；方法查[深度瘦身](reference/deep-slimming-methodology.md)，实际结果查[瘦身记录](reference/project-slimming.md)。
- 本地交付、签名和明确授权后的发布：[Release流程](reference/release.md)。普通提交与推送不代表发布授权。

素材搜索、原件保存与处理进入[外部素材工作区](../../TMP/TableMaxMaterial/AGENTS.md)，不创建Git；正式资源核验后导入[assets](../assets/README.md)。外部路径仅适用于本机布局，不是运行依赖。

## 定向查询

已知文件先列大纲或直接读章节；入口未知时按实际目录查找，命令与参数查[文档工具](../tools/maintenance/README.md#定向markdown读取与迁移审计)。默认查询当前源码，追溯历史才显式纳入归档。

```powershell
pnpm docs:find "换机" --path=docs/reference
pnpm docs:read docs/reference/validation.md --outline
pnpm docs:read docs/reference/validation.md --heading="按变更范围选择检查"
```

查找只返回定位片段；按结果的标题层级、SHA和读取参数补读必要正文。跨段前提、例外及状态未完整返回时继续补读。续读使用工具返回的版本化游标，文件变化后重新定位；MORE或未命中均不能证明内容不存在。

已知术语也可用定向 `rg -n` 查所属文件或目录；仅当前正文不足、出现矛盾或需要原理由时扩大范围。正文、索引、任务及技能的职责见[维护规则](reference/maintenance.md)。

## 维护与追溯

- 跨游戏主题总览：[参考索引](reference/README.md)。
- 原文来源、核验等级和项目解释：对应游戏的来源页；不得由摘要升级认证。
- 历史过程、旧哈希及旧验收：[归档索引](archive/README.md)。历史通过不升级为当前产物通过。
- 历史引用失效、原件退役／缺失及同字节备份：[逐项可用性核查](archive/historical-evidence-audit-2026-10-23.md)。入口修复不等于补回原证明；缺失原件不得复用。
- 剩余工作：[任务索引](tasks/README.md)；完成后归档，长期知识回到对应主题。
- 资源原件、版本、派生和用途：[资源入口](../assets/README.md)。

新增、迁移或归档主题时同步受影响索引与入链，保留适用旧URL。当前命令只在所属工具README维护，文档整理不改变原始资料、存档或验收结论。

## 开发效率速查

[开发环境](reference/development.md)路由运行、验证与维护；[项目技能](reference/maintenance.md#项目技能与按需加载)组织文档整合与定向验证流程。按需加载，普通问答不启动写入。改动收尾按[完成检查](reference/maintenance.md#任务完成检查)核对适用交付物，临时文件一键清理仍先预览后确认。

[文档优化接续](tasks/documentation-wiki-and-skills.md)与[既有提效观察](tasks/development-efficiency.md)分别保存剩余事项和真实任务收益；字节、token及费用分开记录，不以读取量下降代替正确性。

# TableMax：Agent入口

Windows 全数字桌游平台。电脑管理兼展示，真人使用玩家端，支持局域网和手动外部入口。以用户最新指示和[需求基线](docs/requirements.md)为准，实现概况见[README](README.md)。

## 最小阅读

先查 Git 状态和任务 diff，明确范围与完成标准。同文件仅一名负责人，保留其他改动。已注入且未变的入口只补 diff。按[任务入口](docs/README.md#开始开发)读取所需章节，默认 8 KiB，MORE 按游标续读。归档仅用于追溯，生成物只查已知证据。

- 游戏规则、版本、秘密、人机与验证查[游戏索引](docs/games/README.md)，模块接入查[扩展指南](docs/reference/game-development.md)。
- UI／声画先查[用户偏好](docs/reference/art-preferences.md#agent-使用入口)和[通用视觉](docs/reference/visual-design.md)，再查[盒子](docs/reference/box-visual-design.md)或游戏。手机横屏门禁直接查[通用正文](docs/reference/visual-design.md#手机仅竖屏与横屏提示2026-10-28)。
- 权限、保存及回退查[平台规格](docs/reference/phase-02-platform-spec.md#身份房主与信息权限)。运行、工具链和冻结查[构建与运行](docs/reference/build-and-run.md)，命令查[工具索引](tools/README.md)。

## 关键边界

1. **权限与恢复。** 服务端权威，按身份投影秘密，动作统一校验、保存和决策点回退。管理员不占座，仅见公开投影。手机与电脑玩家同权限。房主及换机授权与 checkpoint 分离，回退不能恢复旧授权，换机撤销旧凭证和连接。
2. **游戏与共享层。** 核验采用版次原文、数据、秘密和决策点。同版出版方原文及修订优先，项目解释单列。宝可梦仅中文检索，优先用户资料，查不到按既有授权定案并记理由。各游戏版本、人数和旧玩法恢复范围按[游戏索引](docs/games/README.md)。规则、策略、UI、样式和资源内聚于游戏，React／TypeScript 共享层负责装配，不直接依赖游戏类型或动效。管理和玩家各有盒子与游戏页，保留 SDK 公开投影及旧 ABI。默认／豆包／绝悟各游戏独立，仅使用本人授权信息、走统一动作，不能代掉线真人。
3. **视觉与素材。** 明亮桌游美术、主体和主要操作优先。单步直接操作，位置选择具体确认。管理、帮助、记录按需浮窗，声画只表达已保存结果，规则用顶层图文，不加必经教程。信息≥16、主要动作／关键状态≥18、电脑标题≥20 CSS px，短屏重排，适配 4K 与 Windows DPI。管理保存缩放，手机无电脑显示设置。偏好只取用户历史。视觉改造交付变化展示 HTML。素材检索／处理走[外部素材工作区](../TMP/TableMaxMaterial/AGENTS.md)，不建 Git，核验后导入 assets。授权位图生成／编辑／核验交[imagegen 子 agent](docs/subagent/imagegen.md)。
4. **安装与发布。** Windows 只交付预装全部正式玩法的完整 installer EXE，不提供盒子版、单独游戏安装或 ZIP 导入。按[冻结契约](docs/reference/build-and-run.md#windows-安装与整个程序更新)安装、更新和推广。新局用 EXE 核验映射，旧缓存不得覆盖。旧局固定原发行，缺失时保留原档并提示旧完整 EXE。按[Release 流程](docs/reference/release.md#三位公开版本与四位本地构建2026-10-12)维护三位公开版本和四位本地构建，公开版本只按明确指示调整。最终 installer EXE 不得超过 50 MB（50,000,000 字节）。内部 ZIP、实际提取和首次启动占用继续记录并核验完整性。已交付字节与标签保留。未经明确授权不得发布、部署 Pages 或生成 source ZIP。日常导出、文件命名、载荷归属和版本计数见[交付流程](docs/reference/release.md)。
5. **运行安全。** 凭证走私有管道，桥接核验本源、顶层和角色，Job Object 清理服务。运行栈、锁定依赖、配置根、资源根与迁移见[构建与运行](docs/reference/build-and-run.md#配置目录与网络)，配置不可写不回退 C 盘。只有明确要求新导出包才验安装器。推广前按[安装验收](docs/reference/installation-validation.md)在干净 Windows 用户下检查原 EXE 安全标记并用标准 Medium 令牌直接从原路径启动。同 SHA 副本不能替代，验收临时标准账户及 profile 按精确 SID 清理。
6. **范围验证。** 盒子、单游戏、共享依赖及纯文档各按[改动范围](docs/reference/validation.md#按变更范围选择检查)选择。默认按低通过率排序，累计 10 失败即停，保留旧账和未执行项。有实质修复或环境纠正时记录原因与范围，在已有授权内独立预算定向复验。无变化不重试，不放宽断言或跨权限，不以复用省必需验收。测试默认隐藏、静音、使用实际渲染；本机服务只监听 127.0.0.1，真实 LAN 验收才开放网卡。禁止关闭或全局放行防火墙，修改防火墙须明确授权。
7. **维护与协作。** 独立读取和检查批量进行，有界等待。派工、接续及收尾查[维护规则](docs/reference/maintenance.md)及[职责](docs/subagent/README.md)。用项目 Prettier，不升级全局环境。要求、实现、建议和验收分别判断，当前规则归唯一正文，完成任务归档并修复入链。主 agent 按[周期提交与推送](docs/reference/maintenance.md#周期提交与推送)仅处理本任务已验证改动，不强推、不混入其他任务、不自行发布。
8. **临时文件与清理。** 新临时文件归唯一 tmp/<任务唯一ID>/，收尾配一键清理入口。清理先预览后 Apply，保护原件、存档、交付、验收、历史模块、活跃进程及依赖缓存，不按 Git 忽略项删除。容量阈值、一次清理、历史退役与路径保护按[工作区维护](docs/reference/workspace-maintenance.md)。

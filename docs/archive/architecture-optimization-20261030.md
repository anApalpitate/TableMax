# 架构优化实施记录（2026-10-30）

按用户授权先备份，再实施A01—A09中的低风险高收益项，整理当前文档并提交。现行职责归[架构](../reference/architecture.md)，逐项落地与后续边界归[实施状态](../reference/architecture-improvements.md)；本页仅保留本轮证据和失败纠正。

## 备份、范围与提交

工作前独立索引备份分支 `codex/architecture-before-optimization-20261030`，提交 `d6453302dfe24f4bc4d753c82ca218951b8780b2`，树 `dc5b85dd73a6c086892f8b40076b3a614e0ded0c`，基线 `7708d806d2b0166babb7e94cb12a201e921f8568`。纳入当时跟踪文件及两份已发现未跟踪项目文件；忽略的生成物不纳入Git，原暂存区不变。详见[备份记录](../../artifacts/maintenance/architecture-optimization-20261030/backup.json)。备份为本地分支。

代码阶段提交 `e1bcda60`。本轮未改规则、公共API、通信／存档字段、版本或安装发行；保留工作前其他任务改动。当前权限与事务仍由唯一RoomCoordinator负责。向origin/master推送被自动审批拒绝：本次请求只明确commit，审核要求具体远端默认分支的明确授权；未绕过拒绝，本地提交保留。

## 验证与真实变化

| 层次                       | 本轮结果与证据                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 权威／保存／恢复及表现单元 | 147项通过、0失败；[原始结果](../../artifacts/maintenance/test-history/runs/0d572a94-ba6d-4248-beb3-b2d014419033/results.json)，含15个定向测试文件                                                                                        |
| 依赖与资源反例             | 最终两组通过；[范围结果](../../artifacts/maintenance/test-history/runs/7a5b5cb7-2ae1-437d-8dbc-7f6c31b4be99/results.json)，覆盖静态／动态／导出／require／类型导入、生产夹具拒绝、来源缺失／哈希／白名单／预算拒绝                       |
| 生产输入与独立构建         | 全部发现的运行代码单元通过依赖输入扫描；服务、宝可梦网页及common／variant两组资源构建通过；[最终结果](../../artifacts/maintenance/test-history/runs/bc156b7a-e906-4df7-90e6-13c509251919/results.json)                                   |
| 修改前画面                 | 11个相同合法局面采样；[基线报告](../../artifacts/maintenance/architecture-optimization-20261030/before/report.json)                                                                                                                      |
| 源码浏览器                 | 65个场景通过：61扩展、4原版隔离检查；[最终报告](../../artifacts/maintenance/architecture-optimization-20261030/browser-r2/report.json)                                                                                                   |
| 连续演出                   | 三端3个真实保存触发场景通过，录像与逐帧联系表见[审阅HTML](../../artifacts/maintenance/architecture-optimization-20261030/review/index.html)及[报告](../../artifacts/maintenance/architecture-optimization-20261030/video-r2/report.json) |
| 静态检查                   | 项目TypeScript无输出通过；packages／games、新构建工具、范围映射及ESLint配置检查通过；任务文件采用项目Prettier                                                                                                                            |

浏览器覆盖管理2—6人、1280／1920／4K、手机390×844与电脑玩家1280／1920横屏的取牌、暂持、初翻、等待、私看、多目标、缓冲／强制换入、研究投票、结算和事件详情；确认／旋转草稿、授权内容隔离、全屏切入及减少动态按既有夹具检查。动态3场景是65场景的定向补证，不另计新增独特场景。

实际视查了电脑取牌决策区、手机暂持、六人及两人管理画面、等待区前后图与演出逐帧联系表；对照页保留同局面前后图，不把架构重构描述为一次视觉改版。录像来自现行React渲染和已保存反馈，未替换渲染器或逐帧摆姿势。未测帧率／内存／构建提速，不宣称性能改善；实体手机、Windows DPI、电视、真人听感、网络持久化及新安装器仍不在此次源码证明内。

收尾复核进一步区分“恢复分支”和“正常下一小局”：前者消费旧反馈，后者保留同一授权下的新保存演出。新增对应回归，[定向结果](../../artifacts/maintenance/test-history/runs/bf78e3d6-fe59-40f2-870c-27ed1802381b/results.json)通过；去重后的单元覆盖为148项。修正后重新采集65场景与三端录像，最终入口见上表报告。

## 失败、纠正与保留边界

- 初次定向单元计划遗漏已有game-setup-recovery测试所属UNO范围，在执行前被范围校验拒绝；补正真实依赖后运行，未扩大为全游戏行为回归。
- 新依赖lint发现既有宝可梦兼容测试夹具读取node:crypto。只为准确文件在测试上下文增加例外，生产扫描仍拒绝；补反例后复验通过。
- 构建集成首轮将普通任务缓存误传给仅允许efficiency-build夹具的隔离入口，被安全检查拒绝，见[失败记录](../../artifacts/maintenance/test-history/runs/166e5eed-f979-4b30-937f-e2f98ec77b3c/results.json)。测试改为正常内容寻址构建缓存，没有放宽路径保护。
- 下一轮沙箱在素材realpath读取处返回EPERM，见[失败记录](../../artifacts/maintenance/test-history/runs/a510e051-18da-4ee6-8666-2b1a827857a6/results.json)；取得适用执行权限后定向复验通过。格式化scopes文件也遇到沙箱写入限制，获准后使用同一项目Prettier完成。
- 证据抽帧时Playwright自带FFmpeg缺少图片编码器，改为隐藏静音浏览器解码本轮原录像并取帧；不安装或升级全局工具。曾在计划文件创建前误调用视频入口，ENOENT发生在测试执行前，补齐计划后通过。
- 旧失败保留，各轮默认10失败预算。未放宽断言、权限边界或资源预算，不将失败轮重写为通过。

资源门槛当前仅覆盖已具备完整来源记录的漫画资源组，旧CSS覆盖与大型命令分发仍有后续空间，详见实施状态。缺失R05插图、Mega／羁绊待定独立效果继续留空，不因架构整理补造玩法。

## 文档与临时内容

原架构与建议分别归[原架构快照](architecture-before-optimization-20261030.md)、[原建议](architecture-improvements-plan-20261030.md)；已完成布局记录归[完成快照](all-games-layout-rollout-completed-20261029.md)。保留原锚点和来源SHA，任务页只留真正未完成项；研究清单纠正为16图已接入、R05唯一缺口。

临时内容统一位于 `tmp/architecture-optimization-20261030/`；[清理入口](../../artifacts/maintenance/architecture-optimization-20261030/cleanup.ps1)默认预览，Apply需检查路径、链接、进程、近期文件及与预览的哈希一致性。正式报告、审阅图片／录像、源素材、Git备份和构建缓存不在删除范围，本轮不执行删除。

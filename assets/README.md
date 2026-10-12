# 美术与声音资源

所有运行和原型资源统一存放在此目录；既有原始生成物、实物参考及当前核验证据保留在 `artifacts/`，历史运行截图和生成副本按[瘦身记录](../docs/reference/project-slimming.md)审计退役，原素材与规则资料继续保护。后续本机美术资源检索、加工与交付候选核验使用外部 [TableMaxMaterial 工作区](../../TMP/TableMaxMaterial/AGENTS.md)，按其 [素材流程](../../TMP/TableMaxMaterial/docs/reference/material-workflow.md)交接；该目录不创建 Git，既有资料不迁移。采用的资源与来源／版本清单仍导入本目录，所有正式游戏的资源随完整 EXE 预装，运行时不请求外站或外部工作区；历史原局固定读取原发行资源。

宝可梦扩展事件及新版研究的92份适用素材已于2026-10-12迁入[扩展事件资源](games/pokemon-encounters/expansion/events/README.md)，尚未接入UI与当前完整EXE；逐项来源及SHA以该目录清单为准。

| 位置                                  | 职责                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `platform/`                           | 头像、通用桌游组件及原型公共素材                                                                                    |
| `games/pokemon-encounters/`           | 首版角色、声音与牌桌背景                                                                                            |
| `games/pokemon-encounters/catalog.ts` | 当前卡面／硬币的浏览器资源表；颜色与文件映射，不参与规则与存档                                                      |
| `games/template/`                     | 内部扩展验证游戏资源，不计入正式游戏预装清单                                                                        |
| `games/modern-art/`                   | 五族独立画作图集、小封面、浏览器资源映射、imagegen 来源及独立原创音效清单；70卡图像为原创演绎                       |
| `games/power-grid/`                   | 经典德国地图地形、工业厂景图集、小封面、独立音效和来源清单；城市、连线与费用由代码绘制                              |
| `games/uno/`                          | UNO 独立实体桌面、四色封面与原创音频；数字和功能符号由代码绘制，来源见 [资源页](../docs/games/uno/assets.md)        |
| `games/rummikub/`                     | 拉密牌面、桌面、封面与离线声音；数字、颜色和百搭标记由代码绘制，来源见[资源页](../docs/games/rummikub/assets.md)    |
| `games/avalon/`                       | 原创复古亚瑟王画卷、六角色图集、透明圣杯／宝剑／乌鸦与独立离线音效，来源见 [资源页](../docs/games/avalon/assets.md) |

## 规则图解与历史截图

当前各游戏的顶层图文规则采用独立主题插画、HTML／SVG 和代码图解；准确人数、角色、数字、座号和箭头由已采用规则及代码排版，示例不读取正式玩家秘密。原图、来源、提示词、尺寸、哈希及实际导入状态由各游戏清单维护，不能将生成预览作为产品验收。

较早三款游戏的 `rules/` 曾使用隔离示例对局的真实区域截图：宝可梦三图（牌桌、取牌、计分），现代艺术四图（手牌、行情、拍卖、收藏），电力公司五图（电厂市场、横向地图、公司、顺序、燃料价区）。这些历史图片来自当时实际渲染，并非 imagegen 规则示意，不包含正式玩家秘密；已退出当前规则导入。规则参考原件和对应哈希继续保留，其他历史运行截图按具体清理清单退役。

源截图捕获入口、分游戏限定与 PNG→WebP 操作集中维护在 [开发环境：图文规则维护与验证](../docs/reference/development.md#图文规则维护与验证)。统一转换脚本为 `tools/assets/rules/compress-rule-captures.py`，生成后核对解码尺寸与像素字节完全一致，再同步游戏清单和 UI 引用、构建并验证；资产页只维护素材职责和来源，不另复制操作流程。

现代艺术音效 v2 的 16 个本地 WAV 分别表达五类入场及其他保存结果，v1 资料保留。

## 替换

每类牌对应独立角色文件；同类实体牌复用该卡面。统一右上角分值、左上角能力标与名称由 `CardFace` 排版，取值来自已采用的卡牌定义，不把文字或分值烘焙到插画里。替换角色图只需新增版本文件、更新 `catalog.ts` 映射和对应清单；保持类别 ID，不能借换图修改规则。牌框及翻牌由游戏 CSS 管理。

各目录的 `manifest*.json` 保存来源、版本、哈希与核验。`characters/manifest-official.json` 是官方图鉴原图导入记录；`manifest-a/b/c.json` 记录独立 imagegen 尝试，只有百变怪生成成功，其余明确失败。导入角色图不能标成生成原创。官方图鉴 PNG 保留白色柔边；深棕牌心显示为轻微光晕，使用 contain 与内距保留完整角色。

2026-10-02 已清理 19 张退出引用的旧卡面、牌背和硬币 WebP；原始 PNG 保留在 `artifacts/phase-05/imagegen/source/`，历史文件与来源在游戏 `manifest.json` 的 `retiredAssets`，压缩副本可从 Git 历史恢复。未采用的等待背景原图与清单归档在 [theme-preparation](../artifacts/phase-02/theme-preparation/manifest.json)，不留在运行资源目录。

已生成、已核验、已导入 UI 分别记录；替换后验证全部 16 类、角标对比、窄卡名称及实际手机／公共屏。维护方法见 [资源规格](../docs/games/pokemon-encounters/assets.md) 与 [维护规则](../docs/reference/maintenance.md#子-agent-与素材记录维护)。

# 美术与声音资源

所有运行和原型资源统一存放在此目录；原始生成物、实物参考和核验截图保留在 `artifacts/`。资源随程序本地打包，运行时不请求外站。

| 位置                                  | 职责                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `platform/`                           | 头像、通用桌游组件及原型公共素材                                                              |
| `games/pokemon-encounters/`           | 首版角色、声音与牌桌背景                                                                      |
| `games/pokemon-encounters/catalog.ts` | 当前卡面／硬币的浏览器资源表；颜色与文件映射，不参与规则与存档                                |
| `games/template/`                     | 扩展验证游戏资源                                                                              |
| `games/modern-art/`                   | 五族独立画作图集、小封面、浏览器资源映射、imagegen 来源及独立原创音效清单；70卡图像为原创演绎 |
| `games/power-grid/`                   | 经典德国地图地形、工业厂景图集、小封面、独立音效和来源清单；城市、连线与费用由代码绘制        |

## 替换

每类牌对应独立角色文件；同类实体牌复用该卡面。统一右上角分值、左上角能力标与名称由 `CardFace` 排版，取值来自已采用的卡牌定义，不把文字或分值烘焙到插画里。替换角色图只需新增版本文件、更新 `catalog.ts` 映射和对应清单；保持类别 ID，不能借换图修改规则。牌框及翻牌由游戏 CSS 管理。

各目录的 `manifest*.json` 保存来源、版本、哈希与核验。`characters/manifest-official.json` 是官方图鉴原图导入记录；`manifest-a/b/c.json` 记录独立 imagegen 尝试，只有百变怪生成成功，其余明确失败。导入角色图不能标成生成原创。官方图鉴 PNG 保留白色柔边；深棕牌心显示为轻微光晕，使用 contain 与内距保留完整角色。

2026-10-02 已清理 19 张退出引用的旧卡面、牌背和硬币 WebP；原始 PNG 保留在 `artifacts/phase-05/imagegen/source/`，历史文件与来源在游戏 `manifest.json` 的 `retiredAssets`，压缩副本可从 Git 历史恢复。未采用的等待背景原图与清单归档在 [theme-preparation](../artifacts/phase-02/theme-preparation/manifest.json)，不留在运行资源目录。

已生成、已核验、已导入 UI 分别记录；替换后验证全部 16 类、角标对比、窄卡名称及实际手机／公共屏。维护方法见 [资源规格](../docs/games/pokemon-encounters/assets.md) 与 [维护规则](../docs/reference/maintenance.md#子-agent-与素材记录维护)。

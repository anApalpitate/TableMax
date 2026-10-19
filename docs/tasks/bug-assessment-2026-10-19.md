# 真人反馈快速评估（2026-10-19）

状态：2026-10-19原始反馈评估保留如下；2026-10-20用户另行明确授权起始弃牌、角标／轨迹、通用设置、保存提示及马尼拉布局修正。当前实现与验证分别见[宝可梦验证](../games/pokemon-encounters/validation-scenarios.md)、[马尼拉验证](../games/manila/validation-scenarios.md)及[通用视觉](../reference/visual-design.md)。本任务不改变梦幻重复发动规则、不改公开版本、不导出安装器。源码模拟证据不代表反馈所用EXE或实体手机。

以下三个反馈章节保留2026-10-19评估时的源码结论和边界；当前实现以开头主题链接为准。

## 宝可梦：弃牌中的梦幻反复发动

用户反馈：与朋友游玩时，同一张梦幻反复发动多次。

- **原版存在该行为路径，是否为规则缺陷待核对。** [取牌分支](../../games/pokemon-encounters/rules/index.ts)不区分牌库与弃牌来源，只要取到梦幻便进入 `mew-other`；[状态](../../games/pokemon-encounters/rules/state.ts)没有逐实例能力消耗字段。因此梦幻被换出到弃牌顶、再次被取到时可以再次发动。现行[原版规则](../games/pokemon-encounters/rules.md)规定新摸到的梦幻执行完整效果，但没有扩展版那样的逐实例消耗限制，不能直接套用扩展规则判定原版错误。
- **扩展版暂未确认同类漏洞。** [实现](../../games/pokemon-encounters/expansion/index.ts)在取牌时检查 `usedAbilityIds`，梦幻目标交换时调用 `useAbility`，实际回洗时仅清除被洗回牌库的实例。按[扩展能力消耗规则](../games/pokemon-encounters/expansion-design.md)，弃牌／移动／缓冲保留消耗，实际回洗后恢复；回洗后再次发动本身符合现行规则。[现有测试](../../games/pokemon-encounters/expansion/rules-ability-usage.test.ts)包含梦幻消耗及回洗场景，本轮仅读取，未运行，也不据此宣称用户局面通过。

接续：先绑定实际版本、原版／扩展、是否发生回洗，以及同一实例的连续动作／存档。若扩展在未回洗时重复发动，应按规则缺陷优先定位；原版先确认采用规则与用户预期，不在本次改变规则。

## 马尼拉：手机浏览器文字溢出

用户反馈：手机浏览器游玩时，文字普遍溢出相应框。

**记录为用户实测问题；静态检查发现风险，尚未独立复现具体控件。** [标签布局](../../games/manila/ui/label-layout.css)存在 `white-space: nowrap`、`max-content` 列和 `overflow: visible`，窄屏岸上格使用固定行高；[玩家操作布局](../../games/manila/ui/harbor-layout.css)还使用 `min-width: max-content` 及固定高度按钮。这些组合值得检查，但必须结合最终层叠、文字内容、字体和真实视口，不能仅凭 CSS 宣称已证明普遍溢出。

接续：在实际版本的手机玩家端覆盖 320／360／390／430px、横竖屏、长文案与各操作阶段，分别核对文字和所属框的几何及截图；优先岸上位置、货物标题、操作按钮和菜单。完成标准为文字完整可读且不侵入相邻框，沿用字号要求，通过重排解决；模拟视口与实体手机证据分开。实体设备接续见[马尼拉任务](manila-development.md)。

## 设置入口：盒子音频与游戏视频

- **盒子音频入口缺失，源码确认。** [BoxScreen](../../apps/web/src/screens/BoxScreen.tsx)提供倒计时、视频和管理等入口，没有音频调节控件。游戏中的独立声音控件不能替代盒子入口。用户本次明确要求音频调节放在游戏设置里，记为待实现要求，本轮不修改界面。
- **“游戏中均无视频设置”与当前源码不符，实际版本及入口可发现性待核对。** 当前七款游戏／八个玩法均接入 `DisplaySettings`，位于游戏菜单的设置区，例如[宝可梦原版](../../games/pokemon-encounters/web/index.tsx)、[扩展版](../../games/pokemon-encounters/expansion/web/index.tsx)及[马尼拉](../../games/manila/web/index.tsx)。马尼拉明确仅向非玩家端显示该入口；[共享视频面板](../../apps/web/src/components/DisplaySettings.tsx)标题为“视频设置”，原生分辨率等功能还依赖显示桥接。入口存在不等于所有设备拥有相同选项，也不证明用户 EXE 包含该实现。

接续：核对用户具体游戏、主机／公共屏／玩家端及 EXE 版本，确认菜单入口是否可见、可找到、能打开；依据[通用显示边界](../reference/visual-design.md)区分电脑显示与手机设置。本次反馈保留为可发现性／端口覆盖待核对，不直接新增重复视频面板。

## 剩余接续

- 梦幻重复发动：仍按上文绑定原版／扩展、实际发行、是否回洗及同一实例的动作记录；本次不改变规则。
- 实体设备：待实际手机浏览器核对声音手势限制、全屏支持及文字字形；未执行真实LAN、安装器或原生系统窗口验收。

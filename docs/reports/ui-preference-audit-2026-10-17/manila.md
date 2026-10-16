1. 三端顶栏（G05）：菜单仍为文字按钮，账本图标旁重复文字。调整：菜单、账本和规则使用同系列铜牌图标，保留提示、可访问名称与44px热区；视觉居中须渲染复核。证据：`games/manila/web/index.tsx:132`。
2. 已完成（2026-10-17，1/1项）：规则、账本、菜单已改为同系列44px铜牌图标；手机不再隐藏这些SVG，中文名称保留在aria及提示中。三角色×四尺寸12组、48图、三浮窗开关／焦点、无命令／revision变化及账本秘密边界通过，见[校验](../../../artifacts/maintenance/ui-preference-implementation-20261017/manila-round01/report.json)。实际看图居中，类型、局部ESLint和Web增量构建通过；仅源码及模拟视口，未重封安装器。

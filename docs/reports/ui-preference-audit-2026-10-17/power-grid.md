1. 玩家行动页等待他人操作（G06）：状态栏只有姓名，行动者头像／高亮在独立公司页。调整：状态栏复用公开头像，保留“轮到你”强调及秘密现金边界。证据：`games/power-grid/web/index.tsx:424`、`games/power-grid/ui/PhonePages.tsx:3`。
2. 三端顶栏（G05）：菜单仍为文字按钮。调整：换成工业主题菜单图标，保留提示、可访问名称和44px热区，渲染核验视觉居中。证据：`games/power-grid/web/index.tsx:410`。
3. 地皮进度与选区预览（G03）：门槛、候选区域和未确认状态用“·”串联。调整：门槛各自成组，预览标题与“未确认”独立，保留完整数值。证据：`games/power-grid/ui/GameProgress.tsx:36`、`games/power-grid/ui/map.tsx:1356`。
4. 桌面侧栏hover提示（G12）：背景为完全不透明的`#343e36`。调整：背景使用alpha色并保持文字不透明，保留键盘提示与定位；在地图深浅背景上核验可读性。证据：`games/power-grid/ui/desktop-board.css:383`。
5. 已完成（2026-10-17，4/4项）：状态栏加入公开行动者头像，保留本人轮次、暂停及秘密现金边界；菜单改为居中44px工业图标；门槛、候选区域与未确认状态分别成组；侧栏提示背景使用92% alpha，文字保持实色。局部ESLint、类型检查、电力公司Web增量构建通过；实际源码渲染11组、25张截图通过，覆盖三端及320／390／1280px，核验合法换人、长昵称、现金权限、原门槛、浮窗焦点，以及地图深浅背景的hover／键盘提示。证据：`artifacts/maintenance/ui-preference-implementation-20261017/power-grid-round02/report.json`及同目录聚焦截图。模拟视口不替代实体设备、Windows DPI或安装验收；安装器未重封。

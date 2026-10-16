1. 玩家行动页等待他人操作（G06）：状态栏只有姓名，行动者头像／高亮在独立公司页。调整：状态栏复用公开头像，保留“轮到你”强调及秘密现金边界。证据：`games/power-grid/web/index.tsx:424`、`games/power-grid/ui/PhonePages.tsx:3`。
2. 三端顶栏（G05）：菜单仍为文字按钮。调整：换成工业主题菜单图标，保留提示、可访问名称和44px热区，渲染核验视觉居中。证据：`games/power-grid/web/index.tsx:410`。
3. 地皮进度与选区预览（G03）：门槛、候选区域和未确认状态用“·”串联。调整：门槛各自成组，预览标题与“未确认”独立，保留完整数值。证据：`games/power-grid/ui/GameProgress.tsx:36`、`games/power-grid/ui/map.tsx:1356`。
4. 桌面侧栏hover提示（G12）：背景为完全不透明的`#343e36`。调整：背景使用alpha色并保持文字不透明，保留键盘提示与定位；在地图深浅背景上核验可读性。证据：`games/power-grid/ui/desktop-board.css:383`。

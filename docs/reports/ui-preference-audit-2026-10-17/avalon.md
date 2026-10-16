1. 三端顶栏（G05）：菜单、规则仍为文字按钮。调整：使用复古材质的菜单和书本图标，保留提示、可访问名称与44px热区；视觉居中须渲染复核。证据：`games/avalon/web/index.tsx:276`。
2. 讨论、刺杀、密投等待及记录（G03）：阶段、顺序、个人选择等用“·”串联。调整：阶段、行动者、进度、提交状态分别成组，保留必要保密说明。证据：`games/avalon/web/index.tsx:201`、`games/avalon/ui/PlayerControls.tsx:82`、`games/avalon/ui/Board.tsx:240`。
3. 玩家讨论（G03／G16）：状态栏、操作区和顺序区重复发言者与顺序说明。调整：保留一处行动说明及完整顺序区，操作区只留“发言完成”和进度。证据：`games/avalon/web/index.tsx:300`、`games/avalon/ui/PlayerControls.tsx:80`。
4. 最后刺杀（G06）：状态栏没有刺客头像，卡片高亮仍依据队长、发言或选中状态。调整：公开刺杀阶段展示刺客头像及姓名，或持续高亮其卡片。证据：`games/avalon/web/index.tsx:298`、`games/avalon/ui/Board.tsx:160`。
5. 已完成（2026-10-17，4/4项）：菜单／规则采用44px居中主题图标；阶段、提案、本人选择与保密条件独立分组；讨论操作区只留进度及完成入口；刺杀阶段展示公开刺客头像与完整姓名。同步修复状态、保存条及历史记录的长昵称溢出和动作末字孤行，保留姓名中的中点。局部ESLint、类型检查、阿瓦隆Web增量构建通过；实际源码渲染28组、63张截图通过，覆盖5／6／10人、三端及320／390／1280px，核验完整顺序、本人密投、刺客与队长不同、刺杀前保密、浮窗关闭／焦点及无额外动作。证据：`artifacts/maintenance/ui-preference-implementation-20261017/avalon-round05/report.json`；原失败记录保留。模拟视口不替代实体设备、Windows DPI或安装验收；安装器未重封。

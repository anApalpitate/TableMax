1. 三端顶栏（G05）：菜单、规则仍为文字按钮。调整：使用复古材质的菜单和书本图标，保留提示、可访问名称与44px热区；视觉居中须渲染复核。证据：`games/avalon/web/index.tsx:276`。
2. 讨论、刺杀、密投等待及记录（G03）：阶段、顺序、个人选择等用“·”串联。调整：阶段、行动者、进度、提交状态分别成组，保留必要保密说明。证据：`games/avalon/web/index.tsx:201`、`games/avalon/ui/PlayerControls.tsx:82`、`games/avalon/ui/Board.tsx:240`。
3. 玩家讨论（G03／G16）：状态栏、操作区和顺序区重复发言者与顺序说明。调整：保留一处行动说明及完整顺序区，操作区只留“发言完成”和进度。证据：`games/avalon/web/index.tsx:300`、`games/avalon/ui/PlayerControls.tsx:80`。
4. 最后刺杀（G06）：状态栏没有刺客头像，卡片高亮仍依据队长、发言或选中状态。调整：公开刺杀阶段展示刺客头像及姓名，或持续高亮其卡片。证据：`games/avalon/web/index.tsx:298`、`games/avalon/ui/Board.tsx:160`。

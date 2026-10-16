1. 三端顶栏（G05）：菜单、规则仍为文字按钮。调整：采用菜单和书本图标，沿用撤销／重置图标的线条与材质；保留提示、可访问名称与44px热区，渲染核验视觉居中。证据：`games/rummikub/web/index.tsx:133`。
2. 已完成（2026-10-17，1/1项）：菜单／规则已换为24px线条图标、44px触控按钮，保留中文可访问名称与提示。三角色×四尺寸共12组实测、36图、开关及Escape焦点、命令／revision不变、已选牌与草稿保持均通过，见[校验](../../../artifacts/maintenance/ui-preference-implementation-20261017/rummikub-round01/report.json)。实际看图居中；类型、局部ESLint及Web增量构建通过。仅源码与模拟视口，未重封安装器。

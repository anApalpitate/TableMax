# TableMax

供自己和朋友线下聚会使用的 Windows 局域网全数字桌游平台。电脑负责本地服务与公共屏，玩家通过手机浏览器加入并操作；正式游玩不依赖互联网或实体组件。

首版目标是《宝可梦奇遇：皮卡丘和朋友们》完整可玩，并具备身份与秘密信息隔离、房主决策点回退、手机重连和程序重启恢复能力。后续目标包含经典版《电力公司》德国地图，具体边界以需求为准。

## 当前状态

需求基线、项目基础结构与粗粒度开发阶段已建立，尚未开始软件实现。下一阶段是确认技术栈、环境配置和代码结构设计，详见 [第一阶段任务](docs/tasks/phase-01-engineering-foundation.md)。当前没有依赖清单、启动命令、测试入口或可运行程序；具体库、版本与源码布局仍待确认。

## 项目入口

- [需求文档 v1.0](docs/requirements/TableMax_需求文档_v1.0.md)：产品范围、技术建议、规则研究项与首版验收标准；原件已移入 docs，正文保持不变。
- [Agent 入口](AGENTS.md)：最小阅读顺序、工作与提交约定。
- [文档索引](docs/README.md)：按任务意图查找文档。
- [目录职责](docs/reference/project-structure.md)：现有目录与未来内容的边界。
- [开发阶段与任务](docs/tasks/README.md)：粗粒度阶段、主要任务与交付物。
- [第一阶段任务](docs/tasks/phase-01-engineering-foundation.md)：技术栈确认、环境配置、代码结构设计及完成标准。
- [编辑器工作区](TableMax.code-workspace)：以相对路径打开本项目，包含项目级显示、搜索与监听设置。

## 目录概览

```text
TableMax/
  AGENTS.md
  README.md
  TableMax.code-workspace
  .gitignore
  docs/
    README.md
    requirements/TableMax_需求文档_v1.0.md
    reference/
      README.md
      maintenance.md
      project-structure.md
    decisions/README.md
    tasks/
      README.md
      phase-01-engineering-foundation.md
    archive/README.md
```

文档随实现同步维护。较大任务完成并通过相关验证后自动提交，默认不 push。

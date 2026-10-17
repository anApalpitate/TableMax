# 马尼拉三端界面全量修复归档（2026-10-17）

1. 主机 3／4 人局旧 `:has()` 多列规则删除；商人栏在 3／4／5 人局都单列。商人卡按内容定高，剩余空间改为木质账房底板；3／4 人增加座号图例。
2. 主航道“状态／分红”改成独立分区，使用4px列间距和左侧分隔，不再出现“靠港A分红池”粘连。当前行情价提高底色、描边和字重。
3. 玩家竖屏显示0／5／10／13与当前格；船员座号增加左侧分隔。390×844压缩航道高度后动作条进入首屏。
4. 玩家横屏改为真实三列：航道／岸线／操作确认。玩家航道改为横向，现金／抵押／股数条固定首屏；844×390选中目标后确认按钮底部385px，不超出视口；932×430同样通过。
5. 所有按钮、`.button`、`summary`、`[role="button"]` 加 `user-select:none`；输入框、文本域、选择框不变。
6. 验证：设计10布局/10详情、竖屏港湾45检查/296交互、触控25检查（320/390/430/844/932）、马尼拉单测、TypeScript、ESLint通过。按钮真实拖动不产生选区。
7. 边界：原生开发构建游戏库选择预装 Manila 超时，未取得3／4／5人原生布局证据；视觉证据来自同源码组件夹具。0秒仍可确认未复现；本轮不改计时规则。
8. 视觉证据：`artifacts/maintenance/manila-ui-full-fix-20261017/`；结果为 `artifacts/manila/validation/ui-fix-design-final3/`、`artifacts/maintenance/manila-harbor-rebuild-20261017/mobile/ui-fix-harbor-final2/`、`artifacts/maintenance/manila-touch-layout-20261017/touch/ui-fix-touch-final2/`。

9. 最终源码构建快照：`80dc1fddaea173f129426cc3d444d1858596d84dbce5dcbfbbffe8b2c5a3d15b`。


10. 最终候选安装器1.0.7.28，38,110,969字节，SHA256 `ddabcca6285ef3513f5122e8fcc8be524942c1f12950df5996842ccdc98ffed4`；current保持1.0.7.22，不推广。

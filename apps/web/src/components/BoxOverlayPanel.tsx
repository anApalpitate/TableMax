import type { ComponentProps, ReactNode } from 'react';
import { OverlayPanel } from './OverlayPanel';
import { BoxPanelContext } from './box-panel-context';
import './box-overlay-panel.css';

export function BoxPanelScope({ children }: { children: ReactNode }) {
  return <BoxPanelContext.Provider value>{children}</BoxPanelContext.Provider>;
}

/** Box panels scroll within their inset content, preserving the rounded shell. */
export function BoxOverlayPanel(props: ComponentProps<typeof OverlayPanel>) {
  return (
    <BoxPanelScope>
      <OverlayPanel embedded {...props} />
    </BoxPanelScope>
  );
}

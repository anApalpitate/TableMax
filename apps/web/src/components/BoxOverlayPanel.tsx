import type { ComponentProps } from 'react';
import { OverlayPanel } from './OverlayPanel';
import './box-overlay-panel.css';

/** Box panels scroll within their inset content, preserving the rounded shell. */
export function BoxOverlayPanel({
  children,
  className,
  ...props
}: ComponentProps<typeof OverlayPanel>) {
  return (
    <OverlayPanel
      {...props}
      className={`box-overlay-panel${className ? ` ${className}` : ''}`}
    >
      <div className="box-overlay-panel__content">{children}</div>
    </OverlayPanel>
  );
}

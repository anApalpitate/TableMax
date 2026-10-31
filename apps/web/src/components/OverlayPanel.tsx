import { useContext, type ComponentProps } from 'react';
import { OverlayPanel as SharedOverlayPanel } from '@tablemax/web-host';
import { BoxPanelContext } from './box-panel-context';
import './overlay-panel.css';

export function OverlayPanel(props: ComponentProps<typeof SharedOverlayPanel>) {
  const boxAppearance = useContext(BoxPanelContext);
  return <SharedOverlayPanel {...props} boxAppearance={boxAppearance} />;
}

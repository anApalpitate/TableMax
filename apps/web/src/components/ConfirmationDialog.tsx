import { OverlayPanel } from './OverlayPanel';
import { useRef, type ReactNode } from 'react';

export function ConfirmationDialog({
  title,
  children,
  cancel,
  confirm,
  disabled = false,
}: {
  title: string;
  children?: ReactNode;
  cancel(): void;
  confirm(): void;
  disabled?: boolean;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  return (
    <OverlayPanel title={title} close={cancel} initialFocus={cancelButton}>
      {children && <div className="confirmation-message">{children}</div>}
      <div className="dialog-actions">
        <button
          ref={cancelButton}
          type="button"
          className="secondary"
          onClick={cancel}
        >
          取消
        </button>
        <button
          type="button"
          className="danger"
          disabled={disabled}
          onClick={confirm}
        >
          确定
        </button>
      </div>
    </OverlayPanel>
  );
}

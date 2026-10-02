import { OverlayPanel } from './OverlayPanel';
import { useRef, type ReactNode } from 'react';

export function ConfirmationDialog({
  title,
  children,
  confirmLabel,
  cancel,
  confirm,
  disabled = false,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancel(): void;
  confirm(): void;
  disabled?: boolean;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  return (
    <OverlayPanel title={title} close={cancel} initialFocus={cancelButton}>
      <div className="confirmation-message">{children}</div>
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
          {confirmLabel}
        </button>
      </div>
    </OverlayPanel>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
export function OverlayPanel({
  title,
  close,
  children,
}: {
  title: string;
  close(): void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="overlay-panel"
      aria-labelledby="panel-title"
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }
      }}
    >
      <div className="panel-heading">
        <h2 id="panel-title">{title}</h2>
        <button className="secondary" aria-label="关闭面板" onClick={close}>
          关闭
        </button>
      </div>
      {children}
    </dialog>
  );
}

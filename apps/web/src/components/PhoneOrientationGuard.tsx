import { useEffect, useRef } from 'react';

/** A non-dismissible top-level modal also blocks dialogs inside the player iframe. */
export function PhoneOrientationGuard() {
  const modal = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = modal.current!;
    element.showModal();
    element.focus({ preventScroll: true });
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={modal}
      className="phone-orientation-guard"
      tabIndex={-1}
      aria-labelledby="phone-orientation-title"
      aria-describedby="phone-orientation-description"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Tab' || event.key === 'Escape')
          event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="phone-orientation-guard__content">
        <span className="phone-orientation-guard__phone" aria-hidden="true" />
        <span className="phone-orientation-guard__arrow" aria-hidden="true">
          ↶
        </span>
        <h2 id="phone-orientation-title">请将手机竖屏，继续玩耍</h2>
        <p id="phone-orientation-description">转回竖屏后自动继续</p>
      </div>
    </dialog>
  );
}

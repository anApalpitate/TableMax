import { useId, useLayoutEffect, useRef, useState } from 'react';
import './setting-help.css';

/** A setting's label doubles as its hover, keyboard and touch help target. */
export function SettingHelp({
  id,
  label,
  hint,
}: {
  id?: string;
  label: string;
  hint: string;
}) {
  const generatedId = useId();
  const tipId = `${generatedId}-help`;
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!open || !tip.current) return;
    const node = tip.current;
    node.showPopover?.();
    const position = () => {
      const rect = anchor.current!.getBoundingClientRect();
      const height = node.getBoundingClientRect().height;
      const width = node.getBoundingClientRect().width;
      node.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
      node.style.top = `${Math.max(12, rect.bottom + height + 8 <= innerHeight ? rect.bottom + 8 : rect.top - height - 8)}px`;
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);
  return (
    <span className="setting-help">
      <button
        ref={anchor}
        id={id}
        type="button"
        className="setting-help__label"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => {
          if (document.activeElement !== anchor.current) setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (open && event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {label}
      </button>
      {open && (
        <span
          ref={tip}
          id={tipId}
          role="tooltip"
          popover="manual"
          className="setting-help__tip"
        >
          {hint}
        </span>
      )}
    </span>
  );
}

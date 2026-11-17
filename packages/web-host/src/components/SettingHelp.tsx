import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { SettingLockHelp } from './setting-lock-help';
import './setting-help.css';

const lockHintDurationMs = 1500;

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
  const lockHint = useContext(SettingLockHelp);
  const tipId = `${generatedId}-help`;
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!lockHint) return;
    const button = anchor.current!;
    const row = button.closest('.setting-help')?.parentElement;
    let hovered = false;
    const move = (event: PointerEvent) => {
      if (hovered || event.pointerType === 'touch') return;
      hovered = true;
      setOpen(true);
    };
    const leave = () => {
      hovered = false;
      if (document.activeElement !== button) setOpen(false);
    };
    row?.addEventListener('pointermove', move);
    row?.addEventListener('pointerleave', leave);
    return () => {
      row?.removeEventListener('pointermove', move);
      row?.removeEventListener('pointerleave', leave);
    };
  }, [lockHint]);
  useLayoutEffect(() => {
    if (!open || !tip.current) return;
    const node = tip.current;
    node.showPopover?.();
    const position = () => {
      const rect = anchor.current!.getBoundingClientRect();
      const height = node.getBoundingClientRect().height;
      const width = node.getBoundingClientRect().width;
      const row = lockHint
        ? (anchor
            .current!.closest('.setting-help')
            ?.parentElement?.getBoundingClientRect() ?? rect)
        : rect;
      const left = lockHint ? (row.left + row.right - width) / 2 : rect.left;
      const top =
        lockHint || rect.bottom + height + 8 > innerHeight
          ? row.top - height - 8
          : rect.bottom + 8;
      node.style.left = `${Math.max(12, Math.min(left, innerWidth - width - 12))}px`;
      node.style.top = `${Math.max(12, top)}px`;
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open, lockHint]);
  useEffect(() => {
    if (!open || !lockHint) return;
    const timeout = window.setTimeout(() => setOpen(false), lockHintDurationMs);
    return () => window.clearTimeout(timeout);
  }, [open, lockHint]);
  return (
    <span className="setting-help">
      <button
        ref={anchor}
        id={id}
        type="button"
        className="setting-help__label"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onPointerEnter={() => {
          if (!lockHint) setOpen(true);
        }}
        onPointerLeave={() => {
          if (!lockHint && document.activeElement !== anchor.current)
            setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
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
          className={`setting-help__tip${lockHint ? ' setting-help__tip--transient' : ''}`}
        >
          {lockHint ?? hint}
        </span>
      )}
    </span>
  );
}

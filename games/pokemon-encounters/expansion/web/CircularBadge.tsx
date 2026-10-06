import { useLayoutEffect, useRef } from 'react';
import './circular-badge.css';

/** Center the painted glyph, rather than its font advance or line box. */
export function CircularBadge({
  value,
  className = '',
}: {
  value: number | '✓';
  className?: string;
}) {
  const text = useRef<SVGTextElement>(null);
  useLayoutEffect(() => {
    let active = true;
    const align = () => {
      const node = text.current;
      if (!active || !node) return;
      const font = getComputedStyle(node);
      const scale =
        (node.ownerSVGElement?.getBoundingClientRect().width ?? 24) / 100;
      if (!scale) return;
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return;
      context.font = `${font.fontStyle} ${font.fontWeight} ${68 * scale}px ${font.fontFamily}`;
      const ink = context.measureText(String(value));
      node.setAttribute(
        'x',
        String(
          50 -
            (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft) /
              (2 * scale),
        ),
      );
      node.setAttribute(
        'y',
        String(
          50 +
            (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) /
              (2 * scale),
        ),
      );
    };
    align();
    void document.fonts.ready.then(align);
    const observer = new ResizeObserver(align);
    if (text.current?.ownerSVGElement)
      observer.observe(text.current.ownerSVGElement);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [value]);
  return (
    <svg
      className={`ex-circular-badge ${className}`}
      viewBox="0 0 100 100"
      data-badge-value={value}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="49" />
      <text ref={text} x="50" y="70">
        {value}
      </text>
    </svg>
  );
}

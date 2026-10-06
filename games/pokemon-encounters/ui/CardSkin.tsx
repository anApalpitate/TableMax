import type { CSSProperties, ReactNode } from 'react';

/** Presentation only: every caller supplies an already authorized face. */
export function CardSkin({
  face,
  image,
  frame,
  className = '',
  value,
}: {
  face: {
    categoryId: string;
    name: string;
    value: number | null;
    ability: unknown;
  } | null;
  image?: string | undefined;
  frame?: string | undefined;
  className?: string;
  value?: ReactNode;
}) {
  const expansion = className.includes('ex-card');
  return (
    <span
      className={`pokemon-card ${face ? 'face' : 'back'} ${className}`}
      style={
        frame
          ? ({ '--card-frame': frame, '--card-color': frame } as CSSProperties)
          : undefined
      }
      data-category={face?.categoryId}
      title={face ? `${face.name} · ${face.value ?? '复制'}` : '暗牌'}
    >
      {face ? (
        <>
          <span className="card-heading">
            <strong
              className={`card-value${expansion ? ' ex-card-value' : ''}`}
            >
              {value ?? face.value ?? '?'}
            </strong>
            {Boolean(face.ability) && (
              <span
                className={`ability-mark${expansion ? ' ex-ability-dot' : ''}`}
                aria-label="能力牌"
              >
                ✦
              </span>
            )}
          </span>
          {image && (
            <img
              src={image}
              alt=""
              draggable={false}
              width={475}
              height={475}
            />
          )}
          <span className={`card-name${expansion ? ' ex-card-name' : ''}`}>
            {face.name.replace('外观', '')}
          </span>
        </>
      ) : (
        <span
          className={`pokeball-mark${expansion ? ' ex-ball' : ''}`}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

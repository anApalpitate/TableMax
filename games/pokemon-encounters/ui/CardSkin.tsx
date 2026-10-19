import type { CSSProperties, ReactNode } from 'react';
import { abilityMark } from './ability-mark';
import { AbilityIcon } from './AbilityIcon';
import './card-skin.css';

/** Presentation only: every caller supplies an already authorized face. */
export function CardSkin({
  face,
  image,
  frame,
  className = '',
  value,
  bounds,
}: {
  face: {
    categoryId: string;
    name: string;
    value: number | null;
    ability: unknown;
    abilityUsed?: boolean;
  } | null;
  image?: string | undefined;
  frame?: string | undefined;
  className?: string;
  value?: ReactNode;
  bounds?:
    | {
        size: readonly [number, number];
        viewBox: readonly [number, number, number, number];
      }
    | undefined;
}) {
  const expansion = className.includes('ex-card');
  const mark = abilityMark(face);
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
            {mark && (
              <span
                className={`ability-mark${expansion ? ' ex-ability-dot' : ''}`}
                role="img"
                aria-label={mark.label}
                title={mark.label}
                data-ability-mark={mark.kind}
              >
                <AbilityIcon kind={mark.kind} />
              </span>
            )}
          </span>
          {image && bounds ? (
            <svg
              className="card-portrait"
              viewBox={bounds.viewBox.join(' ')}
              aria-hidden="true"
            >
              <image
                href={image}
                width={bounds.size[0]}
                height={bounds.size[1]}
              />
            </svg>
          ) : (
            image && (
              <img
                src={image}
                alt=""
                draggable={false}
                width={475}
                height={475}
              />
            )
          )}
          <span className={`card-name${expansion ? ' ex-card-name' : ''}`}>
            <span className="card-name-text">
              {face.name.replace('外观', '')}
            </span>
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

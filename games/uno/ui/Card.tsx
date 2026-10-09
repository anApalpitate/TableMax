/* eslint-disable react-refresh/only-export-components -- Card names and faces share the same presentation contract. */
import type { CSSProperties } from 'react';
import type { Card as UnoCard, CardKind } from '../types';

export type CardFace = Pick<UnoCard, 'color' | 'kind' | 'value'>;

const colors = { red: '红', yellow: '黄', green: '绿', blue: '蓝' };
const values = {
  skip: '跳过',
  reverse: '反转',
  'draw-two': '+2',
  wild: '变色',
  'wild-draw-four': '+4',
};

export function cardName(card: CardFace) {
  return `${card.color ? colors[card.color] : '万能'}${card.kind === 'number' ? card.value : values[card.kind]}`;
}

function Symbol({ value }: { value: number | Exclude<CardKind, 'number'> }) {
  if (typeof value === 'number')
    return <span className="uno-card-number">{value}</span>;
  if (value === 'skip')
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r="31"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
        />
        <path
          d="M28 72 72 28"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
        />
      </svg>
    );
  if (value === 'reverse')
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path
          d="m14 34 25-23v14h30a19 19 0 0 1 19 19v12H73V43a4 4 0 0 0-4-4H39v16ZM86 66 61 89V75H31a19 19 0 0 1-19-19V44h15v13a4 4 0 0 0 4 4h30V45Z"
          fill="currentColor"
        />
      </svg>
    );
  if (value === 'wild')
    return (
      <svg className="uno-wild-mark" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 6A44 44 0 0 0 6 50h44Z" fill="#dd3836" />
        <path d="M50 6a44 44 0 0 1 44 44H50Z" fill="#258bc0" />
        <path d="M50 94A44 44 0 0 1 6 50h44Z" fill="#e6b82a" />
        <path d="M50 94a44 44 0 0 0 44-44H50Z" fill="#419e62" />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="#fffaf0"
          strokeWidth="4"
        />
      </svg>
    );
  return (
    <span className="uno-card-plus">
      <span>{value === 'draw-two' ? '+2' : '+4'}</span>
      <svg viewBox="0 0 100 64" aria-hidden="true">
        {(value === 'draw-two' ? [28, 49] : [8, 27, 46, 65]).map((x, index) => (
          <rect
            key={x}
            x={x}
            y={12 - index * 3}
            width="27"
            height="43"
            rx="4"
            transform={`rotate(-9 ${x + 13} 30)`}
            fill={
              value === 'draw-two'
                ? 'currentColor'
                : ['#dc3e37', '#2a87bd', '#e2b935', '#4a9c66'][index]
            }
            stroke="#fffaf0"
            strokeWidth="3"
          />
        ))}
      </svg>
    </span>
  );
}

export function Card({
  card,
  back = false,
  className = '',
  style,
}: {
  card?: CardFace;
  back?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const value =
    card?.kind === 'number' ? (card.value ?? 0) : (card?.kind ?? 'wild');
  const corner =
    typeof value === 'number'
      ? String(value)
      : value === 'draw-two'
        ? '+2'
        : value === 'wild-draw-four'
          ? '+4'
          : value === 'reverse'
            ? '↔'
            : value === 'skip'
              ? '⊘'
              : '◆';
  return (
    <span
      className={`uno-card uno-card--${back ? 'back' : (card?.color ?? 'wild')} ${className}`}
      style={style}
      role="img"
      aria-label={back ? 'UNO 牌背' : card ? cardName(card) : '万能牌'}
    >
      <span className="uno-card-print">
        {back ? (
          <span className="uno-card-logo">UNO</span>
        ) : (
          <>
            <span className="uno-card-corner">{corner}</span>
            <span className="uno-card-oval">
              <Symbol value={value} />
            </span>
            <span className="uno-card-corner uno-card-corner--bottom">
              {corner}
            </span>
            <span className="uno-card-color-mark" aria-hidden="true">
              {card?.color === 'red'
                ? '●'
                : card?.color === 'yellow'
                  ? '▲'
                  : card?.color === 'green'
                    ? '■'
                    : card?.color === 'blue'
                      ? '◆'
                      : ''}
            </span>
          </>
        )}
      </span>
    </span>
  );
}

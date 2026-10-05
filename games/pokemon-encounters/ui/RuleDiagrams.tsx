import type { ReactNode } from 'react';

const illustrations = import.meta.glob(
  '../../../assets/games/pokemon-encounters/rules/illustrations-v1/*.webp',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

export function GuideScene({
  name,
  caption,
  children,
}: {
  name: string;
  caption: string;
  children: ReactNode;
}) {
  const src =
    illustrations[
      `../../../assets/games/pokemon-encounters/rules/illustrations-v1/${name}-v1.webp`
    ];
  return (
    <figure
      className={`pk-rule-scene pk-rule-scene--${name}`}
      data-rule-illustration={name}
    >
      {src && <img src={src} alt={caption} loading="lazy" />}
      <div className="pk-rule-scene__logic">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function BoardExample({
  values,
  paired = [],
  ditto,
}: {
  values: readonly (number | null)[];
  paired?: readonly number[];
  ditto?: number;
}) {
  return (
    <div className="pk-rule-board" aria-label="两行三列规则示例">
      {values.map((value, slot) => (
        <div
          className={`pk-rule-card${value === null ? ' pk-rule-card--back' : ''}${paired.includes(slot) ? ' pk-rule-card--paired' : ''}`}
          key={slot}
          data-rule-slot={slot}
          role="img"
          aria-label={`第${slot + 1}格，${value === null ? '暗牌' : `${slot === ditto ? '百变怪复制' : '明牌分值'}${value}`}${paired.includes(slot) ? '，同列归零' : ''}`}
        >
          {value === null ? (
            <>
              <i aria-hidden="true" />
              <span>暗牌</span>
            </>
          ) : (
            <>
              <strong>{value < 0 ? `−${Math.abs(value)}` : value}</strong>
              {slot === ditto && <span>百变怪</span>}
              {paired.includes(slot) && <span>归零</span>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function RuleFlow({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="pk-rule-flow">
      {steps.map((step, index) => (
        <li key={step}>
          <span className="pk-rule-step" aria-hidden="true">
            {index + 1}
          </span>
          <span>{step}</span>
          {index < steps.length - 1 && <b aria-hidden="true">→</b>}
        </li>
      ))}
    </ol>
  );
}

export function VictoryExample() {
  return (
    <div className="pk-rule-victories">
      {[
        ['甲', 3],
        ['乙', 3],
        ['丙', 1],
      ].map(([name, wins]) => (
        <div key={name} className={wins === 3 ? 'pk-rule-victory--winner' : ''}>
          <strong>玩家{name}</strong>
          <span aria-label={`${wins}胜`}>
            {Array.from({ length: Number(wins) }, (_, i) => (
              <b key={i} aria-hidden="true">
                ★
              </b>
            ))}
          </span>
          {wins === 3 && <span>共同赢家</span>}
        </div>
      ))}
    </div>
  );
}

import type { ReactNode } from 'react';
import { AbilityIcon } from './AbilityIcon';
import './rules-guide.css';

export function AbilityLegend({ expansion = false }: { expansion?: boolean }) {
  return (
    <div className="pk-rule-ability-legend" aria-label="能力角标图例">
      <p>
        <AbilityIcon kind="mandatory" />
        <span>星星：正常取到时必须执行的能力。</span>
      </p>
      <p>
        <AbilityIcon kind="optional" />
        <span>放大镜：符合发动条件后可选择发动或放弃。</span>
      </p>
      {expansion ? (
        <>
          <p>
            <AbilityIcon kind="mixed" />
            <span>
              超梦叠加角标：先私看，再选择交换或放弃；私看后能力已使用。
            </span>
          </p>
          <p>
            主动能力已使用后角标消失；百变怪、索罗亚是被动复制，不显示主动能力角标。
          </p>
        </>
      ) : (
        <p>
          <AbilityIcon kind="mandatory" />
          <span>百变怪保留星形被动标记，仅在结算时复制。</span>
        </p>
      )}
    </div>
  );
}

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

import { useId, type ReactNode } from 'react';
import type { PowerGridView } from '../types';
import './stage-layout.css';

export function StageSection({
  name,
  title,
  expanded,
  toggle,
  summary,
  children,
}: {
  name: string;
  title: string;
  expanded: boolean;
  toggle(): void;
  summary: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      className="pg-stage-section"
      data-stage-section={name}
      data-expanded={expanded}
    >
      <h2>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={toggle}
        >
          <span>{title}</span>
          <span aria-hidden="true">{expanded ? '−' : '＋'}</span>
        </button>
      </h2>
      <div id={id}>{expanded ? children : summary}</div>
    </section>
  );
}

export function PlantMarketSummary({ view }: { view: PowerGridView }) {
  return (
    <div className="pg-plant-market-summary" aria-label="电厂市场摘要">
      <div>
        <span>可拍</span>
        <div>
          {view.actualMarket.map((id) => (
            <b key={id}>{id}</b>
          ))}
          {!view.actualMarket.length && <span>暂无电厂</span>}
        </div>
      </div>
      {view.futureMarket.length > 0 && (
        <div>
          <span>未来</span>
          <div>
            {view.futureMarket.map((id) => (
              <b key={id}>{id}</b>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
} from 'react';
import type { PowerGridView } from '../types';
import { GermanyMap } from './map';
import { AuctionDisplay, PlantMarket } from './components';
import { ResourceMarket } from './ResourceMarket';
import { IncomeGuide } from './IncomeCard';
import { CompanyCards } from './CompanyCards';
import {
  boardStage,
  defaultBoardPanels,
  toggleBoardPanel,
  type BoardPanels,
} from './board-layout';
import './desktop-board.css';

export function DesktopBoard({
  view,
  names,
  portraits,
  active,
  mapProps,
  artFor,
  contextKey,
  savedKey,
  animate,
  onDetails,
}: {
  view: PowerGridView;
  names: Record<string, string>;
  portraits: Record<string, string>;
  active: boolean;
  mapProps: ComponentProps<typeof GermanyMap>;
  artFor(id: number): CSSProperties;
  contextKey: string;
  savedKey: string | null;
  animate: boolean;
  onDetails(seatId: string): void;
}) {
  const board = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [bottomGap, setBottomGap] = useState(0);
  const stageKey = contextKey + ':' + boardStage(view.phase);
  const [choice, setChoice] = useState<{
    key: string;
    panels: BoardPanels;
  } | null>(null);
  const [companyChoice, setCompanyChoice] = useState<{
    instance: string;
    open: boolean;
  } | null>(null);
  const instance = contextKey.split(':')[0]!;
  const companies =
    companyChoice?.instance === instance ? companyChoice.open : true;
  const panels =
    choice?.key === stageKey ? choice.panels : defaultBoardPanels(view.phase);
  const left =
    panels.left && !(narrow && panels.right && panels.last === 'right');
  const right =
    panels.right && !(narrow && panels.left && panels.last === 'left');
  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const companyDrawer = element.querySelector<HTMLElement>(
      '.pg-board-companies',
    )!;
    const observer = new ResizeObserver(() => {
      setNarrow(element.clientWidth <= 1100);
      setBottomGap(companyDrawer.hidden ? 0 : companyDrawer.offsetHeight + 20);
    });
    observer.observe(element);
    observer.observe(companyDrawer);
    return () => observer.disconnect();
  }, []);
  const toggle = (side: 'left' | 'right') =>
    setChoice({
      key: stageKey,
      panels: toggleBoardPanel(panels, side, narrow),
    });
  const direction =
    view.phase === 'resources' || view.phase === 'building'
      ? '位次从大到小行动'
      : view.phase === 'auction'
        ? '本场按座位顺时针报价'
        : '位次从小到大行动';
  return (
    <div
      ref={board}
      className="pg-map-table"
      data-map-table
      data-companies-open={companies}
      style={{ '--pg-board-bottom-gap': `${bottomGap}px` } as CSSProperties}
    >
      <GermanyMap {...mapProps} avoidDrawers />
      <button
        className="pg-board-edge pg-board-edge--left"
        aria-controls="pg-board-market"
        aria-expanded={left}
        onClick={() => toggle('left')}
      >
        市场
      </button>
      <aside
        id="pg-board-market"
        className="pg-board-drawer pg-board-drawer--left"
        data-map-obstacle="left"
        hidden={!left}
      >
        <header>
          <h2>市场</h2>
          <button aria-label="关闭市场边栏" onClick={() => toggle('left')}>
            ×
          </button>
        </header>
        <div
          className="pg-board-market-tabs"
          role="group"
          aria-label="市场类型"
        >
          <button
            aria-pressed={panels.market === 'plants'}
            onClick={() =>
              setChoice({
                key: stageKey,
                panels: { ...panels, market: 'plants' },
              })
            }
          >
            电厂
          </button>
          <button
            aria-pressed={panels.market === 'resources'}
            onClick={() =>
              setChoice({
                key: stageKey,
                panels: { ...panels, market: 'resources' },
              })
            }
          >
            燃料
          </button>
        </div>
        <div className="pg-board-drawer-content">
          {panels.market === 'plants' ? (
            <>
              {view.auction && (
                <AuctionDisplay
                  view={view}
                  names={names}
                  artFor={artFor}
                  compact
                />
              )}
              <PlantMarket view={view} artFor={artFor} />
            </>
          ) : (
            <ResourceMarket view={view} compact />
          )}
        </div>
      </aside>
      <button
        className="pg-board-edge pg-board-edge--right"
        aria-controls="pg-board-income"
        aria-expanded={right}
        onClick={() => toggle('right')}
      >
        收益
      </button>
      <aside
        id="pg-board-income"
        className="pg-board-drawer pg-board-drawer--right"
        data-map-obstacle="right"
        hidden={!right}
      >
        <header>
          <h2>发电收益</h2>
          <button aria-label="关闭收益边栏" onClick={() => toggle('right')}>
            ×
          </button>
        </header>
        <div className="pg-board-drawer-content">
          <IncomeGuide view={view} />
        </div>
      </aside>
      <section
        className="pg-board-companies"
        data-map-obstacle="bottom"
        hidden={!companies}
      >
        <header>
          <h2>玩家公司</h2>
          <span className="pg-board-order-note">{direction}</span>
          <button
            aria-controls="pg-board-companies-list"
            aria-expanded={companies}
            aria-label="收起玩家公司"
            onClick={() => setCompanyChoice({ instance, open: false })}
          >
            ⌄
          </button>
        </header>
        <div id="pg-board-companies-list">
          <CompanyCards
            view={view}
            names={names}
            portraits={portraits}
            active={active}
            onDetails={onDetails}
            savedKey={savedKey}
            animate={animate}
            contextKey={contextKey}
            horizontal
          />
        </div>
      </section>
      {!companies && (
        <button
          className="pg-board-edge pg-board-edge--bottom"
          aria-expanded={false}
          aria-label="展开玩家公司"
          onClick={() => setCompanyChoice({ instance, open: true })}
        >
          玩家公司 ⌃
        </button>
      )}
      {view.latest && (
        <div className="pg-board-latest" role="status">
          <strong>
            {view.latest.actor ? names[view.latest.actor] : '电网'}
          </strong>
          <span>{view.latest.text}</span>
        </div>
      )}
    </div>
  );
}

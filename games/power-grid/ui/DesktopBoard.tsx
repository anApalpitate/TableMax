import {
  useCallback,
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
import { BoardIcon } from './BoardIcon';

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
  const [boardWidth, setBoardWidth] = useState(1280);
  const [manualRevision, setManualRevision] = useState(0);
  const [manualFocusKey, setManualFocusKey] = useState('');
  const [avoidance, setAvoidance] = useState({ token: '', level: 0 });
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
  const companyBase =
    companyChoice?.instance === instance ? companyChoice.open : true;
  const panels =
    choice?.key === stageKey ? choice.panels : defaultBoardPanels(view.phase);
  const focusToken = `${stageKey}:${mapProps.selected ?? ''}:${manualRevision}`;
  const selectionToken = `${stageKey}:${mapProps.selected ?? ''}:${mapProps.selectionRequest ?? 0}`;
  const avoiding =
    mapProps.selected && avoidance.token === focusToken ? avoidance.level : 0;
  const marketWidth = avoiding ? 'narrow' : panels.width;
  const occupiedWidth =
    (marketWidth === 'wide' ? Math.min(900, boardWidth - 96) : 310) + 240 + 32;
  const exclusive = narrow || occupiedWidth > boardWidth - 96;
  const left =
    panels.left &&
    avoiding < 2 &&
    !(exclusive && panels.right && panels.last === 'right');
  const right =
    panels.right &&
    avoiding < 3 &&
    !(exclusive && panels.left && panels.last === 'left');
  const companies = companyBase && avoiding < 4;
  const onFocusOccluded = useCallback(() => {
    if (!mapProps.selected || manualFocusKey === selectionToken) return;
    setAvoidance((previous) => {
      const level = previous.token === focusToken ? previous.level : 0;
      return level >= 4 ? previous : { token: focusToken, level: level + 1 };
    });
  }, [focusToken, mapProps.selected, manualFocusKey, selectionToken]);
  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const companyDrawer = element.querySelector<HTMLElement>(
      '.pg-board-companies',
    )!;
    const observer = new ResizeObserver(() => {
      setNarrow(element.clientWidth <= 1100);
      setBoardWidth(element.clientWidth);
      setBottomGap(companyDrawer.hidden ? 0 : companyDrawer.offsetHeight + 12);
    });
    observer.observe(element);
    observer.observe(companyDrawer);
    return () => observer.disconnect();
  }, []);
  const toggle = (side: 'left' | 'right') => {
    setManualFocusKey(selectionToken);
    setManualRevision((value) => value + 1);
    setChoice({
      key: stageKey,
      panels: toggleBoardPanel(panels, side, exclusive),
    });
  };
  const switchWidth = () => {
    setManualFocusKey(selectionToken);
    setManualRevision((value) => value + 1);
    setChoice({
      key: stageKey,
      panels: {
        ...panels,
        width: marketWidth === 'narrow' ? 'wide' : 'narrow',
        last: 'left',
      },
    });
  };
  const chooseCompanies = (open: boolean) => {
    setManualFocusKey(selectionToken);
    setManualRevision((value) => value + 1);
    setCompanyChoice({ instance, open });
  };
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
      data-market-width={marketWidth}
      data-map-avoidance={avoiding}
      style={{ '--pg-board-bottom-gap': `${bottomGap}px` } as CSSProperties}
    >
      <GermanyMap
        {...mapProps}
        avoidDrawers
        onFocusOccluded={onFocusOccluded}
      />
      <button
        className="pg-board-edge pg-board-edge--left"
        aria-label="市场"
        data-tooltip={left ? '收起市场' : '打开市场'}
        aria-controls="pg-board-market"
        aria-expanded={left}
        onClick={() => toggle('left')}
      >
        <BoardIcon name="market" />
      </button>
      <aside
        id="pg-board-market"
        className={`pg-board-drawer pg-board-drawer--left${marketWidth === 'wide' ? ' pg-board-drawer--wide' : ''}`}
        data-map-obstacle="left"
        hidden={!left}
      >
        <header>
          <h2>市场</h2>
          <button
            aria-label={marketWidth === 'narrow' ? '展开为宽市场' : '收窄市场'}
            data-tooltip={
              marketWidth === 'narrow' ? '展开为宽市场' : '收窄市场'
            }
            onClick={switchWidth}
          >
            <BoardIcon name={marketWidth === 'narrow' ? 'wide' : 'narrow'} />
          </button>
          <button aria-label="关闭市场边栏" onClick={() => toggle('left')}>
            <BoardIcon name="left" />
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
        aria-label="收益"
        data-tooltip={right ? '收起收益' : '打开收益'}
        aria-controls="pg-board-income"
        aria-expanded={right}
        onClick={() => toggle('right')}
      >
        <BoardIcon name="income" />
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
            <BoardIcon name="right" />
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
            onClick={() => chooseCompanies(false)}
          >
            <BoardIcon name="down" />
          </button>
        </header>
        <div id="pg-board-companies-list">
          <CompanyCards
            artFor={artFor}
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
          onClick={() => chooseCompanies(true)}
        >
          <BoardIcon name="up" />
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

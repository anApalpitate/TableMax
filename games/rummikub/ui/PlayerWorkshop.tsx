import { useEffect, useMemo, useRef, useState } from 'react';
import { OverlayPanel } from '@tablemax/web-host';
import type { Action, Color, PlayAction, RummikubView } from '../types';
import { COLORS } from '../types';
import { inspectTurn, prepareTurn } from '../shared/turn';
import { parseMeld } from '../shared/melds';
import { DraftBoard } from './Board';
import { NumberTile } from './NumberTile';
import { COLOR_NAMES } from './labels';
import {
  contextFor,
  initialDraft,
  moveTiles,
  restoreDraft,
  sortGroup,
  splitGroup,
  tableFor,
  type TurnDraft,
} from './draft';

const storageKey = 'tablemax:rummikub:turn-draft';

function loadDraft(scope: string, context: ReturnType<typeof contextFor>) {
  try {
    const saved: unknown = JSON.parse(
      sessionStorage.getItem(storageKey) ?? 'null',
    );
    if (
      !saved ||
      typeof saved !== 'object' ||
      !('scope' in saved) ||
      saved.scope !== scope ||
      !('draft' in saved)
    )
      return null;
    return restoreDraft(saved.draft, context);
  } catch {
    return null;
  }
}

function JokerEditor({
  id,
  draft,
  apply,
  close,
}: {
  id: string;
  draft: TurnDraft;
  apply(color: Color, value: number): void;
  close(): void;
}) {
  const [color, setColor] = useState<Color>(
    draft.bindings[id]?.color ?? 'blue',
  );
  const [value, setValue] = useState(draft.bindings[id]?.value ?? 1);
  return (
    <OverlayPanel title="指定百搭" close={close} className="rk-overlay">
      <div className="rk-screen rk-panel rk-joker-editor">
        <NumberTile
          tile={{ id, color: null, value: null, joker: true }}
          binding={{ color, value }}
        />
        <div
          className="rk-binding-colors"
          role="group"
          aria-label="百搭代表颜色"
        >
          {COLORS.map((entry) => (
            <button
              type="button"
              key={entry}
              className={`rk-color-choice rk-color-choice--${entry}`}
              aria-pressed={color === entry}
              onClick={() => setColor(entry)}
            >
              {COLOR_NAMES[entry]}色
            </button>
          ))}
        </div>
        <label className="rk-binding-number">
          代表数字
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={13}
            step={1}
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
          />
        </label>
        <p>百搭在这个牌组中代表所选颜色与数字。</p>
        <div className="dialog-actions">
          <button type="button" onClick={close}>
            取消
          </button>
          <button
            type="button"
            className="rk-primary"
            disabled={!Number.isInteger(value) || value < 1 || value > 13}
            onClick={() => apply(color, value)}
          >
            确定百搭
          </button>
        </div>
      </div>
    </OverlayPanel>
  );
}

export function PlayerWorkshop({
  game,
  scope,
  locked,
  actions,
  choose,
}: {
  game: RummikubView;
  scope: string;
  locked: boolean;
  actions: Action[];
  choose(action: Action): void;
}) {
  const context = useMemo(() => contextFor(game), [game]);
  const [editing, setEditing] = useState(() => ({
    draft: loadDraft(scope, context) ?? initialDraft(game),
    history: [] as TurnDraft[],
  }));
  const [selected, setSelected] = useState<string[]>([]);
  const [bindingTarget, setBindingTarget] = useState<string | null>(null);
  const [sort, setSort] = useState<'color' | 'value' | 'dealt'>('color');
  const [panel, setPanel] = useState<'actions' | 'draw' | null>(null);
  const [section, setSection] = useState<'table' | 'rack'>('table');
  const tableSection = useRef<HTMLElement>(null);
  const rackSection = useRef<HTMLElement>(null);
  const draft = editing.draft;
  const original = useMemo(() => initialDraft(game), [game]);
  const changed = JSON.stringify(draft) !== JSON.stringify(original);
  const canDraw = actions.some((action) => action.type === 'draw');
  const canPass = actions.some((action) => action.type === 'pass');
  const joker = selected.find((id) => context.tiles[id]?.joker);
  const canReturn =
    selected.length > 0 && selected.every((id) => context.originalRack.has(id));
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ scope, draft }));
    } catch {
      /* Storage is optional; authoritative state stays on the server. */
    }
  }, [scope, draft]);

  const preview = useMemo((): {
    action: PlayAction | null;
    text: string;
    points: number;
    placed: number;
  } => {
    const candidate = tableFor(draft, context);
    if (!candidate)
      return {
        action: null,
        text: '请先指定百搭的颜色和数字',
        points: 0,
        placed: 0,
      };
    if (draft.tray.length)
      return {
        action: null,
        text: `暂持区还有 ${draft.tray.length} 张牌`,
        points: 0,
        placed: 0,
      };
    const canonical = candidate.map((meld) =>
      parseMeld(
        meld.tiles.map((tile) => tile.tileId),
        draft.bindings,
        meld.kind,
      ),
    );
    if (canonical.some((meld) => meld === null))
      return { action: null, text: '还有牌组未整理完成', points: 0, placed: 0 };
    try {
      const turnContext = {
        rack: [...context.originalRack],
        table: game.table,
        opened: game.self!.opened,
      };
      const table = canonical as import('../types').Meld[];
      const action = prepareTurn(turnContext, table);
      if (!action) {
        inspectTurn(turnContext, { type: 'submit-turn', table });
        return {
          action: null,
          text: '请完成百搭替换与重用',
          points: 0,
          placed: 0,
        };
      }
      const result = inspectTurn(turnContext, action);
      return {
        action,
        text: `可提交 ${result.placedTileIds.length} 张${game.self!.opened ? '' : `，首出 ${result.points} 点`}`,
        points: result.points,
        placed: result.placedTileIds.length,
      };
    } catch (error) {
      return {
        action: null,
        text: error instanceof Error ? error.message : '请继续整理桌面',
        points: 0,
        placed: 0,
      };
    }
  }, [draft, context, game]);

  const update = (next: TurnDraft) => {
    if (locked || next === draft) return;
    setEditing({
      draft: next,
      history: [...editing.history.slice(-59), draft],
    });
  };
  const move = (destination: Parameters<typeof moveTiles>[2]) => {
    const next = moveTiles(draft, selected, destination, context);
    update(next);
    if (next !== draft) setSelected([]);
  };
  const scrollTo = (next: 'table' | 'rack') => {
    setSection(next);
    (next === 'table' ? tableSection : rackSection).current?.scrollIntoView({
      block: 'start',
      behavior: 'instant',
    });
  };
  const rack = [...draft.rack].sort((a, b) => {
    if (sort === 'dealt') return 0;
    const left = context.tiles[a]!;
    const right = context.tiles[b]!;
    const byValue = (left.value ?? 99) - (right.value ?? 99);
    const byColor = (left.color ?? 'z').localeCompare(right.color ?? 'z');
    return sort === 'value' ? byValue || byColor : byColor || byValue;
  });
  const tileButton = (id: string) => (
    <NumberTile
      key={id}
      tile={context.tiles[id]!}
      {...(draft.bindings[id] ? { binding: draft.bindings[id] } : {})}
      selected={selected.indexOf(id) + 1}
      disabled={locked}
      onSelect={() =>
        setSelected(
          selected.includes(id)
            ? selected.filter((tile) => tile !== id)
            : [...selected, id],
        )
      }
    />
  );
  return (
    <div className="rk-workshop" data-turn-workshop data-draft-scope={scope}>
      <div className="rk-workshop-nav">
        <div className="rk-section-nav" role="group" aria-label="工作区位置">
          <button
            type="button"
            aria-pressed={section === 'table'}
            onClick={() => scrollTo('table')}
          >
            桌面
          </button>
          <button
            type="button"
            aria-pressed={section === 'rack'}
            onClick={() => scrollTo('rack')}
          >
            牌架 {draft.rack.length}
          </button>
        </div>
        <button
          type="button"
          disabled={locked || !editing.history.length}
          onClick={() => {
            const previous = editing.history.at(-1);
            if (previous) {
              setEditing({
                draft: previous,
                history: editing.history.slice(0, -1),
              });
              setSelected([]);
            }
          }}
        >
          撤销
        </button>
        <button
          type="button"
          disabled={locked || !changed}
          onClick={() => {
            update(initialDraft(game));
            setSelected([]);
          }}
        >
          重置
        </button>
      </div>
      <div className="rk-selection-bar">
        <strong aria-live="polite">
          {selected.length ? `已选 ${selected.length} 张` : '点牌选择'}
        </strong>
        <button
          type="button"
          className="rk-primary"
          disabled={locked || !selected.length}
          onClick={() => {
            move('new');
            scrollTo('table');
          }}
        >
          建立新组
        </button>
        <button
          type="button"
          disabled={locked || !selected.length}
          onClick={() => setPanel('actions')}
        >
          更多
        </button>
        <button
          type="button"
          aria-label="取消选牌"
          disabled={!selected.length}
          onClick={() => setSelected([])}
        >
          取消
        </button>
      </div>
      <div
        className="rk-workspace-scroll"
        onScroll={(event) => {
          const viewport = event.currentTarget;
          if (viewport.scrollHeight <= viewport.clientHeight + 1) return;
          const bounds = viewport.getBoundingClientRect();
          const visibleHeight = (element: HTMLElement | null) => {
            if (!element) return 0;
            const rect = element.getBoundingClientRect();
            return Math.max(
              0,
              Math.min(rect.bottom, bounds.bottom) -
                Math.max(rect.top, bounds.top),
            );
          };
          setSection(
            visibleHeight(rackSection.current) >
              visibleHeight(tableSection.current)
              ? 'rack'
              : 'table',
          );
        }}
      >
        <section
          ref={tableSection}
          className="rk-table-section"
          aria-labelledby="rk-draft-table-title"
        >
          <div className="rk-section-heading">
            <h2 id="rk-draft-table-title">桌面草稿</h2>
            <span className="rk-draft-label">仅你可见</span>
          </div>
          {!game.self!.opened && (
            <p className="rk-opening-note">
              首出至少 30 点，本回合只能用自己的牌。
            </p>
          )}
          <DraftBoard
            draft={draft}
            context={context}
            selected={selected}
            choose={(id) =>
              setSelected(
                selected.includes(id)
                  ? selected.filter((tile) => tile !== id)
                  : [...selected, id],
              )
            }
            move={(group, index) =>
              move({ group, ...(index !== undefined ? { index } : {}) })
            }
            split={(group, before) => {
              update(splitGroup(draft, group, before));
              setSelected([]);
            }}
            sort={(group) => update(sortGroup(draft, group, context))}
            changeKind={(id, kind) =>
              update({
                ...draft,
                groups: draft.groups.map((group) =>
                  group.id === id ? { ...group, kind } : group,
                ),
              })
            }
            disabled={locked}
            opened={game.self!.opened}
          />
        </section>
        <section
          ref={rackSection}
          className="rk-rack-section"
          aria-labelledby="rk-own-rack-title"
        >
          <div className="rk-section-heading">
            <h2 id="rk-own-rack-title">我的牌架</h2>
            <label className="rk-sort-label">
              <span className="sr-only">牌架排序</span>
              <select
                aria-label="牌架排序"
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
              >
                <option value="color">按颜色</option>
                <option value="value">按数字</option>
                <option value="dealt">原顺序</option>
              </select>
            </label>
          </div>
          <div className="rk-rack" data-own-rack>
            {rack.map(tileButton)}
            {!rack.length && <p>牌架已清空</p>}
          </div>
          {draft.tray.length > 0 && (
            <section className="rk-tray" aria-label="暂持的牌">
              <div className="rk-section-heading">
                <h3>暂持 {draft.tray.length} 张</h3>
                <span>提交前整理回去</span>
              </div>
              <div className="rk-rack">{draft.tray.map(tileButton)}</div>
            </section>
          )}
        </section>
      </div>
      <div className="rk-action-dock">
        <p
          className={preview.action ? 'rk-valid-preview' : ''}
          role="status"
          data-turn-preview
        >
          {locked ? '当前暂不能提交，草稿已保留' : preview.text}
        </p>
        <div className="rk-submit-actions">
          <button
            type="button"
            className="rk-primary"
            disabled={locked || !preview.action}
            onClick={() => preview.action && choose(preview.action)}
            data-submit-turn
          >
            提交回合
          </button>
          <button
            type="button"
            disabled={locked || (!canDraw && !canPass)}
            onClick={() =>
              changed
                ? setPanel('draw')
                : choose({ type: canDraw ? 'draw' : 'pass' })
            }
          >
            {canDraw ? '摸牌结束' : '无牌可摸，过牌'}
          </button>
        </div>
      </div>
      {panel === 'actions' && (
        <OverlayPanel
          title={`选中的 ${selected.length} 张牌`}
          close={() => setPanel(null)}
          className="rk-overlay"
        >
          <div className="rk-screen rk-panel rk-selection-actions">
            <div className="rk-rack">
              {selected.map((id) => (
                <NumberTile
                  key={id}
                  tile={context.tiles[id]!}
                  {...(draft.bindings[id]
                    ? { binding: draft.bindings[id] }
                    : {})}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                move('tray');
                setPanel(null);
              }}
            >
              移入暂持区
            </button>
            <button
              type="button"
              disabled={locked || !canReturn}
              onClick={() => {
                move('rack');
                setPanel(null);
              }}
            >
              退回我的牌架
            </button>
            <button
              type="button"
              disabled={locked || !joker}
              onClick={() => {
                setPanel(null);
                setBindingTarget(joker ?? null);
              }}
            >
              指定百搭颜色数字
            </button>
            <p>
              桌面原牌只能暂持和重组。替换后的百搭须在本回合重新组成合法牌组。
            </p>
            <button type="button" onClick={() => setPanel(null)}>
              继续整理
            </button>
          </div>
        </OverlayPanel>
      )}
      {panel === 'draw' && (
        <OverlayPanel
          title={canDraw ? '摸牌结束回合' : '过牌结束回合'}
          close={() => setPanel(null)}
          className="rk-overlay"
        >
          <div className="rk-screen rk-panel">
            <p>这会放弃本回合尚未提交的草稿，保留已保存的桌面。</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPanel(null)}>
                继续整理
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  choose({ type: canDraw ? 'draw' : 'pass' });
                  setPanel(null);
                }}
              >
                {canDraw ? '放弃草稿并摸牌' : '放弃草稿并过牌'}
              </button>
            </div>
          </div>
        </OverlayPanel>
      )}
      {bindingTarget && (
        <JokerEditor
          id={bindingTarget}
          draft={draft}
          close={() => setBindingTarget(null)}
          apply={(color, value) => {
            const next = {
              ...draft,
              bindings: {
                ...draft.bindings,
                [bindingTarget]: { color, value },
              },
            };
            next.groups = next.groups.map((group) => {
              const meld = parseMeld(group.tiles, next.bindings);
              return meld ? { ...group, kind: meld.kind } : group;
            });
            update(next);
            setBindingTarget(null);
          }}
        />
      )}
    </div>
  );
}

export function WaitingRack({ game }: { game: RummikubView }) {
  return (
    <section className="rk-rack-section rk-rack-section--waiting">
      <div className="rk-section-heading">
        <h2>我的牌架</h2>
        <span>{game.self?.rack.length ?? 0} 张</span>
      </div>
      <div className="rk-rack" data-own-rack>
        {game.self?.rack.map((tile) => (
          <NumberTile key={tile.id} tile={tile} />
        ))}
      </div>
    </section>
  );
}

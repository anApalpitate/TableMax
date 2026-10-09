import { useState } from 'react';
import type { DraftContext, DraftGroup, TurnDraft } from './draft';
import { NumberTile } from './NumberTile';
import { parseMeld } from '../shared/melds';

export function DraftBoard({
  draft,
  context,
  selected,
  choose,
  move,
  split,
  sort,
  changeKind,
  disabled,
  opened,
}: {
  draft: TurnDraft;
  context: DraftContext;
  selected: string[];
  choose(id: string): void;
  move(group: string, index?: number): void;
  split(group: string, before: string): void;
  sort(group: string): void;
  changeKind(group: string, kind: DraftGroup['kind']): void;
  disabled: boolean;
  opened: boolean;
}) {
  const [tools, setTools] = useState<string | null>(null);
  return (
    <div className="rk-table" data-draft-table>
      {!draft.groups.length && (
        <div className="rk-empty-table">
          <span aria-hidden="true">▥</span>
          <p>选牌，建立第一个牌组</p>
        </div>
      )}
      {draft.groups.map((group, index) => {
        const original = group.id.startsWith('saved-');
        const readonly = !opened && original;
        const bound = group.tiles.every(
          (id) => !context.tiles[id]?.joker || draft.bindings[id],
        );
        const legal =
          bound && parseMeld(group.tiles, draft.bindings, group.kind) !== null;
        const canSplit =
          selected.length === 1 && group.tiles.indexOf(selected[0]!) > 0;
        return (
          <article
            key={group.id}
            className={`rk-meld${legal ? '' : ' rk-meld--incomplete'}${readonly ? ' rk-meld--readonly' : ''}`}
            data-group-id={group.id}
            data-group-legal={legal}
          >
            <div className="rk-meld-heading">
              <h3>
                <span>{index + 1}</span>
                {group.kind === 'run' ? '顺子' : '同数组'}
              </h3>
              {!legal && <span className="rk-group-state">待整理</span>}
              {readonly ? (
                <span className="rk-group-state">首出前只读</span>
              ) : (
                <button
                  className="rk-icon-button"
                  type="button"
                  aria-label={`第 ${index + 1} 组操作`}
                  aria-expanded={tools === group.id}
                  onClick={() => setTools(tools === group.id ? null : group.id)}
                  disabled={disabled}
                >
                  ⋯
                </button>
              )}
            </div>
            <div className="rk-meld-tiles">
              {group.tiles.map((id) => (
                <NumberTile
                  key={id}
                  tile={context.tiles[id]!}
                  {...(draft.bindings[id]
                    ? { binding: draft.bindings[id] }
                    : {})}
                  selected={selected.indexOf(id) + 1}
                  placed={context.originalRack.has(id)}
                  {...(!readonly ? { onSelect: () => choose(id) } : {})}
                  disabled={disabled}
                />
              ))}
            </div>
            {!readonly && selected.length > 0 && (
              <div className="rk-meld-drop">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => move(group.id, 0)}
                >
                  放到开头
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => move(group.id)}
                >
                  放到末尾
                </button>
              </div>
            )}
            {tools === group.id && !readonly && (
              <div className="rk-meld-tools">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => sort(group.id)}
                >
                  按数字排
                </button>
                <button
                  type="button"
                  disabled={disabled || !canSplit}
                  onClick={() => selected[0] && split(group.id, selected[0])}
                >
                  从选中牌拆分
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    changeKind(group.id, group.kind === 'run' ? 'group' : 'run')
                  }
                >
                  {group.kind === 'run' ? '改为同数组' : '改为顺子'}
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function PublicBoard({
  table,
  placed = [],
}: {
  table: import('../types').Meld[];
  placed?: string[];
}) {
  const recent = new Set(placed);
  return (
    <div className="rk-table rk-table--public" data-saved-table>
      {!table.length && (
        <div className="rk-empty-table">
          <span aria-hidden="true">▥</span>
          <p>等待首出</p>
        </div>
      )}
      {table.map((group, index) => (
        <article
          className="rk-meld"
          key={group.tiles.map((tile) => tile.tileId).join(':')}
        >
          <div className="rk-meld-heading">
            <h3>
              <span>{index + 1}</span>
              {group.kind === 'run' ? '顺子' : '同数组'}
            </h3>
          </div>
          <div className="rk-meld-tiles">
            {group.tiles.map((placement) => (
              <NumberTile
                key={placement.tileId}
                tile={{
                  id: placement.tileId,
                  color: placement.color,
                  value: placement.value,
                  joker: placement.tileId.startsWith('joker-'),
                }}
                {...(placement.tileId.startsWith('joker-')
                  ? {
                      binding: {
                        color: placement.color,
                        value: placement.value,
                      },
                    }
                  : {})}
                placed={recent.has(placement.tileId)}
              />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

import type { JsonValue } from '@tablemax/game-sdk';
import type { TemplateView } from '../view';
export function PlayerControls({
  view,
  actions,
  locked,
  choose,
}: {
  view: TemplateView;
  actions: readonly JsonValue[];
  locked: boolean;
  choose(action: JsonValue): void;
}) {
  return (
    <>
      {view.ownSecret !== null && (
        <p className="secret">
          你的秘密骰子：<strong>{view.ownSecret}</strong>
        </p>
      )}
      <div className="player-actions">
        {actions.map((action, i) => (
          <button key={i} disabled={locked} onClick={() => choose(action)}>
            选择 +{(action as { value: number }).value}
          </button>
        ))}
      </div>
    </>
  );
}

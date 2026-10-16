import type { View } from '../project';
import type { CSSProperties } from 'react';
import {
  eventLabels,
  eventSummaries,
  runtimePicture,
} from './event-presentation';
import type { SavedEvent } from './playback';
import './event-environment.css';

export function EventEnvironment({ game }: { game: View }) {
  const event = game.currentEvent;
  if (!event || game.roundResult) return null;
  const picture = runtimePicture(`event-${event.kind}`);
  return (
    <div
      className={`ex-event-environment ex-environment-${event.kind}`}
      data-event-environment={event.kind}
      style={
        picture
          ? ({ '--event-wallpaper': `url("${picture}")` } as CSSProperties)
          : undefined
      }
      aria-hidden="true"
    >
      <div className="ex-environment-wallpaper" />
      <div className="ex-environment-drift" />
    </div>
  );
}

export function EventStatus({ game }: { game: View }) {
  if (!game.currentEvent && !game.bondPlaceholders?.length) return null;
  return (
    <aside className="ex-event-status" aria-label="本局事件">
      {game.currentEvent && (
        <details>
          <summary>
            {eventLabels[game.currentEvent.kind]}
            {game.currentEvent.placeholder && (
              <span className="ex-event-placeholder">效果待设计</span>
            )}
          </summary>
          <p>{eventSummaries[game.currentEvent.kind]}</p>
        </details>
      )}
      {game.bondPlaceholders?.map((bond) => (
        <span className="ex-semantic-groups" key={bond.id}>
          <span>{bond.name}</span>
          <span>效果待设计</span>
        </span>
      ))}
    </aside>
  );
}

/** A public saved announcement. No private faces or targets enter this scene. */
export function EventEntrance({
  event,
  durationMs,
}: {
  event: SavedEvent;
  durationMs: number;
}) {
  const kind = event.effect?.eventKind;
  const bond = event.kind === 'bond-placeholder';
  return (
    <div
      className={`ex-event-entrance ${kind ? `ex-entrance-${kind}` : 'ex-entrance-bond'}`}
      data-event-entrance={kind ?? 'bond'}
      style={{ '--event-ms': `${durationMs}ms` } as CSSProperties}
      role="status"
    >
      <div className="ex-event-impact" aria-hidden="true" />
      <div className="ex-event-announcement">
        <span>{bond ? '羁绊登场' : '取牌触发特殊事件'}</span>
        <strong>{kind ? eventLabels[kind] : '伙伴齐聚'}</strong>
        <p>{bond ? event.text : kind ? eventSummaries[kind] : event.text}</p>
        {(bond || event.effect?.placeholder) && <b>效果待设计</b>}
      </div>
    </div>
  );
}

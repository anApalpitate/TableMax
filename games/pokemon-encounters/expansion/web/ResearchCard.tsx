import type { ResearchTask } from '../research';
import { researchDefinition, lines, type RulesProfile } from '../research';
import { scoreBoard } from '../scoring';
import { card } from '../cards';
import { portraitFor } from './card-art';
import { portraitBoundsFor } from './portrait-bounds';
import { researchRiskText } from './research-presentation';
import { ResearchReward } from './ResearchReward';

const illustrations = import.meta.glob<string>(
  '../../../../assets/games/pokemon-encounters/expansion/research-illustrations/*.webp',
  { eager: true, query: '?url', import: 'default' },
);
export function ResearchPicture({
  id,
  profile = 'research-buffer-v2',
}: {
  id: string;
  profile?: RulesProfile;
}) {
  const { name, presentation, illustrationId } = researchDefinition(
    id,
    profile,
  );
  const source =
    illustrations[
      `../../../../assets/games/pokemon-encounters/expansion/research-illustrations/${illustrationId}.webp`
    ];
  return source ? (
    <figure
      className="ex-research-art"
      role="img"
      aria-label={`${name}主题插画`}
    >
      <img
        className="ex-research-picture ex-research-backdrop"
        src={source}
        alt=""
        width={320}
        height={180}
      />
      <span className="ex-research-subjects" aria-hidden="true">
        {presentation.subjects.map((categoryId, index, subjects) => {
          const bounds = portraitBoundsFor(categoryId);
          return (
            <svg
              key={`${categoryId}-${index}`}
              className="ex-research-subject"
              viewBox={bounds.viewBox.join(' ')}
              style={{
                left: `${subjects.length === 1 ? 25 : subjects.length === 2 ? 15 + index * 37 : 7 + index * 30}%`,
                width: `${subjects.length === 1 ? 50 : subjects.length === 2 ? 33 : 28}%`,
              }}
            >
              <image
                href={portraitFor(categoryId)}
                width={bounds.size[0]}
                height={bounds.size[1]}
              />
            </svg>
          );
        })}
      </span>
    </figure>
  ) : null;
}
export function ResearchDiagram({
  id,
  profile = 'research-buffer-v2',
}: {
  id: string;
  profile?: RulesProfile;
}) {
  const { diagram } = researchDefinition(id, profile);
  const score = scoreBoard(
    diagram.sample.instances,
    [id],
    diagram.sample.preReveal,
    profile,
  );
  const center = (slot: number) => ({
    x: 42 + (slot % 3) * 72,
    y: 30 + Math.floor(slot / 3) * 60,
  });
  return (
    <figure className="ex-research-diagram">
      <svg
        viewBox={diagram.kind === 'lines' ? '0 0 274 216' : '0 0 228 180'}
        role="img"
        aria-label={diagram.caption}
      >
        <defs>
          <marker
            id={`arrow-${id}`}
            markerWidth="5"
            markerHeight="5"
            refX="4"
            refY="2.5"
            orient="auto"
          >
            <path d="M0,0 L5,2.5 L0,5" fill="#8164b4" />
          </marker>
        </defs>
        {diagram.sample.instances.map((instance, slot) => {
          const point = center(slot),
            selected = diagram.highlightSlots.includes(slot),
            face = card(instance),
            bounds = portraitBoundsFor(face.categoryId);
          return (
            <g key={slot}>
              <rect
                x={point.x - 30}
                y={point.y - 24}
                width={60}
                height={48}
                rx={9}
                fill={selected ? '#d7efe8' : '#f5f0e4'}
                stroke={selected ? '#258c77' : '#ddd5c0'}
                strokeWidth={2}
                strokeDasharray={
                  diagram.sample.preReveal[slot] ? undefined : '4 3'
                }
              />
              {(diagram.kind === 'roles' ||
                (diagram.kind === 'copy' &&
                  !face.copy &&
                  diagram.arrows.some((a) => a.to === slot))) &&
              portraitFor(face.categoryId) ? (
                <>
                  <svg
                    x={
                      point.x -
                      (face.categoryId === 'special-team-rocket' ? 28 : 26)
                    }
                    y={
                      point.y -
                      (face.categoryId === 'special-team-rocket' ? 23 : 20)
                    }
                    width={face.categoryId === 'special-team-rocket' ? 56 : 36}
                    height={face.categoryId === 'special-team-rocket' ? 28 : 40}
                    viewBox={bounds.viewBox.join(' ')}
                  >
                    <image
                      href={portraitFor(face.categoryId)}
                      width={bounds.size[0]}
                      height={bounds.size[1]}
                    />
                  </svg>
                  <rect
                    x={
                      point.x +
                      29 -
                      Math.max(19, String(score.values[slot]).length * 10 + 5)
                    }
                    y={
                      point.y +
                      (face.categoryId === 'special-team-rocket' ? 6 : 3)
                    }
                    width={Math.max(
                      19,
                      String(score.values[slot]).length * 10 + 5,
                    )}
                    height={face.categoryId === 'special-team-rocket' ? 17 : 19}
                    rx={4}
                    fill="#fffdf4"
                  />
                  <text
                    x={point.x + 21}
                    y={
                      point.y +
                      (face.categoryId === 'special-team-rocket' ? 22 : 19)
                    }
                    textAnchor="end"
                    fill="#1f4646"
                    fontSize={20}
                    fontWeight={700}
                  >
                    {score.values[slot]}
                  </text>
                </>
              ) : (
                <text
                  x={point.x}
                  y={point.y + 7}
                  textAnchor="middle"
                  fill="#1f4646"
                  fontSize={22}
                  fontWeight={700}
                >
                  {face.copy
                    ? `${face.copy === 'vertical' ? '↕' : '↔'}${score.values[slot]}`
                    : score.values[slot]}
                </text>
              )}
            </g>
          );
        })}
        {diagram.highlightLines.map((line) => {
          const slots = lines[line]!,
            a = center(slots[0]!),
            b = center(slots.at(-1)!);
          return (
            <line
              key={line}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#2f987d"
              strokeWidth={4}
              opacity={0.28}
            />
          );
        })}
        {diagram.kind === 'lines' &&
          diagram.highlightLines
            .filter((line) => score.matchedLines.includes(line))
            .map((line) => {
              const x =
                line < 3
                  ? 235
                  : line < 6
                    ? center((line - 3) * 1).x - 15
                    : line === 6
                      ? 236
                      : 6;
              const y =
                line < 3
                  ? center(line * 3).y + 7
                  : line < 6
                    ? 207
                    : line === 6
                      ? 174
                      : 207;
              return (
                <text
                  key={`zero-${line}`}
                  x={x}
                  y={y}
                  fontSize={20}
                  fontWeight={700}
                  fill="#258c77"
                >
                  {line < 3 ? '→0' : line < 6 ? '↓0' : line === 6 ? '↘0' : '↙0'}
                </text>
              );
            })}
        {diagram.arrows.map((arrow, index) => {
          const a = center(arrow.from),
            b = center(arrow.to);
          return (
            <path
              key={index}
              d={`M${a.x} ${a.y + 18} L${b.x} ${b.y + 18}`}
              stroke="#8164b4"
              strokeWidth={3}
              fill="none"
              markerEnd={`url(#arrow-${id})`}
            />
          );
        })}
      </svg>

      {diagram.kind === 'visibility' && (
        <p className="ex-diagram-notes">
          虚线表示揭示前暗牌；数字为结算有效值。
        </p>
      )}
      {(diagram.kind === 'roles' || diagram.kind === 'copy') && (
        <p className="ex-diagram-roles">
          {diagram.sample.instances
            .filter((_, slot) =>
              diagram.kind === 'roles'
                ? diagram.highlightSlots.includes(slot)
                : diagram.arrows.some((a) => a.to === slot),
            )
            .map((instance) => card(instance).name)
            .filter((name, index, names) => names.indexOf(name) === index)
            .map((name, i, names) => (
              <span className="ex-role-name" key={name}>
                {name}
                {i < names.length - 1 ? '、' : ''}
              </span>
            ))}
        </p>
      )}
      {diagram.annotations.length > 0 && (
        <p className="ex-diagram-notes">
          {diagram.annotations.map((a) => a.text).join('；')}
        </p>
      )}
    </figure>
  );
}
export function ResearchCard({
  task,
  profile = 'research-buffer-v2',
}: {
  task: ResearchTask;
  profile?: RulesProfile;
}) {
  const { presentation } = researchDefinition(task.id, profile);
  return (
    <div className="ex-research-card" data-research={task.id}>
      <ResearchPicture id={task.id} profile={profile} />
      <div className="ex-research-copy">
        <div className="ex-research-title">
          <h3>{task.name}</h3>
          <b>
            <ResearchReward task={task} />
          </b>
        </div>
        <p className="ex-research-flavor">{presentation.flavor}</p>
        <p className="ex-research-condition">
          <strong>达成条件</strong>
          {task.description}
        </p>
        {researchRiskText(task) && (
          <p className="ex-research-risk">
            <strong>未达成的代价</strong>
            {researchRiskText(task)}
          </p>
        )}
      </div>
      <ResearchDiagram id={task.id} profile={profile} />
    </div>
  );
}

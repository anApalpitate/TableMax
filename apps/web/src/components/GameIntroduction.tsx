import type { RoomView } from '@tablemax/protocol';
import { gameCover } from '../assets/game-covers';
import {
  gameIntroduction,
  type IntroductionIcon,
} from '../game-clients/introductions';
import './box-overlays.css';

function StepIllustration({ icon }: { icon: IntroductionIcon }) {
  return (
    <svg
      viewBox="0 0 160 100"
      aria-hidden="true"
      className="game-overview__illustration"
    >
      {icon === 'cards' || icon === 'pair' ? (
        <>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <g
              key={index}
              transform={`translate(${29 + (index % 3) * 36},${9 + Math.floor(index / 3) * 43})`}
            >
              <rect
                width="28"
                height="37"
                rx="5"
                fill={
                  icon === 'pair' && index % 3 === 1 ? '#fffdf3' : '#275f78'
                }
                stroke={
                  icon === 'pair' && index % 3 === 1 ? '#e2ab43' : '#9fc3c6'
                }
                strokeWidth="2"
              />
              {icon === 'pair' && index % 3 === 1 ? (
                <text
                  x="14"
                  y="26"
                  textAnchor="middle"
                  fontSize="24"
                  fontWeight="800"
                  fill="#194b45"
                >
                  3
                </text>
              ) : (
                <circle cx="14" cy="19" r="7" fill="#f8eee0" />
              )}
            </g>
          ))}
          {icon === 'pair' && (
            <text x="135" y="59" fontSize="25" fontWeight="800" fill="#194b45">
              0
            </text>
          )}
        </>
      ) : icon === 'swap' ? (
        <>
          <rect
            x="22"
            y="25"
            width="38"
            height="52"
            rx="6"
            fill="#275f78"
            stroke="#9fc3c6"
            strokeWidth="3"
          />
          <rect
            x="100"
            y="25"
            width="38"
            height="52"
            rx="6"
            fill="#fffdf3"
            stroke="#e2ab43"
            strokeWidth="3"
          />
          <path
            d="M54 13h50l-9-8m11 80H55l9 8"
            fill="none"
            stroke="#27756d"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m119 35 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z"
            fill="#e2ab43"
          />
        </>
      ) : icon === 'auction' ? (
        <>
          <g transform="rotate(-25 80 44)">
            <rect
              x="42"
              y="25"
              width="58"
              height="22"
              rx="5"
              fill="#c78252"
              stroke="#754c38"
              strokeWidth="3"
            />
            <path
              d="M70 48v34"
              stroke="#754c38"
              strokeWidth="12"
              strokeLinecap="round"
            />
          </g>
          <rect x="87" y="76" width="49" height="10" rx="4" fill="#c78252" />
          <path
            d="m120 23 9-8m0 22h14"
            stroke="#e2ab43"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      ) : icon === 'painting' ? (
        <>
          <rect
            x="37"
            y="11"
            width="85"
            height="77"
            rx="4"
            fill="#e2b37b"
            stroke="#946d4b"
            strokeWidth="3"
          />
          <rect x="47" y="21" width="65" height="57" fill="#f2ead9" />
          <circle cx="66" cy="39" r="10" fill="#d78067" />
          <path d="m49 73 22-25 17 13 13-22 9 34Z" fill="#55928c" />
          <path d="m86 24 11 20-16 3Z" fill="#b5c59a" />
        </>
      ) : (
        <>
          {[0, 1, 2].map((index) => (
            <g key={index}>
              <rect
                x={28 + index * 36}
                y={65 - index * 19}
                width="29"
                height={22 + index * 19}
                rx="4"
                fill={['#dcb66f', '#df9879', '#83aaa2'][index]}
              />
              <ellipse
                cx={42 + index * 36}
                cy={65 - index * 19}
                rx="14"
                ry="5"
                fill="#fff0bd"
                stroke="#b38338"
                strokeWidth="2"
              />
            </g>
          ))}
          <path
            d="m28 48 35-14 29-9 26-14m-15-1 15 1-4 15"
            fill="none"
            stroke="#27756d"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export function GameIntroduction({
  game,
}: {
  game: NonNullable<RoomView['game']>;
}) {
  const content = gameIntroduction(game.id);
  const [title, ...subtitle] = game.name.split('：');
  return (
    <section className="game-introduction game-overview">
      <div className="game-overview__heading">
        <img src={gameCover(game.id)} alt="" />
        <div>
          <h3>
            {title}
            {subtitle.length > 0 && (
              <>
                ：
                <span className="game-overview__subtitle">
                  {subtitle.join('：')}
                </span>
              </>
            )}
          </h3>
          <span className="game-overview__players">
            {game.min}–{game.max} 位玩家
          </span>
        </div>
      </div>
      {content && (
        <>
          <p className="game-overview__lead">{content.lead}</p>
          <div className="game-overview__steps">
            {content.steps.map((step) => (
              <article key={step.title}>
                <StepIllustration icon={step.icon} />
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
          <p className="game-overview__goal">
            <span aria-hidden="true">★</span>
            <strong>{content.goal}</strong>
          </p>
        </>
      )}
    </section>
  );
}

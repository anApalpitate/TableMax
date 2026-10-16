import { useState } from 'react';
import grandAustriaHotel from '../../../../../assets/platform/library-covers/grand-austria-hotel-v1.webp';
import duneImperium from '../../../../../assets/platform/library-covers/dune-imperium-v1.webp';
import scout from '../../../../../assets/platform/library-covers/scout-v2.webp';
import flip7 from '../../../../../assets/platform/library-covers/flip-7-v1.webp';

const officialCovers: Partial<Record<string, string>> = {
  'grand-austria-hotel': grandAustriaHotel,
  'dune-imperium': duneImperium,
  scout,
  'flip-7': flip7,
};

/** Local publisher imagery identifies planned games without fixing rule editions. */
export function CandidateCover({ id }: { id: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = officialCovers[id];
  if (source && failedSource !== source) {
    return (
      <img
        src={source}
        alt=""
        width="96"
        height="120"
        data-candidate-cover={id}
        onError={() => setFailedSource(source)}
      />
    );
  }
  return <CandidateCoverPlaceholder id={id} />;
}

/** Original decorative fallback for missing or unavailable publisher imagery. */
function CandidateCoverPlaceholder({ id }: { id: string }) {
  return (
    <svg
      className="game-library__candidate-cover"
      data-theme={id}
      viewBox="0 0 240 180"
      aria-hidden="true"
    >
      <rect className="candidate-paper" width="240" height="180" />
      <circle className="candidate-glow" cx="120" cy="70" r="56" />
      {id === 'grand-austria-hotel' ? (
        <g className="candidate-ink">
          <path d="M60 148V60l60-30 60 30v88H60Z" />
          <path
            className="candidate-accent"
            d="M104 148v-36a16 16 0 0 1 32 0v36"
          />
          {[78, 112, 146].map((x) => (
            <g key={x} className="candidate-window">
              <rect x={x} y="66" width="16" height="22" rx="6" />
              <rect x={x} y="100" width="16" height="20" rx="5" />
            </g>
          ))}
          <path className="candidate-line" d="M50 149h140M107 43h26" />
        </g>
      ) : id === 'dune-imperium' ? (
        <g>
          <circle className="candidate-accent" cx="158" cy="49" r="23" />
          <path
            className="candidate-ink"
            d="M0 142Q75 52 154 125q45 38 86 7v48H0Z"
          />
          <path
            className="candidate-sand"
            d="M0 162q73-72 145-17 53 36 95 6v29H0Z"
          />
          <path className="candidate-line" d="m100 109 20-55 20 55M120 54v68" />
        </g>
      ) : id === 'scout' ? (
        <g>
          <path className="candidate-ink" d="m40 140 80-100 80 100H40Z" />
          <path
            className="candidate-accent"
            d="M120 40v100H88l32-100Zm0 0 60 100h-30L120 40Z"
          />
          <path
            className="candidate-line"
            d="M120 40V23l27 9-27 9M34 145h172"
          />
          <path
            className="candidate-window"
            d="M105 140v-28a15 15 0 0 1 30 0v28Z"
          />
          <circle className="candidate-accent" cx="55" cy="52" r="5" />
          <circle className="candidate-accent" cx="184" cy="64" r="4" />
        </g>
      ) : (
        <g>
          <rect
            className="candidate-ink"
            x="58"
            y="43"
            width="76"
            height="104"
            rx="12"
            transform="rotate(-15 96 95)"
          />
          <rect
            className="candidate-accent"
            x="103"
            y="33"
            width="76"
            height="108"
            rx="12"
            transform="rotate(12 141 87)"
          />
          <path className="candidate-line" d="m123 64 31 6-30 46" />
          <path
            className="candidate-line"
            d="m46 65-9-5m155 62 11 5M83 25l-3-10"
          />
        </g>
      )}
    </svg>
  );
}

import { useId } from 'react';
import { samplePose, type PoseJoints } from './timeline';
import { Arceus, Groudon, Kyogre, Rayquaza } from './gods';
import type { ArtModelProps } from './art-model';
import { Charizard, Greninja, Lucario, Snorlax } from './beasts';
import { Ditto, Mew, Zapdos, Zorua } from './friends';
import { Rocket } from './rocket';

export type PoseArtProps = {
  creatureId: string;
  progress: number;
  className?: string;
};
type ModelProps = {
  joints: PoseJoints;
  ink: string;
  light: string;
  accent: string;
  progress: number;
};
const rotate = (angle: number, x: number, y: number) =>
  `rotate(${angle.toFixed(3)} ${x} ${y})`;

function Mewtwo({ joints: j, ink, light, accent }: ModelProps) {
  return (
    <g
      stroke={ink}
      strokeWidth="3.2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g data-joint="tail" transform={rotate(j.tail, 220, 350)}>
        <path
          d="M242 349 C149 359 92 305 111 237 C129 178 166 204 143 239 C107 294 194 306 264 313 Z"
          fill={accent}
        />
        <path
          d="M238 341 C172 339 123 300 126 254"
          fill="none"
          stroke="#dfb7e8"
          strokeWidth="8"
        />
      </g>
      <g data-joint="left-leg" transform={rotate(j.leftLeg, 241, 323)}>
        <path
          d="M245 302 C216 309 198 345 210 364 L190 422 Q181 431 165 432 Q153 445 178 448 L221 443 L242 392 Q267 345 263 320 Z"
          fill={light}
        />
        <path
          d="M232 351 L217 412"
          fill="none"
          stroke="#b5a8c4"
          strokeWidth="8"
        />
      </g>
      <g data-joint="right-leg" transform={rotate(j.rightLeg, 285, 324)}>
        <path
          d="M275 303 Q310 305 323 342 Q327 366 305 387 L311 414 Q319 428 342 429 Q364 433 354 446 L311 446 Q292 441 289 423 L275 371 Z"
          fill={light}
        />
        <path
          d="M308 339 Q314 354 301 372"
          fill="none"
          stroke="#b5a8c4"
          strokeWidth="8"
        />
      </g>
      <g data-joint="torso" transform={rotate(j.torso, 265, 301)}>
        <path
          d="M243 191 C212 210 229 250 222 278 C204 318 228 349 258 355 C300 362 321 331 306 294 L290 240 C291 217 276 200 274 188 Z"
          fill={light}
        />
        <path
          d="M252 268 C239 274 236 302 239 326 Q261 343 287 324 C294 303 287 278 270 270 Z"
          fill={accent}
        />
        <path
          d="M253 207 Q240 224 258 243 Q280 252 279 228"
          fill="none"
          stroke="#b5a8c4"
          strokeWidth="8"
        />
        <g data-joint="left-arm" transform={rotate(j.leftArm, 239, 216)}>
          <path
            d="M238 208 Q216 202 202 226 L167 236 Q155 232 150 218 L137 214 Q128 220 137 233 L143 243 L128 239 Q117 243 123 253 L143 260 L159 254 L190 252 Q226 249 247 226 Z"
            fill={light}
          />
          <circle cx="132" cy="246" r="10" fill={light} />
          <circle cx="143" cy="216" r="10" fill={light} />
          <circle cx="166" cy="242" r="10" fill={light} />
          <path
            d="M202 231 Q213 218 229 220"
            fill="none"
            stroke="#b5a8c4"
            strokeWidth="6"
          />
        </g>
        <g data-joint="right-arm" transform={rotate(j.rightArm, 287, 215)}>
          <path
            d="M278 208 Q293 201 307 219 L335 255 L360 275 Q371 279 373 288 L368 296 Q357 294 352 286 L350 302 Q342 310 335 302 L337 284 L326 273 L295 250 Q276 235 278 208 Z"
            fill={light}
          />
          <circle cx="368" cy="289" r="8" fill={light} />
          <circle cx="342" cy="303" r="8" fill={light} />
          <circle cx="353" cy="278" r="8" fill={light} />
        </g>
        <g data-joint="head" transform={rotate(j.head, 264, 187)}>
          <path
            d="M235 169 Q217 153 225 129 L223 100 Q229 94 242 106 L250 122 Q264 117 277 123 L292 107 Q304 104 302 119 L298 139 Q314 171 293 187 L277 202 L248 197 Z"
            fill={light}
          />
          <path
            d="M236 155 L258 165 L244 178 Q233 175 236 155 M282 163 L297 150 L295 177 L281 181 Z"
            fill="#faf8ff"
          />
          <path
            d="M244 159 L248 174 M291 157 L287 177"
            stroke="#8d3b9b"
            strokeWidth="5"
          />
          <path
            d="M251 188 Q269 192 279 185 M267 173 L263 182"
            fill="none"
            strokeWidth="2"
          />
          <path
            d="M235 127 Q231 149 240 155"
            fill="none"
            stroke="#ffffff"
            strokeWidth="6"
          />
        </g>
      </g>
    </g>
  );
}

const models: Readonly<
  Record<string, (props: ArtModelProps) => React.JSX.Element>
> = {
  mewtwo: Mewtwo,
  arceus: Arceus,
  groudon: Groudon,
  kyogre: Kyogre,
  rayquaza: Rayquaza,
  greninja: Greninja,
  mew: Mew,
  zapdos: Zapdos,
  'team-rocket': Rocket,
  charizard: Charizard,
  snorlax: Snorlax,
  lucario: Lucario,
  ditto: Ditto,
  zorua: Zorua,
};
const colors: Readonly<
  Record<string, readonly [string, string, string, string, string]>
> = {
  mewtwo: ['#fffcff', '#e6e0f1', '#bab1cb', '#cea0db', '#935fa7'],
  arceus: ['#fffefa', '#ececed', '#b9bbc8', '#f3d976', '#b18c38'],
  groudon: ['#f68b66', '#d94c43', '#9e303c', '#e8c8a0', '#a68878'],
  kyogre: ['#65b5e9', '#2e7fbd', '#244b89', '#d3ebfc', '#80b8df'],
  rayquaza: ['#9fdabc', '#529d78', '#2b6d58', '#f6dfa0', '#c9a54b'],
  greninja: ['#7093d3', '#395b9f', '#233565', '#a5dcf2', '#45a2d3'],
  mew: ['#fff1f7', '#eabfdc', '#c688b9', '#f7d6eb', '#c88fb5'],
  zapdos: ['#fff0a0', '#efd06b', '#cf9d39', '#f4d77e', '#c8a04f'],
  'team-rocket': ['#ffffff', '#efedf2', '#b9bdcd', '#ffe29a', '#dfb650'],
  charizard: ['#ffce8e', '#ec9856', '#c96738', '#fff2ba', '#d1bf83'],
  snorlax: ['#5e9baf', '#35778c', '#265667', '#fff6de', '#dfd3b9'],
  lucario: ['#a2d4e7', '#64a9c6', '#367594', '#fff0bc', '#d4c184'],
  ditto: ['#ead5f8', '#bc96d4', '#9672b5', '#d5b8e8', '#9470af'],
  zorua: ['#858196', '#5d576f', '#3c374a', '#d85e76', '#a12f50'],
};

export function PoseArt({ creatureId, progress, className }: PoseArtProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const sample = samplePose(creatureId, progress);
  const Model = models[creatureId];
  if (!sample || !Model) return null;
  const shades = colors[creatureId]!;
  const palette = {
    ink: '#39324d',
    light: `url(#${id}-light)`,
    accent: `url(#${id}-accent)`,
  };
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-creature={creatureId}
      data-pose={sample.poseName}
      data-pose-index={sample.index}
      data-pose-source="layered-svg-skeleton"
    >
      <defs>
        <linearGradient
          id={`${id}-light`}
          x1="170"
          y1="120"
          x2="335"
          y2="425"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={shades[0]} />
          <stop offset=".55" stopColor={shades[1]} />
          <stop offset="1" stopColor={shades[2]} />
        </linearGradient>
        <linearGradient
          id={`${id}-accent`}
          x1="120"
          y1="210"
          x2="285"
          y2="370"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={shades[3]} />
          <stop offset="1" stopColor={shades[4]} />
        </linearGradient>
      </defs>
      <g
        transform={`translate(0 ${sample.joints.lift.toFixed(3)})`}
        data-joint="body-height"
      >
        <Model joints={sample.joints} {...palette} progress={sample.progress} />
      </g>
    </svg>
  );
}

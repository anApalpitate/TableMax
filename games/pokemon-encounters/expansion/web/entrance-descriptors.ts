/** Public presentation configuration. Independent of renderer, poses and rule state. */
export const entranceDescriptors: Readonly<
  Record<string, { durationMs: number; fullscreen: boolean }>
> = {
  mewtwo: {
    durationMs: 1650,
    fullscreen: true,
  },
  arceus: {
    durationMs: 1750,
    fullscreen: true,
  },
  groudon: {
    durationMs: 1600,
    fullscreen: true,
  },
  kyogre: {
    durationMs: 1700,
    fullscreen: true,
  },
  rayquaza: {
    durationMs: 1650,
    fullscreen: true,
  },
  greninja: {
    durationMs: 1600,
    fullscreen: true,
  },
  mew: {
    durationMs: 1650,
    fullscreen: true,
  },
  zapdos: {
    durationMs: 1500,
    fullscreen: true,
  },
  'team-rocket': {
    durationMs: 1800,
    fullscreen: true,
  },
  charizard: {
    durationMs: 650,
    fullscreen: false,
  },
  snorlax: {
    durationMs: 550,
    fullscreen: false,
  },
  lucario: {
    durationMs: 850,
    fullscreen: false,
  },
  ditto: {
    durationMs: 400,
    fullscreen: false,
  },
  zorua: {
    durationMs: 450,
    fullscreen: false,
  },
};
export const maximumEntranceMs = Math.max(
  ...Object.values(entranceDescriptors).map((x) => x.durationMs),
);

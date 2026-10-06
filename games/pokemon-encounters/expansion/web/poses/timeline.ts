export type PoseJoints = {
  head: number;
  torso: number;
  leftArm: number;
  rightArm: number;
  leftLeg: number;
  rightLeg: number;
  tail: number;
  lift: number;
};
export type PoseSequence = {
  creatureId: string;
  durationMs: number;
  poseNames: readonly string[];
  poses: readonly PoseJoints[];
  positions: readonly number[];
  presentation: 'full' | 'local';
  fullscreen: boolean;
};
type JointRow = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
const keys = [
  'head',
  'torso',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg',
  'tail',
  'lift',
] as const;
function sequence(
  creatureId: string,
  durationMs: number,
  presentation: PoseSequence['presentation'],
  poseNames: readonly string[],
  rows: readonly JointRow[],
): PoseSequence {
  return {
    creatureId,
    durationMs,
    presentation,
    fullscreen: presentation === 'full',
    poseNames,
    positions: rows.map((_, index) => keyProgress(index, rows.length)),
    poses: rows.map(
      (row) =>
        Object.fromEntries(
          keys.map((key, index) => [key, row[index]]),
        ) as PoseJoints,
    ),
  };
}
/** Authored joint poses: no rule state, clock, random source or private card faces. */
export const poseSequences: Readonly<Record<string, PoseSequence>> = {
  mewtwo: sequence(
    'mewtwo',
    1650,
    'full',
    ['lock', 'entry', 'palm', 'pull', 'release'],
    [
      [-18, -9, 42, -32, 12, -18, -23, 18],
      [-5, 4, -24, 35, -14, 17, 21, -8],
      [7, -3, 37, -73, 4, -12, 38, -20],
      [-2, 7, -18, 96, -22, 26, -12, -12],
      [13, -5, 30, 8, 15, -5, -38, 14],
    ],
  ),
  arceus: sequence(
    'arceus',
    1750,
    'full',
    ['silhouette', 'rise', 'veil', 'reveal', 'release'],
    [
      [19, 6, 18, -20, 12, -15, -20, 10],
      [-17, -8, -22, 28, -17, 16, 12, -3],
      [8, 4, 36, -38, 27, -22, 28, -12],
      [-10, -4, -28, 42, -12, 31, -15, -18],
      [3, 8, 10, -5, 19, -7, -28, 7],
    ],
  ),
  groudon: sequence(
    'groudon',
    1600,
    'full',
    ['crouch', 'press', 'roar', 'stamp', 'settle'],
    [
      [18, 12, 16, -20, -19, 21, -22, 22],
      [9, 18, -42, 28, -30, 35, 11, 33],
      [-22, -10, -66, 59, 18, -16, 27, -12],
      [12, 3, 28, -58, -39, 45, -12, 8],
      [-5, -4, 9, 13, 12, -9, -29, 4],
    ],
  ),
  kyogre: sequence(
    'kyogre',
    1700,
    'full',
    ['dive', 'unfurl', 'rise', 'sweep', 'sink'],
    [
      [14, 10, 34, -32, 17, -16, -25, 25],
      [-3, -7, -24, 26, -12, 13, 21, -8],
      [-15, -11, -43, 45, -22, 24, 33, -25],
      [7, 20, -9, 52, 29, -19, -13, -10],
      [21, -5, 42, -24, 11, -30, -38, 19],
    ],
  ),
  rayquaza: sequence(
    'rayquaza',
    1650,
    'full',
    ['coil', 'dive', 'spiral', 'sweep', 'exit'],
    [
      [-19, -9, 22, -19, 13, -14, -40, 12],
      [12, 14, -30, 32, -21, 24, 26, -18],
      [-6, -20, 48, -42, 34, -32, 44, -9],
      [18, 12, -24, 49, -12, 19, -23, -23],
      [-23, 2, 11, -33, 28, -21, -46, 9],
    ],
  ),
  greninja: sequence(
    'greninja',
    1600,
    'full',
    ['focus', 'bond', 'transform', 'dash', 'cover', 'settle'],
    [
      [14, 15, 28, -26, -28, 31, -22, 26],
      [-12, -3, -45, 40, 12, -13, 18, -6],
      [-6, -8, -66, 65, -21, 23, 32, -17],
      [17, 21, -9, 103, 42, -49, -38, -12],
      [-17, -14, -84, -17, -41, 32, 41, -28],
      [7, 6, 13, -34, 18, -16, -14, 18],
    ],
  ),
  mew: sequence(
    'mew',
    1650,
    'full',
    ['curl', 'open', 'pull', 'release'],
    [
      [17, 14, 42, -44, -31, 33, -36, 15],
      [-15, -8, -47, 49, 18, -17, 34, -17],
      [4, 8, -17, 91, -14, 25, 13, -29],
      [-5, -12, 25, -18, 29, -24, -25, 5],
    ],
  ),
  zapdos: sequence(
    'zapdos',
    1500,
    'full',
    ['dive', 'unfurl', 'strike', 'exit'],
    [
      [17, 12, 37, -38, -24, 25, -25, 22],
      [-12, -8, -26, 29, 17, -14, 31, -12],
      [-4, 4, -58, 52, -19, 32, 13, -25],
      [11, -12, 16, -31, 27, -21, -37, 8],
    ],
  ),
  'team-rocket': sequence(
    'team-rocket',
    1800,
    'full',
    ['entry', 'pose', 'coin', 'exit'],
    [
      [-12, -5, 26, -31, 15, -17, -25, 17],
      [13, 7, -52, 59, -12, 15, 33, -3],
      [-5, -8, -22, 100, 25, -21, 15, -12],
      [20, 11, 45, -24, -26, 32, -38, 9],
    ],
  ),
  charizard: sequence(
    'charizard',
    650,
    'local',
    ['inhale', 'charge', 'exhale', 'settle'],
    [
      [16, 9, 25, -28, -16, 21, -27, 14],
      [-19, -7, -31, 37, 12, -15, 35, -9],
      [-9, 12, -49, 66, -23, 27, 12, -18],
      [7, -5, 15, -13, 24, -18, -38, 4],
    ],
  ),
  snorlax: sequence(
    'snorlax',
    550,
    'local',
    ['ready', 'twist-left', 'twist-right', 'settle'],
    [
      [7, 5, 13, -18, -12, 15, -7, 11],
      [-16, -15, -44, 32, 21, -24, 14, 3],
      [15, 16, 42, -53, -22, 28, -17, -9],
      [-4, -3, 21, 11, 16, -12, 8, 6],
    ],
  ),
  lucario: sequence(
    'lucario',
    850,
    'local',
    ['gather', 'charge', 'pulse', 'settle'],
    [
      [11, 10, 29, -30, -20, 23, -26, 19],
      [-14, -9, -32, 41, 14, -17, 29, -7],
      [-3, 8, -58, 96, -28, 34, 11, -19],
      [8, -5, 16, -19, 23, -12, -35, 8],
    ],
  ),
  ditto: sequence(
    'ditto',
    400,
    'local',
    ['round', 'stretch', 'morph', 'round-return'],
    [
      [0, 2, 13, -12, 9, -8, -20, 12],
      [-12, -8, -35, 38, -17, 21, 33, -21],
      [16, 17, 47, -44, 28, -31, 10, -9],
      [7, -3, 24, -18, -9, 13, -31, 5],
    ],
  ),
  zorua: sequence(
    'zorua',
    450,
    'local',
    ['crouch', 'look-up', 'rise', 'settle'],
    [
      [19, 14, 21, -24, -18, 22, -29, 23],
      [-21, -8, -25, 34, 16, -15, 31, -8],
      [-5, 7, -43, 55, -24, 29, 12, -18],
      [8, -4, 12, -10, 21, -17, -37, 6],
    ],
  ),
};
export const poseFrameCount = Object.values(poseSequences).reduce(
  (count, entry) => count + entry.poses.length,
  0,
);
/** All authored poses occur before the exit camera fades; hold the final 15%. */
export function keyProgress(index: number, count: number) {
  return count <= 1
    ? 0
    : (0.85 * Math.max(0, Math.min(count - 1, index))) / (count - 1);
}
export function samplePose(creatureId: string, progress: number) {
  const entry = poseSequences[creatureId];
  if (!entry) return null;
  const safeProgress = Number.isFinite(progress)
    ? Math.max(0, Math.min(1, progress))
    : 0;
  const rawPosition =
    Math.min(1, safeProgress / 0.85) * (entry.poses.length - 1);
  const nearest = Math.round(rawPosition);
  const position =
    Math.abs(nearest - rawPosition) < 1e-9 ? nearest : rawPosition;
  const index = Math.min(entry.poses.length - 1, Math.floor(position));
  const from = entry.poses[index]!;
  const to = entry.poses[Math.min(index + 1, entry.poses.length - 1)]!;
  const fraction = position - index;
  const eased = fraction * fraction * (3 - 2 * fraction);
  const joints = Object.fromEntries(
    keys.map((key) => [key, from[key] + (to[key] - from[key]) * eased]),
  ) as PoseJoints;
  return {
    sequence: entry,
    index,
    poseName: entry.poseNames[index]!,
    progress: safeProgress,
    joints,
  };
}

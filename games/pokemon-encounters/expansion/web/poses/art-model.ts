import type { PoseJoints } from './timeline';
export type ArtModelProps = {
  joints: PoseJoints;
  ink: string;
  light: string;
  accent: string;
  progress: number;
};
export const rotateJoint = (angle: number, x: number, y: number) =>
  `rotate(${angle.toFixed(3)} ${x} ${y})`;

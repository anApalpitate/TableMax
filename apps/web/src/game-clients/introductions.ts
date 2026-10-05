import { moduleFor } from '../catalog';
import type { ModuleManifest } from '../../../../packages/game-sdk/src/module-manifest';
export type GameIntroductionContent = NonNullable<
  ModuleManifest['introduction']
>;
export type IntroductionIcon = GameIntroductionContent['steps'][number]['icon'];
export const gameIntroduction = (id: string) => moduleFor(id)?.introduction;

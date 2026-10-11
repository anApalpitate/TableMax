import type {
  GameDetails,
  ModuleManifest,
} from '@tablemax/game-sdk/module-manifest';
export type GameIntroductionContent = NonNullable<
  ModuleManifest['introduction']
>;
export type IntroductionIcon = GameIntroductionContent['steps'][number]['icon'];
export const gameIntroduction = (
  details: GameDetails | undefined,
  variantId?: string,
) => {
  return (
    details?.variants?.find((variant) => variant.id === variantId)
      ?.introduction ?? details?.introduction
  );
};

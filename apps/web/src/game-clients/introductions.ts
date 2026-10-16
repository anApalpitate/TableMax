import type {
  GameDetails,
  ModuleManifest,
} from '@tablemax/game-sdk/module-manifest';
export type GameIntroductionContent = NonNullable<
  ModuleManifest['introduction']
>;
export type IntroductionIcon = GameIntroductionContent['steps'][number]['icon'];
const sourceIllustrations = import.meta.glob<string>(
  [
    '../../../../assets/games/*/introduction-*.svg',
    '../../../../assets/games/*/expansion/introduction-*.svg',
  ],
  { eager: true, query: '?url', import: 'default' },
);

/** Current source previews and immutable installed releases use the same metadata. */
export function gameIntroductionIllustration(
  path: string | undefined,
  gameId: string,
  releaseRef?: string,
) {
  if (!path) return undefined;
  const prefix = `assets/games/${gameId}/`;
  if (
    !path.startsWith(prefix) ||
    !/^assets\/games\/[a-z][a-z0-9-]*\/(?:[a-z0-9-]+\/)*introduction-[a-z0-9-]+\.svg$/.test(
      path,
    )
  )
    return undefined;
  const resource = `${gameId}/${path.slice(prefix.length)}`;
  if (releaseRef)
    return /^[a-f0-9]{64}$/.test(releaseRef)
      ? `/game-packages/${releaseRef}/resources/${resource}`
      : undefined;
  return import.meta.env.PROD
    ? `/games/${gameId}/resources/${resource}`
    : sourceIllustrations[`../../../../${path}`];
}

export const gameIntroduction = (
  details: GameDetails | undefined,
  variantId?: string,
) => {
  return (
    details?.variants?.find((variant) => variant.id === variantId)
      ?.introduction ?? details?.introduction
  );
};

/** Browser-only art registry. Rules and saved state never depend on asset filenames. */
const images = import.meta.glob<string>('./characters/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const frames: Record<string, string> = {
  'ordinary--2': '#f5ce42',
  'ordinary-0': '#ec87ae',
  'ordinary-1': '#d39c58',
  'ordinary-3': '#74b969',
  'ordinary-4': '#6facdc',
  'ordinary-5': '#ee9461',
  'ordinary-6': '#eb9fa6',
  'ordinary-7': '#9a84c7',
  'ordinary-8': '#d79bba',
  'ordinary-9': '#aeb5b4',
  'special-mew': '#f2ceda',
  'special-team-rocket': '#eee6ce',
  'special-zapdos': '#f3cf48',
  'special-charizard': '#ec9159',
  'special-snorlax': '#74a9ab',
  'special-ditto': '#b793d3',
};

export function cardArt(categoryId: string) {
  return {
    image:
      images[`./characters/${categoryId}-official.png`] ??
      images[`./characters/${categoryId}-v1.webp`],
    frame: frames[categoryId] ?? '#eee6ce',
  };
}

export const coinArt = {
  pikachu: images['./characters/ordinary--2-official.png'],
  meowth: images['./characters/coin-meowth-official.png'],
};

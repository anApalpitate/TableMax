/** Only father/son and grandfather/grandson nickname relations. */
const kinshipNames: Readonly<Record<string, string>> = {
  爸爸: '儿子',
  父亲: '儿子',
  父親: '儿子',
  老爹: '乖儿',
  老父: '幼子',
  老子: '小子',
  义父: '义子',
  养父: '养子',
  養父: '养子',
  生父: '亲子',
  干爹: '干儿',
  干爸: '干儿',
  乾爸: '干儿',
  爷爷: '孙子',
  爺爺: '孙子',
  外公: '外孙',
  老爷子: '小孙子',
  老爺子: '小孙子',
  老爷: '孙子',
  老爺: '孙子',
  大爷: '孙子',
  大爺: '孙子',
  曾爷爷: '曾孙子',
  曾爺爺: '曾孙子',
  太爷爷: '曾孙子',
  太爺爺: '曾孙子',
  太姥爷: '曾外孙',
  太姥爺: '曾外孙',
  太爷: '曾孙',
  太爺: '曾孙',
  父: '子',
  爸: '儿',
  爹: '儿',
  爷: '孙',
  爺: '孙',
};
const chinese = kinshipNames;
// These compounds contain 父/爸/爹 but belong to other relationships. Match whole first.
const excludedTerms = [
  '父母',
  '爸妈',
  '爸媽',
  '爹娘',
  '岳父',
  '伯父',
  '叔父',
  '姑父',
  '舅父',
  '姨父',
  '师父',
  '師父',
  '教父',
  '神父',
];
const english: Readonly<Record<string, string>> = {
  dad: '儿子',
  daddy: '儿子',
  papa: '儿子',
  father: '儿子',
  baba: '儿子',
  laoba: '儿子',
  grandpa: '孙子',
  granddad: '孙子',
  grandfather: '孙子',
  yeye: '孙子',
  stepfather: '继子',
};
const gap = '[\\s\\u200b-\\u200d\\u2060\\ufeff·・._-]*';
const chinesePattern = [...Object.keys(chinese), ...excludedTerms]
  .sort((a, b) => b.length - a.length)
  .map((word) => [...word].join(gap))
  .join('|');
const englishPattern = Object.keys(english)
  .sort((a, b) => b.length - a.length)
  .map((word) =>
    [...word]
      .map(
        (letter) =>
          `[${letter}${String.fromCharCode(letter.charCodeAt(0) + 0xfee0)}]`,
      )
      .join(gap),
  )
  .join('|');
const matcher = new RegExp(
  `${chinesePattern}|(?<![a-zａ-ｚ])(?:${englishPattern})(?![a-zａ-ｚ])`,
  'giu',
);
const stripGaps = (value: string) =>
  value.replace(/[\s\u200b-\u200d\u2060\ufeff·・._-]/gu, '');

/** Applied on explicit name submission only. Restoring a save keeps its original names. */
export function normalizePlayerName(input: string): string {
  const trimmed = input.trim();
  return trimmed.replace(matcher, (match) => {
    const key = stripGaps(match);
    return (
      chinese[key as keyof typeof chinese] ??
      english[key.normalize('NFKC').toLowerCase()] ??
      match
    );
  });
}

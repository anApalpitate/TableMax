type CandidateSeedReport = {
  trainSeeds?: unknown;
  tuneSeeds?: unknown;
  relatedSeeds?: unknown;
  localCorpus?: { seeds?: unknown } | null;
};

export function correctionSeeds(report: CandidateSeedReport) {
  const { trainSeeds, tuneSeeds, relatedSeeds, localCorpus } = report;
  if (
    !Array.isArray(trainSeeds) ||
    !trainSeeds.length ||
    !Array.isArray(tuneSeeds) ||
    !tuneSeeds.length
  )
    throw new Error(
      'UNO correction needs its frozen training and tuning seeds',
    );
  const groups = [
    trainSeeds,
    tuneSeeds,
    relatedSeeds ?? [],
    localCorpus?.seeds ?? [],
  ];
  if (groups.some((group) => !Array.isArray(group)))
    throw new Error('Invalid UNO correction seed provenance');
  const seeds = groups.flat();
  if (
    !seeds.every(
      (seed): seed is number =>
        typeof seed === 'number' &&
        Number.isInteger(seed) &&
        seed >= 1 &&
        seed <= 0xffffffff,
    ) ||
    new Set(seeds).size !== seeds.length
  )
    throw new Error('Invalid or overlapping UNO correction seed provenance');
  return seeds;
}

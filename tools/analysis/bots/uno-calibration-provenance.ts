type Report = {
  trainSeeds?: unknown;
  holdoutSeeds?: unknown;
  pending?: { fitSeeds?: unknown; reviewSeeds?: unknown };
};

export function calibrationSeeds(report: Report): number[] {
  const groups = [
    report.trainSeeds,
    report.holdoutSeeds,
    ...(report.pending === undefined
      ? []
      : [report.pending.fitSeeds, report.pending.reviewSeeds]),
  ];
  const result: number[] = [];
  for (const group of groups) {
    if (
      !Array.isArray(group) ||
      !group.length ||
      group.some(
        (seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
      )
    )
      throw new Error('Calibration must identify all its frozen seeds');
    result.push(...group);
  }
  if (result.length !== new Set(result).size)
    throw new Error('Calibration seed partitions overlap');
  return result;
}

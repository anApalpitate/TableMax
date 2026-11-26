type Calibration = {
  calibrationDigest?: unknown;
  options?: { hypotheses?: unknown };
};

type Candidate = Calibration & {
  type?: unknown;
  calibrationReportSha256?: unknown;
};

export function matchesUnoCorrectionCalibration(
  candidate: Candidate | null | undefined,
  calibration: Calibration | null | undefined,
  calibrationReportSha256: string,
) {
  const leafDigest = calibration?.calibrationDigest;
  const samples = calibration?.options?.hypotheses;
  return (
    candidate?.type === 'uno-residual-candidate' &&
    typeof leafDigest === 'string' &&
    /^[a-f0-9]{64}$/.test(leafDigest) &&
    /^[a-f0-9]{64}$/.test(calibrationReportSha256) &&
    candidate.calibrationReportSha256 === calibrationReportSha256 &&
    candidate.calibrationDigest === leafDigest &&
    (samples === 8 || samples === 16) &&
    candidate.options?.hypotheses === samples
  );
}

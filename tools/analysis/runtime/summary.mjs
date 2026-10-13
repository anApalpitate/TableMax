export const SAMPLE_LIMIT = 256;
export function boundedPush(values, value) {
  if (!Number.isFinite(value) || value < 0) return;
  values.push(value);
  if (values.length > SAMPLE_LIMIT) values.shift();
}
export function summarize(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (p) =>
    sorted.length
      ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]
      : null;
  return {
    samples: sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.at(-1) ?? null,
  };
}

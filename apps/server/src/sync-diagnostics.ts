export type SyncMetric =
  | 'projection'
  | 'probeUnchanged'
  | 'commandReply'
  | 'saveToBroadcast'
  | 'broadcast';
const names: readonly SyncMetric[] = [
  'projection',
  'probeUnchanged',
  'commandReply',
  'saveToBroadcast',
  'broadcast',
];

/** Bounded timing samples only; no credentials, actions or projected contents. */
export class SyncDiagnostics {
  private metrics = Object.fromEntries(
    names.map((name) => [name, { count: 0, samplesMs: [] as number[] }]),
  ) as Record<SyncMetric, { count: number; samplesMs: number[] }>;
  record(name: SyncMetric, elapsedMs: number) {
    const metric = this.metrics[name];
    metric.count++;
    metric.samplesMs.push(Math.max(0, elapsedMs));
    if (metric.samplesMs.length > 256) metric.samplesMs.shift();
  }
  snapshot(): {
    sampleLimit: number;
    metrics: Readonly<
      Record<
        SyncMetric,
        { readonly count: number; readonly samplesMs: readonly number[] }
      >
    >;
  } {
    return {
      sampleLimit: 256,
      metrics: Object.fromEntries(
        names.map((name) => [
          name,
          {
            count: this.metrics[name].count,
            samplesMs: [...this.metrics[name].samplesMs],
          },
        ]),
      ) as Record<SyncMetric, { count: number; samplesMs: number[] }>,
    };
  }
}

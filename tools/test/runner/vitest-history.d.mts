export function failureLimit(value?: string | number): number;
// Keep the small config contract independent of Vitest node/browser ambient
// declarations. Runtime integration is checked against the pinned local build.
export class HistorySequencer {
  constructor(context: { config: { root: string } });
  shard<T>(files: T[]): Promise<T[]>;
  sort<T>(files: T[]): Promise<T[]>;
}
export class HistoryReporter {
  onInit(vitest: unknown): void;
}
export default HistoryReporter;

import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { TestRunner } from 'vitest';
import {
  TestHistory,
  sortSuite,
  rawIdentity,
  lifecycleIdentity,
} from './history.mjs';

export default class HistoryRunner extends TestRunner {
  constructor(config) {
    super(config);
    this.history = new TestHistory(config.root);
    this.runId = this.injectValue('tablemaxTestHistoryRun');
    if (!this.runId) {
      this.history.close();
      throw new Error(
        'HistoryRunner requires HistoryReporter; keep it when selecting CLI reporters',
      );
    }
  }
  exhausted() {
    return this.history.failures(this.runId) >= this.config.bail;
  }
  async onBeforeRunSuite(suite) {
    sortSuite(suite, this.history, this.config.name ?? '');
    if (this.exhausted()) this.cancel('test-failure');
    await super.onBeforeRunSuite(suite);
  }
  async onBeforeRunTask(task) {
    if (this.exhausted()) this.cancel('test-failure');
    await super.onBeforeRunTask(task);
  }
  onAfterRunTask(task) {
    super.onAfterRunTask(task);
    const result = task.result;
    if (!result?.startTime || !['pass', 'fail'].includes(result.state)) return;
    this.history.record(
      this.runId,
      `${this.runId}:${task.id}`,
      rawIdentity(this.history.root, task, this.config.name ?? ''),
      result.state === 'pass' ? 'passed' : 'failed',
      result.duration ?? 0,
      {
        retryCount: result.retryCount ?? 0,
        repeatCount: result.repeatCount ?? 0,
        errors:
          result.errors?.map((error) => ({
            message: error.message,
            stack: error.stack,
          })) ?? [],
      },
    );
  }
  lifecycle(suite) {
    if (!['pass', 'fail'].includes(suite.result?.state)) return;
    const file = 'filepath' in suite;
    const identity = lifecycleIdentity(
      this.history.root,
      suite,
      this.config.name ?? '',
    );
    const errors = suite.result.errors ?? [];
    this.history.record(
      this.runId,
      `${this.runId}:${file ? 'module' : 'suite'}:${suite.id}`,
      identity,
      errors.length ? 'failed' : 'passed',
      0,
      {
        errors: errors.map((error) => ({
          message: error.message,
          stack: error.stack,
        })),
      },
    );
  }
  async onAfterRunSuite(suite) {
    await super.onAfterRunSuite(suite);
    this.lifecycle(suite);
  }
  onAfterRunFiles(files) {
    try {
      for (const file of files) this.lifecycle(file);
      super.onAfterRunFiles(files);
    } finally {
      this.history.close();
    }
  }
}

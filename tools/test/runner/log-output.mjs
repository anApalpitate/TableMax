import { openSync, closeSync, fstatSync, readSync } from 'node:fs';
import { join } from 'node:path';

export const summaryBudgetBytes = 2048;
export const failureBudgetBytes = 8192;
export async function selectionListOutput(
  root,
  selection,
  directory = process.env.TABLEMAX_TEST_HISTORY_DIR ??
    'artifacts/maintenance/test-history',
) {
  const { atomicJson, localFile } = await import('./evidence.mjs');
  const path = join(directory, 'preset-list.json');
  atomicJson(root, path, selection);
  const full = JSON.stringify(selection, null, 2);
  if (Buffer.byteLength(full + '\n') <= summaryBudgetBytes)
    return {
      text: full,
      truncated: false,
      evidencePath: localFile(root, path),
    };
  const summary = {
    version: selection.version,
    scope: selection.scope,
    preset: selection.preset,
    truncated: true,
    counts: {
      execute: selection.tests.filter((item) => item.decision === 'execute')
        .length,
      reuse: selection.tests.filter((item) => item.decision === 'reuse').length,
      excluded: selection.excluded.length,
    },
    message: '选择输出已截断；完整执行、复用、排除及理由见证据文件',
    evidencePath: localFile(root, path),
  };
  const text = JSON.stringify(summary, null, 2);
  if (Buffer.byteLength(text + '\n') > summaryBudgetBytes)
    throw new Error('Selection evidence path exceeds console output budget');
  return { text, truncated: true, evidencePath: summary.evidencePath };
}
function utf8Tail(bytes) {
  let start = 0;
  while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start++;
  return bytes.subarray(start).toString('utf8');
}
function tail(path, limit) {
  const handle = openSync(path, 'r');
  try {
    const size = fstatSync(handle).size,
      length = Math.min(size, Math.max(0, limit));
    const bytes = Buffer.alloc(length);
    readSync(handle, bytes, 0, length, size - length);
    return { text: utf8Tail(bytes), truncated: size > length };
  } finally {
    closeSync(handle);
  }
}
export function failureLogExcerpt(logs, limit = failureBudgetBytes) {
  const header = '完整日志：' + logs.join(' ; ') + '\n';
  const marker = '\n[输出已截断；请查看上述完整日志]\n';
  const allowance = Math.max(
    0,
    limit - Buffer.byteLength(header + marker) - logs.length - 1,
  );
  const portions = logs.map((path) =>
    tail(path, Math.floor(allowance / logs.length)),
  );
  const truncated = portions.some((portion) => portion.truncated);
  const result =
    header +
    portions.map((portion) => portion.text).join('\n') +
    (truncated ? marker : '\n');
  return { text: result, truncated };
}
export function createOutputBudget(
  write = (text, failed) => (failed ? console.error : console.log)(text),
) {
  let summaries = summaryBudgetBytes,
    failures = failureBudgetBytes,
    summaryTruncated = false;
  return {
    line(text) {
      const marker = '[结论输出已截断；完整逐项结果见本轮 results.json]';
      if (
        Buffer.byteLength(text + '\n') <=
        summaries - Buffer.byteLength(marker + '\n')
      ) {
        summaries -= Buffer.byteLength(text + '\n');
        write(text, false);
      } else if (!summaryTruncated) {
        summaries -= Buffer.byteLength(marker + '\n');
        summaryTruncated = true;
        write(marker, false);
      }
    },
    failure(logs) {
      if (
        failures <
        Buffer.byteLength(
          '完整日志：' +
            logs.join(' ; ') +
            '\n[输出已截断；请查看上述完整日志]\n',
        ) +
          logs.length +
          1
      )
        return;
      const excerpt = failureLogExcerpt(logs, failures);
      failures -= Buffer.byteLength(excerpt.text + '\n');
      write(excerpt.text, true);
    },
  };
}

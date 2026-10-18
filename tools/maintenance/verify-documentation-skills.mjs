import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { failureLimit } from '../test/runner/failure-policy.mjs';
import { localFile } from '../test/runner/evidence.mjs';

// Fresh CLI sessions test discovery; stdout is evidence, not an automatic pass.
const cases = {
  'doc-route':
    '请为 TableMax 整理文档：把文档规则中的来源冲突处理、未核实原文和旧结论适用范围整理成可执行的维护方案。当前只做只读准备：定位唯一正文和准确章节，说明若实施应改哪里、如何核对入链；不要编辑文件或写审计报告。',
  'validation-route':
    '假设本任务只修改现有 games/uno/rules/rules.test.ts 与 games/uno/rules/engine.ts，其他未提交内容不是本任务。请选择必要验证范围，使用已有纯选择导出函数实际做只读范围选择（先核对副作用；不能运行写选择报告的预览分支）。说明 SHA changes 过期、证据损坏、失败阈值及修复后复验。不要写报告、测试、安装、发布或清理。',
  'missing-path':
    '本任务输入声称只修改 games/uno/src/not-a-real-file.test.ts。请只读核对这个路径能否用于本任务 changes SHA 绑定；路径若不存在应明确拒绝，不得猜测替代、生成清单或执行检查。',
  'ordinary-query':
    'TableMax 的管理员占玩家座位吗？只回答这个问题并给出当前正文定位；不要写文件或运行检查。',
  'exact-command':
    '只执行这一条命令并报告结果：node tools/test/runner/test-scoped.mjs --scope=game:uno --list。不要增加其他检查或文档维护。',
  'combined-route':
    '请为 TableMax 整合文档维护中的来源变化复核规则，并为这一文档改动选择定向验证。这次只做只读预演：找到唯一维护正文及准确章节，给出应修改的位置、冲突保全办法、必要入链和适用检查；说明 changes SHA 过期及复用证据损坏时怎么处理。不要写文件、执行审计、启动测试或产品。',
};
const selected = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--case='))
  ?.slice(7);
if (!Object.hasOwn(cases, selected)) {
  console.error(
    'Usage: node tools/maintenance/verify-documentation-skills.mjs --case=' +
      Object.keys(cases).join('|') +
      ' [--model=<available-model>] [--evidence=<repository-directory>]',
  );
  process.exit(2);
}
const root = process.cwd();
const evidence = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice(11);
const parent = localFile(
  root,
  evidence ?? 'artifacts/maintenance/documentation-skills',
);
mkdirSync(parent, { recursive: true });
const directory = mkdtempSync(join(parent, `${selected}-${Date.now()}-`));
const prompt = cases[selected];
writeFileSync(join(directory, 'prompt.txt'), prompt + '\n');
const executable = process.env.TABLEMAX_CODEX_EXECUTABLE ?? 'codex';
const args = [
  'exec',
  '--ephemeral',
  '--sandbox',
  'read-only',
  '--json',
  '-C',
  root,
  '-',
];
const model = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--model='))
  ?.slice(8);
if (model) args.splice(args.length - 1, 0, '--model', model);
const startedAt = new Date().toISOString();
const child = spawn(executable, args, {
  cwd: root,
  windowsHide: true,
  stdio: ['pipe', 'pipe', 'pipe'],
});
let stdout = '',
  stderr = '',
  timedOut = false,
  error,
  pending = '',
  failedCommands = 0,
  completedCommands = 0,
  stoppedReason;
const maxFailures = failureLimit();
const eventsPath = join(directory, 'events.jsonl');
const stderrPath = join(directory, 'stderr.txt');
writeFileSync(eventsPath, '');
writeFileSync(stderrPath, '');
function stop(reason) {
  if (!stoppedReason) {
    stoppedReason = reason;
    child.kill();
  }
}
child.stdout.setEncoding('utf8').on('data', (data) => {
  stdout += data;
  appendFileSync(eventsPath, data);
  pending += data;
  const lines = pending.split('\n');
  pending = lines.pop();
  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (
      event.type !== 'item.completed' ||
      event.item?.type !== 'command_execution'
    )
      continue;
    completedCommands++;
    if (event.item.exit_code !== 0) failedCommands++;
    if (failedCommands >= maxFailures) stop('failure-budget');
    if (completedCommands >= 80) stop('command-budget');
  }
  if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > 1_000_000)
    stop('output-budget');
});
child.stderr.setEncoding('utf8').on('data', (data) => {
  stderr += data;
  appendFileSync(stderrPath, data);
  if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > 1_000_000)
    stop('output-budget');
});
child.on('error', (cause) => {
  error = cause.message;
});
child.stdin.on('error', () => {});
child.stdin.end(prompt);
const timer = setTimeout(() => {
  timedOut = true;
  stop('timeout');
}, 240_000);
const result = await new Promise((done) =>
  child.on('close', (exitCode, signal) => done({ exitCode, signal })),
);
clearTimeout(timer);
const report = {
  case: selected,
  executable,
  args,
  startedAt,
  endedAt: new Date().toISOString(),
  ...result,
  timedOut,
  failedCommands,
  completedCommands,
  maxFailures,
  stoppedReason,
  state: stoppedReason
    ? 'incomplete'
    : result.exitCode === 0
      ? 'requires-review'
      : 'failed',
  error,
  evaluation:
    'Requires review of actual discovery, tool calls, and scope; process completion alone is not a routing pass.',
};
writeFileSync(
  join(directory, 'execution.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify({ ...report, directory }, null, 2));
if (result.exitCode !== 0 || stoppedReason || error) process.exitCode = 1;

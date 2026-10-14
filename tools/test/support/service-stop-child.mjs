import { createInterface } from 'node:readline';

// Private-pipe fixture only; it never listens or accesses a real data directory.
let mode;
const alive = setInterval(() => {}, 1000);
const finish = (status, code) => {
  const exit = () => {
    clearInterval(alive);
    process.exit(code);
  };
  if (status === undefined) exit();
  else
    process.stdout.write(
      JSON.stringify({ type: 'stopped', status }) + '\n',
      exit,
    );
};
createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  if (message.type === 'start') {
    mode = message.config.mode;
    process.stdout.write(
      JSON.stringify({
        type: 'ready',
        port: 1234,
        hostToken: 'fixture-private',
        health: {},
      }) + '\n',
    );
  } else if (message.type === 'stop') {
    if (mode === 'hang') return;
    if (mode === 'no-confirmation') finish(undefined, 0);
    else if (mode === 'save-failed') finish('save-failed', 1);
    else if (mode === 'invalid-confirmation') finish('unknown', 0);
    else finish('drained', mode === 'nonzero-exit' ? 1 : 0);
  }
});

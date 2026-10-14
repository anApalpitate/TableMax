import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import {
  ApplicationUpdateError,
  applicationUpdateMachineBlock,
  extractApplicationUpdate,
  signApplicationUpdate,
  verifyApplicationUpdate,
} from '../shared/application-update.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';

/** Private material is accepted only through this process's private environment/file. */
export async function signApplicationUpdateFiles(
  args,
  environment = process.env,
  verification = {},
) {
  const options = Object.create(null);
  for (const argument of args) {
    const match = /^--(description|notes|out|envelope-out)=(.+)$/.exec(
      argument,
    );
    if (!match || Object.hasOwn(options, match[1]))
      throw new ApplicationUpdateError('signing-arguments');
    options[match[1]] = match[2];
  }
  if (!options.description || !options.notes || !options.out)
    throw new ApplicationUpdateError('signing-arguments');
  const keyId = environment.TABLEMAX_APPLICATION_UPDATE_KEY_ID;
  const keyFile = environment.TABLEMAX_APPLICATION_UPDATE_PRIVATE_KEY_FILE;
  const privateEnvironment =
    environment.TABLEMAX_APPLICATION_UPDATE_PRIVATE_KEY;
  if ((!keyFile && !privateEnvironment) || (keyFile && privateEnvironment))
    throw new ApplicationUpdateError('private-key-source');
  const description = await readFile(resolve(options.description));
  const notes = await readFile(resolve(options.notes), 'utf8');
  if (notes.includes('TABLEMAX-APPLICATION-UPDATE'))
    throw new ApplicationUpdateError('notes-already-contain-update');
  const privateBytes = keyFile
    ? await readFile(resolve(keyFile))
    : Buffer.from(privateEnvironment, 'utf8');
  let envelope;
  try {
    envelope = signApplicationUpdate(description, privateBytes, { keyId });
    verifyApplicationUpdate(envelope, verification);
  } finally {
    privateBytes.fill(0);
  }
  const body =
    notes.trimEnd() + '\n\n' + applicationUpdateMachineBlock(envelope) + '\n';
  extractApplicationUpdate(body);
  // New files only: an approved release body/evidence is never overwritten implicitly.
  const paths = [options.out, options['envelope-out']]
    .filter(Boolean)
    .map((path) => resolve(path));
  if (new Set(paths).size !== paths.length)
    throw new ApplicationUpdateError('signing-output-paths');
  for (const path of paths) await mkdir(dirname(path), { recursive: true });
  await writeFile(paths[0], body, { encoding: 'utf8', flag: 'wx' });
  if (paths[1])
    await writeFile(paths[1], JSON.stringify(envelope, null, 2) + '\n', {
      encoding: 'utf8',
      flag: 'wx',
    });
  return { keyId, bodyPath: paths[0], envelopePath: paths[1] ?? null };
}

if (isDirectExecution(import.meta.url)) {
  assertWorkspaceRoot();
  try {
    const result = await signApplicationUpdateFiles(process.argv.slice(2));
    console.log(JSON.stringify({ result: 'signed', ...result }));
  } catch (error) {
    // Crypto/provider exceptions can contain private input/path details; never print them.
    console.error(
      JSON.stringify({
        result: 'failed',
        code:
          error instanceof ApplicationUpdateError
            ? error.code
            : 'signing-io-error',
      }),
    );
    process.exitCode = 1;
  }
}

import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fingerprint } from '../runner/evidence.mjs';
import { installationRecipeInputs } from '../../release/installation-package.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';

/** Reuse runner v2 import expansion; PS/dynamic native sources are explicit. */
export async function installationExecutionSources(root = resolve('.')) {
  const directory = 'tools/test/installation';
  const explicit = [
    directory + '/verify-production-user.ps1',
    directory + '/verify-production-user-child.ps1',
    directory + '/verify-application-handoff.mjs',
    directory + '/verify-update-transaction.mjs',
    directory + '/verify-portable-migration.mjs',
    directory + '/verify-installer-wizard.mjs',
    directory + '/execution-method.mjs',
    'tools/shared/windows-executable-security.ps1',
    ...readdirSync(resolve(root, 'apps/desktop/native'))
      .filter((name) => name.endsWith('.cs'))
      .map((name) => 'apps/desktop/native/' + name),
    ...(await installationRecipeInputs()).map((record) => record.path),
    'tools/shared/application-update-trust.json',
    'apps/desktop/native/Bridge.js',
    'apps/desktop/native/app.manifest',
    'assets/platform/app-icon.ico',
    ...readdirSync(resolve(root, directory))
      .filter((name) => name.endsWith('.cs'))
      .map((name) => directory + '/' + name),
  ];
  const binding = fingerprint(root, {
    runtime: 'node',
    script: 'tools/release/installation-verifier.mjs',
    args: [],
    inputs: { complete: true, files: explicit },
  });
  if (binding.value.gaps.length) throw new Error(binding.value.gaps.join('; '));
  return binding.value.files;
}

if (isDirectExecution(import.meta.url)) {
  assertWorkspaceRoot();
  console.log(JSON.stringify(await installationExecutionSources()));
}

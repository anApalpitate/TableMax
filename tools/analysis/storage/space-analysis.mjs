import { lstat, readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, sep, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const images = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const generatedImage = (path) =>
  /^(artifacts\/(maintenance\/|[^/]+\/validation\/)|tmp\/)/i.test(path) &&
  !/(^|\/)(assets|imagegen|originals?|raw|sources?|references?|research|inputs|materials)(\/|$)/i.test(
    path,
  ) &&
  images.has(extname(path).toLowerCase());

// Metadata only: no deletion, file content reads, or traversal through links.
export async function inventory(root) {
  root = resolve(root);
  const first = await lstat(root);
  if (!first.isDirectory() || first.isSymbolicLink())
    throw new Error('Root must be a real directory');
  const result = {
    schemaVersion: 1,
    root,
    startedAtUtc: new Date().toISOString(),
    files: [],
    skippedLinks: [],
    skippedRepositories: [],
    errors: [],
  };
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      if (
        directory !== root &&
        entries.some((entry) => entry.name === '.git')
      ) {
        result.skippedRepositories.push(
          relative(root, directory).split(sep).join('/'),
        );
        continue;
      }
      for (const entry of entries) {
        const absolute = resolve(directory, entry.name);
        const path = relative(root, absolute).split(sep).join('/');
        try {
          const stat = await lstat(absolute);
          if (stat.isSymbolicLink()) result.skippedLinks.push(path);
          else if (stat.isDirectory()) pending.push(absolute);
          else if (stat.isFile())
            result.files.push({
              path,
              bytes: stat.size,
              mtimeMs: stat.mtimeMs,
            });
        } catch (error) {
          result.errors.push({ path, message: error.message });
        }
      }
    } catch (error) {
      result.errors.push({
        path: relative(root, directory),
        message: error.message,
      });
    }
  }
  result.logicalBytes = result.files.reduce((sum, file) => sum + file.bytes, 0);
  result.finishedAtUtc = new Date().toISOString();
  return result;
}

export function analyze(snapshot) {
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.files))
    throw new Error('Unsupported inventory');
  const directories = new Map();
  const extensions = new Map();
  const screenshots = [];
  const runtimes = [];
  for (const file of snapshot.files) {
    const parts = file.path.split('/');
    for (let index = 1; index < parts.length; index++) {
      const path = parts.slice(0, index).join('/');
      const value = directories.get(path) ?? { path, bytes: 0, files: 0 };
      value.bytes += file.bytes;
      value.files++;
      directories.set(path, value);
    }
    const extension = extname(file.path).toLowerCase() || '(none)';
    const value = extensions.get(extension) ?? {
      extension,
      bytes: 0,
      files: 0,
    };
    value.bytes += file.bytes;
    value.files++;
    extensions.set(extension, value);
    if (generatedImage(file.path)) screenshots.push(file);
    if (/(^|\/)node\.exe$/i.test(file.path)) runtimes.push(file);
  }
  const descending = (a, b) =>
    b.bytes - a.bytes ||
    (a.path ?? a.extension).localeCompare(b.path ?? b.extension);
  const totals = [...directories.values()].sort(descending);
  const logicalBytes = snapshot.files.reduce(
    (sum, file) => sum + file.bytes,
    0,
  );
  const screenshotBytes = screenshots.reduce(
    (sum, file) => sum + file.bytes,
    0,
  );
  const screenshotGroups = new Map();
  for (const file of screenshots) {
    const path = file.path
      .split('/')
      .slice(0, file.path.startsWith('tmp/') ? 2 : 4)
      .join('/');
    const group = screenshotGroups.get(path) ?? { path, files: 0, bytes: 0 };
    group.files++;
    group.bytes += file.bytes;
    screenshotGroups.set(path, group);
  }
  return {
    schemaVersion: 1,
    root: snapshot.root,
    measuredAtUtc: snapshot.finishedAtUtc,
    logicalBytes,
    logicalGiB: logicalBytes / 2 ** 30,
    files: snapshot.files.length,
    complete: snapshot.errors.length === 0,
    errors: snapshot.errors,
    skippedLinks: snapshot.skippedLinks,
    skippedRepositories: snapshot.skippedRepositories,
    topLevel: totals.filter((item) => !item.path.includes('/')),
    largestDirectories: totals.slice(0, 40),
    extensions: [...extensions.values()].sort(descending),
    largestFiles: [...snapshot.files].sort(descending).slice(0, 40),
    screenshots: {
      files: screenshots.length,
      bytes: screenshotBytes,
      share: logicalBytes ? screenshotBytes / logicalBytes : 0,
      groups: [...screenshotGroups.values()].sort(descending),
    },
    runtimes,
    note: 'Logical file lengths; screenshot paths are generated-image candidates, not deletion authorization. Runtime entries are not cleanup targets.',
  };
}

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function duplicates(snapshot) {
  const groups = new Map();
  for (const file of snapshot.files.filter(
    (file) => generatedImage(file.path) || /(^|\/)node\.exe$/i.test(file.path),
  )) {
    const kind = generatedImage(file.path) ? 'generated-image' : 'node-runtime';
    const key = `${kind}:${file.bytes}`;
    groups.set(key, [...(groups.get(key) ?? []), file]);
  }
  const matched = new Map();
  const errors = [];
  for (const [key, files] of groups) {
    if (files.length < 2) continue;
    for (const file of files) {
      try {
        if (
          file.path.includes('\\') ||
          file.path.split('/').some((part) => ['..', '.', ''].includes(part))
        )
          throw new Error('Unsafe inventory path');
        const absolute = resolve(snapshot.root, file.path);
        if (!absolute.startsWith(resolve(snapshot.root) + sep))
          throw new Error('Inventory path escapes root');
        let current = resolve(snapshot.root);
        for (const part of file.path.split('/')) {
          current = resolve(current, part);
          if ((await lstat(current)).isSymbolicLink())
            throw new Error('Link appeared since inventory');
        }
        const before = await lstat(absolute);
        if (
          !before.isFile() ||
          before.size !== file.bytes ||
          before.mtimeMs !== file.mtimeMs
        )
          throw new Error('File changed since inventory');
        const hash = await sha256(absolute);
        const after = await lstat(absolute);
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
          throw new Error('File changed while hashing');
        const digestKey = `${key}:${hash}`;
        matched.set(digestKey, [...(matched.get(digestKey) ?? []), file]);
      } catch (error) {
        errors.push({ path: file.path, message: error.message });
      }
    }
  }
  return {
    groups: [...matched]
      .filter(([, files]) => files.length > 1)
      .map(([key, files]) => ({
        kind: key.split(':')[0],
        sha256: key.split(':')[2],
        bytesEach: files[0].bytes,
        redundantBytes: (files.length - 1) * files[0].bytes,
        paths: files.map((file) => file.path),
      })),
    errors,
    note: 'Identical bytes only. Redundant bytes are a theoretical upper bound; references, current evidence and package boundaries still require review.',
  };
}

export async function main(args) {
  const [command, ...options] = args;
  if (!command || command === '--help') {
    console.log(
      'scan --root=<directory> --output=<new-inventory.json>\nanalyze --input=<inventory.json> [--output=<new-report.json>] [--hash-duplicates]\nOutput files must not exist. Analysis reuses metadata; hashes are opt-in. No deletion.',
    );
    return;
  }
  if (!['scan', 'analyze'].includes(command))
    throw new Error('Unknown command');
  for (const option of options) {
    if (
      !/^--(root|output|input)=.+$/.test(option) &&
      option !== '--hash-duplicates'
    )
      throw new Error(`Unknown option: ${option}`);
  }
  const get = (name) =>
    options
      .find((item) => item.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  if (
    command === 'scan' &&
    (!get('output') || get('input') || options.includes('--hash-duplicates'))
  )
    throw new Error('scan requires --output and accepts --root only');
  if (command === 'analyze' && (!get('input') || get('root')))
    throw new Error('analyze requires --input; root comes from inventory');
  const output = get('output');
  if (output) {
    try {
      await lstat(resolve(output));
      throw new Error('Output already exists');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const snapshot =
    command === 'scan'
      ? await inventory(get('root') ?? process.cwd())
      : JSON.parse(await readFile(get('input'), 'utf8'));
  const result = command === 'scan' ? snapshot : analyze(snapshot);
  if (options.includes('--hash-duplicates'))
    result.duplicates = await duplicates(snapshot);
  if (output) {
    await mkdir(dirname(resolve(output)), { recursive: true });
    await writeFile(output, JSON.stringify(result, null, 2) + '\n', {
      flag: 'wx',
    });
    console.log(
      JSON.stringify({
        output: resolve(output),
        logicalBytes: result.logicalBytes,
        files: command === 'scan' ? result.files.length : result.files,
        errors: result.errors.length,
        duplicateErrors: result.duplicates?.errors.length ?? 0,
      }),
    );
  } else console.log(JSON.stringify(result, null, 2));
  if (result.errors.length || result.duplicates?.errors.length)
    process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

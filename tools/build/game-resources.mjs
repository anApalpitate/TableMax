import ts from 'typescript';
import { createRequire } from 'node:module';
import { resolve, dirname, relative } from 'node:path';
import { lstat, readdir, realpath } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { globSync } = createRequire(require.resolve('vite/package.json'))(
  'tinyglobby',
);
export const mediaFile = (file) =>
  /\.(?:png|jpe?g|webp|svg|gif|ico|flac|wav|ogg|mp3|m4a|woff2?)$/i.test(
    file.split('?')[0],
  );
const posix = (value) => value.replaceAll('\\', '/');
/** Discover runtime media from the manifest namespace, including dynamic resourceUrl calls. */
export async function discoverGameMedia(item, workspace = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/.test(item.id))
    throw new Error('Invalid game resource namespace');
  const base = resolve(workspace);
  const namespace = resolve(base, 'assets/games', item.id);
  const equalPath = (a, b) =>
    process.platform === 'win32'
      ? a.toLowerCase() === b.toLowerCase()
      : a === b;
  const plain = async (path) => {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !equalPath(await realpath(path), path))
      throw new Error('Linked game resources are forbidden: ' + path);
    return info;
  };
  // Check existing ancestors too: a namespace reached through a junction must
  // never import bytes from another game or from outside the workspace.
  for (const path of [
    base,
    resolve(base, 'assets'),
    resolve(base, 'assets/games'),
    namespace,
  ]) {
    try {
      if (!(await plain(path)).isDirectory())
        throw new Error('Game resource namespace must be a directory: ' + path);
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
  const files = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const info = await plain(path);
      if (info.isDirectory()) await visit(path);
      else if (!info.isFile())
        throw new Error('Special game resource rejected: ' + path);
      else if (mediaFile(path)) files.push(posix(relative(base, path)));
    }
  };
  await visit(namespace);
  return files.sort();
}
export function logicalResource(file, root) {
  const path = posix(relative(resolve(root, 'assets/games'), file));
  if (path.startsWith('../') || path.includes('/../'))
    throw new Error('Game media outside asset namespace: ' + file);
  return path;
}
export function mediaGlobs(source, file) {
  const syntax = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const calls = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'glob' &&
      ts.isMetaProperty(node.expression.expression)
    ) {
      const arg = node.arguments[0];
      const literals = ts.isArrayLiteralExpression(arg) ? arg.elements : [arg];
      if (literals.every(ts.isStringLiteralLike)) {
        const patterns = literals.map((literal) => {
          const negative = literal.text.startsWith('!');
          return (
            (negative ? '!' : '') +
            posix(
              resolve(
                dirname(file),
                negative ? literal.text.slice(1) : literal.text,
              ),
            )
          );
        });
        const matches = globSync(patterns, {
          absolute: true,
          onlyFiles: true,
        }).sort();
        if (matches.length && matches.every(mediaFile))
          calls.push({
            start: node.getStart(syntax),
            end: node.end,
            matches,
            keys: matches.map((match) => {
              const key = posix(relative(dirname(file), match));
              return key.startsWith('.') ? key : './' + key;
            }),
          });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(syntax);
  return calls;
}
export function gameResourcesPlugin(root) {
  return {
    name: 'tablemax-logical-resources',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !mediaFile(source) || !source.startsWith('.')) return;
      const file = resolve(dirname(importer), source.split('?')[0]);
      if (posix(file).includes('/assets/games/'))
        return '\0tablemax-resource:' + logicalResource(file, root);
    },
    load(id) {
      if (!id.startsWith('\0tablemax-resource:')) return;
      return `import {resourceUrl} from '@tablemax/web-host';export default resourceUrl(${JSON.stringify(id.slice('\0tablemax-resource:'.length))},import.meta.url);`;
    },
    transform(source, file) {
      if (file.endsWith('.css'))
        return source.replace(
          /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,
          (token, quote, path) => {
            if (!path.startsWith('.') || !mediaFile(path)) return token;
            return `url("../resources/${logicalResource(resolve(dirname(file), path), root)}")`;
          },
        );
      if (!/\.[jt]sx?$/.test(file)) return;
      const globs = mediaGlobs(source, file, root);
      if (!globs.length) return;
      for (const call of globs.reverse()) {
        const properties = call.matches
          .map(
            (match, index) =>
              `${JSON.stringify(call.keys[index])}:{enumerable:true,get:()=>__tablemaxResourceUrl(${JSON.stringify(logicalResource(match, root))},import.meta.url)}`,
          )
          .join(',');
        source =
          source.slice(0, call.start) +
          `Object.defineProperties({}, {${properties}})` +
          source.slice(call.end);
      }
      return (
        `import {resourceUrl as __tablemaxResourceUrl} from '@tablemax/web-host';\n` +
        source
      );
    },
  };
}

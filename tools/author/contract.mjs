import { readFile, readdir, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, extname, sep } from 'node:path';
import ts from 'typescript';
import { createHash } from 'node:crypto';

const publicImports = new Set([
  '@tablemax/game-sdk',
  '@tablemax/game-sdk/module-manifest',
  '@tablemax/web-host',
  '@tablemax/protocol',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-dom/client',
]);
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
export function inside(root, path) {
  const rel = relative(root, path);
  return (
    !rel.startsWith(`..${sep}`) &&
    rel !== '..' &&
    !resolve(path).startsWith('\\\\') &&
    !rel.includes(':')
  );
}
export async function checkAuthorProject(directory) {
  const root = await realpath(resolve(directory));
  let frozen;
  try {
    frozen = JSON.parse(
      await readFile(resolve(root, 'public-freeze.json'), 'utf8'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (frozen) {
    if (frozen.schemaVersion !== 1 || !Array.isArray(frozen.files))
      throw new Error('Invalid frozen public dependency manifest');
    for (const file of frozen.files) {
      const path = resolve(root, file.path);
      if (!file.path.startsWith('public/') || !inside(root, path))
        throw new Error('Invalid frozen dependency path');
      const bytes = await readFile(path);
      if (createHash('sha256').update(bytes).digest('hex') !== file.sha256)
        throw new Error('Frozen public dependency changed');
    }
  }
  const manifest = JSON.parse(
    await readFile(resolve(root, 'game-module.json'), 'utf8'),
  );
  if (
    manifest.schemaVersion !== 1 ||
    !/^[a-z][a-z0-9-]{0,63}$/.test(manifest.id) ||
    manifest.catalog?.id !== manifest.id ||
    manifest.compatibility?.sdk !== 1 ||
    manifest.compatibility?.protocol !== 7 ||
    manifest.compatibility?.webHost !== 1
  )
    throw new Error(
      'Incompatible author module contract (SDK 1, module 7, web host 1)',
    );
  const files = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['node_modules', 'public', 'out', '.tablemax'].includes(entry.name))
        continue;
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink() || (await lstat(path)).isSymbolicLink())
        throw new Error(`Author source link rejected: ${relative(root, path)}`);
      if (entry.isDirectory()) await visit(path);
      else if (
        codeExtensions.has(extname(path)) ||
        ['.css', '.json'].includes(extname(path))
      )
        files.push(path);
    }
  };
  await visit(root);
  for (const part of ['rules', 'bot', 'web']) {
    const entry = resolve(root, manifest.entries?.[part] ?? '');
    if (
      !inside(root, entry) ||
      !files.includes(entry) ||
      !codeExtensions.has(extname(entry))
    )
      throw new Error(`Invalid ${part} entry`);
  }
  for (const file of files) {
    if (!codeExtensions.has(extname(file))) continue;
    const text = await readFile(file, 'utf8');
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    const imports = [];
    const walk = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier
      )
        imports.push(node.moduleSpecifier);
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require'))
      ) {
        if (
          node.arguments.length !== 1 ||
          !ts.isStringLiteral(node.arguments[0])
        )
          throw new Error(
            `Computed module import rejected: ${relative(root, file)}`,
          );
        imports.push(node.arguments[0]);
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'window' &&
        /^tablemax/.test(node.name.text)
      )
        throw new Error(
          `Native bridge access rejected: ${relative(root, file)}`,
        );
      ts.forEachChild(node, walk);
    };
    walk(source);
    for (const node of imports) {
      if (!ts.isStringLiteral(node))
        throw new Error('Nonliteral module import');
      const name = node.text;
      if (name.startsWith('.')) {
        const target = resolve(file, '..', name);
        if (
          !inside(root, target) ||
          /(^|[\\/])(apps|packages|node_modules|public)([\\/]|$)/.test(
            relative(root, target),
          )
        )
          throw new Error(`Private or escaping import rejected: ${name}`);
        const gamePath = relative(root, target).replaceAll('\\', '/');
        if (
          gamePath.startsWith('games/') &&
          !gamePath.startsWith(`games/${manifest.id}/`)
        )
          throw new Error(`Other game import rejected: ${name}`);
      } else if (!publicImports.has(name))
        throw new Error(`Nonpublic package import rejected: ${name}`);
    }
  }
  return { root, manifest, files };
}

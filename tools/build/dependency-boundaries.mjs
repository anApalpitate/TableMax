import { dirname, relative, resolve } from 'node:path';

const normalize = (path) => path.replaceAll('\\', '/');
const publicGameImports = new Set([
  '@tablemax/game-sdk',
  '@tablemax/game-sdk/module-manifest',
  '@tablemax/game-sdk/metadata',
  '@tablemax/protocol',
  '@tablemax/web-host',
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
]);
/** One policy for lint and the production dependency walk. Test fixtures may compose games. */
export function dependencyViolation(
  file,
  specifier,
  root = process.cwd(),
  { testContext = false } = {},
) {
  const source = normalize(relative(root, resolve(file)));
  if (testContext && /\.(test|spec)\.[cm]?[jt]sx?$/.test(source)) return null;
  // Existing deterministic compatibility fixture is consumed only by two tests.
  // The build walk never enables testContext, so it cannot enter a runtime bundle.
  if (
    testContext &&
    source ===
      'games/pokemon-encounters/expansion/config/compatibility-fixture.ts' &&
    specifier === 'node:crypto'
  )
    return null;
  const game = source.match(/^(?:assets\/)?games\/([^/]+)\//)?.[1];
  const shared = source.startsWith('packages/');
  if (!game && !shared) return null;
  const path = specifier.split('?')[0];
  let target =
    path.startsWith('.') || path.startsWith('/')
      ? normalize(relative(root, resolve(dirname(file), path)))
      : path;
  if (path.startsWith('@tablemax/')) {
    const [name, ...rest] = path.slice('@tablemax/'.length).split('/');
    target =
      name.startsWith('game-') && name !== 'game-sdk'
        ? `games/${name.slice(5)}/${rest.join('/')}`
        : `packages/${name}/${rest.join('/')}`;
  }
  const targetGame = target.match(/^(?:assets\/)?games\/([^/]+)\//)?.[1];
  if (shared && (targetGame || target.startsWith('apps/')))
    return 'Shared packages cannot depend on games, game assets or application-private state.';
  if (game && targetGame && targetGame !== game)
    return `Game ${game} cannot import another game (${targetGame}).`;
  if (game && target.startsWith('apps/'))
    return 'Games must consume GameHost, never private application sessions or transport.';
  if (game && publicGameImports.has(path)) return null;
  if (game && target.startsWith('packages/')) {
    const allowed = new Set(['game-sdk', 'protocol', 'web-host']);
    const [, name, ...rest] = target.split('/');
    if (
      !allowed.has(name) ||
      (name === 'web-host' &&
        rest.join('/').replace(/\.[cm]?[jt]sx?$/, '') === 'platform')
    )
      return 'Games may only depend on public SDK, protocol and web-host contracts.';
    if (path.startsWith('.') || path.startsWith('/'))
      return 'Import shared contracts through their public @tablemax exports, not source internals.';
    if (rest.some(Boolean))
      return 'Game imports must use the public package entry, not private subpaths.';
  }
  if (
    game &&
    (path.startsWith('.') || path.startsWith('/')) &&
    ![`games/${game}/`, `assets/games/${game}/`, `docs/games/${game}/`].some(
      (prefix) => target.startsWith(prefix),
    )
  )
    return 'Private or cross-game import rejected';
  if (game && !path.startsWith('.') && !path.startsWith('/'))
    return 'Non-public game import rejected';
  return null;
}

export const dependencyBoundaryRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { boundary: '{{reason}} ({{source}})' },
  },
  create(context) {
    const check = (node) => {
      if (!node || typeof node.value !== 'string') return;
      const reason = dependencyViolation(
        context.filename,
        node.value,
        context.cwd,
        { testContext: true },
      );
      if (reason)
        context.report({
          node,
          messageId: 'boundary',
          data: { reason, source: node.value },
        });
    };
    return {
      ImportDeclaration: (n) => check(n.source),
      ExportNamedDeclaration: (n) => check(n.source),
      ExportAllDeclaration: (n) => check(n.source),
      ImportExpression: (n) => check(n.source),
      TSImportType: (n) => check(n.argument?.literal ?? n.argument),
      TSExternalModuleReference: (n) => check(n.expression),
      CallExpression: (n) => {
        if (n.callee.type === 'Identifier' && n.callee.name === 'require')
          check(n.arguments[0]);
      },
    };
  },
};

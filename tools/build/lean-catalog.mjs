import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectGameCatalog } from '../../packages/game-sdk/src/metadata.mjs';

/** Development transforms the descriptors before Vite can import full JSON. */
export function leanCatalogPlugin(workspaceRoot = resolve('.')) {
  const root = resolve(workspaceRoot);
  return {
    name: 'lean-development-game-catalog',
    enforce: 'pre',
    configureServer(server) {
      server.watcher.add(resolve(root, 'games'));
    },
    async transform(_code, id) {
      if (
        id.split('?')[0].replaceAll('\\', '/') !==
        `${root.replaceAll('\\', '/')}/apps/web/src/catalog.ts`
      )
        return;
      const modules = [];
      const folder = resolve(root, 'games');
      // Watch manifests individually: Vite 8 treats a watched directory as an import edge.
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const path = resolve(folder, entry.name, 'game-module.json');
        let module;
        try {
          module = JSON.parse(await readFile(path, 'utf8'));
        } catch (error) {
          if (error.code === 'ENOENT') continue;
          throw error;
        }
        this.addWatchFile(path);
        modules.push(module);
      }
      const covers = [];
      const catalog = modules
        .sort((a, b) => a.order - b.order)
        .map((module, index) => {
          if (module.cover)
            covers.push(
              `import cover${index} from ${JSON.stringify('/@fs/' + resolve(root, module.cover).replaceAll('\\', '/') + '?url')};`,
            );
          const item = projectGameCatalog(module, null);
          return `{...${JSON.stringify(item)},cover:${module.cover ? 'cover' + index : 'null'}}`;
        });
      return `${covers.join('\n')}\nexport const moduleCatalog=[${catalog.join(',')}];\nexport const moduleFor=id=>moduleCatalog.find(item=>item.id===id);`;
    },
  };
}

import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inside = (root, path) => {
  const local = relative(root, path);
  return !isAbsolute(local) && local !== '..' && !local.startsWith('..' + sep);
};

// Read-only structural checks. This does not execute HTML, cleanup, or product code.
export function auditTaskDelivery(root, delivery) {
  root = resolve(root);
  const failures = [];
  const checked = new Set();
  const fail = (reason) => failures.push({ reason });
  function file(path) {
    if (
      typeof path !== 'string' ||
      !path ||
      isAbsolute(path) ||
      /[\\:*?]/.test(path) ||
      path.split('/').some((part) => ['', '.', '..', '.git'].includes(part))
    )
      throw new Error('Invalid workspace file: ' + path);
    const absolute = resolve(root, path);
    if (!inside(root, absolute)) throw new Error('Path escapes workspace');
    for (let cursor = absolute; cursor !== root; cursor = dirname(cursor)) {
      if (lstatSync(cursor).isSymbolicLink())
        throw new Error('Linked path is not accepted: ' + path);
    }
    if (!lstatSync(absolute).isFile()) throw new Error('Not a file: ' + path);
    checked.add(path);
    return readFileSync(absolute);
  }
  function protect(action) {
    try {
      action();
    } catch (error) {
      fail(error.message);
    }
  }
  const id = delivery?.taskId;
  if (
    delivery?.version !== 1 ||
    !/^[a-z0-9][a-z0-9-]{0,80}$/.test(id ?? '') ||
    !['visual-change', 'change', 'analysis'].includes(delivery.type)
  )
    return {
      failed: true,
      failures: [{ reason: 'Invalid delivery identity' }],
    };
  const temporaryRoot = 'tmp/' + id;
  const temporary = delivery.temporary;
  if (temporary?.none) {
    if (
      typeof temporary.none !== 'string' ||
      !temporary.none.trim() ||
      temporary.root ||
      temporary.cleanup
    )
      fail('No-temporary-files reason must be exclusive');
    protect(() => {
      try {
        lstatSync(resolve(root, temporaryRoot));
      } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
      }
      throw new Error('Declared task temporary directory exists');
    });
  } else if (temporary?.root === temporaryRoot) {
    protect(() => {
      const cleanup = temporary.cleanup;
      const control = 'artifacts/maintenance/' + id + '/';
      for (const key of ['launcher', 'script', 'manifest'])
        if (
          typeof cleanup?.[key] !== 'string' ||
          !cleanup[key].startsWith(control) ||
          dirname(cleanup[key]) !== control.slice(0, -1)
        )
          throw new Error('Cleanup controls must belong to this task');
      if (
        !cleanup.launcher.endsWith('.cmd') ||
        !cleanup.script.endsWith('.ps1')
      )
        throw new Error('Missing CMD launcher or PowerShell wrapper');
      const launcher = file(cleanup.launcher);
      const wrapper = file(cleanup.script);
      const manifest = file(cleanup.manifest);
      if (sha256(manifest) !== cleanup.manifestSha256)
        throw new Error('Cleanup manifest hash changed');
      const plan = JSON.parse(manifest);
      if (
        plan.version !== 1 ||
        plan.id !== id ||
        plan.authorization !== 'retire-reviewed-tmp-once' ||
        plan.taskRoot !== temporaryRoot ||
        plan.entries?.length !== 1 ||
        plan.entries[0].name !== id ||
        !plan.entries[0].reason ||
        !plan.entries[0].files?.length
      )
        throw new Error('Cleanup manifest does not select this exact task');
      for (const [path, bytes] of [
        [cleanup.launcher, launcher],
        [cleanup.script, wrapper],
      ]) {
        const controls = plan.controlFiles?.filter(
          (item) => item.name === path.slice(control.length),
        );
        if (controls?.length !== 1 || controls[0].sha256 !== sha256(bytes))
          throw new Error('Cleanup control hash changed: ' + path);
      }
      if (
        !launcher.toString().includes(cleanup.script.slice(control.length)) ||
        !wrapper.toString().includes('Clean-Intermediates.ps1') ||
        !wrapper.toString().includes('-TemporaryManifest')
      )
        throw new Error(
          'Cleanup controls do not name the existing cleanup path',
        );
      const expected = new Set();
      for (const item of plan.entries[0].files) {
        if (
          !item.path?.startsWith(temporaryRoot + '/') ||
          expected.has(item.path)
        )
          throw new Error('Duplicate or foreign temporary member');
        expected.add(item.path);
        const bytes = file(item.path);
        if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256)
          throw new Error('Temporary file changed: ' + item.path);
      }
      function inventory(directory) {
        if (lstatSync(directory).isSymbolicLink())
          throw new Error('Linked temporary directory is protected');
        for (const name of readdirSync(directory)) {
          if (name === '.git')
            throw new Error('Nested repository is protected');
          const absolute = resolve(directory, name);
          const stat = lstatSync(absolute);
          if (stat.isSymbolicLink()) throw new Error('Linked temporary member');
          if (stat.isDirectory()) inventory(absolute);
          else if (
            !expected.delete(relative(root, absolute).split(sep).join('/'))
          )
            throw new Error('Unlisted temporary member');
        }
      }
      inventory(resolve(root, temporaryRoot));
      if (expected.size) throw new Error('Temporary inventory is incomplete');
    });
  } else fail('Declare the task temporary root or a no-files reason');

  if (delivery.type === 'visual-change') {
    protect(() => {
      const preview = delivery.preview;
      if (
        typeof preview?.html !== 'string' ||
        !preview.html.startsWith(temporaryRoot + '/') ||
        !/\.html?$/i.test(preview.html) ||
        !preview.limitations?.trim() ||
        !preview.before?.trim() ||
        !preview.renderings?.length
      )
        throw new Error(
          'Visual task requires HTML, renderings and evidence limits',
        );
      const visited = new Set();
      function resource(from, value) {
        if (!value || value.startsWith('#') || value.startsWith('data:'))
          return;
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value))
          throw new Error('Remote preview dependency: ' + value);
        const decoded = decodeURIComponent(value.split(/[?#]/)[0]);
        if (isAbsolute(decoded)) throw new Error('Absolute preview dependency');
        const absolute = resolve(root, dirname(from), decoded);
        if (!inside(root, absolute))
          throw new Error('Preview dependency escapes');
        const path = relative(root, absolute).split(sep).join('/');
        if (visited.has(path)) return;
        visited.add(path);
        const bytes = file(path);
        if (/\.css$/i.test(path)) css(path, bytes.toString());
      }
      function css(from, source) {
        for (const match of source.matchAll(
          /url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/gi,
        ))
          resource(from, match[1] ?? match[2]);
      }
      const html = file(preview.html)
        .toString()
        .replace(/<!--[\s\S]*?-->/g, '');
      if (/<base\b/i.test(html))
        throw new Error('Preview base URL is unsupported');
      for (const tag of html.matchAll(
        /<(img|script|link|iframe|video|audio|source|object)\b[^>]*>/gi,
      ))
        for (const attr of tag[0].matchAll(
          /\b(src|href|poster|data|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
        )) {
          const value = attr[2] ?? attr[3] ?? attr[4];
          if (attr[1].toLowerCase() === 'srcset') {
            if (value.includes('data:'))
              throw new Error('Inline srcset is unsupported');
            for (const candidate of value.split(','))
              resource(preview.html, candidate.trim().split(/\s+/)[0]);
          } else resource(preview.html, value);
        }
      css(preview.html, html);
      for (const rendering of preview.renderings) {
        if (
          !['actual-rendering', 'design-illustration'].includes(
            rendering.kind,
          ) ||
          !rendering.role?.trim() ||
          !rendering.viewport?.trim() ||
          !visited.has(rendering.path)
        )
          throw new Error('Rendering must be labelled and referenced by HTML');
        file(rendering.path);
      }
    });
  } else if (delivery.preview)
    fail('Only a visual task declares a visual preview');
  return {
    taskId: id,
    type: delivery.type,
    checkedFiles: checked.size,
    failed: failures.length > 0,
    failures,
    limits:
      'Static references and inventory only; no rendering, provenance or cleanup execution proved.',
  };
}

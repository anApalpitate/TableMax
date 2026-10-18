import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SYSTEM_TAR = 'C:/Windows/System32/tar.exe';
const digest = (data) => createHash('sha256').update(data).digest('hex');
export async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function field(block, offset, length) {
  const value = block.subarray(offset, offset + length);
  const zero = value.indexOf(0);
  if (zero >= 0 && value.subarray(zero).some((byte) => byte !== 0))
    throw new Error('Invalid USTAR field padding.');
  return new TextDecoder('utf-8', { fatal: true }).decode(
    zero < 0 ? value : value.subarray(0, zero),
  );
}
function octal(block, offset, length) {
  if (block.subarray(offset, offset + length).some((byte) => byte > 127))
    throw new Error('Unsupported USTAR numeric encoding.');
  const value = block.subarray(offset, offset + length).toString('ascii');
  if (!/^[ 0-7]*[\0 ]*$/.test(value)) throw new Error('Invalid USTAR number.');
  const number = Number.parseInt(
    value.replace(/[\0 ]+$/g, '').trim() || '0',
    8,
  );
  if (!Number.isSafeInteger(number))
    throw new Error('USTAR number exceeds safe size.');
  return number;
}
function safeMember(name) {
  if (
    !name ||
    /[\\:]/.test(name) ||
    [...name].some(
      (character) =>
        character.codePointAt(0) < 32 || character.codePointAt(0) === 127,
    ) ||
    name
      .split('/')
      .some(
        (part) =>
          !part ||
          /[. ]$|[<>"|?*]/.test(part) ||
          /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) ||
          part === '.' ||
          part === '..' ||
          part.toLowerCase() === '.git',
      )
  )
    throw new Error('Unsafe preserved member path.');
}

// Parse a reserialized, uncompressed USTAR stream without extracting any member.
export async function parseUstar(stream) {
  const members = Object.create(null);
  const windowsNames = new Set();
  let pending = Buffer.alloc(0);
  let remaining = 0;
  let padding = 0;
  let active;
  let zeros = 0;
  for await (const value of stream) {
    let chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    while (chunk.length) {
      if (remaining) {
        const count = Math.min(remaining, chunk.length);
        active.hash.update(chunk.subarray(0, count));
        remaining -= count;
        chunk = chunk.subarray(count);
        if (!remaining) {
          members[active.name] = {
            bytes: active.bytes,
            sha256: active.hash.digest('hex'),
          };
          active = undefined;
        }
      } else if (padding) {
        const count = Math.min(padding, chunk.length);
        if (chunk.subarray(0, count).some((byte) => byte !== 0))
          throw new Error('Invalid USTAR body padding.');
        padding -= count;
        chunk = chunk.subarray(count);
      } else {
        const count = Math.min(512 - pending.length, chunk.length);
        pending = Buffer.concat([pending, chunk.subarray(0, count)]);
        chunk = chunk.subarray(count);
        if (pending.length !== 512) continue;
        const block = pending;
        pending = Buffer.alloc(0);
        if (block.every((byte) => byte === 0)) {
          zeros++;
          continue;
        }
        if (zeros) throw new Error('Data after USTAR termination.');
        let checksum = 0;
        for (let index = 0; index < 512; index++)
          checksum += index >= 148 && index < 156 ? 32 : block[index];
        if (checksum !== octal(block, 148, 8))
          throw new Error('Invalid USTAR checksum.');
        if (
          !block
            .subarray(257, 265)
            .equals(Buffer.from([117, 115, 116, 97, 114, 0, 48, 48]))
        )
          throw new Error('Unsupported USTAR header.');
        field(block, 265, 32);
        field(block, 297, 32);
        if (block.subarray(500).some((byte) => byte !== 0))
          throw new Error('Invalid USTAR header padding.');
        if (block[156] !== 0 && block[156] !== 48)
          throw new Error('Only regular preserved members are allowed.');
        if (field(block, 157, 100))
          throw new Error('Preserved member has a link target.');
        const prefix = field(block, 345, 155);
        const name = (prefix ? prefix + '/' : '') + field(block, 0, 100);
        safeMember(name);
        if (windowsNames.has(name.toLowerCase()))
          throw new Error('Duplicate preserved member.');
        windowsNames.add(name.toLowerCase());
        for (const [offset, length] of [
          [100, 8],
          [108, 8],
          [116, 8],
          [136, 12],
          [329, 8],
          [337, 8],
        ])
          octal(block, offset, length);
        remaining = octal(block, 124, 12);
        padding = (512 - (remaining % 512)) % 512;
        active = { name, bytes: remaining, hash: createHash('sha256') };
        if (!remaining) {
          members[name] = { bytes: 0, sha256: digest('') };
          active = undefined;
        }
      }
    }
  }
  if (pending.length || remaining || padding || zeros < 2)
    throw new Error('Truncated or unterminated USTAR stream.');
  return members;
}

export async function verifyPreservedTar({
  format,
  archivePath,
  archiveSha256,
  tarSha256,
}) {
  if (format !== 'ustar-xz-v1') throw new Error('Unknown preservation format.');
  if (
    ![archiveSha256, tarSha256].every((value) =>
      /^[a-f0-9]{64}$/.test(value || ''),
    )
  )
    throw new Error('Invalid preservation binding.');
  if (!path.isAbsolute(archivePath) || !archivePath.endsWith('.tar.xz'))
    throw new Error('Expected an absolute .tar.xz archive path.');
  if ((await hashFile(SYSTEM_TAR)) !== tarSha256)
    throw new Error('System tar method changed.');
  if ((await hashFile(archivePath)) !== archiveSha256)
    throw new Error('Preservation archive changed.');
  const archive = await open(archivePath, 'r');
  try {
    const signature = Buffer.alloc(6);
    const { bytesRead } = await archive.read(signature, 0, 6, 0);
    if (
      bytesRead !== 6 ||
      !signature.equals(Buffer.from([253, 55, 122, 88, 90, 0]))
    )
      throw new Error('Expected XZ preservation stream.');
  } finally {
    await archive.close();
  }
  const child = spawn(
    SYSTEM_TAR,
    ['-cPf', '-', '--format=ustar', '@' + archivePath],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-8192);
  });
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Preservation decoder failed: ' + stderr)),
    );
  });
  // Attach a rejection handler immediately while the parser consumes stdout.
  completion.catch(() => {});
  let members;
  try {
    members = await parseUstar(child.stdout);
    await completion;
    if (stderr)
      throw new Error('Preservation decoder reported a warning: ' + stderr);
  } catch (error) {
    child.kill();
    await completion.catch(() => {});
    throw error;
  }
  if (
    (await hashFile(archivePath)) !== archiveSha256 ||
    (await hashFile(SYSTEM_TAR)) !== tarSha256
  )
    throw new Error('Preservation binding changed during verification.');
  return { format, archiveSha256, tarSha256, members };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [format, archivePath, archiveSha256, tarSha256, ...extra] =
      process.argv.slice(2);
    if (extra.length) throw new Error('Unexpected preservation arguments.');
    process.stdout.write(
      JSON.stringify(
        await verifyPreservedTar({
          format,
          archivePath,
          archiveSha256,
          tarSha256,
        }),
      ),
    );
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}

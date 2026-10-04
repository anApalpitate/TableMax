import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { RoomView } from '@tablemax/protocol';
import { rules, bot } from '@tablemax/game-template';
import { createService } from './service';
import { normalizeAvatar } from './avatar-images';

const { PNG } = createRequire(import.meta.url)('pngjs') as {
  PNG: {
    sync: {
      write(value: { width: number; height: number; data: Buffer }): Buffer;
    };
  };
};
function picture(color = 80, width = 256) {
  return PNG.sync.write({
    width,
    height: 256,
    data: Buffer.alloc(width * 256 * 4, color),
  });
}
function config() {
  const dataDir = mkdtempSync(join(tmpdir(), 'tablemax-avatar-upload-'));
  const webDir = mkdtempSync(join(tmpdir(), 'tablemax-avatar-page-'));
  writeFileSync(join(webDir, 'index.html'), '<html>avatar upload</html>');
  return { host: '127.0.0.1', port: 0, dataDir, webDir };
}
async function post(origin: string, path: string, body: unknown) {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      ok: boolean;
      reason?: string;
      token?: string;
      view?: RoomView;
    },
  };
}
async function view(origin: string, token: string) {
  return (await post(origin, '/api/session/view', { token })).body.view!;
}

it('really decodes bounded PNGs and rejects CRC damage, wrong dimensions and disguised input', () => {
  const png = picture();
  const image = normalizeAvatar(png);
  expect(normalizeAvatar(image.png).id).toBe(image.id);
  const damaged = Buffer.from(png);
  damaged[damaged.length - 1]! ^= 1;
  for (const invalid of [
    damaged,
    picture(80, 257),
    Buffer.from('<svg/>'),
    Buffer.alloc(513 * 1024),
    png.subarray(0, png.length - 1),
  ])
    expect(() => normalizeAvatar(invalid)).toThrow('invalid-avatar-image');
});

it('rolls back image bytes, identity and journal when the actual SQLite save fails', async () => {
  const settings = config();
  const service = await createService(settings, { rules, bot });
  const origin = `http://127.0.0.1:${await service.listen()}`;
  const database = new DatabaseSync(join(settings.dataDir, 'room.sqlite'));
  try {
    const first = await post(origin, '/api/session/join', {
      name: '原头像',
      avatarImage: picture().toString('base64'),
    });
    const token = first.body.token!;
    const before = await view(origin, token);
    const journal = database
      .prepare('SELECT count(*) AS n FROM journal')
      .get()?.n;
    database.exec(
      "CREATE TRIGGER fail_avatar_save BEFORE UPDATE ON saves BEGIN SELECT RAISE(ABORT, 'simulated save failure'); END;",
    );
    const avatarImage = picture(150).toString('base64');
    const changed = await post(origin, '/api/session/avatar', {
      token,
      avatarImage,
      envelope: {
        actionId: randomUUID(),
        instanceId: before.instanceId,
        revision: before.revision,
        branch: before.branch,
      },
    });
    expect(changed.body.ok).toBe(false);
    expect((await view(origin, token)).seats).toEqual(before.seats);
    const joined = await post(origin, '/api/session/join', {
      name: '未保存朋友',
      avatarImage,
      requestKey: randomBytes(32).toString('hex'),
    });
    expect(joined.body.ok).toBe(false);
    expect((await view(origin, token)).seats).toEqual(before.seats);
    expect(
      database.prepare('SELECT count(*) AS n FROM avatar_images').get()?.n,
    ).toBe(1);
    expect(database.prepare('SELECT count(*) AS n FROM journal').get()?.n).toBe(
      journal,
    );
    database.exec('DROP TRIGGER fail_avatar_save');
  } finally {
    database.close();
    await service.close();
  }
});

it('joins with a cropped image, deduplicates identical uploads, retries after restart, and protects identity', async () => {
  const settings = config();
  let service = await createService(settings, { rules, bot });
  let origin = `http://127.0.0.1:${await service.listen()}`;
  const png = picture();
  const avatarImage = png.toString('base64');
  const request = {
    name: '上传朋友',
    requestKey: randomBytes(32).toString('hex'),
    avatarImage,
  };
  try {
    const first = await post(origin, '/api/session/join', request);
    expect(first.body.ok).toBe(true);
    const credential = first.body.token!;
    const initial = await view(origin, credential);
    expect(initial.seats[0]!.avatarId).toBe(normalizeAvatar(png).id);
    const imageResponse = await fetch(
      `${origin}/api/avatars/${initial.seats[0]!.avatarId}`,
    );
    expect(imageResponse.headers.get('content-type')).toContain('image/png');
    expect(Buffer.from(await imageResponse.arrayBuffer())).toEqual(
      normalizeAvatar(png).png,
    );
    const second = await post(origin, '/api/session/join', {
      ...request,
      name: '相同头像',
      requestKey: randomBytes(32).toString('hex'),
    });
    expect(second.body.ok).toBe(true);
    expect((await view(origin, credential)).seats).toHaveLength(2);
    await service.close();
    service = await createService(settings, { rules, bot });
    origin = `http://127.0.0.1:${await service.listen()}`;
    const retried = await post(origin, '/api/session/join', request);
    expect(retried.body.token).toBe(credential);
    const current = await view(origin, credential);
    const envelope = {
      actionId: randomUUID(),
      instanceId: current.instanceId,
      revision: current.revision,
      branch: current.branch,
    };
    const upload = {
      token: credential,
      envelope,
      avatarImage: picture(140).toString('base64'),
    };
    const changed = await post(origin, '/api/session/avatar', upload);
    expect(changed.body.ok).toBe(true);
    expect((await post(origin, '/api/session/avatar', upload)).body).toEqual(
      changed.body,
    );
    const newView = await view(origin, credential);
    expect(newView.seats[0]!.avatarId).toBe(normalizeAvatar(picture(140)).id);
    expect(newView.seats[1]!.avatarId).toBe(normalizeAvatar(png).id);
    const unauthorized = await post(origin, '/api/session/avatar', {
      ...upload,
      token: service.hostToken,
    });
    expect(unauthorized.body.reason).toBe('unauthorized');
    const invalid = await post(origin, '/api/session/join', {
      name: '损坏',
      avatarImage: 'AAAA',
    });
    expect(invalid.body.reason).toBe('invalid-avatar-image');
    await service.close();
    const database = new DatabaseSync(join(settings.dataDir, 'room.sqlite'));
    expect(
      database.prepare('SELECT count(*) AS n FROM avatar_images').get()?.n,
    ).toBe(2);
    database
      .prepare('DELETE FROM avatar_images WHERE id=?')
      .run(newView.seats[0]!.avatarId);
    database.close();
    await expect(createService(settings, { rules, bot })).rejects.toThrow(
      'damaged-avatar-image',
    );
  } finally {
    await service.close();
  }
});

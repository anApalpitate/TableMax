import { MAXIMUM_PACKAGE_BYTES } from './lib/package-limits.mjs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Source acquisition and deterministic, local derivation only. This is a development
// tool; the shipped application never downloads or synthesizes these resources.
const root = resolve(import.meta.dirname, '..');
const audit = join(root, 'artifacts/maintenance/v1.0.5/interaction-assets');
const originals = join(audit, 'originals');
const output = join(root, 'assets/platform/interaction');
for (const dir of [audit, originals, output])
  mkdirSync(dir, { recursive: true });
const ffmpeg = JSON.parse(
  readFileSync(
    join(root, 'tmp/pokemon-expansion-materials/tools/ffmpeg-tool.json'),
    'utf8',
  ),
).binary;
const sourcesFile = join(audit, 'sources.json');
const records = existsSync(sourcesFile)
  ? JSON.parse(readFileSync(sourcesFile, 'utf8'))
  : [];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const rel = (path) => path.slice(root.length + 1).replaceAll('\\', '/');
const noname =
  'https://raw.githubusercontent.com/libccy/noname/e18a8256e01ab1357e4c7472349dceb3d0aa1a3a/';
const freeKill =
  'https://raw.githubusercontent.com/Qsgs-Fans/FreeKill/v0.5.19/';

async function acquire(id, url, file, note, headers = {}) {
  const path = join(originals, file);
  if (!existsSync(path)) {
    // urllib honours the desktop's configured system proxy, unlike Node fetch.
    const result = spawnSync(
      'python',
      [
        '-c',
        'import urllib.request,sys,json; req=urllib.request.Request(sys.argv[1],headers=json.loads(sys.argv[3])); data=urllib.request.urlopen(req,timeout=90).read(); open(sys.argv[2],"wb").write(data)',
        encodeURI(url),
        path,
        JSON.stringify(headers),
      ],
      { encoding: 'utf8', timeout: 100000 },
    );
    if (result.status !== 0) throw new Error(`${id}: ${result.stderr}`);
  }
  const bytes = readFileSync(path);
  const record = {
    id,
    url,
    file: rel(path),
    bytes: bytes.length,
    sha256: sha256(bytes),
    acquiredAt: '2026-10-08',
    note,
  };
  const previous = records.findIndex((entry) => entry.id === id);
  if (previous < 0) records.push(record);
  else records[previous] = record;
  writeFileSync(sourcesFile, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`${id}: ${bytes.length} bytes retained`);
  return path;
}

function runFFmpeg(args) {
  const result = spawnSync(
    ffmpeg,
    ['-hide_banner', '-nostdin', '-y', ...args],
    { encoding: 'utf8', maxBuffer: 10_000_000 },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stderr;
}

function durationMs(file) {
  // PCM sample count excludes MP3 encoder padding and also proves full decoding.
  const result = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      file,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '24000',
      '-f',
      's16le',
      'pipe:1',
    ],
    { maxBuffer: MAXIMUM_PACKAGE_BYTES },
  );
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return Math.round(result.stdout.length / 2 / 24);
}

function encode(
  id,
  input,
  {
    start = 0,
    duration,
    filter = 'highpass=f=70,lowpass=f=10000,loudnorm=I=-18:TP=-2:LRA=9',
  } = {},
) {
  const path = join(output, `${id}.mp3`);
  const args = ['-i', input];
  if (start) args.push('-ss', String(start));
  if (duration) args.push('-t', String(duration));
  args.push(
    '-vn',
    '-af',
    filter,
    '-ac',
    '1',
    '-ar',
    '24000',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '48k',
    '-map_metadata',
    '-1',
    path,
  );
  runFFmpeg(args);
  const bytes = readFileSync(path);
  const result = {
    id,
    file: `${id}.mp3`,
    bytes: bytes.length,
    sha256: sha256(bytes),
    durationMs: durationMs(path),
    codec: 'MP3',
    channels: 1,
    sampleRate: 24000,
    bitrate: 48000,
    processing: { start, duration: duration ?? 'complete', filter },
  };
  console.log(`${id}: ${result.durationMs} ms, ${result.bytes} bytes`);
  return result;
}

const mode = process.argv[2] ?? 'acquire';
if (mode === 'acquire') {
  const batch = [
    [
      'hurry-original',
      `${noname}audio/voice/male/7.mp3`,
      'hurry-original.mp3',
      'noname quickVoice[7]: 能不能快一点啊，兵贵神速啊; mapping verified in library/index.js and element/player.js; community copy, not an official source claim',
    ],
    [
      'shameless-original',
      `${noname}audio/voice/male/0.mp3`,
      'shameless-original.mp3',
      'noname quickVoice[0]: 我从未见过如此厚颜无耻之人！; code mapping verified',
    ],
    [
      'friendly-original',
      `${noname}audio/voice/male/8.mp3`,
      'friendly-original.mp3',
      'noname quickVoice[8]: 主公，别开枪，自己人; code mapping verified',
    ],
    [
      'cappuccino-original',
      'https://cdn.uwupad.me/85476.mp3',
      'cappuccino-original.mp3',
      'Community uploaded recording; https://uwupad.me/sound/85476; title 给阿姨 给你倒一杯卡布奇诺; speaker/source authenticity requires listening',
    ],
    [
      'seventeen-original',
      'https://cdn.uwupad.me/107202.mp3',
      'seventeen-original.mp3',
      'Community uploaded recording; https://uwupad.me/sound/107202; title 十七张牌你能秒我; trim after listening',
    ],
    [
      'tomato-reference-original',
      'https://cdn.uwupad.me/16187.mp3',
      'tomato-reference-original.mp3',
      'Reference recording 卢 番茄连招; https://uwupad.me/sound/16187; may include dialogue or background music; not blindly imported',
    ],
    [
      'nice-source-zip',
      'https://godbiao.com/tools/wzry/sounds/快捷语音.zip',
      'wzry-quick-voice.zip',
      'Public community archive; relevant entry credits 微博IM追清风; https://godbiao.com/tools/wzry/',
    ],
    ...['egg1', 'egg2', 'flower1', 'flower2', 'shoe1', 'shoe2'].map((id) => [
      `${id}-original`,
      `${freeKill}audio/system/${id}.mp3`,
      `${id}-original.mp3`,
      'FreeKill v0.5.19 community audiovisual asset; upstream GPLv3 does not establish all third-party game rights',
    ]),
    ...[
      ['egg', 'image/anim/egg/egg.png'],
      ['flower', 'image/anim/flower/egg.png'],
      ['shoe', 'image/anim/shoe/shoe.png'],
    ].map(([id, path]) => [
      `object-${id}-original`,
      `${freeKill}${path}`,
      `object-${id}-original.png`,
      'FreeKill v0.5.19 unmodified original; transparency and visual review pending',
    ]),
    [
      'freekill-license',
      `${freeKill}LICENSE`,
      'freekill-LICENSE.txt',
      'Upstream source license text retained',
    ],
    [
      'freekill-third-party-notice',
      'https://raw.githubusercontent.com/CircleCly/WoTKSpire/v0.5.1/THIRD_PARTY_NOTICES.md',
      'freekill-THIRD_PARTY_NOTICES.md',
      'Source attribution of the unmodified FreeKill v0.5.19 audiovisual assets and original QML timing',
    ],
  ];
  const results = await Promise.allSettled(
    batch.map((args) => acquire(...args)),
  );
  for (let i = 0; i < results.length; i++)
    if (results[i].status === 'rejected')
      console.error(`${batch[i][0]}: ${results[i].reason}`);
  if (results.some((result) => result.status === 'rejected'))
    process.exitCode = 1;
} else if (mode === 'carry') {
  const api =
    'https://api.bilibili.com/x/player/playurl?bvid=BV1Nt411w7M2&cid=107128915&qn=32&fnval=0';
  const headers = {
    'User-Agent': 'Mozilla/5.0',
    Referer: 'https://www.bilibili.com/video/BV1Nt411w7M2/',
  };
  const response = await fetch(api, {
    headers,
    signal: AbortSignal.timeout(60000),
  });
  const meta = await response.json();
  if (meta.code !== 0 || !meta.data?.durl?.[0]?.url)
    throw new Error(`Bili playurl code ${meta.code}`);
  const path = await acquire(
    'carry-video-original',
    meta.data.durl[0].url,
    'carry-system-original.mp4',
    `Public Bili BV1Nt411w7M2 P9 系统, cid107128915; stable source API ${api}; uploader 蘑菇苏苏; timed comment at 561.077 seconds says i will carry you; signature URL is temporary`,
    headers,
  );
  // Persist the stable resolver instead of an expiring public CDN signature.
  records.find((record) => record.id === 'carry-video-original').url = api;
  writeFileSync(sourcesFile, `${JSON.stringify(records, null, 2)}\n`);
  runFFmpeg([
    '-ss',
    '552',
    '-i',
    path,
    '-t',
    '18',
    '-vn',
    '-ac',
    '1',
    '-ar',
    '24000',
    '-c:a',
    'pcm_s16le',
    join(audit, 'carry-listening-window.wav'),
  ]);
} else if (mode === 'voices') {
  const selections = JSON.parse(
    readFileSync(join(audit, 'selections.json'), 'utf8'),
  );
  const voices = selections.map((selection) => ({
    ...encode(selection.id, join(root, selection.sourceFile), selection),
    label: selection.label,
    sourceId: selection.sourceId,
    verification: selection.verification,
  }));
  writeFileSync(
    join(audit, 'voice-derivatives.json'),
    `${JSON.stringify(voices, null, 2)}\n`,
  );
} else if (mode === 'effects') {
  const result = spawnSync('python', [join(audit, 'derive-effect-audio.py')], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10_000_000,
  });
  process.stdout.write(result.stdout);
  if (result.status !== 0) throw new Error(result.stderr);
} else if (mode === 'manifest') {
  await import(pathToFileURL(join(audit, 'finish-assets.mjs')).href);
} else {
  throw new Error(`Unknown mode: ${mode}`);
}

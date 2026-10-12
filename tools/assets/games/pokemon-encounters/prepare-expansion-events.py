"""Budgeted runtime derivatives and v3 diagrams; never alter adopted originals."""
from pathlib import Path
import argparse
import hashlib
import html
import json
import xml.etree.ElementTree as ET
from PIL import Image, ImageOps, ImageDraw, ImageFont


def sha(data):
    return hashlib.sha256(data).hexdigest()


def svg(title, lines, rows=()):
    height = max(620, 190 + len(rows) * 65 + len(lines) * 40)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="{height}" viewBox="0 0 1000 {height}" role="img">',
           f'<title>{html.escape(title)}</title>',
           f'<rect width="1000" height="{height}" rx="28" fill="#fffaf0"/>',
           '<g font-family="Microsoft YaHei, sans-serif" fill="#243e39">',
           f'<text x="40" y="65" font-size="38" font-weight="700">{html.escape(title)}</text>']
    y = 125
    for left, right in rows:
        out.extend([f'<rect x="30" y="{y-36}" width="940" height="56" rx="12" fill="#e5f0e5"/>',
                    f'<text x="50" y="{y}" font-size="27">{html.escape(left)}</text>',
                    f'<text x="550" y="{y}" font-size="27">{html.escape(right)}</text>'])
        y += 65
    y += 25
    for line in lines:
        out.append(f'<text x="40" y="{y}" font-size="26">{html.escape(line)}</text>')
        y += 40
    out.extend(['</g>', '</svg>'])
    data = ('\n'.join(out) + '\n').encode('utf-8')
    ET.fromstring(data)
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[4])
    parser.add_argument('--workspace', type=Path, required=True)
    args = parser.parse_args()
    project, workspace = args.project.resolve(), args.workspace.resolve()
    archive = project / 'assets/games/pokemon-encounters/expansion/events'
    runtime = archive / 'runtime'
    export = workspace / 'exports/pokemon-expansion-events/runtime-v3'
    diagrams = workspace / 'exports/pokemon-expansion-events/event-effects/v3'
    originals = workspace / 'originals/pokemon-expansion-events/generated-event-effects/v3'
    for directory in (runtime, export, diagrams, originals):
        directory.mkdir(parents=True, exist_ok=True)
    adopted = json.loads((archive / 'manifest.json').read_text('utf-8-sig'))
    assets = adopted['assets']
    entries = []
    fallbacks = []
    selected = [('event-art', ident, f'event-{ident}.webp', (768, 432), 48 * 1024)
                for ident in ('rain', 'sandstorm', 'sun', 'snow', 'trick-room')]
    selected += [('research-art', ident, f'research-{ident}.webp', (512, 288), 24 * 1024)
                 for ident in ('R01', 'R06', 'R08', 'R11', 'R14', 'R15', 'R16', 'R17', 'R19', 'R23')]
    for group, ident, name, size, cap in selected:
        source_id = 'sunny' if group == 'event-art' and ident == 'sun' else ident
        item = next(a for a in assets if a['group'] == group and a['id'] == source_id)
        source = archive / item['file']
        raw = source.read_bytes()
        assert sha(raw) == item['sha256'], source
        with Image.open(source) as image:
            derived = ImageOps.fit(image.convert('RGB'), size, method=Image.Resampling.BICUBIC)
        path = export / name
        quality = 82
        while True:
            derived.save(path, 'WEBP', quality=quality, method=6)
            if path.stat().st_size <= cap:
                break
            quality -= 5
            if quality < 52:
                # Exact generated candidate path only; preserve all source media.
                path.unlink()
                fallbacks.append(dict(file=name, reason='Cannot meet per-image cap at quality >=52; existing portrait/default background + code scene'))
                break
        if not path.exists():
            continue
        data = path.read_bytes()
        (runtime / name).write_bytes(data)
        with Image.open(runtime / name) as checked:
            assert checked.size == size and checked.format == 'WEBP'
            checked.load()
        entries.append(dict(file=name, source=item['file'], source_sha256=sha(raw),
                            sha256=sha(data), bytes=len(data), width=size[0], height=size[1],
                            quality=quality, cap_bytes=cap, status='derived and decoded; runtime QA pending'))
    total = sum(a['bytes'] for a in entries)
    assert total <= 512 * 1024, total
    manifest = dict(profile='events-research-v3', generation='resize/crop/re-encode only; existing adopted illustration',
                    pillow_version=Image.__version__, total_bytes=total, runtime_allowlist=[a['file'] for a in entries],
                    assets=entries, budget_bytes=512 * 1024,
                    placeholders=['R02', 'R03', 'R05', 'R13', 'R18', 'R22', 'R24'],
                    budget_fallbacks=fallbacks,
                    pending='Actual module budget and UI visual QA; no new character poses or Mega mechanics')
    for directory in (runtime, export):
        (directory / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    # Contact sheet is an audit artifact, excluded from the runtime allowlist.
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
    contact = Image.new('RGB', (960, max(1, (len(entries) + 2) // 3) * 205), '#fffaf0')
    draw = ImageDraw.Draw(contact)
    for n, item in enumerate(entries):
        x, y = (n % 3) * 320, (n // 3) * 205
        with Image.open(runtime / item['file']) as image:
            contact.paste(ImageOps.fit(image, (310, 174)), (x + 5, y))
        draw.text((x + 8, y + 178), item['file'], font=font, fill='#243e39')
    contact.save(export / 'contact.jpg', quality=88)
    pairs = [('皮卡丘 −2', '烈咬陆鲨 11'), ('谜拟丘 −2', '快龙 9'), ('波克比 −1', '大岩蛇 9'),
             ('胖丁 0', '魔墙人偶 8'), ('鲤鱼王 0', '沙奈朵 8'), ('伊布 1', '耿鬼 7'),
             ('波加曼 2', '可达鸭 6'), ('妙蛙种子 3', '呆呆兽 6'), ('木木枭 3', '巨金怪 5'),
             ('杰尼龟 4', '六尾 5')]
    common = ['每小局仅触发一次随机事件；持续到小局结束。',
              '仅当前明置场地牌受天气影响；盖回／离场即停止。',
              '双属性仅调整一次；复制继承来源有效值，不重复加减。']
    definitions = {
        'rain': ('雨天', common, [('水系', '−2'), ('火系', '＋2'), ('其他', '不变')]),
        'sun': ('晴天', common, [('火系或草系', '−2'), ('水系', '＋2'), ('其他', '不变')]),
        'sandstorm': ('沙暴', common, [('岩石／地面／钢系', '−2'), ('其他固定数值', '＋1'), ('复制牌', '继承来源有效值')]),
        'snow': ('雪天', common + ['按天气前数值分档一次；不循环判断。'], [('数值 ≥8', '−2'), ('数值 ≤3', '＋1'), ('数值 4–7', '不变')]),
        'mega': ('Mega · 效果待设计', ['六类事件等概率中的一类；仅主题提示。', '不变身、不改分、不增加奖励或行动。'], [('玩法', '占位')]),
        'trick-room': ('戏法空间 · 十组双向互换', ['仅触发时全桌场地牌（含暗牌），不翻明。', '实例、位置和明暗不变；离场后身份不恢复。', '特殊角色不变；下一小局重置。'], [(a, '↔ '+b) for a, b in pairs]),
    }
    evidence = []
    for ident, (title, lines, rows) in definitions.items():
        data = svg(title, lines, rows)
        for directory in (originals, diagrams):
            (directory / (ident + '.svg')).write_bytes(data)
        evidence.append(dict(file=ident+'.svg', bytes=len(data), sha256=sha(data), status='v3 code diagram'))
    badge = svg('天气角标 · 减少动态静态示例', ['雨天减分淡蓝底；增分暖色底；未受影响保留常规底。',
                '角标有效值由服务端授权；暗牌无数值或来源提示。',
                '无动画时仍显示事件名称、有效值和调整来源。'],
                [('杰尼龟：印刷 4 → 有效 2', '雨天 −2 · 淡蓝底'), ('喷火龙：10 → 12', '雨天 ＋2 · 暖色底'), ('耿鬼：7 → 7', '雨天未调整')])
    badge = badge.replace(b'#e5f0e5', b'#d5eaf5', 1).replace(b'#e5f0e5', b'#ffe5bd', 1)
    (diagrams/'weather-badges-static.svg').write_bytes(badge)
    for ident, color in [('rain','#cadfea'),('sun','#fff0c0'),('sandstorm','#dfd2b0'),('snow','#e6f1f8'),('trick-room','#e3d2f4')]:
        data = svg(definitions[ident][0]+' · 静态替代', ['减少动态：使用运行背景和明确事件标签；不循环移动。'])
        (diagrams/(ident+'-static.svg')).write_bytes(data.replace(b'#fffaf0',color.encode()))
    static_assets = [dict(file=p.name, bytes=p.stat().st_size, sha256=sha(p.read_bytes()))
                     for p in sorted(diagrams.glob('*-static.svg'))]
    (diagrams/'manifest.json').write_text(json.dumps(dict(profile='events-research-v3',assets=evidence,static_assets=static_assets,
        old_v1='preserved as archived design reference; superseded descriptions are not runtime rules'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(runtime_files=len(entries),runtime_bytes=total,contact=str(export/'contact.jpg'),event_diagrams=len(evidence)),ensure_ascii=False))


if __name__ == '__main__':
    main()

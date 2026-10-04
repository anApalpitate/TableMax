"""Encode real UI captures losslessly without changing pixels or deleting originals."""

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument(
    "--game",
    choices=("all", "pokemon-encounters", "modern-art", "power-grid"),
    default="all",
)
parser.add_argument("--report")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
names = {
    "pokemon-encounters": ("table", "draw", "scoring"),
    "modern-art": ("hand", "market", "auction", "collection"),
    "power-grid": ("market", "network", "company", "order", "resource-prices"),
}
report = []
source_names = {
    "power-grid": {
        "market": "market-v2",
        "network": "network-v2",
        "company": "companies-v2",
    }
}
for game, files in names.items():
    if args.game not in ("all", game):
        continue
    for name in files:
        source_name = source_names.get(game, {}).get(name, name)
        source = root / "assets/games" / game / "rules" / f"{source_name}.png"
        target = source.parent / f"{name}.webp"
        with Image.open(source) as image:
            # Native screenshots are opaque; preserve alpha if a future capture isn't.
            opaque = image.convert("RGBA").getchannel("A").getextrema() == (255, 255)
            original = image.convert("RGB" if opaque else "RGBA")
            encoded = io.BytesIO()
            original.save(encoded, "WEBP", lossless=True, method=6)
            data = encoded.getvalue()
            with Image.open(io.BytesIO(data)) as decoded:
                assert decoded.size == original.size
                assert decoded.convert(original.mode).tobytes() == original.tobytes()
            if not target.exists() or target.read_bytes() != data:
                target.write_bytes(data)
        report.append({
            "game": game,
            "id": name,
            "file": f"rules/{name}.webp",
            "sourceFile": f"rules/{source_name}.png",
            "width": original.width,
            "height": original.height,
            "bytes": len(data),
            "sourceBytes": source.stat().st_size,
            "sha256": hashlib.sha256(data).hexdigest(),
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "pixelsVerifiedIdentical": True,
        })
        print(
            f"{game}/{name}: {source.stat().st_size} -> {len(data)} bytes; "
            "pixels identical"
        )
if args.report:
    output = Path(args.report).resolve()
    assert output.is_relative_to(root), "Report must stay inside this workspace"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

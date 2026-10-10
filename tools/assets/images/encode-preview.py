"""Encode a transient PNG from stdin as a WebP quality-90 preview.

No files are changed. Critical evidence and original assets must bypass this tool.
"""

import hashlib
import io
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[3]
if Path.cwd().resolve() != root or json.loads(
    (root / "package.json").read_text(encoding="utf-8")
)["name"] != "tablemax":
    raise RuntimeError("Run this tool from the TableMax repository root: " + str(root))

import PIL
from PIL import Image, features

if PIL.__version__ != "11.1.0" or not features.check("webp"):
    raise RuntimeError("Preview encoding requires Pillow 11.1.0 with WebP support")

source = sys.stdin.buffer.read()
with Image.open(io.BytesIO(source)) as original:
    if original.format != "PNG" or getattr(original, "n_frames", 1) != 1:
        raise ValueError("Only a single PNG screenshot can become a preview")
    original.load()
    pixels = original.convert("RGBA")
    opaque = pixels.getchannel("A").getextrema() == (255, 255)
    pixels = pixels.convert("RGB") if opaque else pixels
    encoded = io.BytesIO()
    pixels.save(encoded, "WEBP", quality=90, method=6, exact=True)
    data = encoded.getvalue()
    with Image.open(io.BytesIO(data)) as decoded:
        decoded.load()
        if decoded.size != pixels.size:
            raise ValueError("Preview dimensions changed")
        if not opaque and decoded.convert("RGBA").getchannel("A").tobytes() != pixels.getchannel("A").tobytes():
            raise ValueError("Preview transparency changed")
    metadata = {
        "quality": 90,
        "encoder": "Pillow " + PIL.__version__,
        "width": pixels.width,
        "height": pixels.height,
        "sourceBytes": len(source),
        "bytes": len(data),
        "sourceSha256": hashlib.sha256(source).hexdigest(),
        "sha256": hashlib.sha256(data).hexdigest(),
        "pixelsVerifiedIdentical": False,
    }
sys.stderr.write(json.dumps(metadata) + "\n")
sys.stdout.buffer.write(data)

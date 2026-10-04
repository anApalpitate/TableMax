"""Losslessly encode actual UI screenshots; retain the source PNGs."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent / "assets/games/modern-art/rules"
for name in ("hand", "market", "auction", "collection"):
    source = root / f"{name}.png"
    target = root / f"{name}.webp"
    with Image.open(source) as image:
        original = image.convert("RGB")
        original.save(target, "WEBP", lossless=True, method=6)
        with Image.open(target) as decoded:
            assert decoded.size == original.size
            assert decoded.convert("RGB").tobytes() == original.tobytes()
    print(f"{name}: {source.stat().st_size} -> {target.stat().st_size} bytes; pixels identical")

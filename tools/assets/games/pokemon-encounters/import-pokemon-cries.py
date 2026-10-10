from pathlib import Path
import json
_workspace_root = Path(__file__).resolve().parents[3]
if Path.cwd().resolve() != _workspace_root or json.loads((_workspace_root / 'package.json').read_text(encoding='utf-8'))['name'] != 'tablemax':
    raise RuntimeError('Run this tool from the TableMax repository root: ' + str(_workspace_root))

"""Import the user's eight WAVs; run with the bundled Python/NumPy runtime.

The two user-confirmed clips are copied byte for byte. Six filename-labelled
character cries receive deterministic mono/16 kHz processing. Source files and
the three replaced runtime sounds are archived with hashes before import.
"""

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import shutil
import wave

import numpy as np


WORKSPACE = Path(__file__).resolve().parent.parent
AUDIO = WORKSPACE / "assets/games/pokemon-encounters/audio"
DEFAULT_EVIDENCE = WORKSPACE / "artifacts/maintenance/v1.0.2/pokemon-polish-20261005/audio"
FILES = [
    ("皮卡丘.wav", "pikachu", "pikachu-user-v2.wav", "ordinary--2", False),
    ("胖丁.wav", "jigglypuff", "jigglypuff-user-v2.wav", "ordinary-0", False),
    ("伊布.wav", "eevee", "eevee-user-v2.wav", "ordinary-1", False),
    ("妙蛙种子.wav", "bulbasaur", "bulbasaur-user-v2.wav", "ordinary-3", False),
    ("杰尼龟.wav", "squirtle", "squirtle-user-v2.wav", "ordinary-4", False),
    ("耿鬼.wav", "gengar", "gengar-user-v2.wav", "ordinary-7", False),
    ("火箭队.wav", "rocket", "team-rocket-entrance-user-v2.wav", None, True),
    ("硬币喵喵面.wav", "meowth", "meowth-coin-user-v2.wav", None, True),
]
RETIRED = ["rocket-v1.wav", "meowth-game-v1.mp3", "pikachu-starter-game-v1.mp3"]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def owned(path):
    result = path.resolve()
    if not result.is_relative_to(WORKSPACE):
        raise ValueError(f"Write target leaves this workspace: {result}")
    return result


def relative(path):
    return path.relative_to(WORKSPACE).as_posix()


def json_write(path, value):
    owned(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def archive(source, destination):
    destination = owned(destination)
    source_hash = sha(source.read_bytes())
    if destination.exists():
        if sha(destination.read_bytes()) != source_hash:
            raise ValueError(f"Existing archive has different bytes: {destination}")
    else:
        shutil.copyfile(source, destination)
    if sha(destination.read_bytes()) != source_hash:
        raise ValueError(f"Archive hash mismatch: {destination}")
    return {"path": relative(destination), "bytes": source.stat().st_size, "sha256": source_hash}


def decode(data):
    with wave.open(io.BytesIO(data), "rb") as wav:
        if wav.getsampwidth() != 2 or wav.getcomptype() != "NONE":
            raise ValueError("Expected signed PCM16 WAV")
        rate, channels, frames = wav.getframerate(), wav.getnchannels(), wav.getnframes()
        samples = np.frombuffer(wav.readframes(frames), dtype="<i2").astype(np.float64)
        return samples.reshape(-1, channels) / 32768, rate


def stats(data):
    values, rate = decode(data)
    peak = float(np.max(np.abs(values)))
    rms = float(np.sqrt(np.mean(values**2)))
    active = np.flatnonzero(np.max(np.abs(values), axis=1) >= 10 ** (-45 / 20))
    return {
        "seconds": len(values) / rate,
        "channels": values.shape[1],
        "sampleRate": rate,
        "bits": 16,
        "peak": peak,
        "peakDBFS": 20 * math.log10(peak) if peak else None,
        "rms": rms,
        "rmsDBFS": 20 * math.log10(rms) if rms else None,
        "dc": float(np.mean(values)),
        "clippedSamples": int(np.count_nonzero(np.abs(values) >= 0.999)),
        "leadingAtMinus45DB": int(active[0]) / rate if active.size else len(values) / rate,
        "trailingAtMinus45DB": (len(values) - 1 - int(active[-1])) / rate if active.size else len(values) / rate,
    }


def process(data):
    samples, source_rate = decode(data)
    mono = samples.mean(axis=1)
    mono -= mono.mean()
    target_rate = 16000
    count = round(len(mono) * target_rate / source_rate)
    # Band-limited Fourier downsampling; a short cosine transition prevents
    # aliasing above 8 kHz without changing pitch or the full clip duration.
    spectrum = np.fft.rfft(mono)
    frequency = np.fft.rfftfreq(len(mono), 1 / source_rate)
    transition = np.clip((frequency - target_rate * 0.45) / (target_rate * 0.05), 0, 1)
    spectrum *= (1 + np.cos(np.pi * transition)) / 2
    spectrum = spectrum[: count // 2 + 1].copy()
    if count % 2 == 0 and count < len(mono):
        spectrum[-1] *= 2
    result = np.fft.irfft(spectrum, n=count) * (count / len(mono))
    rms = float(np.sqrt(np.mean(result**2)))
    peak = float(np.max(np.abs(result)))
    if not rms or not peak:
        raise ValueError("User clip contains no non-silent samples")
    gain = min(10 ** ((-22 - 20 * math.log10(rms)) / 20), 10 ** (12 / 20), 10 ** (-3 / 20) / peak)
    result *= gain
    fade = min(round(target_rate * 0.008), count // 2)
    result[:fade] *= np.linspace(0, 1, fade)
    result[-fade:] *= np.linspace(1, 0, fade)
    pcm = np.clip(np.rint(result * 32767), -32768, 32767).astype("<i2").tobytes()
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(target_rate)
        wav.writeframes(pcm)
    return output.getvalue(), {
        "mono": "arithmetic mean of both channels",
        "dcRemoval": True,
        "resampling": "band-limited Fourier; cosine rolloff 7200-8000 Hz",
        "sampleRate": target_rate,
        "rmsTargetDBFS": -22,
        "peakCeilingDBFS": -3,
        "maxGainDB": 12,
        "appliedGainDB": 20 * math.log10(gain),
        "fadeInMs": 8,
        "fadeOutMs": 8,
        "trimmed": False,
        "pitchChanged": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(r"D:\aLCYYDS\IDM下载\叫声"))
    parser.add_argument("--evidence", type=Path, default=DEFAULT_EVIDENCE)
    args = parser.parse_args()
    evidence = owned(args.evidence)
    originals = owned(evidence / "source-originals")
    retired = owned(evidence / "retired-originals")
    originals.mkdir(parents=True, exist_ok=True)
    retired.mkdir(parents=True, exist_ok=True)
    manifest_path = AUDIO / "manifest.json"
    previous = json.loads(manifest_path.read_text(encoding="utf-8"))
    retired_report = [archive(AUDIO / name, retired / name) for name in RETIRED]
    retired_manifest = retired / "manifest.json"
    if not retired_manifest.exists():
        json_write(retired_manifest, [entry for entry in previous if entry["path"] in RETIRED])
    entries = []
    report = []
    for name, cue, filename, category, untouched in FILES:
        source = args.source / name
        source_archive = archive(source, originals / name)
        original = source.read_bytes()
        source_stats = stats(original)
        if untouched:
            output, processing = original, {"bytePreserved": True, "processing": "none (user request)"}
        else:
            output, processing = process(original)
        destination = owned(AUDIO / filename)
        destination.write_bytes(output)
        output_stats = stats(output)
        if untouched and sha(destination.read_bytes()) != source_archive["sha256"]:
            raise ValueError(f"User-preserved WAV changed: {filename}")
        if not untouched and (output_stats["sampleRate"] != 16000 or output_stats["channels"] != 1 or output_stats["clippedSamples"]):
            raise ValueError(f"Processed WAV failed format/clipping checks: {filename}")
        purpose = (
            "Team Rocket entrance BGM; content confirmed by user 2026-10-05"
            if cue == "rocket"
            else "Meowth meow cry on saved coin landing; content confirmed by user 2026-10-05"
            if cue == "meowth"
            else "Character cry on new saved draw; identity uses user's filename label"
        )
        entry = {
            "id": f"pokemon-encounters/audio/{cue}",
            "path": filename,
            "source": "User-provided local WAV",
            "sourceFile": str(source.resolve()),
            "sourceEvidence": source_archive,
            "imported": "2026-10-05",
            "version": "v2",
            "encoding": "PCM signed 16-bit stereo" if untouched else "PCM signed 16-bit mono",
            "bytes": len(output),
            "sha256": sha(output),
            "decoded": output_stats,
            "processing": processing,
            "purpose": purpose,
            "categoryId": category,
            "verification": "Source/output hashes, PCM decoding and non-silent samples verified; no model listening or official recording-source claim.",
            "evidence": relative(evidence / "import-results.json"),
        }
        entries.append(entry)
        report.append({"cue": cue, "source": source_archive, "sourceDecoded": source_stats, "output": entry})
    imported_ids = {entry["id"] for entry in entries}
    manifest = [entry for entry in previous if entry["id"] not in imported_ids] + entries
    json_write(manifest_path, manifest)
    json_write(evidence / "import-results.json", {
        "imported": "2026-10-05",
        "pythonScript": "tools/assets/games/pokemon-encounters/import-pokemon-cries.py",
        "numpyVersion": np.__version__,
        "sourceBytes": sum(item["source"]["bytes"] for item in report),
        "outputBytes": sum(entry["bytes"] for entry in entries),
        "retired": retired_report,
        "retiredFilesRemainInRepository": True,
        "runtimeNetAdditionalBytes": sum(entry["bytes"] for entry in entries) - sum(item["bytes"] for item in retired_report),
        "clips": report,
    })
    print(json.dumps({"imported": len(entries), "outputBytes": sum(entry["bytes"] for entry in entries), "evidence": relative(evidence)}, ensure_ascii=True))


if __name__ == "__main__":
    main()

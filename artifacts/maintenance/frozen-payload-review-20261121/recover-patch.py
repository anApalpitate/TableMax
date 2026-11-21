"""Rebuild the archived Ra patch. Pass --output to save it to an unused filename."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def run_git(args, env, **kwargs):
    return subprocess.run(["git", *args], cwd=ROOT, env=env, check=True, **kwargs)


def recover(output):
    recipe = json.loads((HERE / "final-patch-recipe.json").read_text(encoding="utf-8"))
    if output and os.path.lexists(output):
        raise FileExistsError(output)
    clean = os.environ.copy()
    for name in ("GIT_DIR", "GIT_COMMON_DIR", "GIT_WORK_TREE", "GIT_OBJECT_DIRECTORY",
                 "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_INDEX_FILE"):
        clean.pop(name, None)
    clean["GIT_NO_REPLACE_OBJECTS"] = "1"
    scratch_root = ROOT / "tmp"
    if scratch_root.resolve() != scratch_root:
        raise ValueError("Unexpected scratch root")
    with tempfile.TemporaryDirectory(dir=scratch_root, prefix="ra-patch-check-") as directory:
        scratch = Path(directory)
        if scratch.resolve().parent != scratch_root:
            raise ValueError("Unexpected scratch directory")
        (scratch / "pack").mkdir()
        (scratch / "info").mkdir()
        isolated = dict(clean, GIT_OBJECT_DIRECTORY=str(scratch))
        with subprocess.Popen(["git", "pack-objects", "--stdout", "--revs"], cwd=ROOT,
                              env=clean, stdin=subprocess.PIPE, stdout=subprocess.PIPE) as source:
            source.stdin.write((recipe["head"] + "\n").encode())
            source.stdin.close()
            run_git(["index-pack", "--stdin"], isolated, stdin=source.stdout, capture_output=True)
            if source.wait():
                raise RuntimeError("Pinned history could not be loaded")
        for pack_path, expected in [(ROOT / recipe["priorPack"], recipe["priorSha256"]),
                                    (HERE / "final-tree.pack", recipe["extraPackSha256"])]:
            if subprocess.run(["git", "cat-file", "-e", recipe["tree"]], cwd=ROOT, env=isolated,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                raise RuntimeError("Negative control failed before adding recovery input")
            data = pack_path.read_bytes()
            if hashlib.sha256(data).hexdigest() != expected:
                raise ValueError("Recovery pack digest differs")
            run_git(["index-pack", "--stdin"], isolated, input=data, capture_output=True)
        data = run_git(["diff", "--no-ext-diff", "--no-textconv", "--binary", "--abbrev=8",
                        recipe["base"], recipe["tree"]], isolated, capture_output=True).stdout
        digest = hashlib.sha256(data).hexdigest()
        if len(data) != recipe["bytes"] or digest != recipe["sha256"]:
            raise ValueError("Recovered patch differs")
        if output:
            with tempfile.NamedTemporaryFile(dir=output.parent, delete=False) as stream:
                staged = Path(stream.name)
            try:
                staged.write_bytes(data)
                if os.name == "nt":
                    os.rename(staged, output)
                else:
                    os.link(staged, output)
            finally:
                staged.unlink(missing_ok=True)
        print(json.dumps(dict(bytes=len(data), sha256=digest, result="passed")))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    recover(parser.parse_args().output)

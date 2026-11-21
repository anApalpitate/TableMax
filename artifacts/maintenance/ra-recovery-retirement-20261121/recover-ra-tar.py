"""Verify the historical Ra TAR, optionally restoring it to an unused path."""
from contextlib import nullcontext
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RECIPE = json.loads((HERE / "ra-source-recipe.json").read_text(encoding="utf-8"))


def git(*args, env=None, **kwargs):
    return subprocess.run(["git", *args], cwd=ROOT, env=env, check=True, **kwargs)


def verify(output):
    recipe = RECIPE
    pack = (HERE / "ra-source-objects.pack").read_bytes()
    if hashlib.sha256(pack).hexdigest() != recipe["packSha256"]:
        raise ValueError("Recovery pack digest differs")
    task = ROOT / "tmp" / "ra-source-recovery-20261121"
    task.mkdir(exist_ok=True)
    if task.resolve() != task or (task / ".git").exists():
        raise ValueError("Unexpected verification workspace")
    with tempfile.TemporaryDirectory(prefix="objects-", dir=task) as scratch:
        db = Path(scratch)
        if db.resolve().parent != task:
            raise ValueError("Unexpected object directory")
        (db / "pack").mkdir()
        (db / "info").mkdir()
        env = os.environ.copy()
        for key in ("GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES",
                    "GIT_COMMON_DIR", "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"):
            env.pop(key, None)
        env["GIT_NO_REPLACE_OBJECTS"] = "1"
        isolated = dict(env, GIT_OBJECT_DIRECTORY=str(db))
        # Populate the empty object database strictly through the pinned commit.
        with subprocess.Popen(["git", "pack-objects", "--stdout", "--revs"],
                              cwd=ROOT, env=env, stdin=subprocess.PIPE,
                              stdout=subprocess.PIPE) as source:
            source.stdin.write((recipe["pinnedCommit"] + "\n").encode())
            source.stdin.close()
            git("index-pack", "--stdin", stdin=source.stdout, stdout=subprocess.DEVNULL, env=isolated)
            if source.wait():
                raise ValueError("Could not transfer reachable history")
        for oid in recipe["objects"]:
            probe = subprocess.run(["git", "cat-file", "-e", oid], cwd=ROOT, env=isolated,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if probe.returncode == 0:
                raise ValueError("Negative control failed: " + oid)
        git("index-pack", "--stdin", input=pack, stdout=subprocess.DEVNULL, env=isolated)
        for item in recipe["blobs"]:
            data = git("cat-file", "blob", item["oid"], env=isolated, capture_output=True).stdout
            if len(data) != item["size"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
                raise ValueError("Source blob differs: " + item["oid"])
        digest = hashlib.sha256()
        size = 0
        # Keep output private until both whole-archive checks pass. link() never overwrites.
        with nullcontext(None) if output is None else tempfile.NamedTemporaryFile(
                dir=output.parent, delete=False) as stream:
            staged = Path(stream.name) if output is not None else None
            try:
                with subprocess.Popen(["git", "archive", "--format=tar", "--mtime=@" + str(recipe["mtime"]),
                                       recipe["tree"]], cwd=ROOT, env=isolated, stdout=subprocess.PIPE) as archive:
                    while block := archive.stdout.read(1048576):
                        digest.update(block)
                        size += len(block)
                        if staged is not None:
                            stream.write(block)
                    if archive.wait():
                        raise ValueError("Archive reconstruction failed")
                if size != recipe["tarBytes"] or digest.hexdigest() != recipe["tarSha256"]:
                    raise ValueError("Reconstructed archive differs")
                if staged is not None:
                    stream.close()
                    os.link(staged, output)
            finally:
                if staged is not None:
                    stream.close()
                    staged.unlink(missing_ok=True)
        print(json.dumps(dict(bytes=size, sha256=digest.hexdigest(), restoredBlobs=len(recipe["blobs"]),
                              initiallyAbsentObjects=len(recipe["objects"]))))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Restore to an unused file in an existing directory")
    output = parser.parse_args().output
    if output is not None and (output.exists() or output.is_symlink()):
        parser.error("Output path already exists")
    verify(output)

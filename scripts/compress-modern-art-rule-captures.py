"""Compatibility entry point for the Modern Art capture encoder."""
from pathlib import Path
import runpy
import sys

entry = Path(__file__).with_name("compress-rule-captures.py")
sys.argv = [str(entry), "--game=modern-art", *sys.argv[1:]]
runpy.run_path(str(entry), run_name="__main__")

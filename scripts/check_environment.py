#!/usr/bin/env python3
"""Check the portable GIF Maker skill and application prerequisites."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from find_project import find_project


def command_version(command: str) -> str | None:
    executable = shutil.which(command)
    if executable is None:
        return None
    result = subprocess.run(
        [executable, "--version"], capture_output=True, text=True, timeout=10, check=False
    )
    return (result.stdout or result.stderr).strip() or "unknown"


def node_version(version: str) -> tuple[int, int] | None:
    try:
        major, minor, *_ = version.lstrip("v").split(".")
        return int(major), int(minor)
    except (ValueError, IndexError):
        return None


def node_is_supported(version: str) -> bool:
    parsed = node_version(version)
    if parsed is None:
        return False
    major, minor = parsed
    return (major == 20 and minor >= 19) or (major == 22 and minor >= 12) or major > 22


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=Path, default=Path.cwd())
    args = parser.parse_args()

    project = find_project(args.start)
    node = command_version("node")
    npm = command_version("npm")
    problems: list[str] = []

    print(f"Python: {sys.version.split()[0]}")
    print(f"Node.js: {node or 'missing'}")
    print(f"npm: {npm or 'missing'}")
    print(f"Project: {project or 'not found'}")

    if node is None:
        problems.append("Node.js is required")
    elif not node_is_supported(node):
        problems.append("Node.js ^20.19.0 or >=22.12.0 is required")
    if npm is None:
        problems.append("npm is required")
    if project is None:
        problems.append("CineGIF project was not found")
    elif not (project / "node_modules").is_dir():
        print("Dependencies: not installed (run npm install)")
    else:
        print("Dependencies: installed")

    if problems:
        for problem in problems:
            print(f"ERROR: {problem}", file=sys.stderr)
        return 1
    print("Environment check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

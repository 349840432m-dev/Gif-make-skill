#!/usr/bin/env python3
"""Locate a CineGIF checkout without relying on machine-specific paths."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def is_project(path: Path) -> bool:
    package_file = path / "package.json"
    required = (path / "src" / "App.tsx", path / "src" / "lib" / "gifEncoder.ts")
    if not package_file.is_file() or not all(item.is_file() for item in required):
        return False
    try:
        package = json.loads(package_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return package.get("name") == "cinegif"


def candidates(start: Path) -> list[Path]:
    values: list[Path] = []
    configured = os.environ.get("GIF_MAKER_PROJECT")
    if configured:
        values.append(Path(configured).expanduser())
    resolved = start.expanduser().resolve()
    values.extend((resolved, *resolved.parents))
    home = Path.home()
    for base in (home / "development", home / "Developer", home / "Projects"):
        values.extend((base / "GIF制作", base / "cinegif", base / "gif-maker"))
    return values


def find_project(start: Path) -> Path | None:
    seen: set[Path] = set()
    for candidate in candidates(start):
        normalized = candidate.resolve()
        if normalized in seen:
            continue
        seen.add(normalized)
        if is_project(normalized):
            return normalized
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=Path, default=Path.cwd())
    args = parser.parse_args()
    project = find_project(args.start)
    if project is None:
        print("CineGIF project not found. Set GIF_MAKER_PROJECT or run from its repository.")
        return 1
    print(project)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

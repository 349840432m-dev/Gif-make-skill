#!/usr/bin/env python3
"""Create a CineGIF project from the self-contained skill template."""

from __future__ import annotations

import argparse
import json
import shutil
import stat
import tempfile
from pathlib import Path

from template_utils import (
    MANIFEST_NAME,
    build_manifest,
    compare_manifests,
    project_is_valid,
    verify_manifest,
)


def default_template() -> Path:
    return Path(__file__).resolve().parent.parent / "assets" / "cinegif-template"


def initialize(template: Path, destination: Path) -> Path:
    template = template.expanduser().resolve()
    destination = destination.expanduser().resolve()
    valid, problems = verify_manifest(template)
    if not valid:
        raise ValueError("Bundled template failed verification: " + "; ".join(problems))
    expected = json.loads((template / MANIFEST_NAME).read_text(encoding="utf-8"))
    destination_existed = destination.exists()
    destination_mode = stat.S_IMODE(destination.stat().st_mode) if destination_existed else None
    if destination_existed:
        if not destination.is_dir():
            raise ValueError(f"Destination is not a directory: {destination}")
        if any(destination.iterdir()):
            raise ValueError(f"Destination must be empty: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(
        tempfile.mkdtemp(prefix=f".{destination.name}-", dir=destination.parent)
    )
    try:
        for source in template.iterdir():
            if source.name == MANIFEST_NAME:
                continue
            target = temporary / source.name
            if source.is_dir():
                shutil.copytree(source, target)
            else:
                shutil.copy2(source, target)
        copied = build_manifest(temporary)
        copy_problems = compare_manifests(expected, copied)
        if copy_problems or not project_is_valid(temporary):
            details = "; ".join(copy_problems) or "project fingerprint mismatch"
            raise ValueError("Initialized project failed verification: " + details)
        if destination_mode is not None:
            temporary.chmod(destination_mode)
        if destination_existed:
            destination.rmdir()
        temporary.replace(destination)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        if destination_existed and not destination.exists():
            destination.mkdir()
        raise
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--destination",
        type=Path,
        default=Path.home() / "CineGIF",
        help="New or empty project directory (default: ~/CineGIF)",
    )
    parser.add_argument("--template", type=Path, default=default_template())
    args = parser.parse_args()
    try:
        destination = initialize(args.template, args.destination)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(destination)
    print("Project initialized. Next: npm ci && npm run build")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

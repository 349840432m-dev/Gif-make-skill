#!/usr/bin/env python3
"""Refresh the bundled CineGIF template from a verified project checkout."""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
from pathlib import Path

from template_utils import (
    MANIFEST_NAME,
    project_is_valid,
    validate_relative_paths,
    write_manifest,
    verify_manifest,
)


def managed_files(destination: Path, include: list[str], exclude: list[str]) -> list[Path]:
    manifest_path = destination / MANIFEST_NAME
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot read existing template manifest: {error}") from error
    if (
        manifest.get("format") != 1
        or manifest.get("project") != "cinegif"
        or not isinstance(manifest.get("files"), dict)
    ):
        raise ValueError("Existing template manifest is unsupported")
    files = set(manifest["files"])
    files.update(include)
    files.difference_update(exclude)
    relative_paths = [Path(relative) for relative in sorted(files)]
    validate_relative_paths(relative_paths)
    return relative_paths


def copy_whitelist(source: Path, destination: Path, files: list[Path]) -> None:
    for relative in files:
        source_file = source / relative
        if source_file.is_symlink():
            raise ValueError(f"Source contains a symbolic link: {relative.as_posix()}")
        if not source_file.is_file():
            raise ValueError(f"Managed source file is missing: {relative.as_posix()}")
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, target)


def sync(
    source: Path,
    destination: Path,
    include: list[str] | None = None,
    exclude: list[str] | None = None,
) -> None:
    source = source.expanduser().resolve()
    destination = destination.expanduser().resolve()
    if not project_is_valid(source):
        raise ValueError(f"Not a valid CineGIF project: {source}")
    if destination.exists() and not destination.is_dir():
        raise ValueError(f"Template destination is not a directory: {destination}")
    if destination == source or destination.is_relative_to(source):
        raise ValueError("Template destination must be outside the source project")
    files = managed_files(destination, include or [], exclude or [])
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{destination.name}-", dir=destination.parent))
    backup = destination.with_name(f".{destination.name}-backup")
    try:
        copy_whitelist(source, staging, files)
        write_manifest(staging)
        valid, problems = verify_manifest(staging)
        if not valid:
            raise ValueError("Staged template failed verification: " + "; ".join(problems))
        if backup.exists():
            raise ValueError(f"Backup path already exists: {backup}")
        if destination.exists():
            destination.replace(backup)
        try:
            staging.replace(destination)
        except Exception:
            if backup.exists() and not destination.exists():
                backup.replace(destination)
            raise
        if backup.exists():
            shutil.rmtree(backup)
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--template", type=Path, required=True)
    parser.add_argument("--include", action="append", default=[])
    parser.add_argument("--exclude", action="append", default=[])
    args = parser.parse_args()
    try:
        sync(args.source, args.template, args.include, args.exclude)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(f"Template synchronized: {args.template.expanduser().resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

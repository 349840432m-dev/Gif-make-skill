#!/usr/bin/env python3
"""Shared template-copy and integrity helpers for the GIF Maker skill."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

MANIFEST_NAME = ".cinegif-template-manifest.json"
PROJECT_NAME = "cinegif"
REQUIRED_FILES = (
    "package.json",
    "package-lock.json",
    "src/App.tsx",
    "src/lib/gifEncoder.ts",
)
ROOT_FILES = (
    ".gitignore",
    "README.md",
    "eslint.config.js",
    "index.html",
    "package-lock.json",
    "package.json",
    "tsconfig.app.json",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts",
)
ROOT_DIRECTORIES = ("docs", "public", "src")
WINDOWS_RESERVED = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{number}" for number in range(1, 10)),
    *(f"LPT{number}" for number in range(1, 10)),
}
WINDOWS_INVALID = re.compile(r'[<>:"\\|?*]')


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def project_is_valid(path: Path) -> bool:
    try:
        package = json.loads((path / "package.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return package.get("name") == PROJECT_NAME and all(
        (path / relative).is_file() for relative in REQUIRED_FILES
    )


def validate_relative_paths(paths: list[Path]) -> None:
    normalized: dict[str, str] = {}
    for path in paths:
        relative = path.as_posix()
        folded = relative.casefold()
        if folded in normalized and normalized[folded] != relative:
            raise ValueError(
                f"case-insensitive path collision: {normalized[folded]} and {relative}"
            )
        normalized[folded] = relative
        for part in path.parts:
            stem = part.split(".", 1)[0].upper()
            if (
                part in ("", ".", "..")
                or part.endswith((" ", "."))
                or WINDOWS_INVALID.search(part)
                or stem in WINDOWS_RESERVED
            ):
                raise ValueError(f"path is not portable to Windows: {relative}")


def build_manifest(template: Path) -> dict[str, object]:
    links = [path for path in template.rglob("*") if path.is_symlink()]
    if links:
        relative = links[0].relative_to(template).as_posix()
        raise ValueError(f"template contains a symbolic link: {relative}")
    source_files = [
        path
        for path in sorted(template.rglob("*"))
        if path.is_file() and path.name != MANIFEST_NAME
    ]
    relative_paths = [path.relative_to(template) for path in source_files]
    validate_relative_paths(relative_paths)
    files = {
        relative.as_posix(): sha256(path)
        for path, relative in zip(source_files, relative_paths)
    }
    return {"format": 1, "project": PROJECT_NAME, "files": files}


def compare_manifests(expected: dict[str, object], actual: dict[str, object]) -> list[str]:
    expected_files = expected.get("files")
    actual_files = actual.get("files")
    if not isinstance(expected_files, dict) or not isinstance(actual_files, dict):
        return ["manifest files must be an object"]
    problems: list[str] = []
    for relative in sorted(set(expected_files) | set(actual_files)):
        expected_hash = expected_files.get(relative)
        actual_hash = actual_files.get(relative)
        if expected_hash is None:
            problems.append(f"unexpected file: {relative}")
        elif actual_hash is None:
            problems.append(f"missing file: {relative}")
        elif expected_hash != actual_hash:
            problems.append(f"checksum mismatch: {relative}")
    return problems


def write_manifest(template: Path) -> Path:
    manifest_path = template / MANIFEST_NAME
    manifest_path.write_text(
        json.dumps(build_manifest(template), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest_path


def verify_manifest(template: Path) -> tuple[bool, list[str]]:
    manifest_path = template / MANIFEST_NAME
    try:
        expected = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return False, [f"invalid manifest: {error}"]
    if expected.get("format") != 1 or expected.get("project") != PROJECT_NAME:
        return False, ["unsupported template manifest"]
    try:
        actual = build_manifest(template)
    except ValueError as error:
        return False, [str(error)]
    problems = compare_manifests(expected, actual)
    return not problems, problems

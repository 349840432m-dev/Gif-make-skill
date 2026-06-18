#!/usr/bin/env python3
"""Exercise self-contained initialization and its destructive-write guards."""

from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from check_environment import node_is_supported
from init_project import default_template, initialize
from sync_template import sync
from template_utils import validate_relative_paths, verify_manifest


class PortabilityTests(unittest.TestCase):
    def test_node_version_boundary(self) -> None:
        self.assertFalse(node_is_supported("v20.18.1"))
        self.assertTrue(node_is_supported("v20.19.0"))
        self.assertFalse(node_is_supported("v21.7.0"))
        self.assertFalse(node_is_supported("v22.11.0"))
        self.assertTrue(node_is_supported("v22.12.0"))
        self.assertTrue(node_is_supported("v24.0.0"))

    def test_rejects_cross_platform_path_conflicts(self) -> None:
        with self.assertRaisesRegex(ValueError, "case-insensitive"):
            validate_relative_paths([Path("src/Foo.ts"), Path("src/foo.ts")])
        with self.assertRaisesRegex(ValueError, "portable to Windows"):
            validate_relative_paths([Path("src/CON.ts")])

    def test_bundled_template_is_valid(self) -> None:
        valid, problems = verify_manifest(default_template())
        self.assertTrue(valid, problems)

    def test_initializes_new_project(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "CineGIF"
            initialize(default_template(), target)
            self.assertTrue((target / "package.json").is_file())
            self.assertFalse((target / ".cinegif-template-manifest.json").exists())

    def test_rejects_non_empty_destination(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "existing"
            target.mkdir()
            marker = target / "keep.txt"
            marker.write_text("keep", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must be empty"):
                initialize(default_template(), target)
            self.assertEqual(marker.read_text(encoding="utf-8"), "keep")

    def test_rejects_tampered_template(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            template = Path(directory) / "template"
            shutil.copytree(default_template(), template)
            (template / "package.json").write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "failed verification"):
                initialize(template, Path(directory) / "output")

    def test_sync_replaces_unknown_template_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "template"
            shutil.copytree(default_template(), target)
            (target / ".env").write_text("must disappear", encoding="utf-8")
            sync(default_template(), target)
            self.assertFalse((target / ".env").exists())
            valid, problems = verify_manifest(target)
            self.assertTrue(valid, problems)

    def test_sync_rejects_source_symlink_without_changing_target(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source"
            target = Path(directory) / "target"
            shutil.copytree(default_template(), source)
            (source / "src" / "external-link").symlink_to(Path(directory) / "outside")
            shutil.copytree(default_template(), target)
            marker = target / "keep.txt"
            marker.write_text("keep", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "symbolic link"):
                sync(source, target, include=["src/external-link"])
            self.assertEqual(marker.read_text(encoding="utf-8"), "keep")

    def test_sync_ignores_unmanaged_source_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source"
            target = Path(directory) / "target"
            shutil.copytree(default_template(), source)
            shutil.copytree(default_template(), target)
            (source / ".env").write_text("secret", encoding="utf-8")
            sync(source, target)
            self.assertFalse((target / ".env").exists())


if __name__ == "__main__":
    unittest.main()

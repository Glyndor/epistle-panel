#!/usr/bin/env python3
"""Tests for `scripts/release/version/check_release_tag.py`.

Run from the repository root with:

	python3 -I -m unittest discover -s scripts/release/version -p 'test_*.py' -v

The script reads `internal/package.json` and `debian/changelog` relative to
the working directory, so each test builds a small tree in a temporary
directory and runs the script there as a command. Assertions are on the exit
code and on whether the failure came from the check that should have refused
the input, by the file or tag the message names.
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "check_release_tag.py"


def changelog(version: str) -> str:
	return f"epistle-panel ({version}) unstable; urgency=medium\n\n  * Entry.\n\n -- Glyndor <p@example.org>  Wed, 11 Nov 2026 12:00:00 +0000\n"


class CheckReleaseTag(unittest.TestCase):
	def run_in_tree(self, tag: str, package: str = "0.1.0", log: str | None = None, *, with_files: bool = True):
		with tempfile.TemporaryDirectory() as tmp:
			root = Path(tmp)
			if with_files:
				(root / "internal").mkdir()
				(root / "internal" / "package.json").write_text(json.dumps({"name": "x", "version": package}))
				(root / "debian").mkdir()
				(root / "debian" / "changelog").write_text(log if log is not None else changelog("0.1.0"))
			return subprocess.run(
				[sys.executable, "-I", str(SCRIPT), tag],
				cwd=root,
				capture_output=True,
				text=True,
				check=False,
			)

	def test_tag_package_and_changelog_agreeing_pass(self) -> None:
		result = self.run_in_tree("v0.1.0")
		self.assertEqual(result.returncode, 0, result.stderr)

	def test_a_tag_that_disagrees_with_package_json_is_refused(self) -> None:
		result = self.run_in_tree("v0.2.0")
		self.assertEqual(result.returncode, 1)
		self.assertIn("internal/package.json", result.stderr)

	def test_a_changelog_left_behind_is_refused(self) -> None:
		result = self.run_in_tree("v0.2.0", package="0.2.0")
		self.assertEqual(result.returncode, 1)
		self.assertIn("debian/changelog", result.stderr)

	def test_a_debian_revision_is_refused(self) -> None:
		result = self.run_in_tree("v0.1.0", log=changelog("0.1.0-1"))
		self.assertEqual(result.returncode, 1)
		self.assertIn("debian/changelog", result.stderr)

	def test_a_changelog_for_another_package_is_refused(self) -> None:
		result = self.run_in_tree("v0.1.0", log=changelog("0.1.0").replace("epistle-panel", "other"))
		self.assertEqual(result.returncode, 1)
		self.assertIn("not a epistle-panel entry", result.stderr)

	def test_a_malformed_tag_is_refused_before_any_file_is_read(self) -> None:
		for tag in ("0.1.0", "v0.1", "v0.1.0.0", "v0.1.0-rc.1", "v0.01.0", "v01.1.0", "v0.1.0 ", "v1x.2.3", ""):
			with self.subTest(tag=tag):
				result = self.run_in_tree(tag, with_files=False)
				self.assertEqual(result.returncode, 1)
				self.assertIn("is not a release tag", result.stderr)

	def test_the_wrong_number_of_arguments_is_refused(self) -> None:
		with tempfile.TemporaryDirectory() as tmp:
			result = subprocess.run(
				[sys.executable, "-I", str(SCRIPT)], cwd=tmp, capture_output=True, text=True, check=False
			)
		self.assertEqual(result.returncode, 1)

	def test_a_missing_version_in_package_json_is_refused(self) -> None:
		with tempfile.TemporaryDirectory() as tmp:
			root = Path(tmp)
			(root / "internal").mkdir()
			(root / "internal" / "package.json").write_text("{}")
			(root / "debian").mkdir()
			(root / "debian" / "changelog").write_text(changelog("0.1.0"))
			result = subprocess.run(
				[sys.executable, "-I", str(SCRIPT), "v0.1.0"], cwd=root, capture_output=True, text=True, check=False
			)
		self.assertEqual(result.returncode, 1)
		self.assertIn("internal/package.json", result.stderr)


if __name__ == "__main__":
	unittest.main()

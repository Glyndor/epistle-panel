#!/usr/bin/env python3
"""Tests for `scripts/release/publish/image_tags.py`.

Run from the repository root with:

	python3 -I -m unittest discover -s scripts/release/publish -p 'test_*.py' -v

The script is driven as a command, the way `publish-manifest.sh` calls it, so
every assertion is on an exit code and on the tags printed. A version the
script must refuse is checked for a non-zero exit and an empty stdout: a tag
printed before a failure would be published.
"""

import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "image_tags.py"


def run(*args: str) -> subprocess.CompletedProcess:
	return subprocess.run(
		[sys.executable, "-I", str(SCRIPT), *args],
		capture_output=True,
		text=True,
		check=False,
	)


class PublishedTags(unittest.TestCase):
	def test_a_plain_version_publishes_exact_minor_and_major(self) -> None:
		result = run("v0.9.0")
		self.assertEqual(result.returncode, 0)
		self.assertEqual(result.stdout.split(), ["0.9.0", "0.9", "0"])

	def test_the_leading_v_is_optional(self) -> None:
		self.assertEqual(run("1.2.3").stdout.split(), ["1.2.3", "1.2", "1"])

	def test_multi_digit_components_stay_whole(self) -> None:
		self.assertEqual(run("v10.20.30").stdout.split(), ["10.20.30", "10.20", "10"])

	def test_zero_components_are_valid(self) -> None:
		self.assertEqual(run("v0.0.0").stdout.split(), ["0.0.0", "0.0", "0"])


class RefusedVersions(unittest.TestCase):
	def assert_refused(self, version: str) -> None:
		result = run(version)
		self.assertNotEqual(result.returncode, 0, version)
		self.assertEqual(result.stdout, "", f"{version} printed a tag before failing")
		self.assertIn("::error::", result.stderr)

	def test_a_leading_zero_is_refused(self) -> None:
		for version in ("v1.02.0", "v1.0.09", "v01.0.0"):
			with self.subTest(version=version):
				self.assert_refused(version)

	def test_a_pre_release_is_refused(self) -> None:
		for version in ("v1.0.0-rc.1", "1.0.0-rc", "v0.9.0-0"):
			with self.subTest(version=version):
				self.assert_refused(version)

	def test_a_malformed_version_is_refused(self) -> None:
		for version in ("", "v1", "v1.2", "v1.2.3.4", "v1x.2.3", "vv1.2.3", "v1.2.3 ", "latest", "v1.2.3+build"):
			with self.subTest(version=version):
				self.assert_refused(version)

	def test_the_wrong_number_of_arguments_is_refused(self) -> None:
		for args in ((), ("v1.0.0", "v1.0.1")):
			with self.subTest(args=args):
				result = run(*args)
				self.assertNotEqual(result.returncode, 0)
				self.assertEqual(result.stdout, "")


if __name__ == "__main__":
	unittest.main()

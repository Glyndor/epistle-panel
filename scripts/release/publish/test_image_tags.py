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
import tempfile
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


class FloatingTagsDoNotGoBack(unittest.TestCase):
	"""Attack: rerun `images-only` for an old version once a newer one is published."""

	def tags(self, version: str, published: str) -> list[str]:
		with tempfile.TemporaryDirectory() as tmp:
			listing = Path(tmp) / "published"
			listing.write_text(published)
			result = run(version, "--published", str(listing))
		self.assertEqual(result.returncode, 0, result.stderr)
		return result.stdout.split()

	def test_the_highest_patch_of_a_minor_moves_the_minor_and_the_major_when_it_is_the_highest_of_both(self) -> None:
		self.assertEqual(self.tags("v0.3.1", "v0.3.0\nv0.3.1\nv0.2.5\n"), ["0.3.1", "0.3", "0"])

	def test_an_old_patch_leaves_the_minor_and_the_major_where_they_are(self) -> None:
		self.assertEqual(self.tags("v0.3.0", "v0.3.0\nv0.3.1\n"), ["0.3.0"])

	def test_an_old_minor_leaves_the_major_alone_but_moves_its_own_minor(self) -> None:
		self.assertEqual(self.tags("v0.2.9", "v0.2.9\nv0.3.0\n"), ["0.2.9", "0.2"])

	def test_a_new_major_does_not_move_the_old_one(self) -> None:
		self.assertEqual(self.tags("v1.0.0", "v0.9.9\nv1.0.0\n"), ["1.0.0", "1.0", "1"])
		self.assertEqual(self.tags("v0.9.9", "v0.9.9\nv1.0.0\n"), ["0.9.9", "0.9", "0"])

	def test_versions_are_compared_as_numbers_not_as_text(self) -> None:
		self.assertEqual(self.tags("v0.9.0", "v0.9.0\nv0.10.0\n"), ["0.9.0", "0.9"])
		self.assertEqual(self.tags("v0.3.9", "v0.3.9\nv0.3.10\n"), ["0.3.9"])

	def test_lines_that_are_not_versions_are_ignored(self) -> None:
		self.assertEqual(self.tags("v0.3.0", "v0.3.0\nv0.4.0-rc.1\nlatest\n\n"), ["0.3.0", "0.3", "0"])

	def test_the_version_itself_need_not_be_in_the_list(self) -> None:
		self.assertEqual(self.tags("v0.3.2", ""), ["0.3.2", "0.3", "0"])

	def test_without_a_list_nothing_is_left_out(self) -> None:
		self.assertEqual(run("v0.3.0").stdout.split(), ["0.3.0", "0.3", "0"])

	def test_an_unreadable_list_stops_everything(self) -> None:
		result = run("v0.3.0", "--published", "/nonexistent/list")
		self.assertNotEqual(result.returncode, 0)
		self.assertEqual(result.stdout, "")


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

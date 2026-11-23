#!/usr/bin/env python3
"""Tests for `scripts/release/sign/verify_signatures.py` and the pinned key.

Run from the repository root with an interpreter that has `cryptography`:

	python3 -I -m unittest discover -s scripts/release/sign -p 'test_*.py' -v

The last check of a release verifies every signature against the key that is pinned in
the repository. Each test is an attack on it: a signature that is only a non-empty file,
a signature by another key, a signature of other bytes, one missing, one extra.
"""

import base64
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

SIGN_DIR = Path(__file__).resolve().parent
SCRIPT = SIGN_DIR / "verify_signatures.py"
PINNED = SIGN_DIR / "release-verify-key.b64"
TAG = "v0.3.0"
DEB = "epistle-panel_0.3.0_all.deb"
SBOM = "epistle-panel-v0.3.0.cdx.json"
SIGNED = (DEB, SBOM, "SHA256SUMS")
KEY = Ed25519PrivateKey.from_private_bytes(bytes(range(32)))
OTHER = Ed25519PrivateKey.from_private_bytes(bytes(range(1, 33)))


def b64(key: Ed25519PrivateKey) -> str:
	return base64.b64encode(key.public_key().public_bytes_raw()).decode().rstrip("=") + "\n"


class Verify(unittest.TestCase):
	def setUp(self) -> None:
		tmp = tempfile.TemporaryDirectory()
		self.addCleanup(tmp.cleanup)
		self.tmp = Path(tmp.name)
		self.dist = self.tmp / "dist"
		self.dist.mkdir()
		for name in SIGNED:
			(self.dist / name).write_bytes(f"content of {name}\n".encode())
			(self.dist / f"{name}.sig").write_bytes(KEY.sign((self.dist / name).read_bytes()))
		self.pub = self.tmp / "key.b64"
		self.pub.write_text(b64(KEY))

	def run_script(self, pub: Path | None = None) -> subprocess.CompletedProcess:
		return subprocess.run([sys.executable, "-I", str(SCRIPT), str(self.dist), TAG, str(pub or self.pub)], capture_output=True, text=True, check=False)

	def test_good_signatures_pass(self) -> None:
		result = self.run_script()
		self.assertEqual(result.returncode, 0, result.stderr)

	def test_a_signature_that_is_only_a_non_empty_file_is_refused(self) -> None:
		"""The old last check: `sig` in a file was a signature."""
		(self.dist / f"{DEB}.sig").write_bytes(b"sig\n")
		result = self.run_script()
		self.assertEqual(result.returncode, 1)
		self.assertIn("an Ed25519 signature is 64", result.stderr)

	def test_a_signature_of_the_right_size_that_does_not_verify_is_refused(self) -> None:
		(self.dist / f"{SBOM}.sig").write_bytes(b"\0" * 64)
		self.assertEqual(self.run_script().returncode, 1)

	def test_a_signature_by_another_key_is_refused(self) -> None:
		"""Attack: a substituted artifact that carries its own key's signatures."""
		(self.dist / "SHA256SUMS.sig").write_bytes(OTHER.sign((self.dist / "SHA256SUMS").read_bytes()))
		self.assertEqual(self.run_script().returncode, 1)

	def test_a_file_changed_after_signing_is_refused(self) -> None:
		(self.dist / DEB).write_bytes(b"another package\n")
		self.assertEqual(self.run_script().returncode, 1)

	def test_the_files_signed_with_the_wrong_pinned_key_are_refused(self) -> None:
		self.pub.write_text(b64(OTHER))
		self.assertEqual(self.run_script().returncode, 1)

	def test_a_missing_or_an_extra_signature_is_refused(self) -> None:
		(self.dist / f"{SBOM}.sig").unlink()
		self.assertEqual(self.run_script().returncode, 1)
		(self.dist / f"{SBOM}.sig").write_bytes(KEY.sign((self.dist / SBOM).read_bytes()))
		(self.dist / "extra.sig").write_bytes(KEY.sign(b"x"))
		self.assertEqual(self.run_script().returncode, 1)

	def test_a_symlink_in_place_of_a_signature_is_refused(self) -> None:
		target = self.tmp / "elsewhere.sig"
		target.write_bytes((self.dist / f"{DEB}.sig").read_bytes())
		(self.dist / f"{DEB}.sig").unlink()
		(self.dist / f"{DEB}.sig").symlink_to(target)
		self.assertEqual(self.run_script().returncode, 1)

	def test_a_key_file_that_is_not_one_key_is_refused(self) -> None:
		for content in ("", "not base64!!\n", base64.b64encode(b"short").decode() + "\n", b64(KEY) + b64(OTHER)):
			with self.subTest(content=content):
				self.pub.write_text(content)
				self.assertEqual(self.run_script().returncode, 1)
		self.pub.write_text("# the release key\n\n" + b64(KEY))
		self.assertEqual(self.run_script().returncode, 0)


class ThePinnedKey(unittest.TestCase):
	def test_it_is_the_public_key_of_the_organisation(self) -> None:
		"""A change of the pinned key has to change this test too, in the same reviewed change."""
		self.assertEqual(PINNED.read_text(), "HFv7vg5FCY7YyKUDbJhaQSfB9SboJGSblJtFbLmLHzM\n")
		raw = base64.b64decode(PINNED.read_text().strip() + "=", validate=True)
		self.assertEqual(len(raw), 32)

	def test_the_public_half_of_a_key_is_printed_in_the_form_of_the_pinned_file(self) -> None:
		seed = base64.b64encode(bytes(range(32))).decode()
		done = subprocess.run([sys.executable, "-I", str(SIGN_DIR / "sign_file.py"), "--public"], capture_output=True, text=True, check=False, env={"GLYNDOR_RELEASE_ED25519_KEY": seed})
		self.assertEqual(done.returncode, 0, done.stderr)
		self.assertEqual(done.stdout, b64(KEY))


if __name__ == "__main__":
	unittest.main()

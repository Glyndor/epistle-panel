#!/usr/bin/env python3
"""Tests for `scripts/release/sign/sign-release.sh`.

Run from the repository root with an interpreter that has `cryptography`:

	python3 -I -m unittest discover -s scripts/release/sign -p 'test_*.py' -v

The script is run for real, so these tests build its virtualenv from the
hash-pinned `sign-requirements.txt` and need the package index. What they
check is what the apt archive relies on: SHA256SUMS names exactly the two
payload files, every file and SHA256SUMS carry a signature that verifies, and
nothing is signed when the key is missing or when a pinned hash does not match.
"""

import base64
import hashlib
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

SIGN_DIR = Path(__file__).resolve().parent
SEED = bytes(range(32))
KEY = base64.b64encode(SEED).decode()
TAG = "v0.3.0"
DEB = "epistle-panel_0.3.0_all.deb"
SBOM = "epistle-panel-v0.3.0.cdx.json"


def run_script(script: Path, dist: Path, key: str | None) -> subprocess.CompletedProcess:
	env = {k: v for k, v in os.environ.items() if k != "GLYNDOR_RELEASE_ED25519_KEY"}
	if key is not None:
		env["GLYNDOR_RELEASE_ED25519_KEY"] = key
	return subprocess.run(
		["bash", str(script), str(dist), TAG], capture_output=True, text=True, env=env, check=False
	)


class SignRelease(unittest.TestCase):
	def setUp(self) -> None:
		tmp = tempfile.TemporaryDirectory()
		self.addCleanup(tmp.cleanup)
		self.dist = Path(tmp.name) / "dist"
		self.dist.mkdir()
		(self.dist / DEB).write_bytes(b"deb bytes\n")
		(self.dist / SBOM).write_bytes(b'{"bomFormat": "CycloneDX"}\n')
		self.tmp = Path(tmp.name)
		self.public = Ed25519PrivateKey.from_private_bytes(SEED).public_key()

	def names(self) -> set[str]:
		return {p.name for p in self.dist.iterdir()}

	def test_every_file_and_the_checksums_are_signed_and_verify(self) -> None:
		result = run_script(SIGN_DIR / "sign-release.sh", self.dist, KEY)
		self.assertEqual(result.returncode, 0, result.stderr)
		self.assertEqual(
			self.names(),
			{DEB, SBOM, "SHA256SUMS", f"{DEB}.sig", f"{SBOM}.sig", "SHA256SUMS.sig"},
		)
		for name in (DEB, SBOM, "SHA256SUMS"):
			self.public.verify((self.dist / f"{name}.sig").read_bytes(), (self.dist / name).read_bytes())

	def test_the_checksums_name_the_payload_and_nothing_else(self) -> None:
		run_script(SIGN_DIR / "sign-release.sh", self.dist, KEY)
		lines = (self.dist / "SHA256SUMS").read_text().splitlines()
		listed = {}
		for line in lines:
			match = re.fullmatch(r"([0-9a-f]{64})[ *]+(\S+)", line)
			self.assertIsNotNone(match, line)
			listed[match.group(2)] = match.group(1)
		self.assertEqual(set(listed), {DEB, SBOM})
		for name, digest in listed.items():
			self.assertEqual(hashlib.sha256((self.dist / name).read_bytes()).hexdigest(), digest)

	def test_a_file_changed_after_signing_fails_both_checks(self) -> None:
		run_script(SIGN_DIR / "sign-release.sh", self.dist, KEY)
		(self.dist / DEB).write_bytes(b"deb bytes, tampered\n")
		with self.assertRaises(InvalidSignature):
			self.public.verify((self.dist / f"{DEB}.sig").read_bytes(), (self.dist / DEB).read_bytes())
		check = subprocess.run(
			["sha256sum", "--check", "--strict", "SHA256SUMS"], cwd=self.dist, capture_output=True, check=False
		)
		self.assertNotEqual(check.returncode, 0)

	def test_without_a_key_nothing_is_written(self) -> None:
		for key in (None, ""):
			with self.subTest(key=key):
				result = run_script(SIGN_DIR / "sign-release.sh", self.dist, key)
				self.assertEqual(result.returncode, 1)
				self.assertIn("no signing key", result.stderr)
				self.assertEqual(self.names(), {DEB, SBOM})

	def test_a_requirement_whose_hash_does_not_match_stops_the_signing(self) -> None:
		copy = self.tmp / "sign"
		shutil.copytree(SIGN_DIR, copy)
		requirements = copy / "sign-requirements.txt"
		text = requirements.read_text()
		# Replace every pinned hash of one package with a hash that is not its own.
		altered = re.sub(r"--hash=sha256:[0-9a-f]{64}", "--hash=sha256:" + "0" * 64, text)
		self.assertNotEqual(altered, text)
		requirements.write_text(altered)
		result = run_script(copy / "sign-release.sh", self.dist, KEY)
		self.assertNotEqual(result.returncode, 0)
		self.assertIn("hash", result.stderr.lower())
		self.assertEqual(self.names(), {DEB, SBOM})


if __name__ == "__main__":
	unittest.main()

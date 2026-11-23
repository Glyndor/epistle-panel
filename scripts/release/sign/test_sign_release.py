#!/usr/bin/env python3
"""Tests for `scripts/release/sign/prepare-signer.sh` and `sign-release.sh`.

Run from the repository root with an interpreter that has `cryptography`:

	python3 -I -m unittest discover -s scripts/release/sign -p 'test_*.py' -v

The signer is made for real from the hash-pinned `sign-requirements.txt`, so these tests
need the package index. What they check is what the apt archive relies on: SHA256SUMS
names exactly the two payload files, every file and SHA256SUMS carry a signature that
verifies under the public key given, and nothing is signed when the key is missing or when
a pinned hash does not match; and what the review of the release asked for: no installer
runs with the key in its environment, and the signing step installs nothing.
"""

import base64
import hashlib
import os
import re
import shutil
import stat
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


def environment(key: str | None) -> dict:
	env = {k: v for k, v in os.environ.items() if k != "GLYNDOR_RELEASE_ED25519_KEY"}
	if key is not None:
		env["GLYNDOR_RELEASE_ED25519_KEY"] = key
	return env


def prepare(script_dir: Path, target: Path, key: str | None = None) -> subprocess.CompletedProcess:
	return subprocess.run(
		["bash", str(script_dir / "prepare-signer.sh"), str(target)],
		capture_output=True, text=True, env=environment(key), check=False,
	)


def sign(script_dir: Path, dist: Path, signer: Path, public: Path, key: str | None) -> subprocess.CompletedProcess:
	return subprocess.run(
		["bash", str(script_dir / "sign-release.sh"), str(dist), TAG, str(signer), str(public)],
		capture_output=True, text=True, env=environment(key), check=False,
	)


class Signing(unittest.TestCase):
	@classmethod
	def setUpClass(cls) -> None:
		cls.shared = tempfile.TemporaryDirectory()
		cls.signer = Path(cls.shared.name) / "signer"
		result = prepare(SIGN_DIR, cls.signer)
		assert result.returncode == 0, result.stderr
		cls.public_file = Path(cls.shared.name) / "public.b64"
		public = Ed25519PrivateKey.from_private_bytes(SEED).public_key().public_bytes_raw()
		cls.public_file.write_text(base64.b64encode(public).decode().rstrip("=") + "\n")

	@classmethod
	def tearDownClass(cls) -> None:
		cls.shared.cleanup()

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
		result = sign(SIGN_DIR, self.dist, self.signer, self.public_file, KEY)
		self.assertEqual(result.returncode, 0, result.stderr)
		self.assertEqual(
			self.names(),
			{DEB, SBOM, "SHA256SUMS", f"{DEB}.sig", f"{SBOM}.sig", "SHA256SUMS.sig"},
		)
		for name in (DEB, SBOM, "SHA256SUMS"):
			self.public.verify((self.dist / f"{name}.sig").read_bytes(), (self.dist / name).read_bytes())

	def test_the_checksums_name_the_payload_and_nothing_else(self) -> None:
		sign(SIGN_DIR, self.dist, self.signer, self.public_file, KEY)
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
		sign(SIGN_DIR, self.dist, self.signer, self.public_file, KEY)
		(self.dist / DEB).write_bytes(b"deb bytes, tampered\n")
		with self.assertRaises(InvalidSignature):
			self.public.verify((self.dist / f"{DEB}.sig").read_bytes(), (self.dist / DEB).read_bytes())
		check = subprocess.run(["sha256sum", "--check", "--strict", "SHA256SUMS"], cwd=self.dist, capture_output=True, check=False)
		self.assertNotEqual(check.returncode, 0)

	def test_without_a_key_nothing_is_written(self) -> None:
		for key in (None, ""):
			with self.subTest(key=key):
				result = sign(SIGN_DIR, self.dist, self.signer, self.public_file, key)
				self.assertEqual(result.returncode, 1)
				self.assertIn("no signing key", result.stderr)
				self.assertEqual(self.names(), {DEB, SBOM})

	def test_a_key_that_is_not_the_one_the_files_are_checked_against_stops_the_release(self) -> None:
		"""Attack: a secret that holds another key than the pinned one signs files nobody trusts."""
		other = base64.b64encode(bytes(range(1, 33))).decode()
		result = sign(SIGN_DIR, self.dist, self.signer, self.public_file, other)
		self.assertEqual(result.returncode, 1)
		self.assertIn("does not verify under the pinned key", result.stderr)

	def test_the_signing_runs_no_installer_and_no_module(self) -> None:
		"""Attack: pip, or a module, run with the key in the environment and the files as cwd."""
		fake = self.tmp / "fake-signer"
		(fake / "bin").mkdir(parents=True)
		log = self.tmp / "calls"
		python = fake / "bin" / "python"
		python.write_text(f'#!/bin/sh\nprintf \'%s|%s\\n\' "$*" "$PWD" >> {log}\nexit 0\n')
		python.chmod(python.stat().st_mode | stat.S_IEXEC)
		result = sign(SIGN_DIR, self.dist, fake, self.public_file, KEY)
		self.assertEqual(result.returncode, 0, result.stderr)
		calls = log.read_text().splitlines()
		self.assertEqual(len(calls), 4, calls)
		for call in calls:
			arguments = call.split("|")[0].split()
			self.assertEqual(arguments[0], "-I", call)
			self.assertNotIn("-m", arguments, call)
			self.assertNotIn("pip", call)
			self.assertTrue(arguments[1].endswith((".py")), call)
			self.assertNotEqual(Path(call.split("|")[1]).resolve(), self.dist.resolve(), "the artifacts are not the working directory")
		code = "\n".join(line for line in (SIGN_DIR / "sign-release.sh").read_text().splitlines() if not line.lstrip().startswith("#"))
		self.assertNotRegex(code, r"\bpip\b|\bvenv\b|install")

	def test_a_signer_that_was_not_prepared_stops_the_signing(self) -> None:
		result = sign(SIGN_DIR, self.dist, self.tmp / "nowhere", self.public_file, KEY)
		self.assertEqual(result.returncode, 1)
		self.assertEqual(self.names(), {DEB, SBOM})


class PreparingTheSigner(unittest.TestCase):
	def setUp(self) -> None:
		tmp = tempfile.TemporaryDirectory()
		self.addCleanup(tmp.cleanup)
		self.tmp = Path(tmp.name)

	def test_a_key_in_the_environment_stops_the_installation_before_anything_is_made(self) -> None:
		"""Attack: the installer, or what it builds, runs with the signing key in its environment."""
		result = prepare(SIGN_DIR, self.tmp / "signer", KEY)
		self.assertEqual(result.returncode, 1)
		self.assertIn("signing key is in the environment", result.stderr)
		self.assertFalse((self.tmp / "signer").exists())

	def test_the_installer_takes_wheels_only_and_resolves_nothing(self) -> None:
		text = (SIGN_DIR / "prepare-signer.sh").read_text()
		for flag in ("--only-binary=:all:", "--no-deps", "--require-hashes"):
			self.assertIn(flag, text)
		self.assertIn("-I -m pip", text)

	def test_a_directory_that_exists_is_refused(self) -> None:
		(self.tmp / "signer").mkdir()
		result = prepare(SIGN_DIR, self.tmp / "signer")
		self.assertEqual(result.returncode, 1)

	def test_a_requirement_whose_hash_does_not_match_stops_the_installation(self) -> None:
		copy = self.tmp / "sign"
		shutil.copytree(SIGN_DIR, copy)
		requirements = copy / "sign-requirements.txt"
		text = requirements.read_text()
		altered = re.sub(r"--hash=sha256:[0-9a-f]{64}", "--hash=sha256:" + "0" * 64, text)
		self.assertNotEqual(altered, text)
		requirements.write_text(altered)
		result = prepare(copy, self.tmp / "signer")
		self.assertNotEqual(result.returncode, 0)
		self.assertIn("hash", result.stderr.lower())


if __name__ == "__main__":
	unittest.main()

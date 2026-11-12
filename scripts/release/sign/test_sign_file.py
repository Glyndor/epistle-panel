#!/usr/bin/env python3
"""Tests for `scripts/release/sign/sign_file.py`.

Run from the repository root with an interpreter that has `cryptography`, the
one the hash-pinned `sign-requirements.txt` installs:

	python3 -I -m unittest discover -s scripts/release/sign -p 'test_*.py' -v

The script is run as a command with the key in the environment, the way
`sign-release.sh` runs it, and each signature is checked with the public key.
A refused key is checked for a non-zero exit and for no signature file left
behind: a half-written `.sig` next to a release file would be taken for a
signature.
"""

import base64
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

SCRIPT = Path(__file__).resolve().parent / "sign_file.py"
SEED = bytes(range(32))
KEY = base64.b64encode(SEED).decode()


def run(args: list[str], key: str | None) -> subprocess.CompletedProcess:
	env = {k: v for k, v in os.environ.items() if k != "GLYNDOR_RELEASE_ED25519_KEY"}
	if key is not None:
		env["GLYNDOR_RELEASE_ED25519_KEY"] = key
	return subprocess.run(
		[sys.executable, "-I", str(SCRIPT), *args], capture_output=True, text=True, env=env, check=False
	)


class SignFile(unittest.TestCase):
	def setUp(self) -> None:
		self.tmp = tempfile.TemporaryDirectory()
		self.addCleanup(self.tmp.cleanup)
		self.file = Path(self.tmp.name) / "payload.deb"
		self.file.write_bytes(b"release bytes\n")
		self.sig = Path(str(self.file) + ".sig")
		self.public = Ed25519PrivateKey.from_private_bytes(SEED).public_key()

	def test_the_signature_verifies_with_the_public_key(self) -> None:
		result = run([str(self.file)], KEY)
		self.assertEqual(result.returncode, 0, result.stderr)
		self.public.verify(self.sig.read_bytes(), self.file.read_bytes())

	def test_a_changed_file_no_longer_verifies(self) -> None:
		run([str(self.file)], KEY)
		self.file.write_bytes(b"release bytes, tampered\n")
		with self.assertRaises(InvalidSignature):
			self.public.verify(self.sig.read_bytes(), self.file.read_bytes())

	def test_another_key_does_not_verify(self) -> None:
		run([str(self.file)], KEY)
		other = Ed25519PrivateKey.from_private_bytes(bytes(reversed(SEED))).public_key()
		with self.assertRaises(InvalidSignature):
			other.verify(self.sig.read_bytes(), self.file.read_bytes())

	def test_an_explicit_output_path_is_used(self) -> None:
		out = Path(self.tmp.name) / "elsewhere.sig"
		self.assertEqual(run([str(self.file), str(out)], KEY).returncode, 0)
		self.assertTrue(out.exists())
		self.assertFalse(self.sig.exists())

	def test_a_secret_store_newline_and_missing_padding_sign_with_the_same_key(self) -> None:
		run([str(self.file)], KEY)
		expected = self.sig.read_bytes()
		for variant in (KEY + "\n", "  " + KEY + " \r\n", KEY.rstrip("=")):
			with self.subTest(variant=repr(variant)):
				self.sig.unlink()
				self.assertEqual(run([str(self.file)], variant).returncode, 0)
				self.assertEqual(self.sig.read_bytes(), expected)

	def assert_refused(self, key: str | None, message: str = "") -> None:
		result = run([str(self.file)], key)
		self.assertNotEqual(result.returncode, 0)
		self.assertIn(message, result.stderr)
		self.assertNotIn("Traceback", result.stderr)
		self.assertFalse(self.sig.exists(), "a signature file was left behind")

	def test_a_missing_or_empty_key_is_refused(self) -> None:
		for key in (None, "", "   "):
			with self.subTest(key=key):
				self.assert_refused(key, "GLYNDOR_RELEASE_ED25519_KEY")

	def test_a_key_with_a_stray_character_inside_is_refused(self) -> None:
		# Four of them keep the length a multiple of four, so a lenient decoder
		# skips them and signs with the right key, without a word.
		for stray in ("\n", " ", "!"):
			with self.subTest(stray=repr(stray)):
				self.assert_refused(KEY[:20] + stray * 4 + KEY[20:], "not valid base64")

	def test_a_key_of_the_wrong_length_is_refused(self) -> None:
		for size in (16, 31, 33, 64):
			with self.subTest(size=size):
				self.assert_refused(base64.b64encode(bytes(size)).decode(), "exactly 32 bytes")

	def test_the_key_is_never_printed(self) -> None:
		for key in (KEY, KEY[:20] + "!!!!" + KEY[20:]):
			result = run([str(self.file)], key)
			self.assertNotIn(key, result.stdout + result.stderr)

	def test_a_missing_input_file_is_refused(self) -> None:
		result = run([str(self.file) + ".missing"], KEY)
		self.assertNotEqual(result.returncode, 0)

	def test_no_arguments_is_refused(self) -> None:
		self.assertNotEqual(run([], KEY).returncode, 0)


if __name__ == "__main__":
	unittest.main()

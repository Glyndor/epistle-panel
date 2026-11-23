#!/usr/bin/env python3
"""Check every signature of a release directory against one public key.

Usage:
  verify_signatures.py <dist-dir> <tag> <public-key-file>

The directory has to hold exactly the three signed files (the package, the SBOM and
SHA256SUMS) and one .sig for each, and each signature has to verify under the key of
the file. A file that is not there, a signature that is not there or does not verify, a
signature of a file that is not signed and a key that is not 32 bytes all fail. The
public key file holds one base64 line; blank lines and lines that start with # are
skipped.
"""
import base64
import binascii
import os
import sys

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


def die(message: str) -> None:
	print(f"::error::{message}", file=sys.stderr)
	sys.exit(1)


def read_key(path: str) -> Ed25519PublicKey:
	with open(path, encoding="ascii") as handle:
		lines = [line.strip() for line in handle if line.strip() and not line.lstrip().startswith("#")]
	if len(lines) != 1:
		die(f"{path} has to hold exactly one key line, it holds {len(lines)}")
	text = lines[0]
	try:
		raw = base64.b64decode(text + "=" * (-len(text) % 4), validate=True)
	except (binascii.Error, ValueError) as exc:
		die(f"{path} is not valid base64: {exc}")
	if len(raw) != 32:
		die(f"{path} decodes to {len(raw)} bytes; an Ed25519 public key is 32")
	return Ed25519PublicKey.from_public_bytes(raw)


def main(argv: list[str]) -> None:
	if len(argv) != 3:
		print(__doc__, file=sys.stderr)
		sys.exit(2)
	dist, tag, key_file = argv
	version = tag[1:] if tag.startswith("v") else tag
	key = read_key(key_file)
	signed = [f"epistle-panel_{version}_all.deb", f"epistle-panel-{tag}.cdx.json", "SHA256SUMS"]
	present = sorted(name for name in os.listdir(dist) if name.endswith(".sig"))
	if present != sorted(f"{name}.sig" for name in signed):
		die(f"the signatures are not exactly the expected set: {present}")
	for name in signed:
		path = os.path.join(dist, name)
		sig_path = path + ".sig"
		for each in (path, sig_path):
			if os.path.islink(each) or not os.path.isfile(each):
				die(f"{each} is not a regular file")
		with open(path, "rb") as handle:
			data = handle.read()
		with open(sig_path, "rb") as handle:
			sig = handle.read()
		if len(sig) != 64:
			die(f"{name}.sig is {len(sig)} bytes; an Ed25519 signature is 64")
		try:
			key.verify(sig, data)
		except InvalidSignature:
			die(f"{name}.sig does not verify under the pinned key")
		print(f"{name}: signature verifies")


if __name__ == "__main__":
	main(sys.argv[1:])

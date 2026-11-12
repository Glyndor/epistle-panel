# Verifying a release

A published release carries build provenance attestations for the package and the image. No release has been published yet, so replace `<version>` with the version of a release that exists:

```sh
gh attestation verify epistle-panel_<version>_all.deb --repo Glyndor/epistle-panel
gh attestation verify oci://ghcr.io/glyndor/epistle-panel:<version> --repo Glyndor/epistle-panel
```

Each file also has a detached Ed25519 signature over its bytes, made with the org release key. `SHA256SUMS` lists the package and the SBOM, so `sha256sum --check SHA256SUMS` confirms the downloaded files match it.

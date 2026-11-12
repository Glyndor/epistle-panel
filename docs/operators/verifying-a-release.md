# Verifying a release

The package and the image carry build provenance attestations:

```sh
gh attestation verify epistle-panel_0.2.0_all.deb --repo Glyndor/epistle-panel
gh attestation verify oci://ghcr.io/glyndor/epistle-panel:0.2.0 --repo Glyndor/epistle-panel
```

Each file also has a detached Ed25519 signature over its bytes, made with the org release key. `SHA256SUMS` lists the package and the SBOM, so `sha256sum --check SHA256SUMS` confirms the downloaded files match it.

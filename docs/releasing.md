# Releasing

A release publishes two things: the Debian package `epistle-panel_<version>_all.deb`, which the Glyndor apt archive picks up, and the container image `ghcr.io/glyndor/epistle-panel`. Both come from one tag. `.github/workflows/release.yml` does the work; this page is the part a person does.

## Procedure

1. Choose the version, `MAJOR.MINOR.PATCH`. Pre-release tags are not covered here.
2. On a branch from `develop`, set the same version in `internal/package.json` and in the top entry of `debian/changelog`. The workflow refuses to run when the tag and these two files disagree, because the package version is read from the changelog alone.
3. Merge that into `develop`, then open the release pull request `develop` to `main` and merge it with a merge commit. Only commits reachable from `main` can be released.
4. Create a signed tag on the `main` commit and push it:

   ```sh
   git tag -s v0.2.0 <commit-on-main> -m "v0.2.0"
   git push origin v0.2.0
   ```

The tag push starts the workflow. Nothing else starts a release.

## What the workflow does

| Job | What it does |
| --- | --- |
| `verify` | Resolves the tag to one commit, checks it is reachable from `main`, checks tag, `package.json` and `debian/changelog` agree, runs `bun audit`, and refuses a tag that already has a release |
| `build-deb` | Builds the package with `dpkg-buildpackage`, checks its `Package`, `Version` and `Architecture` fields, and attests its provenance |
| `sbom` | Writes a CycloneDX SBOM of the runtime dependencies from `internal/bun.lock` |
| `sign` | Writes `SHA256SUMS` and signs the package, the SBOM and `SHA256SUMS` with the org Ed25519 key |
| `publish` | Creates the GitHub Release with generated notes and the files above |
| `image-build` | Builds the image on amd64 and arm64 runners and pushes `<version>-amd64` and `<version>-arm64` |
| `image-manifest` | Joins them into one manifest list, tags it `<version>`, `<major>.<minor>` and `<major>`, and attests it |

The release assets are `epistle-panel_<version>_all.deb`, `epistle-panel-v<version>.cdx.json`, `SHA256SUMS`, and one `.sig` for each of those three files. The image is pushed after the release is created, so a failed release leaves no image behind.

The release audit fails on any advisory in `bun.lock`, development dependencies included. An advisory that does not apply is ignored with `bun audit --ignore=<id>` in the workflow, with the reason written beside it.

## Re-running and rehearsing

Releases are immutable. A mistake is fixed with a new patch version, never by moving the tag or replacing assets.

`workflow_dispatch` takes the tag and two options:

- `images-only` rebuilds and pushes only the image, for a tag whose release is already published.
- `dry-run` builds and signs everything with a throwaway key, builds the image without pushing it, and stops before anything is published.

## Verifying a release

The package and the image carry build provenance attestations:

```sh
gh attestation verify epistle-panel_0.2.0_all.deb --repo Glyndor/epistle-panel
gh attestation verify oci://ghcr.io/glyndor/epistle-panel:0.2.0 --repo Glyndor/epistle-panel
```

Each file also has a detached Ed25519 signature over its bytes, made with the org release key. `SHA256SUMS` lists the package and the SBOM, so `sha256sum --check SHA256SUMS` confirms the downloaded files match it.

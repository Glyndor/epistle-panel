# Releasing

A release publishes two things: the Debian package `epistle-panel_<version>_all.deb`, which the Glyndor apt archive picks up, and the container image `ghcr.io/glyndor/epistle-panel`. Both come from one tag. `.github/workflows/release.yml` does the work; this page is the part a person does.

## Procedure

1. Choose the version, `MAJOR.MINOR.PATCH`, with no leading zeros. Pre-release tags are not supported: `verify` and `scripts/release/publish/image_tags.py` refuse them.
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
| `build-deb` | Builds the package with `scripts/debian/build.sh`, the clean container build the Debian package workflow runs, which also runs `lintian --fail-on error,warning` on the file produced; checks its `Package`, `Version` and `Architecture` fields, and attests its provenance |
| `sbom` | Writes a CycloneDX SBOM of the runtime dependencies from `internal/bun.lock` |
| `sign` | Writes `SHA256SUMS` and signs the package, the SBOM and `SHA256SUMS` with the org Ed25519 key |
| `publish` | Creates the GitHub Release with generated notes and the files above |
| `image-build` | Builds the image on amd64 and arm64 runners and pushes `<version>-amd64` and `<version>-arm64`, which are build intermediates: only the manifest list is attested and meant to be pulled, and they are not deleted because the registry would remove the images the list points at |
| `image-manifest` | Joins them into one manifest list, tags it `<version>`, `<major>.<minor>` and `<major>`, and attests it |

The release assets are `epistle-panel_<version>_all.deb`, `epistle-panel-v<version>.cdx.json`, `SHA256SUMS`, and one `.sig` for each of those three files. The image is pushed after the release is created, so a failed release leaves no image behind.

The release audit fails on any advisory in `bun.lock`, development dependencies included. An advisory that does not apply is ignored with `bun audit --ignore=<id>` in the workflow, with the reason written beside it.

## Re-running and rehearsing

Releases are immutable. A mistake is fixed with a new patch version, never by moving the tag or replacing assets.

`workflow_dispatch` takes the tag and two options:

- `images-only` rebuilds and pushes only the image, for a tag whose release is already published.
- `dry-run` builds and signs everything with a throwaway key, builds the image without pushing it, publishes a manifest list of two stand-in images to a throwaway registry on the runner (`scripts/release/publish/rehearse-manifest.sh`, which runs `publish-manifest.sh` unchanged), and stops before anything is published. It makes no provenance attestation. The one step it cannot cover is `gh release create`, which would create a real release.

Start a manual run from the tag itself (Use workflow from: the tag, not a branch). Every job builds the commit the run is on, and `verify` refuses a run whose commit is not the one the tag names.

## Scripts

The workflow calls these, each with an explicit interpreter, and they can be run by hand from the repository root:

| Folder | What it holds |
| --- | --- |
| `scripts/release/version/` | `check_release_tag.py` (tag, `package.json` and `debian/changelog` agree) and `check-changelog.sh` (the same without a tag, run by the Debian package workflow) |
| `scripts/release/verify/` | `check-files.sh`, the allowlist of files a release directory may hold at each stage |
| `scripts/release/sbom/` | `cyclonedx.ts`, the SBOM writer |
| `scripts/release/sign/` | `sign-release.sh`, `sign_file.py` and the hash-pinned `sign-requirements.txt` |
| `scripts/release/publish/` | `publish-manifest.sh` and `image_tags.py`, which decides the image tags |
| `scripts/debian/` | `build.sh` and `smoke.sh` (with `smoke-inner.sh`), which build, lint and smoke-test the package in a clean Debian container |

`build.sh` reads `BUILD_IMAGE` and `smoke.sh` reads `SMOKE_IMAGE` to replace the Debian image, `docker.io/library/debian:trixie` by default.

A consumer checks a published release as described in [Verifying a release](../operators/verifying-a-release.md).

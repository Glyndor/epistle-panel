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
| `verify` | Resolves the tag to one commit, checks it is reachable from `main`, checks tag, `package.json` and `debian/changelog` agree, runs `bun audit`, and refuses a tag that already has a published release. For `images-only` it asks for the opposite: a published release, not a draft, that carries the package |
| `build-deb` | Builds the package with `scripts/debian/build.sh`, the clean container build the Debian package workflow runs, which also runs `lintian --fail-on error,warning` on the file produced; checks its `Package`, `Version` and `Architecture` fields. It holds `contents: read` and nothing else |
| `attest-deb` | Receives the package into a folder of its own, checks it is the one regular file expected, attests its provenance and reports its SHA-256. A rehearsal skips it |
| `sbom` | Writes a CycloneDX SBOM of the runtime dependencies from `internal/bun.lock` |
| `sign` | Runs in the `release` environment. Receives each artifact into a folder of its own, checks it, prepares the signer in a step with no secret, then writes `SHA256SUMS`, signs the package, the SBOM and `SHA256SUMS` with the org Ed25519 key and verifies the three signatures against the key pinned in `scripts/release/sign/release-verify-key.b64` |
| `release-check` | Receives the three artifacts again, one folder each, checks each is exactly its files, puts them together, verifies every signature against the pinned key, checks the package is the one `attest-deb` attested and hands the one folder that is published to the next job |
| `image-build` | Builds the image on amd64 and arm64 runners, in parallel with the package, with `contents: read` and nothing else, and hands each one over as a file |
| `image-push` | Loads each file and pushes it under a staging tag of this run (`ci-<run id>-<attempt>-<arch>`), and hands over the digest of what it pushed. The tag of the version is not pushed |
| `image-manifest` | Joins the two images by digest into one manifest list, reads the list back and checks it holds exactly those two digests, pushes it under the staging tag and attests it |
| `publish` | Needs the checked files and the staged, attested image. Reads the tag once more, creates the GitHub Release as a draft with generated notes and the files, reads the tag again and publishes the draft |
| `promote-images` | After the release is published, points `<version>`, `<major>.<minor>` and `<major>` at the staged list: the exact tag is made once and a version that already names another image is refused, and a floating tag only moves for the highest published version it covers. One promotion at a time |

The release assets are `epistle-panel_<version>_all.deb`, `epistle-panel-v<version>.cdx.json`, `SHA256SUMS`, and one `.sig` for each of those three files. Nothing is visible before every check has passed: the image exists only under a staging tag until the release is public, and a release that fails leaves at most a draft, which the next run replaces. The package refers to the image by the tag of the version, which appears seconds after the release.

The owner has to do two things in the repository settings that the workflow cannot do for itself. The first is to move the secret `GLYNDOR_RELEASE_ED25519_KEY` from the organisation to an environment named `release` of this repository, whose deployment rule lets only the `v*` tags use it. Until then a branch that edits the workflow can read the key. The second is a ruleset that blocks moving and deleting `v*` tags, which is what makes the second reading of the tag more than a shorter window.

The release audit fails on any advisory in `bun.lock`, development dependencies included. An advisory that does not apply is ignored with `bun audit --ignore=<id>` in the workflow, with the reason written beside it.

## Re-running and rehearsing

Releases are immutable. A mistake is fixed with a new patch version, never by moving the tag or replacing assets.

`workflow_dispatch` takes the tag and two options:

- `images-only` rebuilds and publishes only the image, for a tag whose release is already published and whose image tags do not exist yet. A version whose image tag names another image is refused, and an old version never moves `<major>.<minor>` or `<major>` back.
- `dry-run` builds and signs everything with a throwaway key, builds the image without pushing it, publishes a manifest list of two stand-in images to a throwaway registry on the runner and points the tags at it (`scripts/release/publish/rehearse-manifest.sh`, which runs `publish-manifest.sh` and `promote-tags.sh` unchanged), verifies every signature against the public half of the throwaway key, and stops before anything is published. It makes no provenance attestation. The one step it cannot cover is `gh release create`, which would create a real release.

Start a manual run from the tag itself (Use workflow from: the tag, not a branch). Every job builds the commit the run is on, and `verify` refuses a run whose commit is not the one the tag names.

## Scripts

The workflow calls these, each with an explicit interpreter, and they can be run by hand from the repository root:

| Folder | What it holds |
| --- | --- |
| `scripts/release/version/` | `check_release_tag.py` (tag, `package.json` and `debian/changelog` agree) and `check-changelog.sh` (the same without a tag, run by the Debian package workflow) |
| `scripts/release/verify/` | `check-files.sh`, the allowlist of files a release directory may hold at each stage, and for each artifact on its own |
| `scripts/release/sbom/` | `cyclonedx.ts`, the SBOM writer |
| `scripts/release/sign/` | `prepare-signer.sh` (the only step that installs anything, with no key in the environment), `sign-release.sh`, `sign_file.py`, `verify_signatures.py`, the pinned public key `release-verify-key.b64` and the hash-pinned `sign-requirements.txt` |
| `scripts/release/publish/` | `publish-manifest.sh`, `promote-tags.sh`, `check-tag.sh` and `image_tags.py`, which decides which tags a version may take |
| `scripts/debian/` | `build.sh` and `smoke.sh` (with `smoke-inner.sh`), which build, lint and smoke-test the package in a clean Debian container |

`build.sh` reads `BUILD_IMAGE` and `smoke.sh` reads `SMOKE_IMAGE` to replace the Debian image, `docker.io/library/debian:trixie` by default.

A consumer checks a published release as described in [Verifying a release](../operators/verifying-a-release.md).

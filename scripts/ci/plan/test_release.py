#!/usr/bin/env python3
"""Attack tests of release.yml: one class per finding of the review of the release.

Run from the repository root, with PyYAML (hash-pinned in requirements.txt):

	python3 -I -m unittest discover -s scripts/ci/plan -p 'test_*.py' -v

Each test names the attack it holds off and reads the workflow the way the attacker
would use it. What cannot be shown from the file (the environment of the repository,
the rule that protects the tags, the first run on the real registry) is said in
docs/maintainers/releasing.md.
"""

import copy
import re
import unittest

from wiring_support import load, step_named, walk

SECRETS = re.compile(r"secrets\.([A-Za-z0-9_]+)")


def text(node) -> str:
    return repr(node)


def secret_names(job) -> set:
    return {name for name in SECRETS.findall(text(job)) if name != "GITHUB_TOKEN"}


def jobs_that_read_a_secret(doc) -> set:
    return {name for name, job in doc["jobs"].items() if secret_names(job)}


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = load(".github/workflows/release.yml")
        cls.jobs = cls.doc["jobs"]

    def run_of(self, job, step):
        return step_named(self.jobs[job], step)["run"]


class ImagesAreNamedByDigest(Base):
    """Finding 2: a writer of the package could get an image that the build did not make attested."""

    def test_nothing_pushes_the_tag_of_a_version_or_an_architecture(self):
        push = self.run_of("image-push", "Push the ${{ matrix.arch }} image under the staging tag")
        pushed = re.findall(r"podman push[^\n]*", push)
        self.assertEqual(len(pushed), 1)
        self.assertIn("${STAGE}-${ARCH}", pushed[0])
        self.assertNotIn("${TAG", pushed[0])

    def test_the_staging_tag_belongs_to_this_run(self):
        for job in ("image-push", "image-manifest"):
            self.assertEqual(self.jobs[job]["env"]["STAGE"], "ci-${{ github.run_id }}-${{ github.run_attempt }}", job)

    def test_the_digests_travel_as_files_and_the_manifest_is_joined_from_them(self):
        join = self.run_of("image-manifest", "Join the two images by digest under the staging tag")
        self.assertIn('"$(cat "$RUNNER_TEMP/digest-amd64/digest")" "$(cat "$RUNNER_TEMP/digest-arm64/digest")"', join)
        self.assertNotRegex(join, r"\$\{?TAG|:[^ ]*-(amd64|arm64)\b")
        downloads = [s["with"]["path"] for s in self.jobs["image-manifest"]["steps"] if str(s.get("uses", "")).startswith("actions/download-artifact@")]
        self.assertEqual(len(downloads), len(set(downloads)), "each digest has its own folder")

    def test_what_is_attested_is_the_digest_of_what_was_staged_and_the_tags_are_made_from_it(self):
        attest = step_named(self.jobs["image-manifest"], "Attest the multi-arch image")["with"]
        self.assertEqual(attest["subject-digest"], "${{ steps.manifest.outputs.digest }}")
        self.assertEqual(self.jobs["image-manifest"]["outputs"], {"digest": "${{ steps.manifest.outputs.digest }}"})
        self.assertEqual(self.jobs["promote-images"]["env"]["DIGEST"], "${{ needs.image-manifest.outputs.digest }}")
        self.assertIn('"$DIGEST"', self.run_of("promote-images", "Point the tags at the staged list"))


class TheKeyLivesInTheEnvironment(Base):
    """Finding 3: a branch that edits this file must not be able to read the signing key."""

    def test_every_job_that_reads_a_secret_declares_the_release_environment(self):
        readers = jobs_that_read_a_secret(self.doc)
        self.assertEqual(readers, {"sign"})
        for name in readers:
            self.assertEqual(self.jobs[name].get("environment"), "release", name)

    def test_the_check_would_notice_a_job_that_reads_the_key_without_the_environment(self):
        doc = copy.deepcopy(self.doc)
        doc["jobs"]["publish"]["steps"].append({"name": "x", "env": {"K": "${{ secrets.GLYNDOR_RELEASE_ED25519_KEY }}"}, "run": "true"})
        self.assertIn("publish", jobs_that_read_a_secret(doc))
        self.assertNotIn("environment", doc["jobs"]["publish"])

    def test_the_rehearsal_has_no_environment_and_no_secret(self):
        job = self.jobs["rehearse-sign"]
        self.assertNotIn("environment", job)
        self.assertEqual(secret_names(job), set())

    def test_the_signing_job_refuses_a_run_that_is_not_on_a_release_tag(self):
        run = self.run_of("sign", "Only a run on a release tag signs")
        self.assertIn("push:refs/tags/v* | workflow_dispatch:refs/tags/v*", run)
        self.assertIn('test "$GITHUB_SHA" = "$COMMIT"', run)
        self.assertEqual(self.jobs["sign"]["steps"][0]["name"], "Only a run on a release tag signs", "the check is before anything else")


class NoInstallerSeesTheKey(Base):
    """Finding 4: pip and the preparation of the environment ran with the key."""

    def test_only_the_signing_step_has_the_key(self):
        for name in ("sign", "rehearse-sign"):
            holders = [s["name"] for s in self.jobs[name]["steps"] if "GLYNDOR_RELEASE_ED25519_KEY" in text(s.get("env", {}))]
            self.assertEqual(len(holders), 1, name)
            self.assertIn("Sign the files", holders[0])
        self.assertNotIn("GITHUB_ENV", self.run_of("sign", "Check what arrived"))

    def test_the_signer_is_prepared_before_the_key_is_given_and_in_a_step_of_its_own(self):
        for name in ("sign", "rehearse-sign"):
            names = [s.get("name", "") for s in self.jobs[name]["steps"]]
            prepare = next(i for i, n in enumerate(names) if n.startswith("Prepare the signer"))
            signing = next(i for i, n in enumerate(names) if n.startswith("Sign the files"))
            self.assertLess(prepare, signing, name)
            step = self.jobs[name]["steps"][prepare]
            self.assertNotIn("env", step, name)
            self.assertEqual(step["run"], 'bash scripts/release/sign/prepare-signer.sh "$RUNNER_TEMP/signer"')

    def test_the_signing_step_installs_nothing_and_runs_the_one_script(self):
        step = step_named(self.jobs["sign"], "Sign the files with the org Ed25519 key")
        self.assertRegex(step["run"], r'^bash scripts/release/sign/sign-release\.sh "\$RUNNER_TEMP/dist" "\$TAG" "\$RUNNER_TEMP/signer" scripts/release/sign/release-verify-key\.b64$')
        self.assertNotRegex(step["run"], r"pip|venv|install")

    def test_the_files_are_signed_outside_the_checkout(self):
        run = self.run_of("sign", "Check what arrived")
        self.assertIn('mkdir "$RUNNER_TEMP/dist"', run)
        for name in ("sign", "rehearse-sign"):
            for step in self.jobs[name]["steps"]:
                self.assertNotIn("working-directory", step)
                self.assertNotIn("merge-multiple", step.get("with", {}))


class ImagesOnlyCannotRewriteAVersion(Base):
    """Finding 5: images-only reused a published version and could move the floating tags back."""

    def test_the_gate_asks_for_a_release_that_is_not_a_draft_and_carries_the_package(self):
        run = self.run_of("verify", "The release images-only completes is published")
        self.assertIn("isDraft", run)
        self.assertIn('"$draft" != false', run)
        self.assertIn('epistle-panel_${TAG#v}_all.deb', run)

    def test_the_tags_are_made_in_one_job_that_runs_one_at_a_time_and_only_after_the_release(self):
        job = self.jobs["promote-images"]
        self.assertEqual(job["concurrency"], {"group": "release-image-tags", "cancel-in-progress": False})
        self.assertIn("publish", job["needs"])
        self.assertIn("needs.publish.result == 'success' || inputs.images-only", job["if"])
        others = [n for n, j in self.jobs.items() if n != "promote-images"]
        for name in others:
            self.assertNotIn("promote-tags.sh", text(self.jobs[name]), name)

    def test_the_versions_the_floating_tags_are_compared_with_are_the_published_releases(self):
        run = self.run_of("promote-images", "List the published versions")
        self.assertIn("select(.isDraft | not)", run)
        self.assertIn('grep -qxF "$TAG"', run)


class TheTagIsReadAgain(Base):
    """Finding 6: the tag could move after the last check and the release name another commit."""

    def test_every_job_builds_the_commit_the_gate_verified(self):
        for name, job in self.jobs.items():
            for step in job.get("steps", []):
                if str(step.get("uses", "")).startswith("actions/checkout@"):
                    want = "main" if name == "verify" else "${{ needs.verify.outputs.commit }}"
                    self.assertEqual(step["with"]["ref"], want, name)
                    if name != "verify":
                        self.assertIn("verify", job["needs"] if isinstance(job["needs"], list) else [job["needs"]], name)

    def test_the_tag_is_read_before_the_draft_and_again_before_it_is_published(self):
        names = [s.get("name", "") for s in self.jobs["publish"]["steps"]]
        first = names.index("The tag is still the commit that was built")
        draft = names.index("Create the release as a draft")
        second = names.index("The tag is still the commit that was built, now with the files attached")
        last = names.index("Publish the draft")
        self.assertLess(first, draft)
        self.assertLess(draft, second)
        self.assertLess(second, last)
        self.assertEqual(last, len(names) - 1, "publishing the draft is the last thing the job does")
        for step in ("The tag is still the commit that was built", "The tag is still the commit that was built, now with the files attached"):
            self.assertIn('check-tag.sh "$TAG" "$COMMIT"', self.run_of("publish", step))
        self.assertEqual(self.jobs["publish"]["env"]["COMMIT"], "${{ needs.verify.outputs.commit }}")

    def test_the_release_is_created_from_the_existing_tag_and_as_a_draft(self):
        run = self.run_of("publish", "Create the release as a draft")
        create = re.search(r"gh release create .*?release/\*", run, re.S).group(0)
        for flag in ("--draft", "--verify-tag"):
            self.assertIn(flag, create)
        self.assertNotIn("--target", create)
        self.assertNotRegex(run, r"git tag|--cleanup-tag")

    def test_a_failure_to_ask_is_not_taken_for_a_release_that_does_not_exist(self):
        for job, step in (("verify", "Tag has no published release yet"), ("publish", "Create the release as a draft")):
            run = self.run_of(job, step)
            self.assertIn("release not found", run)
            self.assertIn("could not tell whether a release", run)
            self.assertNotIn(">/dev/null 2>&1", run)


class EverySignatureIsChecked(Base):
    """Finding 7: the last check accepted a signature that was not one."""

    def test_the_three_artifacts_come_down_into_folders_of_their_own(self):
        for name in ("sign", "rehearse-sign", "release-check"):
            paths = [s["with"]["path"] for s in self.jobs[name]["steps"] if str(s.get("uses", "")).startswith("actions/download-artifact@")]
            self.assertEqual(len(paths), len(set(paths)), name)
            for path in paths:
                self.assertRegex(path, r"^\$\{\{ runner\.temp \}\}/in/[a-z]+$")
        self.assertEqual(len([s for s in self.jobs["release-check"]["steps"] if str(s.get("uses", "")).startswith("actions/download-artifact@")]), 3)

    def test_each_artifact_is_checked_alone_and_then_all_together(self):
        run = self.run_of("release-check", "Each artifact is exactly its files, and together they are the release")
        order = [run.index(f'"$TAG" {stage}') for stage in ("deb", "sbom", "signatures")]
        self.assertEqual(order, sorted(order))
        self.assertLess(order[-1], run.index('"$TAG" final'))
        self.assertLess(run.index("cp --"), run.index('"$TAG" final'))

    def test_the_signatures_are_verified_against_the_key_of_the_repository(self):
        run = self.run_of("release-check", "Every signature verifies under the pinned key")
        self.assertIn("verify_signatures.py", run)
        self.assertIn("scripts/release/sign/release-verify-key.b64", run)
        self.assertIn("-I", run)

    def test_the_package_is_compared_with_what_was_attested(self):
        job = self.jobs["release-check"]
        self.assertEqual(job["env"]["ATTESTED_SHA256"], "${{ needs.attest-deb.outputs.sha256 }}")
        self.assertEqual(self.jobs["attest-deb"]["outputs"], {"sha256": "${{ steps.sum.outputs.sha256 }}"})
        self.assertIn('"$sum" != "$ATTESTED_SHA256"', self.run_of("release-check", "The package is the one that was attested"))

    def test_the_job_that_publishes_receives_the_one_folder_that_was_checked(self):
        downloads = [s["with"] for s in self.jobs["publish"]["steps"] if str(s.get("uses", "")).startswith("actions/download-artifact@")]
        self.assertEqual(downloads, [{"name": "release-files", "path": "${{ runner.temp }}/release"}])
        self.assertIn('check-files.sh "$RUNNER_TEMP/release" "$TAG" final', self.run_of("publish", "Check what is going to be published"))

    def test_the_rehearsal_verifies_every_signature_with_the_public_half_of_its_key(self):
        run = self.run_of("rehearse-sign", "Sign the files with the throwaway key and verify every signature")
        self.assertIn('"$RUNNER_TEMP/rehearsal-key.b64"', run)
        self.assertIn("--public", self.run_of("rehearse-sign", "Make a throwaway key and its public half"))


class NothingIsVisibleUntilEverythingPassed(Base):
    """Finding 8: a failure left a real, public, half made release."""

    def test_the_release_waits_for_the_checked_files_and_for_the_staged_attested_image(self):
        needs = self.jobs["publish"]["needs"]
        for job in ("verify", "release-check", "image-manifest"):
            self.assertIn(job, needs)
        for result in ("release-check", "image-manifest"):
            self.assertIn(f"needs.{result}.result == 'success'", self.jobs["publish"]["if"])

    def test_the_images_do_not_wait_for_the_release_and_make_no_public_tag(self):
        self.assertEqual(self.jobs["image-build"]["needs"], "verify")
        for name in ("image-push", "image-manifest"):
            for step in self.jobs[name]["steps"]:
                self.assertNotRegex(str(step.get("run", "")), r"skopeo|promote|manifest push", f"{name}: {step.get('name')}")

    def test_the_public_tags_come_after_the_release_is_public(self):
        self.assertIn("publish", self.jobs["promote-images"]["needs"])
        self.assertEqual(list(self.jobs["promote-images"]["needs"]), ["verify", "image-manifest", "publish"])

    def test_a_cancelled_run_publishes_nothing(self):
        for name, job in self.jobs.items():
            condition = str(job.get("if", ""))
            if "always()" in condition:
                self.fail(f"{name} runs even when the run was cancelled")
            if job["permissions"] != {"contents": "read"} and name not in ("attest-deb",):
                self.assertIn("!cancelled()", condition, name)

    def test_no_step_pushes_a_tag_that_is_not_the_staging_tag_but_the_promotion(self):
        for name, job in self.jobs.items():
            for node in walk(job):
                if isinstance(node, dict) and isinstance(node.get("run"), str) and name != "promote-images":
                    self.assertNotRegex(node["run"], r"skopeo copy|podman push[^\n]*\$\{?TAG", name)


if __name__ == "__main__":
    unittest.main()

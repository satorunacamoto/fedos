# Secure Runtime Alpha 5321-5400 — Manual Publication Workflow

This is the exact, human-executed sequence to publish a FedOS Desktop Beta release once a human has reviewed and approved it. Nothing in this Arc's own tooling performs any of these steps automatically — every step below is a manual action a person takes, using the tooling this Arc built only to **verify** state before and after each step.

## Preconditions

1. `node scripts/generate_public_beta_gate.mjs` (run from `packages/fedos-desktop-electron-spike/`) reports `"verdict": "ready-for-human-publication"`.
2. A human has read `release-staging/RELEASE_NOTES.md`, `KNOWN_LIMITATIONS.md`, and `SECURITY_NOTICE.md` in full.
3. A human has explicitly decided this build is fit to publish — the gate's own `humanApprovalPending: true` field exists precisely to make this decision explicit and never implicit.

## Steps

1. **Tag the release commit.** From the exact commit the artifacts were built from (`release-manifest.v1.json`'s own `gitCommit` field): `git tag -a fedos-desktop-v<version> -m "FedOS Desktop Beta <version>"`, per `FEDOS_BETA_TAG_POLICY` (`scripts/lib/tag_format.mjs`) — annotated, never lightweight, never retagged.
2. **Push the tag** (a human-run `git push origin fedos-desktop-v<version>` — this Arc's own tooling never pushes a tag itself).
3. **Choose the canonical host** for this release, per the current `canonicalHostPolicy` recorded in `publication-bundle.json`. For `"local-only"` (this Arc's own honest current state), this means: place `release-staging/`'s contents somewhere a recipient can reach (a shared drive, a manually-attached artifact on a self-hosted page, etc.) — there is no automated upload step to run.
4. **Run the dry run first**: `node scripts/publication_dry_run.mjs` — review the printed upload order, filenames, and MIME types before touching any real host.
5. **Upload/place every file** in the printed `uploadOrder`, in that order (primary artifact first, so a partial upload never leaves a recipient able to fetch a ZIP without its accompanying installer or vice versa without the docs already visible).
6. **Post the release announcement** (`release-staging/RELEASE_ANNOUNCEMENT.md`) to the project's own current channel.
7. **Verify the published copy**, using the same tooling a recipient would: re-download every file from wherever it was placed, and confirm its SHA-256 matches `SHA256SUMS.txt` (`scripts/lib/remote_download_verification.mjs`'s own `verifyFedosDownloadedArtifact`, already proven against a real local HTTP server in this Arc's own test suite).
8. **Update the revocation-status record** from `"candidate"` to `"published"` (`buildFedosReleaseStatusRecordV1({ status: "published", ... })`) and re-place the updated `REVOCATION_STATUS.json` alongside the other artifacts.

## What this workflow deliberately does NOT do

- It does not authenticate to any remote service, open a browser, or create a release object anywhere — every "upload" is a manual human action.
- It does not check for or install updates automatically — there is no update mechanism in this build at all.
- It does not sign anything — see `secure_runtime_alpha_5321_5400_certificate_custody_and_signing_seam.md` for the (unimplemented) future signing seam.
- It never retags an existing tag, and never deletes a tag on revocation (`FEDOS_BETA_TAG_POLICY.allowRetagging === false`, `onRevocation === "keep-tag-publish-advisory"`).

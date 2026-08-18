# Release Distribution Plan — FedOS Desktop Beta 0.1.0-beta.1

**This document specifies the plan. It does not execute it — nothing in this arc uploads, pushes,
or publishes anything.**

## A. Publication package contents

| Item | Classification | Notes |
|---|---|---|
| A. Installer (`FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`) | **PUBLIC** | Primary artifact |
| B. Portable ZIP (`FedOS Desktop Beta-0.1.0-beta.1-win.zip`) | **PUBLIC** | Secondary artifact |
| C. `SHA256SUMS.txt` | **PUBLIC** | Required alongside A/B |
| D. Release notes (`02_PUBLIC_RELEASE_NOTES.md`, or the corrected release-staging `RELEASE_NOTES.md` once the "14-gate" string is fixed at the source) | **PUBLIC** | |
| E. Known limitations (`04_KNOWN_LIMITATIONS_FOR_BETA_USERS.md`) | **PUBLIC** | |
| F. Security/verification instructions (`03_DOWNLOAD_AND_CHECKSUM_GUIDE.md`, `SECURITY_NOTICE.md`) | **PUBLIC** | |
| G. Recovery guidance (`05_RECOVERY_AND_BACKUP_GUIDE.md`) | **PUBLIC** | New this pass — was missing |
| H. Bug-reporting guidance (`06_BUG_REPORTING_AND_SAFE_DIAGNOSTICS.md`) | **PUBLIC** | |
| `release-manifest.v1.json` | **OPTIONAL** | Useful for advanced users/auditors; not essential for a normal install |
| `publication-bundle.json` | **INTERNAL-ONLY** | Machine-readable index used by the release pipeline; not user-facing |
| `REVOCATION_STATUS.json` | **OPTIONAL** | Publish if there is anything to revoke; an empty/no-op status is not essential to surface prominently |
| Full internal engineering evidence (`docs/reviews/fedos_final_rc_seal/`, test suite results, gate-by-gate logs) | **INTERNAL-ONLY** | Available in the source repository for anyone who wants it, not part of the curated download page |

## B. Download source / trust boundary

`publication-bundle.json`'s `canonicalHostPolicy` field currently reads `"local-only"`, and the
release announcement's own "Download:" line is an explicit, literal, unfilled placeholder
(`<canonical release location — see the project's own current distribution policy; not yet
configured for this build>`). **No authorized public distribution target currently exists for this
build.**

Per the mandate's own framing, this is classified:

```
DISTRIBUTION TARGET: HUMAN DECISION REQUIRED
```

Not a defect in the release itself — every document that references "the canonical source"
correctly refers to it as something the reader must locate via the official announcement, and
none of them fabricate a location. But no public push can happen until a human decides where this
release actually lives (GitHub Releases on `satorunacamoto/fedos`, a project website, or another
channel) and that decision is reflected back into `canonicalHostPolicy` and the release
announcement before the next build.

**Do not upload artifacts anywhere, and do not use a public paste/gist/file-transfer service as a
substitute for a real decision** — that would create an unofficial, unrevocable distribution point
with no integrity guarantees beyond this review's own checksum file.

## C. Checksum publication model

There is currently **no signature channel separate from the plain SHA-256 checksum file**. No
PGP signature, no code-signing certificate, nothing beyond `SHA256SUMS.txt` published alongside the
binaries from the same location. This means:

- A checksum match proves file integrity from that publication point, not publisher authenticity.
- If the publication location itself is compromised, an attacker could replace both the binary and
  its checksum file together, and a user checking only the checksum would not detect it.

This reality is disclosed plainly to users in `03_DOWNLOAD_AND_CHECKSUM_GUIDE.md` and in the
existing `VERIFY_DOWNLOAD.md`/`SECURITY_NOTICE.md`. No stronger cryptographic assurance is claimed
anywhere, and none should be invented here. A future improvement (out of scope for this arc) would
be a code-signing certificate and/or a maintainer PGP signature published through an independent
channel (e.g., the maintainer's own long-standing key, listed somewhere other than the download
page itself).

## D. Pre-publication human actions (do not confuse with technical readiness)

1. **Decide the canonical distribution target** and update `canonicalHostPolicy` / the release
   announcement accordingly, then rebuild the release-staging bundle so the announcement's download
   line is no longer a placeholder.
2. **Enable GitHub Private Vulnerability Reporting** in repository Settings → Security (currently
   disclosed as not yet enabled in `SECURITY.md`).
3. **Schedule (not perform under this mandate) the trivial source fix** for the "14-real-gate"
   string in `fedos_desktop_beta_capability_manifest.ts:378`, so the auto-generated release notes
   stop regenerating the stale figure on the next build. This requires a new source CandidateHead
   and is explicitly out of scope for this docs-only publication pass.
4. Optionally fold `05_RECOVERY_AND_BACKUP_GUIDE.md`'s content into the official, pipeline-generated
   release-staging bundle (currently it only exists in this review's own docs folder) so future
   builds ship it automatically rather than relying on this standalone copy.

None of these four items are blocking the *technical* GO decision already sealed at EvidenceHead
`c4dfb6e7`. They are what stands between that technical seal and an actual public announcement.

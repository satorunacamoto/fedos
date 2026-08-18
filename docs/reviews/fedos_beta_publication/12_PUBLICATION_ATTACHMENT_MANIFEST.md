# Publication Attachment Manifest — FedOS Desktop Beta 0.1.0-beta.1

Exact files, independently reconfirmed this pass where a hash applies, and their
REQUIRED / OPTIONAL / DO_NOT_PUBLISH classification for a GitHub Release (or the equivalent Closed
Pilot distribution).

## REQUIRED

| File | SHA-256 | Source |
|---|---|---|
| `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` | `a1c32889173a0ae9105724d8b708abaa9456f15a054085a20c29ccde3de6dee0` | `packages/fedos-desktop-electron-spike/release/` — independently recomputed this pass, MATCH |
| `FedOS Desktop Beta-0.1.0-beta.1-win.zip` | `9aa0f584fee09aa7341ec76624cdbaa1a85df05c10662526c2194391075df8a5` | same, MATCH |
| `SHA256SUMS.txt` | (covers the two artifacts + the manifest itself; independently reconfirmed this pass) | same |
| Release notes (human-facing) | — | `docs/reviews/fedos_beta_publication/02_PUBLIC_RELEASE_NOTES.md`, or the release body text in `10_GITHUB_RELEASE_DRY_RUN.md` |
| Known limitations (human-facing) | — | `04_KNOWN_LIMITATIONS_FOR_BETA_USERS.md` |
| Download/checksum guide | — | `03_DOWNLOAD_AND_CHECKSUM_GUIDE.md` |
| Recovery/backup guide | — | `05_RECOVERY_AND_BACKUP_GUIDE.md` — **newly required this pass**; was previously missing from the shipped bundle entirely (see `08_FINAL_PUBLICATION_SIGNOFF.md`) |

## OPTIONAL

| File | Notes |
|---|---|
| `release-manifest.v1.json` | Useful for advanced users/auditors verifying build provenance; not essential for a normal install. Note its `gitCommit` field reads the prior EvidenceHead `0425f0f2`, not `c4dfb6e7` — benign (docs-only intervening commit), but worth a caption if published, so a technical reader doesn't misread it as a mismatch. |
| `REVOCATION_STATUS.json` | Publish if there is ever anything to revoke; an empty/no-op status isn't essential to surface prominently for this first release. |
| `SECURITY_NOTICE.md` (release-staging) | Content is fully covered by `03_DOWNLOAD_AND_CHECKSUM_GUIDE.md` and the release body; redundant but harmless if attached too. |
| Bug-reporting guide (`06_BUG_REPORTING_AND_SAFE_DIAGNOSTICS.md`) | The release body already links the live GitHub Issues/Advisories routes directly; attaching the full guide as a file is a nice-to-have for offline reference. |

## DO_NOT_PUBLISH

| Item | Why |
|---|---|
| `docs/reviews/fedos_final_rc_seal/` (full internal evidence report) | Internal engineering evidence — gate-by-gate logs, internal P1/P2 tracking, red-team findings. Not needed by an end user and full of internal jargon. The repository itself is public, so a curious reader *can* find it by browsing — but it should not be attached to the release as a "here's what you need" artifact. |
| `docs/reviews/fedos_beta_publication/01_HUMAN_PUBLICATION_CHECKLIST.md`, `07_RELEASE_DISTRIBUTION_PLAN.md`, `08_FINAL_PUBLICATION_SIGNOFF.md`, and this dry-run packet (`09`-`13`) | Internal publication-process evidence, written for whoever runs the release, not for end users. |
| Test logs, `.tmp_gen/` scratch output, any CI artifact | Internal only, not release-relevant to a user. |
| Any real user profile, Recovery Bundle, or exported Archive | Never publish real user data. None exists in this repository, and none should ever be attached to a release. |
| Cryptographic secret material (Master Seed, private keys, signing keys) | Never publish. None was found in the staging inputs that became the sealed release artifacts (independently confirmed: the prohibited-content scan ran 984 files / 0 findings during the Final RC Seal — note the scan runs on the uncompressed staging files before packaging, not on the compressed `.exe`/`.zip` bytes directly, since compression defeats plain substring scanning; this is a strict-superset proxy for the shipped artifacts, not a literal scan of their final compressed bytes). |
| `dist-package-beta/win-unpacked/` (the unpacked app directory) | Internal build output, not a release-appropriate artifact — the installer and ZIP are the intended distribution forms. |

## Total

```
4 required binary/checksum files + up to 3 required doc files (or their content folded into the
release body) = 7 REQUIRED items
4 OPTIONAL items
6 categories explicitly marked DO_NOT_PUBLISH
```

# FedOS Desktop Beta 0.1.0-beta.1 — Public Release Notes

*This is a human-facing rewrite prepared during publication review. It corrects one known stale
figure found in the auto-generated `RELEASE_NOTES.md` (see below) and adds two disclosures
(Recovery Bundle, forward secrecy default) that were missing from the shipped release-staging
bundle. It does not change or contradict any capability status in the shipped bundle — only adds
precision.*

**Channel:** Beta · **Build:** `fedos-desktop-beta-0.1.0-beta.1` · **Version:** `0.1.0-beta.1`

> This is Beta software. It is functional but incomplete; behavior and data formats may change
> before a stable release.

## What works today, through the real installed app

- **Create a profile and unlock it.** A real WASM-generated Master Seed, sealed behind your
  passphrase. Proven end-to-end through the actual installed, packaged application — not a
  development build.
- **Lock and re-unlock**, including after a full uninstall and reinstall — your identity survives.
- **Back up and restore your profile (Recovery Bundle).** See `05_RECOVERY_AND_BACKUP_GUIDE.md` —
  this is a real, tested feature reachable from Settings and from the Welcome screen, with
  important scope limits explained there.
- **Settings** are saved, validated, and can be exported/imported.
- **Clean shutdown**, every time.

## What exists but is not yet reachable through the packaged app in every path

Device pairing and sync, opening/creating conversations, direct and group messaging, Archive
export/restore, conversation search, immediate application of some settings (theme, notifications),
desktop notifications, system tray, unread badge, and background operation are all implemented and
tested at the code level, but do not yet have a finished path through the packaged application's
own screens. This will expand release over release.

## What this release does not include

- **No Tor / anonymity.** FedOS does not hide your IP address from relays, and this release makes
  no anonymity claim of any kind.
- **No default forward secrecy for Direct conversations.** A Double Ratchet implementation exists
  in this codebase, but ordinary Direct messages use the plain NIP-17 route unless a build
  explicitly opts a conversation into the ratchet route. Forward secrecy and post-compromise
  recovery are **not active by default** in this Beta.
- **No Commerce in this cohort's release notes.** A real, locally-verified Commerce flow (order →
  TEST/LOCAL payment simulator → delivery → signed receipt) exists in this codebase with no real
  payment rail wired — it is intentionally out of scope for this release's public claims until it
  has its own dedicated publication review.
- **No code signing.** See `03_DOWNLOAD_AND_CHECKSUM_GUIDE.md`.
- **No independent security audit** has occurred yet.

## Known limitations

See `04_KNOWN_LIMITATIONS_FOR_BETA_USERS.md` for the full, plain-language list.

## Correction to the pipeline description

The auto-generated `RELEASE_NOTES.md` shipped in the release-staging bundle describes the release
pipeline as "14-real-gate." The real, authoritative pipeline (`build_release.mjs`) runs exactly
**13** real gates, all of which passed for this build (see the Final RC Seal report). The "14" figure
is a stale off-by-one baked into the pipeline script's own printed step labels (each says "N/14"),
which was then copied into a capability-manifest description string and from there into the
auto-generated release notes. It does not reflect a missing or skipped gate — all 13 real gates ran
and passed. This is a cosmetic wording defect, tracked for a future source fix; it does not change
any capability status, security claim, or artifact identity in this release.

## Support

See `06_BUG_REPORTING_AND_SAFE_DIAGNOSTICS.md`.

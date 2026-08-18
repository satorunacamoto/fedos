# GitHub Release Dry Run — FedOS Desktop Beta 0.1.0-beta.1

**NOT PUBLISHED. This is a dry run only.** No tag was pushed, no release was created, no artifact
was uploaded. Everything below is what WOULD be created if a human explicitly authorized it.

## Prerequisite this dry run surfaced (not previously known)

The current worktree branch (`arc/fedos-installed-startup-root-cause`, HEAD `af940f69`, sealed
EvidenceHead `c4dfb6e7`) **has not been pushed to `origin` at all** (`git ls-remote --heads origin`
finds no matching remote branch). A GitHub Release must target a commit that exists on the remote —
so **before any release, draft or otherwise, can be technically created, these commits must first
reach `origin`** (either by pushing this branch, or by fast-forwarding `origin/main` to include it).

The good news, independently verified this pass: `origin/main` (`4e2825cb`) **is a clean ancestor**
of this branch's HEAD — `git rev-list --count origin/main..HEAD` = 244 (commits ahead), `git
rev-list --count HEAD..origin/main` = 0 (commits behind). This is a clean fast-forward, not a
diverged/conflicting history. Pushing is still a real action requiring explicit authorization
(the mandate's own hard boundary), just not a risky or conflict-prone one technically.

## Proposed release

```
TARGET COMMIT:
c4dfb6e7 (Final RC EvidenceHead — the exact commit the sealed installer/ZIP were built from,
two docs-only commits above source CandidateHead 883e115b: 883e115b -> 0425f0f2 -> c4dfb6e7,
independently re-verified via `git rev-list --count 883e115b..c4dfb6e7` = 2). Not af940f69 or the
later publication
docs, since a release should point at the artifact's own build commit, not subsequent
documentation-only history. Requires the push described above first.

PROPOSED TAG:
desktop-beta-v0.1.0-beta.1

  Reasoning: the repository root package.json version (0.0.1) and the actual shipped product
  version (0.1.0-beta.1, from packages/fedos-desktop-electron-spike/package.json and the release
  manifest's own buildIdentity) differ, and this is a monorepo — a bare "v0.1.0-beta.1" tag could
  read as versioning the whole repo rather than this one product. No tag-naming convention is
  documented anywhere in the repo, so this is a recommendation, not an established standard;
  confirm or override before use.

PROPOSED RELEASE TITLE:
FedOS Desktop Beta 0.1.0-beta.1

DRAFT:
YES — recommended. A draft release has a private, unlisted link that can be shared only with
invited Closed Pilot participants, matching the RECOMMENDED COHORT in 09 without requiring any new
infrastructure. Converting it to a public, non-draft release later is a separate, explicit action.

PRERELEASE:
YES — this is Beta software (0.1.0-beta.1); marking it "prerelease" on GitHub is both accurate and
suppresses it from being flagged as the repository's "latest release," which is correct given its
maturity.
```

## Proposed release body (exact text — human-facing, no internal jargon)

```markdown
# FedOS Desktop Beta 0.1.0-beta.1

This is Beta software — functional but incomplete. Read the known limitations below before
installing.

## What FedOS Beta is

FedOS is a local-first, privacy-oriented desktop app being built for end-to-end encrypted
messaging over Nostr, with local identity and local recovery. **This specific release is an early
Beta: profile, identity, and backup/recovery are real and usable today; sending and reading
messages through this app's own screens is not yet finished — see "What works" below before you
install.**

## What works in this release

- Create a local profile with a real, locally-generated Master Seed.
- Lock and unlock your profile, including after a full reinstall.
- Back up your profile to a Recovery Bundle and restore it later or on a new machine.
- Save and export/import your settings.

Device pairing/sync, opening or sending conversations, Archive, search, notifications, and the
system tray exist and are tested, but do not yet have a complete path through this release's own
screens — expect this to expand in future Beta releases.

## Download

| File | Use it if |
|---|---|
| `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` | You want a normal install with a Start Menu entry (recommended) |
| `FedOS Desktop Beta-0.1.0-beta.1-win.zip` | You want a portable copy with no installer |

**This build is unsigned.** Windows SmartScreen may warn that it's from an unrecognized publisher —
that's expected for unsigned Beta software and isn't by itself a sign of a problem. **Verify the
checksum below before you run anything**, and only proceed past the warning for a file whose
checksum you've already confirmed matches.

```
FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe
SHA-256: a1c32889173a0ae9105724d8b708abaa9456f15a054085a20c29ccde3de6dee0

FedOS Desktop Beta-0.1.0-beta.1-win.zip
SHA-256: 9aa0f584fee09aa7341ec76624cdbaa1a85df05c10662526c2194391075df8a5
```

Verify with PowerShell:
```powershell
Get-FileHash .\FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe -Algorithm SHA256
```

A checksum match proves the file wasn't corrupted or altered relative to what's published here —
it does not prove who published it. There's no separate signature beyond this checksum.

## Before you install — please read

- **This is Beta software.** Behavior and data formats may change before a stable release.
- **A forgotten passphrase cannot be recovered by anyone** — there is no password reset and no
  support-assisted recovery.
- **Your data is local.** Without your own backup (see the Recovery guide below), it can be lost if
  this device or your profile is damaged.
- **No independent security audit has happened yet.**
- **Upgrading over an older version has not been tested yet.** Back up your profile (see below)
  before installing over an existing install, and expect that a future update may need a fresh
  install rather than an in-place upgrade.

## Back up before you need to

FedOS can export an encrypted Recovery Bundle (Settings → Backup) that restores your identity and
local data onto a fresh install or a new machine. It deliberately does **not** carry over your
active message sessions or this device's trust with your contacts — those re-establish fresh, on
purpose. Full guide: `RECOVERY_AND_BACKUP_GUIDE.md` (attached below).

## Reporting a problem

- **Ordinary bugs** (crashes, UI issues, anything with no security impact): open a public
  [GitHub Issue](https://github.com/satorunacamoto/fedos/issues/new/choose) using the bug report
  template. Never attach your Master Seed, private keys, passphrase, Recovery Bundle, or profile
  data — see `BUG_REPORTING_AND_SAFE_DIAGNOSTICS.md`.
- **Security or privacy concerns**: use GitHub's private "Report a vulnerability" flow on this
  repository (Security → Advisories) — never a public Issue.

## Full documentation

Known limitations, download/checksum guide, and recovery guide are attached to this release and
also live in the repository under `docs/reviews/fedos_beta_publication/`.
```

## Settings summary (for whoever actually creates this release)

```
Repository:    satorunacamoto/fedos
Tag:           desktop-beta-v0.1.0-beta.1  (created only at publish time, pointing at c4dfb6e7)
Target:        c4dfb6e7 (requires this commit to exist on origin first — see prerequisite above)
Title:         FedOS Desktop Beta 0.1.0-beta.1
Draft:         true
Prerelease:    true
Generate release notes automatically:  NO — use the exact body above, not GitHub's auto-generated
                                        commit-log summary (which would leak internal commit
                                        messages/jargon into a user-facing release)
Discussion:    do not link a release discussion (Discussions is not enabled on this repo — see 09)
```

This dry run is not an authorization to create the above. See `13_FINAL_HUMAN_ACTION_QUEUE.md`.

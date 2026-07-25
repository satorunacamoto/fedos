# Secure Runtime Alpha 8361-8440 — Public Beta Final Readiness Arc

**Mandate**: fix only the P0/P1 items named by the mission. No new
features beyond them. No Crypto/Protocol/Rust/WASM/Relay/Double Ratchet/
Identity change. Worktree `C:/wt/fedos-public-beta-final-readiness`,
branch `arc/8361-8440-public-beta-final-readiness`, based on master at
`68e7be16` ("FedOS Documentation Consolidation V1").

No commit or branch in this repository is literally titled "Public Beta
Readiness Review." Per this Arc's own "no guessing" ethos, each of the 7
named items was independently re-verified against current real source
before any fix was written — not assumed present or absent from any
review's wording. `KNOWN_LIMITATIONS.md` (added by the just-landed
Documentation Consolidation V1) item 23 ("Interface language is
hardcoded to English") is the closest existing canonical documentation of
item 1 below; the remaining items were verified directly against the
Beta UI's own HTML/renderer source, with no matching prior written
finding found for several of them.

## Verified status of each named item, before any change

1. **Language persisted-but-blocked display bug** — CONFIRMED REAL.
   `fedos_desktop_beta_limitations.ts:115` already discloses "Language...
   stored but not yet applied," but only inside the collapsed "Beta
   limitations" `<details>` list. At the actual point of action, saving a
   non-English Language choice produced a plain `"Saved."` message —
   genuinely misleading, since it reads as if the change took visible
   effect. Fixed (see below).
2. **Recovery screen backup-importance warning** — CONFIRMED ABSENT.
   Direct read of `screen-recovery`: diagnostic code, explain text,
   retry/copy/quit buttons only, no mention of backups. Fixed.
3. **Archive Export pre-export warning** — ALREADY IMPLEMENTED, NO CHANGE
   MADE. `fedos_archive_workflow_safety_warnings.ts` (Alpha 7481-7560)
   already returns real warnings (`archive-metadata-may-survive-content-deletion`,
   `archive-export-after-deletion-applies-retention-parity`), rendered
   into `#archive-export-warnings` by `renderArchiveWarnings(..., "export")`,
   called the moment the Archive tab opens — genuinely before export, not
   merely alongside the result. Verified by direct source read; this item
   needed no fix and none was made, to avoid an unnecessary duplicate
   warning banner.
4. **First-launch Security Notice** — CONFIRMED ABSENT. Direct read of
   `screen-welcome`/`screen-create`: no security-posture disclosure of
   any kind before profile creation. Fixed.
5. **First Relay-add Metadata Notice** — CONFIRMED ABSENT in-context.
   `SECURITY.md`/`KNOWN_LIMITATIONS.md` item 8 already disclose the
   Relay-metadata-correlation risk at the document level, but nothing
   appeared next to the actual "Add a Relay" control in Settings. Fixed.
6. **Settings Closed Beta Disclaimer** — CONFIRMED ABSENT specifically
   inside the Settings screen. The app-wide `<h1>` already carries a
   "— Beta" badge and the "ready" screen's collapsed limitations list
   exists, but Settings itself (where a user is actively changing
   persistent state) had no disclaimer of its own. Fixed.
7. **Feedback link** — CONFIRMED ABSENT anywhere in the Beta UI (full-file
   read, zero "feedback" occurrences). Fixed, WITHOUT inventing a contact
   channel — see "No invented URLs" below.

## What changed

`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html`:

- `screen-welcome`: added a Security Notice paragraph (Closed Beta, no
  external audit, installer unsigned, points to `KNOWN_LIMITATIONS.md`
  and the in-app Safety Center) — shown before a first-time user creates
  a profile.
- `screen-create`: added a passphrase-loss warning (no reset exists).
- `screen-recovery`: added a paragraph stating Archive export is
  currently the only recovery path for conversation history if the
  profile itself cannot be unlocked, and that restoring an Archive does
  not recover the profile itself.
- `app-screen-settings`:
  - Closed Beta Disclaimer paragraph directly under the `<h2>Settings</h2>`
    heading (settings changes are local-only, not backed up/synced).
  - Metadata Notice paragraph directly above the "Add a Relay" field
    (a Relay/network observer can see who-messages-whom-when even though
    it cannot read contents).
  - Language note directly under the Language `<select>` (interface stays
    English-only regardless of the value chosen) — the static,
    always-visible half of item 1's fix.
  - A new "Feedback" section at the bottom of Settings.

`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts`:

- `onSettingsSave()`: the dynamic half of item 1's fix. When the saved
  `language` is not `"en"`, the save-success message now appends "Your
  language preference is saved, but this Beta's interface text stays
  English-only — it does not change what you see," instead of a bare
  `"Saved."` that would otherwise read as a real, effective change. Default
  (`"en"`) behavior is byte-for-byte unchanged.

## No invented URLs (Feedback item)

This repository has an established, deliberate convention for exactly
this situation: `SECURITY.md`'s own "Reporting a vulnerability" section
reads "please open a private report through whatever channel the
maintainers of this repository currently designate for that purpose,"
with an explicit comment: "Contact details intentionally left as a
placeholder: this file does not invent an email address, response SLA,
or bug-bounty program that does not yet exist." The new in-app Feedback
section mirrors this exact wording and policy rather than fabricating a
URL, email address, or issue tracker link — consistent with this
session's own standing instruction to never generate or guess a URL.

## Verification performed (real, not assumed)

- `npm run build` (electron-spike): clean.
- `npm run typecheck:electron`: clean. `npm run typecheck:core`: 2
  pre-existing errors, confirmed identical to the unmodified baseline
  (same two files this session has now confirmed pre-existing on four
  separate occasions across different worktrees).
- `cargo test --release` (zero Rust file touched by this Arc): 639
  passed, 1 known pre-existing dependency-count-drift failure, identical
  to every prior run this session.
- Real production WASM artifact rebuilt from unchanged Rust source:
  reproduced the same `10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a`
  / 385,565-byte artifact as every previous independent build.
- Real Electron subprocess tests:
  `secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`
  (2/2, after one transient timing flake reproduced neither on immediate
  retry nor traceable to any file this Arc touched — none of this Arc's
  edits are on the affected conversation-list/navigation code path),
  `secure_runtime_alpha_8041_8120_structural_guards.test.ts` (13/13),
  `secure_runtime_alpha_8041_8120_failure_matrix.test.ts` (11/11).
- Checked the one existing test that reads `#settings-report`
  (`secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`)
  asserts only non-empty text, never the exact `"Saved."` string, and
  never sets Language away from the `"en"` default — confirmed unaffected
  by the `onSettingsSave()` change.
- `git diff --stat`: exactly 2 files (`fedos_electron_beta_page.html`,
  `fedos_electron_beta_renderer.ts`) — no Crypto/Protocol/Rust/WASM/Relay/
  Ratchet/Identity file touched anywhere.
- Release build (`npm run release:beta`): run against the clean,
  committed tree (the release script itself refuses a dirty working
  tree).

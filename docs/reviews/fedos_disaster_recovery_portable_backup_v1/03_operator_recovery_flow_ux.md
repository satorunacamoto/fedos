# Disaster Recovery / Portable Backup — Operator Recovery Flow (UX design)

Scope note: `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`
and the renderer HTML/TS are being actively edited by a concurrent
session in this same worktree during this Stage (confirmed live — a file
changed under this Stage's own edit mid-flight). This doc is therefore a
DESIGN, not a wired-up UI change, to avoid colliding writes on shared
files neither Stage owns exclusively. It follows this codebase's own
established IPC/dialog conventions exactly (`fedos-app:archive-choose-*`,
`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts:1631-1653`),
so wiring it up later is mechanical, not a redesign.

## 1. Two flows, mirroring the Archive Export/Import precedent exactly

**Create Recovery Bundle** (from the already-unlocked Runtime, e.g. a new
"Recovery" nav section or a Settings action):
1. `fedos-app:recovery-choose-export-destination` — `dialog.showSaveDialog`,
   default name `<profile-label>.fedosrecovery`, filter `{ name: "FedOS Recovery Bundle", extensions: ["fedosrecovery"] }`.
2. `fedos-app:recovery-export` — build via `FedosRecoveryBundleEncryptionAuthority.build()`
   (Data Part entries collected from the current profile root via
   `fedosRecoveryBundleSourcePaths()` + the reused `fedosConversationArchiveFileAuthority.readArchive()`),
   serialize, write via `fedosConversationArchiveFileAuthority.createArchiveExclusive()`
   to the chosen path.
3. Confirmation screen states plainly, mirroring `docs/desktop_beta_user_guide_backup.md`'s
   own established voice: *"This file is protected by your existing
   unlock passphrase — the same one, not a new code to remember. Anyone
   who has both this file AND your passphrase can read your identity and
   recent conversation history. Store it like you would store your
   passphrase itself."*

**Restore from Recovery Bundle** (from the pre-unlock / "no profile yet"
screen, alongside "Create New Profile"):
1. `fedos-app:recovery-choose-source` — `dialog.showOpenDialog`, same filter.
2. Passphrase prompt (the SAME field styling as the existing unlock
   screen — no new credential concept for the operator to learn).
3. `fedos-app:recovery-restore-identity` — `restoreIdentity()` against a
   FRESH, never-before-used profile root the app itself allocates
   (mirrors `fedos_local_profile_paths.ts`'s own "no default path,
   caller supplies explicit root" discipline — the OS picks
   `%APPDATA%\FedOS\profiles\<new-uuid>` the same way first-run profile
   creation already does, never a directory the operator hand-picks,
   which is what makes "never overwrite an existing profile" enforceable
   by construction rather than by a check that could race).
   - `"wrong-secret"` → the SAME "unlock-failed" screen/copy the regular
     unlock flow already uses (no separate "recovery passphrase wrong"
     vocabulary to design or localize).
   - `"malformed"` → "This doesn't look like a FedOS Recovery Bundle
     file (or it's from an incompatible future version)."
4. On `"restored"`: `fedos-app:recovery-restore-data` — derive
   `selfAccountPublicKeyHex` via the now-restored identity's own
   `FedosNostrSigningAuthority.publicIdentityForAccount()`, call
   `restoreDataPart()`, write entries into the SAME fresh profile root.
   - `"identity-only"` (bundle had no Data Part) → proceed straight to
     the ready screen; a banner states "Your identity was recovered.
     This backup did not include conversation history."
   - `"manifest-mismatch"`/`"failed"` → identity is STILL kept (do not
     discard a successful Stage 1 over a failed Stage 2) — banner:
     "Your identity was recovered, but the conversation history in this
     file could not be verified and was not restored."
5. **Mandatory, non-dismissable-by-default disclosure** on first landing
   at the ready screen after ANY restore (not just an error path),
   reusing `02_red_team_and_asset_classification.md` §5's finding
   verbatim: *"This restores your account as it existed when this backup
   was created. Conversations, deletions, and device changes made
   afterward are not included. Device trust is not restored — devices
   you previously paired will need to be re-paired."* This is the single
   UX requirement this Stage's own design treats as load-bearing, not
   optional copy.

## 2. What this flow deliberately does NOT do

- Never offers to restore INTO an existing, already-populated profile
  directory — "Restore from Recovery Bundle" only ever appears where
  "Create New Profile" already appears (pre-unlock), never as an action
  available from inside an already-unlocked profile. This is the
  concrete UX enforcement of the "profile isolation" hard requirement —
  the dangerous action (overwrite/merge) is simply never offered, not
  merely warned against.
- Never claims Device Trust, Ratchet, Tor settings, Commerce receipts, or
  Purchased content are "restored" anywhere in any copy — every string
  above uses "recovered"/"included"/"restored" only for what
  `02_red_team_and_asset_classification.md` §7 actually classifies that
  way for that asset.
- Never uploads the chosen file anywhere — both dialogs are local
  filesystem only, matching the Archive Export/Import precedent's own
  scope exactly.

## 3. Integration order recommendation

Wire `fedos-app:recovery-*` into `fedos_electron_beta_main.cts` AFTER
the concurrent session's own in-flight work on
`fedos_disaster_recovery_fresh_machine_restore.test.ts` lands (same
file, avoid a second concurrent editor) — this doc's own IPC channel
names and dialog shapes are additive and do not depend on anything that
test changes, so no rework is expected, only sequencing.

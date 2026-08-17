# Recovery Bundle — Operator UX Flow (Agent D)

Paper design only. No code in this Stage. Grounded against the files listed
below — every screen/action name either reuses an existing one verbatim or is
proposed as a minimal, same-shape extension.

Read for precedent:
- `docs/desktop_beta_user_guide_backup.md` (current shipped guidance — whole-
  directory copy, manual, untested across versions)
- `docs/desktop_beta_user_guide_recovery_and_troubleshooting.md` (diagnostic-
  code vocabulary and Recovery-screen actions)
- `docs/desktop_beta_user_guide_archive_and_deletion.md` (manifest-inspect-
  before-restore precedent)
- `src/os/messenger/desktop/onboarding/fedos_profile_lifecycle_state.ts`,
  `fedos_profile_initialization_coordinator.ts`,
  `fedos_onboarding_presentation.ts`, `fedos_profile_recovery_notice.ts`
- `docs/reviews/fedos_disaster_recovery_portable_backup_v1/00_gate_decision.md`
  and `01_recovery_bundle_format.md` (the format this UX wraps)

## 0. What the current code actually does (verified, not assumed)

The prior review's "recovery-required may be a dead end" concern is **still
true today, precisely**, and this design must not paper over it:

- `FedosProfileLifecycleState` (`fedos_profile_lifecycle_state.ts`) has a real,
  exhaustive transition table. `recovery-required` is reachable from
  `absent`/`initializing`/`locked`/`unlocking`/`failed`, but **has zero
  outgoing transitions** — it is not in the `TRANSITIONS` map as a source key
  at all except back into itself implicitly (none listed). It is a true dead
  end in the state machine as it stands.
- `FedosProfileInitializationCoordinator.unlockProfile()` explicitly refuses
  to even attempt unlock when presence is `recovery-required`
  (`"profile requires recovery; unlock is not possible"`).
- `fedosOnboardingViewForStatus`/`fedosOnboardingViewForFailure`
  (`fedos_onboarding_presentation.ts`) render a `recovery-required` screen
  with exactly one action: `open-recovery` ("Recovery options") — and no
  `FedosOnboardingAction` in the closed union does anything beyond
  acknowledge/lock/relaunch. There is currently no "restore from Recovery
  Bundle" action anywhere in this file's closed vocabulary.
- The shipped Electron spike's Recovery screen (`fedos_electron_beta_page.html`
  + `fedos_electron_beta_renderer.ts`) confirms the same: `recovery-reason`,
  `recovery-explain` (via `RECOVERY_EXPLANATIONS`), a Retry button, a Copy
  diagnostic-code button, and Lock/Quit. No restore entry point.

**Conclusion driving this design:** "Restore from Recovery Bundle" is not a
new 9th lifecycle state layered on top of the existing 8. It is a genuinely
new *action* wired into two already-real states:

1. `absent` (fresh machine, first run) — the primary, intended case.
2. `recovery-required` (this machine's own profile is broken) — this is the
   escape hatch that finally makes `recovery-required` non-dead-end, by
   giving `open-recovery` → "Recovery options" a real second choice besides
   "wait for support." Restoring here still targets a **fresh, empty**
   profile root, never the broken one in place (profile isolation), so it
   does not need a new lifecycle state either — it is create-profile's own
   shape with an extra input (the bundle) instead of a blank slate.

No new `FedosProfileLifecycleState` member is proposed. Two new
`FedosOnboardingAction` members are: `create-recovery-bundle`,
`restore-recovery-bundle`. Two new screens extend
`FedosOnboardingScreen`: `recovery-bundle-export`,
`recovery-bundle-restore-inspect` (mirrors Archive's Export/Restore-inspect
screen pair).

## 1. Export / backup flow

**Entry point:** the existing `open-recovery` action, already wired from both
`profile-ready` ("Recovery material") and `recovery-warning` (during create).
Today it presumably renders `buildFedosProfileRecoveryNotice()`'s file-list
notice. This design adds a second panel to that same screen — **not** a new
top-level nav item, and **not** buried in Settings — because "Recovery
material" is already the operator's mental-model home for "how do I not lose
this," and Archive already proved the "one screen, Export panel + Restore
panel, side by side" shape works (`fedos_electron_beta_page.html`'s Archive
section literally does this today for conversations).

**Screen: `recovery-bundle-export`**

```
Recovery material
──────────────────
[ existing: Sealed Master Seed / Profile descriptor file-path notice,
  unchanged — buildFedosProfileRecoveryNotice() ]

Create a Recovery Bundle
  A Recovery Bundle is a single file you can use to restore your identity
  (and, optionally, your message history) on a new device.

  ○ Identity only — restores your account, but not your conversations.
    No unlock needed to create this; fastest option.
  ● Identity + conversation history — also restores your Boards,
    conversations, and deletion/suppression history. Requires this profile
    to be unlocked right now.

  The following are NEVER included in a Recovery Bundle, on any device,
  and must be re-established manually after a restore:
   • Your encrypted (Ratchet) sessions with each contact — these are tied
     to this specific device and cannot travel. Messaging will silently
     re-establish a fresh session the next time you contact someone.
   • This device's Device Registry / trust relationships with your other
     paired devices.
   • Tor and Relay connection state.
   • Own-Device Sync's own internal journal/schedule.
   {{COMMERCE_RECEIPTS_CLASSIFICATION_NOTE}}

  [ Choose destination… ]   [ Create Recovery Bundle ]
```

- The exclusion list is rendered as **fixed, always-visible copy**, not a
  collapsed/optional disclosure — matches the hard requirement ("never
  silently claim a category is backed up that isn't") and matches this
  codebase's existing tone (the Backup Guide and Archive guide both state
  their own limits up front, unprompted, not on request).
- The `{{COMMERCE_RECEIPTS_CLASSIFICATION_NOTE}}` placeholder is left for
  whichever agent resolves the pending Commerce/receipts/Tor-settings-storage
  research fork referenced in `00_gate_decision.md` §6 — do not guess it here.
- After **Create Recovery Bundle** succeeds: a short, factual confirmation —
  "Recovery Bundle saved to `<path>`. It is protected by your current unlock
  secret — anyone who has both the file and your secret can open your
  account. Store it somewhere you control, separately from this device."
  Deliberately echoes `RECOVERY_WARNINGS`' own existing tone (no new
  metaphor, no "your backup is complete!" cheerfulness the codebase avoids
  elsewhere).

## 2. Fresh-machine restore flow

**Entry point A (primary):** the `absent`-state `welcome` screen
(`fedosOnboardingViewForStatus`, case `"absent"`) gains a second action
alongside the existing `create-profile`:

```
Welcome
No local profile was found on this device.
  [ Create a new profile ]   [ Restore from Recovery Bundle ]
```

**Entry point B (escape hatch):** the `recovery-required` screen's
"Recovery options" (`open-recovery`) now offers the same
`restore-recovery-bundle` action alongside whatever support/diagnostic
options already exist there — explicitly presented as "restore into a new,
separate profile," never as "repair this profile," since the broken profile
is never touched (profile isolation, per `01_recovery_bundle_format.md` §5).

**Screen: `recovery-bundle-restore-inspect`** (mirrors Archive's
Choose-file → Inspect-manifest → act-on-it shape exactly):

```
Restore from Recovery Bundle
  [ Choose Recovery Bundle file… ]
  [ Inspect ]  (disabled until a file is chosen)

  ── after Inspect, non-secret manifest summary (no passphrase needed) ──
  Bundle format version: 1
  Created: <createdAt, formatted local time>
  Contents: Identity + conversation history  (or: "Identity only")
  Included: board, conversations, deletion history, ...
            (manifest.includedLogs, human-labeled)
  Not included: <manifest.excludedLogs, human-labeled>
  {{OLD_BACKUP_ROLLBACK_WARNING — see §4}}

  Enter the passphrase that was used to unlock this profile when the
  Bundle was created:
  [ passphrase field ]
  [ Restore ]
```

- The Inspect step reads **only** the clear-text `manifest` object
  (`01_recovery_bundle_format.md` §1) — never `sealedMasterSeedEnvelope` or
  `dataCiphertext` — so a user can confirm "is this the right bundle, from
  roughly when I think" before ever typing a passphrase. Directly copies
  Archive's own "Inspect manifest before you commit to anything secret"
  precedent.
- Passphrase prompt only appears after Inspect, never before — avoids asking
  for a secret against a file that later turns out malformed/wrong-kind.

**Screen: post-restore summary (new, not a generic "Restore complete!")**

This is the one place this design explicitly does NOT invent the actual
per-category verdicts — those come from Agent A/B's empirical bundle-format
work and Agent C's rollback red-team, which may not have landed yet. The
summary is written as a mechanical per-category template so it can be filled
in once those land, not guessed:

```
Restore finished
  Your identity has been recovered. You can sign in and use this profile now.

  What came back, by category:
   • Account identity & signing keys — RECOVERED.
     {{IDENTITY_CLASSIFICATION_DETAIL}}
   • Conversations & message history — {{CONVERSATION_CLASSIFICATION}}
     {{CONVERSATION_CLASSIFICATION_DETAIL}}
   • Encrypted (Ratchet) sessions with contacts — REESTABLISHED, not
     recovered. {{RATCHET_CLASSIFICATION_DETAIL — e.g. "your encrypted
     session with each contact could not be carried over and must be
     re-established the next time you message them"}}
   • Device trust / paired devices — {{DEVICE_REGISTRY_CLASSIFICATION}}
     {{DEVICE_REGISTRY_CLASSIFICATION_DETAIL}}
   • Deletion / suppression history — {{DELETION_CLASSIFICATION}}
     {{DELETION_CLASSIFICATION_DETAIL}}
   • Own-Device Sync state — LOST, by design (never included).
     Sync will re-establish itself the next time this device pairs.
   • Commerce receipts / purchased content — {{COMMERCE_CLASSIFICATION}}
     {{COMMERCE_CLASSIFICATION_DETAIL}}
   • Tor / Relay connection settings — LOST, by design (never included).
     Reconfigure in Settings.

  [ Continue ]
```

The four-value vocabulary (RECOVERED / REESTABLISHED / PARTIAL / LOST) is
fixed and closed on purpose, matching this codebase's habit of small closed
enums over free text (`FedosProfileLifecycleState`,
`FedosConversationArchiveRestoreOutcome`, etc.) — a future engineer fills in
placeholders, never invents a fifth value without a doc update.

## 3. Rejection / failure copy — reuse the existing vocabulary, don't invent a parallel one

Side-by-side: existing copy (left, verbatim from
`RECOVERY_EXPLANATIONS`/`docs/desktop_beta_user_guide_recovery_and_troubleshooting.md`)
vs. this flow's proposed additions (right, same tone, same sentence shape):

| Code | Existing copy (unlock/profile flow) | Proposed Recovery Bundle copy |
|---|---|---|
| `unsupported-version` | "This profile was created by an incompatible, newer or older schema version." | "This Recovery Bundle was created by an incompatible format version and cannot be restored by this build." (`decodeFedosConversationArchiveFileContainer`'s own `unsupported-version` outcome, reused verbatim as a concept — Archive already draws exactly this distinction from `"malformed"`.) |
| `corrupt` / malformed | "The locally stored profile data appears corrupted." | "This file is not a valid Recovery Bundle, or is corrupted." (maps to the format's own `"malformed"` outcome, §5 of `01_recovery_bundle_format.md` — never partially trusted, exactly like today's fail-closed parse.) |
| wrong passphrase | "Unlock failed." / "The unlock secret was not accepted. Try again." | "That passphrase did not open this Recovery Bundle. Try again." (maps to `"wrong-secret"` — AEAD failure inside Rust, same fail-closed mechanism as today's unlock, same retry-is-safe framing.) |
| tamper (new distinction Archive already has, unlock flow doesn't need) | Archive: `"integrity-failed"` / `"manifest-mismatch"` | "This Recovery Bundle's contents don't match what it claims — it may have been altered. Your identity was NOT restored." for a Data-Part `manifest-mismatch`; if it happens after the Identity Part already restored successfully, say so explicitly rather than implying total failure: "Your account identity was restored, but your conversation history could not be verified and was not restored." (mirrors the format's own §5 step 3 behavior: Identity success is kept, Data Part is dropped, never silently merged.) |
| profile-already-exists collision | `already-exists`: "A profile already exists here. Unlock it instead of creating a new one." | Restoring never targets an existing populated profile (profile isolation is a hard requirement — §5 of `00_gate_decision.md`), so this exact collision cannot occur mid-restore. It CAN occur at the picker step if the user is somehow directed at an occupied target; reuse the identical existing copy verbatim rather than a bundle-specific variant — same cause, same fix (unlock the existing one instead). |
| `seed-unavailable` | "Secure crypto (the compiled WASM module) is not available on this device build." | Reused verbatim, unchanged — a Recovery Bundle restore needs the same WASM authority as ordinary unlock/create; no new copy needed. |

All five reuse the SAME screen chrome the Recovery screen already has
(diagnostic-code text + "Copy diagnostic code" + retry where retry is safe)
rather than a bundle-specific error page — this is a deliberate "don't
invent a parallel system" choice per the mission brief.

## 4. Old-backup rollback warning

**Recommendation: warn-and-confirm, never silently merge, and never hard
block.**

UI hook (shown in the Inspect step, §2, at the
`{{OLD_BACKUP_ROLLBACK_WARNING}}` placeholder):

```
⚠ This Recovery Bundle was created on <bundle createdAt>, which is older
  than the most recent activity this app has on record for this account
  (<local reference timestamp>). Restoring it may bring back deletion
  requests, device trust decisions, or identity changes that were later
  superseded. Continue only if you understand this file is out of date.
  [ ] I understand this bundle may be older than my most recent data.
  [ Restore anyway ]  (disabled until checked)
```

One-sentence reason: restore always writes into a brand-new, empty profile
(never overwrites/merges an existing one — profile isolation is already a
hard requirement), so there is no destructive-merge risk to block against,
only a *stale-data-resurrection* risk the operator can evaluate for
themselves once warned — blocking outright would also trap the legitimate
"my only surviving device is old" case with no override.

**Explicitly flagged for confirmation, not resolved here:** this hook
assumes a reliable "most recent local activity timestamp for this account"
signal exists to compare `manifest.createdAt` against. Whether that signal
is trustworthy (and whether `device-registry`/`deletion-request-*` rollback
is even mechanically possible given how those logs are append-only) is
Agent C's rollback-analysis question (`02_rollback_analysis.md`), not
something this UX Stage verifies. If Agent C finds no such comparison is
mechanically safe/available, this warning step is simply omitted (fall back
to no comparison, proceed straight to passphrase) rather than faked.

## 5. Explicit non-goal: no automatic restore

This flow **never** scans for a Recovery Bundle file near the app (Downloads,
Desktop, a well-known filename) and never offers to restore it automatically
on launch, even as a "convenience" suggestion chip on the `welcome` screen.
Every restore requires the operator to explicitly pick a file via an OS file
dialog (`Choose Recovery Bundle file…`), exactly once per attempt, mirroring
Archive's own "Choose archive file…" discipline. This is the arc's own hard
requirement against silent/implicit restoration of stale state (§4 above already
shows why: an unattended auto-restore would have no human in the loop to
evaluate the very rollback warning this design just added). No code path in
this design reads any filesystem location the operator did not just pick in
that dialog.

## Riskiest UX decision flagged for confirmation

Two candidates were considered for the `recovery-required` escape hatch
(§0/entry point B): (a) let restore-from-bundle repair the SAME profile in
place, or (b) always create a separate fresh profile and leave the broken
one on disk untouched, as recommended above. (b) is recommended because it
is the only option consistent with the format's own "profile isolation" hard
requirement and because it makes the broken profile available for forensic
inspection/support diagnosis rather than being overwritten — but it does
mean an operator who restores from Recovery Bundle after a `recovery-required`
event ends up with **two profile directories on disk** (the broken original
+ the freshly restored one), and this design does not yet specify whether/how
the UI ever offers to clean up the orphaned broken one. Flagging this as the
single riskiest open UX question for the format-owner agent to confirm: is a
leftover broken profile directory an acceptable permanent disk artifact, or
does a future Stage need an explicit "discard this unrecoverable profile"
action (itself security-sensitive — it would be a real, human-confirmed
delete of otherwise-unrecoverable ciphertext)?

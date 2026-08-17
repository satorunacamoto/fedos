# Recovery Bundle — Implementation Status Check

Read-only verification pass. No shell was used (Read/Grep/Glob only, per
instruction). All citations are file:line against the working tree at
`C:\wt\disaster-recovery-portable-backup`.

---

## 1. `ux-recovery-flow.md` — summary and P0 disclosure-requirement cross-check

**Summary (~150 words):** The doc (Agent D) proposes reusing existing
lifecycle states rather than adding a new one: "Restore from Recovery
Bundle" becomes a new action wired into two already-real onboarding states
— `absent` (fresh machine, primary case) and `recovery-required` (escape
hatch, restores into a *separate fresh* profile, never repairs the broken
one in place). Export gets a second panel on the existing "Recovery
material" screen with an Identity-only vs. Identity+history radio choice
and a fixed, always-visible exclusion list. Restore mirrors Archive's
"choose file → Inspect manifest (no passphrase yet) → enter passphrase →
restore" shape, followed by a new per-category post-restore summary using a
closed four-value vocabulary (RECOVERED / REESTABLISHED / PARTIAL / LOST).
Failure copy reuses the existing `RECOVERY_EXPLANATIONS` vocabulary
side-by-side rather than inventing a parallel one. An "old-backup rollback"
warning step is proposed but explicitly conditional on a rollback-analysis
question the doc defers to Agent C.

**P0 disclosure requirement (02 §3) — only PARTIALLY reflected, real gap to flag:**

`02_restore_import_coordinator_requirements.md:22` requires two things: (a)
"the restore UX MUST show the bundle's export timestamp prominently before
the operator commits," and (b) "the post-restore summary MUST state plainly
that any deletions made after that export timestamp will not be reflected,"
plus (c) the per-category table must classify this **PARTIAL**, never
RECOVERED, "with the staleness caveat named explicitly."

- **(a) is satisfied, concretely, today**: the Inspect screen at
  `ux-recovery-flow.md:154` ("Created: `<createdAt, formatted local time>`")
  shows the export timestamp before the passphrase is ever requested
  (`ux-recovery-flow.md:161-164` — passphrase strictly follows Inspect).
  This is real, drafted copy, not a placeholder.
- **(b) and (c) are NOT yet satisfied as concrete copy.** The post-restore
  summary's "Deletion / suppression history" row
  (`ux-recovery-flow.md:199-200`) is left as two unresolved template
  placeholders — `{{DELETION_CLASSIFICATION}}` and
  `{{DELETION_CLASSIFICATION_DETAIL}}` — with no drafted text stating "any
  deletions made after the export timestamp will not be reflected," and no
  literal "PARTIAL" value written in. The doc's own framing
  (`ux-recovery-flow.md:178-182`) explains this is deliberate — the actual
  per-category verdicts are said to await "Agent A/B's empirical
  bundle-format work and Agent C's rollback red-team, which may not have
  landed yet" — but as of this check, Agent C's red-team (§3 findings below)
  and `02_restore_import_coordinator_requirements.md` itself **have**
  landed and **do** mandate PARTIAL + explicit staleness language, and
  `ux-recovery-flow.md` has not been updated to fill that placeholder in
  accordingly. The generic old-backup rollback warning at
  `ux-recovery-flow.md:245-253` covers similar ground ("may bring back
  deletion requests... superseded") but is explicitly conditional/optional
  per `ux-recovery-flow.md:261-270`, and even if shown, it is not the same
  artifact as the post-restore summary's per-category PARTIAL classification
  the requirement calls for.

**Verdict: gap confirmed, not closed.** The timestamp-prominence half of
the P0 requirement is done; the "post-restore summary states plainly" +
"classify PARTIAL not RECOVERED" half is still an open template placeholder
in the UX doc, not resolved copy. High confidence (direct line citations,
requirement text quoted verbatim from `02_restore_import_coordinator_requirements.md:22`).

---

## 2. The six `src/os/messenger/desktop/recovery/*.ts` files

All six are **real, substantive implementations** — none are
stubs/skeletons. No `TODO`, `FIXME`, `XXX`, `placeholder`, or
`throw new Error("not implemented")` markers were found in any of the six
files (full-file read of each; none present). High confidence.

| File | Verdict | Notes |
|---|---|---|
| `fedos_recovery_bundle_profile_selection.ts` | Real, complete | `FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS` (lines 23-44) and `FEDOS_RECOVERY_BUNDLE_EXCLUDED_LOGS` (lines 53-69), plus two pure resolver functions (lines 72-85). |
| `fedos_recovery_bundle_encryption.ts` | Real, complete | `FedosRecoveryBundleEncryptionAuthority` class, 3 methods: `build()` (119-184), `restoreIdentity()` (196-205), `restoreDataPart()` (214-251). |
| `fedos_recovery_bundle_header.ts` | Real, complete | Fixed-width header encode/split, 78 lines total, no gaps. |
| `fedos_recovery_bundle_manifest.ts` | Real, complete | Manifest build + structural validator, 91 lines total. |
| `fedos_recovery_bundle_data_part_codec.ts` | Real, complete | Deterministic sorted-entry length-prefixed codec, encode (71-82) + decode (90-121), fails closed on all malformed-input branches. |
| `fedos_recovery_bundle.ts` | Real, complete | Container type + structural validator (43-60) + serialize/deserialize (63-77). |

**Profile-selection cross-check against `01_recovery_bundle_format.md` §2 — MATCHES exactly.**

- `deviceRegistryLogFile` — excluded, `fedos_recovery_bundle_profile_selection.ts:54` ("trust-rollback risk"). Matches doc's `device-registry` exclusion row (`01_recovery_bundle_format.md:64`).
- All four `direct-ratchet-*` logs — excluded, `fedos_recovery_bundle_profile_selection.ts:57-59` (`directRatchetSessionLogFile`, `directRatchetSealedSecretLogFile`, `directRatchetResetRecordLogFile`, `directRatchetImportRecordLogFile`). Matches doc row at `01_recovery_bundle_format.md:66`.
- `peerCapabilityObservationLogFile` — excluded, `fedos_recovery_bundle_profile_selection.ts:60`. Matches `01_recovery_bundle_format.md:67`.
- The two Own-Device-Sync `sync-*` logs — actually **three** are excluded, not two: `syncJournalLogFile`, `syncScheduleLogFile`, `syncConflictLogFile` (`fedos_recovery_bundle_profile_selection.ts:61-63`), matching `01_recovery_bundle_format.md:68`'s own `sync-journal`, `sync-schedule`, `sync-conflict` (the doc also lists three, so the task prompt's "two ... sync-* logs" underspecifies it — code and doc agree with each other at three, just not with the prompt's phrasing).
- Also cross-checked the 20-entry `INCLUDED` list (`fedos_recovery_bundle_profile_selection.ts:23-44`) against the doc's `01_recovery_bundle_format.md:49-57` list — same 20 logical names, same set.

No mismatch found between code and doc. High confidence (direct line-by-line diff of both lists).

**`fedos_recovery_bundle_encryption.ts` crypto-path check — matches design exactly, no deviation.**

- Imports `encrypt`/`decrypt`/`exportCiphertext`/`importCiphertext` from the real Runtime WASM wrappers (`fedos_recovery_bundle_encryption.ts:29-32`), not a new primitive.
- `build()` calls `this.#masterSeedAuthority.resolveConversationKey(accountIndex, selfAccountPublicKeyHex)` at line 144 — the same call `01_recovery_bundle_format.md:90` and `00_gate_decision.md:18` specify.
- Uses `AeadAadDomain = "Conversation"` (line 40) — "the SAME domain the Archive and Sync Package already reuse. No new domain variant" (line 18-19 comment), matching the gate decision's "no new `AeadAadDomain` variant" claim (`00_gate_decision.md:104`).
- `restoreIdentity()` calls `this.#masterSeedAuthority.restoreSealed(envelope, passphrase)` (line 200) — the exact existing primitive the gate decision names.
- No new/different crypto primitive found anywhere in the file. **No design violation.**

---

## 3. Prior-decision docs cited in `00_gate_decision.md`

**`docs/secure_runtime_alpha_433_sealing_key_authority_decision.md` (~100 words):**
Evaluated six options for the key that wraps the sealed Master Seed
envelope; adopted **Option B — user-passphrase-derived, Argon2id**, deriving
the wrapping key fresh inside Rust on every `seal()`/`restoreSealed()` call
(never persisted, never returned to TypeScript). Rejected: OS-bound DPAPI
(deferred, no real Host caller wired), a separate randomly-generated
OS-store key (no such store exists), hardcoded key, and device-metadata-derived
key (both absolutely prohibited). Confirms the envelope and
passphrase are both portable to a new device by design — the underlying
mechanism does not block migration, though this Arc did not build the UI
for it. Uses a new, dedicated `AeadAadDomain::MasterSeedSealing` domain,
never reusing `RootKey`/`Storage`.

**Does it contradict/add nuance to `00_gate_decision.md`/`01_recovery_bundle_format.md`?** No
contradiction. It is the direct source of `00_gate_decision.md`'s claim
that the Identity Part's underlying mechanism is "portable across
machines... by design" (`00_gate_decision.md:17`, quoting this decision's
own line verbatim). One nuance worth restating: Option A (DPAPI) is
explicitly *not rejected forever* — it is deferred pending a real Desktop
Host integration point (`secure_runtime_alpha_433...:51-57`) — so if a
future arc ever adds DPAPI-backed sealing, this Recovery Bundle design's
"reuse `seal`/`restoreSealed` verbatim" assumption would need re-checking
against whichever wrapping-key option is live at that time; not an issue
today since Option B is what's actually implemented.

**`docs/reviews/private_conversation_security/17_backup_multi_device.md` (~100 words):**
Classifies what recovers deterministically from the Master Seed alone
(identity/signing keys, DM pairwise conversation keys — both "Yes") versus
what does not (group/epoch keys, message ciphertext bodies, membership
state, invitation/capability state, key-epoch history — all "No," per
Alpha 144's threat model). Recommends **both** strategies for different
halves of the problem: deterministic-from-seed recovery for keys, plus
wrapped-random-key backup (using the same Master-Seed-derived wrapping key)
for non-deterministic keys — but states plainly that neither strategy
recovers the actual **data** (ciphertext bodies, membership/capability/epoch
history), which needs its own separate durability story. States a hard
containment property: any future conversation-key backup wrapping key must
come from a domain-separated leaf of the hierarchy, never derived directly
off the raw Master Seed.

**Does it contradict/add nuance?** No contradiction; it is the direct
source of the gate decision's "domain-separated leaf, never bypass the
hierarchy" hard constraint (`00_gate_decision.md:33-36`, which quotes it
almost verbatim) and confirms `resolveConversationKey` already satisfies
it. One nuance: §17 frames "message ciphertext bodies" and "membership/
capability/epoch history" as needing a **separate data backup** distinct
from key recovery — which is exactly what the Data Part (§2 of
`01_recovery_bundle_format.md`) now is. §17 itself does not design or
anticipate the curated-NDJSON-log Data Part; it only names the requirement
("data recovery is a different problem than key recovery... requires §07's
own durability story") that the Data Part later fulfills. No tension found
between the two documents.

---

## 4. Files not previously named — glob results

**`docs/reviews/fedos_disaster_recovery_portable_backup_v1/**` — 5 files beyond the 4 already read:**

- `DESIGN.md` — an **earlier, superseded** design draft (status header:
  "DESIGN_ONLY"). Proposes a *different*, now-abandoned container shape (a
  single AEAD-sealed blob with bundle-specific passphrase, tar-style
  payload, and a claimed-new `seal_recovery_bundle`/`restore_recovery_bundle`
  Rust surface — `DESIGN.md:27-41`) that the later `00_gate_decision.md`
  explicitly supersedes with a two-part container requiring **zero** Rust
  changes (`00_gate_decision.md` §4, title: "Zero Rust changes confirmed").
  Superseded, not currently authoritative.
- `UX_FLOW_DRAFT.md` — an earlier UX draft written against `DESIGN.md`
  (its own header says so: `UX_FLOW_DRAFT.md:3-9`), including a
  bundle-specific passphrase flow that no longer matches the shipped design
  (the current design reuses the unlock passphrase's own Master Seed
  envelope verbatim — no separate bundle passphrase). Superseded by
  `ux-recovery-flow.md`.
- `RED_TEAM.md` — an earlier red-team pass against `DESIGN.md` §4-§6
  specifically (its own header: `RED_TEAM.md:3-8`). Findings include a
  **confirmed hole**: `FedosIdentityTransitionOutboundNotificationCoordinator`'s
  publish/notify path has zero production callers anywhere outside its own
  unit tests (`RED_TEAM.md:23`) — relevant if a future restore flow ever
  tries to "notify known peers of a new device" per `DESIGN.md` §4's
  (superseded) recommendation; worth checking whether
  `rollback-identity-truth-red-team.md` (the doc already read) still relies
  on this same coordinator before the import coordinator is built. Superseded
  in scope by `rollback-identity-truth-red-team.md`, but this specific
  finding (dead publish path) was not restated verbatim in the docs already
  reviewed, so it is flagged here as a live, unresolved observation worth
  re-checking.
- `FRESH_MACHINE_RESTORE_TRACE.md` — an earlier trace (Agent B), whose own
  header explicitly flags that `DESIGN.md` is *not* this arc's current head
  document and that its own per-asset table is "already-superseded-in-intent"
  by `01_recovery_bundle_format.md`/`00_gate_decision.md`
  (`FRESH_MACHINE_RESTORE_TRACE.md:8-26`). Confirms (as of its own writing)
  that no restore orchestrator existed yet, consistent with what this check
  independently found in part 4 below. Likely the source `02_...md:27`
  means by "`fresh-machine-restore-findings.md`" — **note the filename
  mismatch**: `02_restore_import_coordinator_requirements.md:27` cites
  `fresh-machine-restore-findings.md`, but the actual file on disk is named
  `FRESH_MACHINE_RESTORE_TRACE.md`. No file named `fresh-machine-restore-findings.md`
  exists anywhere in the glob results — either a stale cross-reference or a
  rename that wasn't propagated. Worth confirming with whoever owns Agent B's
  output before relying on that citation.

**Also worth flagging:** `00_gate_decision.md` repeatedly cites a
`03_asset_classification.md` (lines 106, 126, 129) as the home of "the
per-asset table" and the pending Commerce-receipts/Tor-settings
disposition. **No file named `03_asset_classification.md` exists** in the
glob results for this review folder. Either it was never written, or its
content was folded into `01_recovery_bundle_format.md` (which does contain
an exclusion table, `01_recovery_bundle_format.md:61-71`) without renaming
the citations in `00_gate_decision.md`. This directly affects part 1's
finding too: the `{{COMMERCE_RECEIPTS_CLASSIFICATION_NOTE}}` placeholder in
`ux-recovery-flow.md:104` is explicitly waiting on this same
never-materialized file.

**`src/os/messenger/desktop/recovery/**`** — glob returned exactly the same
6 files already named in the task (`fedos_recovery_bundle_data_part_codec.ts`,
`fedos_recovery_bundle_manifest.ts`, `fedos_recovery_bundle_header.ts`,
`fedos_recovery_bundle.ts`, `fedos_recovery_bundle_profile_selection.ts`,
`fedos_recovery_bundle_encryption.ts`). **No import/restore coordinator file
and no test file exist yet anywhere under this directory** — confirms
`02_restore_import_coordinator_requirements.md:3`'s own claim ("No
`fedos_recovery_bundle_import_coordinator.ts` (or equivalent restore path)
exists yet") is still accurate as of this check. High confidence (direct
glob, not a search-window-limited tool).

### Summary of new findings from part 4

1. Four docs (`DESIGN.md`, `UX_FLOW_DRAFT.md`, `RED_TEAM.md`,
   `FRESH_MACHINE_RESTORE_TRACE.md`) are earlier-stage drafts, superseded by
   the four docs already reviewed — safe to treat as historical/context only,
   not authoritative.
2. `03_asset_classification.md`, cited three times in `00_gate_decision.md`,
   does not exist on disk. Its promised content (Commerce receipts / Tor
   settings disposition) is the same gap `ux-recovery-flow.md` leaves as an
   unresolved placeholder.
3. `RED_TEAM.md` contains one finding (dead identity-transition-publish
   path) not restated in the currently-authoritative red-team doc — worth a
   deliberate check, not just an assumption it's superseded.
4. Filename mismatch: `02_restore_import_coordinator_requirements.md`'s
   citation of `fresh-machine-restore-findings.md` does not match the actual
   file `FRESH_MACHINE_RESTORE_TRACE.md`.
5. No import coordinator, no test file — restore path is still 100% unwritten,
   confirming `02_restore_import_coordinator_requirements.md`'s own premise
   still holds.

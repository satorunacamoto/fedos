# Recovery Bundle v1 — Final Asset Classification (fills the gap `00_gate_decision.md`/`02_restore_import_coordinator_requirements.md` both cite and neither wrote)

Synthesizes `00_gate_decision.md`, `01_recovery_bundle_format.md`, `02_restore_import_coordinator_requirements.md`,
`rollback-identity-truth-red-team.md` (Agent C — mechanically verified, treat as authoritative over any
conflicting claim below), `ux-recovery-flow.md`, `IMPLEMENTATION_STATUS_CHECK.md`, and this session's
supplementary research (`FRESH_MACHINE_RESTORE_TRACE.md`, `RED_TEAM.md`, `UX_FLOW_DRAFT.md`, `DESIGN.md` —
all written independently, before this session discovered the pre-existing work above; kept as cross-checks,
not as the primary design).

Classification vocabulary is the mission's own: **RECOVERED** (fully restored, no caveat) / **REESTABLISHED**
(deliberately not restored — rebuilt fresh through an existing live mechanism) / **PARTIAL** (restored with a
named, disclosed limitation) / **LOST** (not restorable by this or any mechanism, today).

| Asset | Classification | Why |
|---|---|---|
| **IDENTITY** | **RECOVERED** | `master-seed.sealed.json` copied byte-for-byte as the bundle's Identity Part; `restoreSealed()` deterministically reconstructs every seed-derived key. Real, shipped, RFC-9106-KAT-verified code path (`01_recovery_bundle_format.md` §3, `fedos_recovery_bundle_encryption.ts:200`). |
| **CONTACTS** | **RECOVERED** (as a derived byproduct — no first-class store exists) | Confirmed no dedicated Contacts/Roster/AddressBook store anywhere reachable from production (`src/os/messenger/contacts/README.md` documents the bucket as deliberately empty/reserved; `FRESH_MACHINE_RESTORE_TRACE.md` §1). What a user would call "contacts" is derived from `conversation-membership.ndjson`, which IS included in the Data Part. |
| **CONVERSATIONS / MESSAGES** | **RECOVERED** | Pairwise conversation keys derive from `resolveConversationKey(accountIndex, counterpartyPublicKeyHex)` — a pure function of the Master Seed, not device-bound. `board`, `outbox`, `conversation*`, `conversation-membership`, `conversation-invitation-received`, `conversation-draft`, `conversation-capability` are all in `FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS` and confirmed present in the actual `fedos_recovery_bundle_profile_selection.ts` code (`IMPLEMENTATION_STATUS_CHECK.md` §2). |
| **DEVICE TRUST** | **REESTABLISHED** | `deviceRegistryLogFile`/`deviceBindingReplayLogFile` are excluded from the Data Part by design specifically to close the "revoked device silently re-trusted" P0 (`rollback-identity-truth-red-team.md` §3, confirmed no monotonicity/tombstone mechanism exists to make inclusion safe). The **not-yet-written** import coordinator must mint a fresh device identity (never carry `profile.json.localDeviceId` forward) — `02_restore_import_coordinator_requirements.md` requirement 1. `FRESH_MACHINE_RESTORE_TRACE.md` §3 confirms the real production device-bootstrap path (`#bootstrapLocalDevice()`) is a self-contained single-process loopback requiring no second trusted device present — restoring alone on a fresh machine is mechanically possible today, once that coordinator exists. |
| **COMMERCE RECEIPTS** | **LOST** | No durable storage exists anywhere on this branch — `os/commerce/creator/entitlement.ts:22`: "inert scaffolding, not reachable from the shipped Electron app." Not a Recovery Bundle defect; nothing to back up. Pre-existing gap, out of this arc's scope. |
| **PURCHASED CONTENT** | **LOST** | Same reason as Commerce Receipts. |
| **RATCHET** | **REESTABLISHED** | All four `direct-ratchet-*` logs plus `peer-capability-observation` excluded by construction (`01_recovery_bundle_format.md` §2 table, confirmed in code). Cryptographically restorable in principle (wrapping key is Master-Seed-derived, not per-machine-secret-derived) but deliberately not restored — a live Double-Ratchet chain must exist on exactly one device; restoring old chain state risks chain-key duplication across the lost and replacement device. Sessions renegotiate at generation 0 via the existing `fedos_direct_ratchet_reset_coordinator.ts` path on next contact. |
| **TOR SETTINGS** | **LOST** (effectively N/A) | No persisted field exists anywhere (`FedosSettingsDescriptorV1` covers only Archive Directory / Auto Start / Auto Lock Timeout / Window Layout). Pre-existing gap. Positive side effect: the hard requirement "no stale live Tor Ready restoration" is automatically satisfied — there is nothing to restore. |
| **Identity Transition / Signed Deletion truth (audit trail)** | **PARTIAL** | Included in the Data Part. `identity-transition-*` rollback fails toward *re-review*, not silent re-trust (`FINAL_ACCEPTANCE_STATES` can never be silently re-promoted — `rollback-identity-truth-red-team.md` §2) — safe but requires a manual re-verification click the operator should be told to expect. One residual question is explicitly still open, not yet resolved either way: whether an absent/stale local-decision record could ever let a peer's *already-superseded* rotation slip through on re-evaluation (`02_restore_import_coordinator_requirements.md` row 2) — must be checked against `fedos_identity_transition_peer_runtime.ts`'s actual evaluation order before this classification can be upgraded to RECOVERED. |
| **Message/payload deletion state** (`conversation-payload-retention.ndjson`) | **PARTIAL — the sharpest finding in this arc** | This is the live P0 (`rollback-identity-truth-red-team.md` §1, `02_restore_import_coordinator_requirements.md` row 3): restoring a bundle silently undeletes any message tombstoned/removed *after* the bundle's export timestamp, with zero trace that it was ever deleted — `readPayload()` returns plaintext indistinguishably from a never-deleted message. Not fixable by "restore only into a fresh profile" (there is nothing newer to defer to; the bundle itself is what's stale). **Not a code fix — an operator-disclosure requirement**: the restore UX must show the bundle's export timestamp prominently and the post-restore summary must name this caveat explicitly. `ux-recovery-flow.md` currently has the export-timestamp half done but the post-restore-summary half is still an unresolved `{{DELETION_CLASSIFICATION}}` placeholder (`IMPLEMENTATION_STATUS_CHECK.md` §1) — **must never ship as "RECOVERED."** |

## Overall machine-loss recovery verdict

Given a Recovery Bundle exists and was exported before loss: **IDENTITY, CONTACTS, CONVERSATIONS, and MESSAGES
recover fully.** DEVICE TRUST and RATCHET correctly do not attempt to recover — they reestablish, by design,
through mechanisms that already ship. COMMERCE RECEIPTS, PURCHASED CONTENT, and TOR SETTINGS were never
durable to begin with, independent of this arc. The one place this design is not yet honest by default is
deletion/retention state, which silently reverts unless the (not-yet-finished) UX explicitly discloses it —
this is the one item standing between "PARTIAL, disclosed" and "PARTIAL, silently misleading."

**If no Recovery Bundle was ever exported**: everything above reverts to whatever the *raw whole-profile-copy*
path in `docs/desktop_beta_user_guide_backup.md` still provides today — IDENTITY/CONVERSATIONS/MESSAGES likely
still work (same underlying portability), but with zero manifest/tamper/version validation, and RATCHET/DEVICE
TRUST/deletion-state risks apply in the *worse*, unmitigated form (§2 of `00_gate_decision.md`).

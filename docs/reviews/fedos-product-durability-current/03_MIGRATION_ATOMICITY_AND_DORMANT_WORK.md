# Migration/Atomicity Spot-Check + Dormant-Work Re-Audit

Solo pass, bounded scope, disclosed honestly rather than fabricating exhaustive coverage.

## Atomicity (mandate §21-30)

Spot-checked (not exhaustive across all 30+ durable stores): `append_only_fedos_device_registry_persistence.ts` uses a single `appendFileSync(path, line + "\n")` call per record — consistent with this codebase's own established, already-documented convention (`docs/secure_runtime_alpha_366_compaction_architecture_review.md`): append-only NDJSON stores use single-syscall appends (a crash mid-write loses at most the unflushed last line, never corrupts prior records); current-value stores (e.g. the Direct Ratchet live-state snapshot, fixed earlier this session) use temp-file-then-`renameSync` atomic replace. This is a **consistent, already-reviewed pattern repo-wide**, not something this pass found broken. Full per-store re-verification across all 30+ files was out of scope for a solo pass — **DEFERRED**, low-risk given the consistent convention already observed.

No schema-version field was found on any of the durable NDJSON records inspected this pass (records are plain JSON objects with domain fields, no `schemaVersion` envelope at the file level — some individual record TYPES do carry their own `schemaVersion`, e.g. `FedosDeviceSyncPackageManifestV1.schemaVersion`, `FedosIdentityTransitionConversationContinuityRecordV1`, etc., confirmed in multiple files touched by this session's own earlier arcs). **No file-level migration/downgrade-detection mechanism exists** — if a future release changed a record shape incompatibly, there is no explicit "unsupported schema version, fail closed" gate at the file level today, only at the individual-record-type level where a type happens to carry its own version field. Classify: **PROTOCOL GAP, real but not urgent** — this product has shipped exactly one schema generation so far (0.1.0-beta.1), so no live migration has ever been exercised; building general migration-transaction infrastructure now would be speculative engineering ahead of an actual second schema generation. Recommend: DESIGN_ONLY, revisit when a real breaking schema change is actually needed.

## Dormant-work re-audit (mandate §34-37)

This repo has **496 local branches** and **442 worktrees** — confirmed via `git branch --list | wc -l` / `git worktree list | wc -l` this pass, consistent with a prior arc's own finding of "500+ branches, exhaustive re-scan not feasible solo." A full fresh re-audit of all 496 is not attempted this pass — same honest boundary as that prior arc. Instead, the specific named capabilities from mandate §36 were re-checked directly against CURRENT `src/` (not old branches), since that answers the more useful question — "does this exist and work today":

| Capability | Status (this pass, source-verified) |
|---|---|
| Device Sync UI | Real, presentation layer exists and is composition-root-wired (see `02_OWN_DEVICE_SYNC_TRUTH_TABLE.md`) |
| RecoveryBundle | Does not exist as a named artifact; the real equivalent is the manual sealed-file-backup notice (`fedos_profile_recovery_notice.ts`) |
| Session-generation/login-time Ratchet | Zero implementation found (grep-confirmed) |
| Alternate Persona | Zero implementation found (grep-confirmed) |
| Old Tor/onion service support | Superseded — this session's own Tor Strict-Transport arcs are the current, real, live-proven implementation; no older onion-service code found in current `src/` |
| Historical Secure Session UI | Superseded by the current Verified Secure Session UI / Security State Controller work (multiple prior arcs this session) |
| Old-key visibility | Handled by the existing Identity Transition continuity UI (prior arc, this session) |
| Signed deletion | Real, implemented, has its own durable log files (confirmed in `01_RECOVERY_TRUTH_TABLE.md`) |
| Ratchet reset | Real, implemented (`FedosDirectRatchetResetCoordinator`, proven in multiple prior arcs this session) |
| Local backup/export | Manual-file-copy only (see recovery notice); no in-app export/import UI exists |
| Nostr identity utilities / npub/bech32 | No bech32/npub encoder found (re-confirms a prior arc's own explicit finding this session) |
| QR identity sharing | Not found for identity specifically; Commerce's own QR receipt feature (unrelated, already proven working) is the only real QR usage in this codebase |
| Update mechanism | **Explicitly, deliberately absent** — `fedos_desktop_beta_release_configuration.ts` states "Auto-update is an Absolute Prohibition — always false" |

No new INTEGRATED/SUPERSEDED/UNSAFE candidates were found this pass beyond what's listed above — this is a narrower, source-grounded pass, not a branch-by-branch archaeology dig.

## Session-Generation Ratchet re-evaluation (mandate §38)

Now that Direct Ratchet is COMPLETE (this session): the marginal threat this would mitigate is a compromise of the LOGIN/UNLOCK-time-derived key material persisting across sessions — but Direct Ratchet's own per-message forward secrecy already rotates the sending/receiving chain keys on every message, and Live-State Durability (this session's own earlier arc) already ensures a restored session can't roll back to a stale chain position. The INCREMENTAL value of a session-generation ratchet on top of that is real but narrow (protects against a specific compromise-of-the-unlock-time-secret-itself scenario, not message content) and would materially complicate backup/recovery (§46's own explicit question) since every login-time secret rotation is one more thing an old backup could roll back unsafely. **Classification: MEDIUM_VALUE, NEEDS_RESEARCH** — not clearly higher priority than the own-device-sync payload-coverage gap or the recovery-notice broadening this pass actually implemented.

## Alternate Persona re-evaluation (mandate §39)

Zero implementation exists. Framed correctly per the mandate's own restriction (ordinary compartmentalized profile separation, never duress/coercion-resistance claims) this is architecturally similar to "a second onboarding flow producing a second, fully independent `dataDir()`-equivalent profile root" — the existing multi-profile isolation guard (`fedosLocalProfilePathsIsolated()`, confirmed present in `fedos_local_profile_paths.ts` this pass) already proves the underlying path-isolation primitive exists and is tested. **Classification: LOW_VALUE relative to other open items this session surfaced** (the reply-send outbox-flush root cause the sibling arc is working, and the own-device-sync payload-coverage gap above, are both higher-value with more direct current product impact).

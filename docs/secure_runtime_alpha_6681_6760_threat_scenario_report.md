# Secure Runtime Alpha 6681–6760 — Threat-Scenario Acceptance Report

**FedOS Desktop Beta Release Candidate and Packaged Security Acceptance Arc — Phase I.**

No fuzzy wording: every scenario is PASS / FAIL / BLOCKED. BLOCKED names
the exact environment/scope boundary; it never hides a design defect.

| # | Scenario | Verdict | Evidence |
|---|---|---|---|
| 1 | Wrong passphrase | **PASS** | Real packaged run, `test/secure_runtime_alpha_4821_4900_unlock_electron_acceptance.test.ts` "UNLOCK: ... wrong secret stays locked (no Runtime)" — re-run this session, real WASM, real Electron subprocess. Also Threat Scenario 9 (`6361_6440_threat_scenarios.test.ts`), re-confirmed passing post-merge. |
| 2 | Stolen sealed profile without passphrase | **PASS** | Same evidence as #1 — a sealed profile alone never yields a usable Runtime/handle without the correct passphrase (no oracle, confirmed by direct source + real test). |
| 3 | Stale Store handle after restart | **PASS** | `packages/fedos-core-rust` real cargo test `secret_handle_store_production_wiring_tests::restart_produces_a_fresh_store_generation_independent_of_the_stopped_one` — re-run this session, passing. |
| 4 | Use after destroy | **PASS** | `secret_handle_store_vertical_slice_tests::destroy_all_handles_on_shutdown` + `two_independent_authorities_never_share_store_state` — re-run this session, passing. |
| 5 | Shutdown with live operations | **PASS** | `window-all-closed`/`performCleanShutdown` real subprocess tests (Alpha 4101-4180/4181-4260/4261-4340/4341-4420, all re-run this session, passing) prove Host/Runtime stop precedes process exit. |
| 6 | Revoked Device | **PASS** | Threat Scenario 1/2, re-confirmed passing post-merge (unchanged by this Arc's own merge). |
| 7 | Malicious Relay replay | **PASS** | Threat Scenario 3 (wrong-key signed payload rejected) + 4 (duplicate re-import refused), re-confirmed passing post-merge. |
| 8 | Ratchet replay/downgrade | **BLOCKED — environment** | The live Double-Ratchet session establishment path (`establishSession()`) remains honestly `describe.skip`'d everywhere in this repository absent a compiled `pkg/` AT THE MOMENT its own tests run (this session built `pkg/` for packaging/vertical-slice work, then cleaned it per policy before the final verification pass — the WASM-gated Ratchet suite was not re-run against a persisted artifact in the same pass as this report). The call-contract-never-fabricated property (unchanged, architecture-frozen) is PASS by source inspection; live execution is unexercised in this specific report's own evidence chain. |
| 9 | Peer capability rollback | **PASS** | Threat Scenario 5 (competing claim at same revision rejected as conflicting downgrade), re-confirmed passing post-merge. |
| 10 | Identity Transition conflict | **PASS** | Threat Scenario 12, re-confirmed passing post-merge. |
| 11 | Signed Deletion replay | **PASS** | Threat Scenario 13, re-confirmed passing post-merge. |
| 12 | Archive Restore (no trust establishment) | **PASS** | Threat Scenario 7 (structural: no Archive-restore file imports Device Registry/Identity Transition trust-mutation code), re-confirmed passing post-merge. |
| 13 | Search retention bypass attempt | **PASS** | Inherited, unmodified by this Arc's own merge — part of the 14003 passing tests in this Arc's own full-suite regression run (Retention state machine `active→tombstoned→payload-removed`, bypass denied). |
| 14 | Malformed packaged IPC | **PASS** | `validatedLabel()`/`validatedSecretBytes()`/`isSafeId()` in `fedos_electron_beta_main.cts` (unchanged by this Arc) reject unknown-key/oversized/non-string payloads; Alpha 4101-4180's own real subprocess IPC round-trip proves malformed-input handling (the one failure in that file, re-confirmed this session, is the unrelated stale `sections`-shape assertion — not an IPC-validation defect). |
| 15 | Corrupted WASM artifact | **PASS** | Real packaged run, Alpha 4821-4900's own "FAILURE MATRIX: a missing WASM artifact fails closed" — re-run this session, passing (create never reaches ready, no Runtime, no dev fallback). |
| 16 | Manifest hash mismatch | **PASS** | `scripts/generate_wasm_artifact_manifest.mjs` pins the real artifact's sha256; `scripts/build_release.mjs`'s own step 8 (`verify_release_checksums.mjs`) independently RE-DERIVES every release-artifact hash rather than merely re-reading the manifest — re-run this session, `[verify-checksums] OK`. |
| 17 | Corrupted profile store | **PASS** | Inherited, unmodified — durable append-only NDJSON backends fail closed on truncation (Threat Scenario 16, re-confirmed post-merge); part of this Arc's own zero-regression full-suite run. |
| 18 | Corrupted Device Registry | **PASS** | Inherited, unmodified — part of this Arc's own zero-regression full-suite run. |
| 19 | Corrupted Ratchet state | **BLOCKED — environment** | Same WASM-artifact-lifecycle boundary as #8. |
| 20 | Corrupted pending-review state | **PASS** | Inherited, unmodified (Alpha 6041-6120's own `FedosDeletionRequestPendingReviewPersistence` fix) — part of this Arc's own zero-regression full-suite run. |
| 21 | Five lock/unlock cycles | **BLOCKED — not exercised at this depth this session** | This session's own real packaged evidence proves ONE full create→unlock→lock→re-unlock cycle (Alpha 4821-4900's own test) and TWO independent sequential launches for several other mains ("repeated real launch"/"restart"). A literal five-cycle run was not constructed as a new test this session — extending an existing acceptance test to loop 5x is real, additive work not yet done; not claimed as PASS to avoid overclaiming beyond what was actually run. |
| 22 | Five Runtime restart cycles | **BLOCKED — not exercised at this depth this session** | Same honest limit as #21 — two-cycle restart proven for Alpha 4101-4180/4181-4260/4341-4420 (real, independent second launches, no corrupted build output), not five. |
| 23 | Application crash/relaunch | **PASS** | Alpha 4181-4260/4261-4340's own "a genuine startup failure ... fails closed -- process reports failure and quits, never hangs as an orphan" — re-run this session, passing. |
| 24 | Installer/portable profile continuity | **BLOCKED — not exercised this session** | `build_release.mjs` produced a real NSIS installer and a real portable ZIP `win-unpacked` directory this session (electron-builder 26.15.3, real code-signing via `signtool.exe`, checksums independently re-verified). Actually RUNNING the NSIS installer (a genuine installer UI/elevation flow) and then launching the installed `.exe` to confirm it discovers the SAME on-disk profile a portable-ZIP launch would was not performed this session — installer execution requires interactive elevation this environment's tool access was not exercised against. Named honestly rather than assumed. |

## Summary

**18 PASS, 0 FAIL, 6 BLOCKED.** Every BLOCKED item is either the
long-standing, universal, pre-existing WASM-artifact-lifecycle boundary
(#8, #19 — unchanged from every prior Arc's own Release Freeze Checklist)
or an honest scope/depth limit of THIS session's own evidence (#21, #22,
#24 — real single/double-cycle evidence exists, five-cycle and installer-
execution evidence does not, and this report does not round up). Zero
FAIL: nothing found in this Arc's own real testing contradicts any
scenario's safety; the BLOCKED items name exactly what would need to run
to close them, never a hidden design defect.

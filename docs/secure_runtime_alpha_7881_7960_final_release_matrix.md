# Secure Runtime Alpha 7881–7960 — Phase M: Final Release Matrix

Legend: **PASS** (verified, real, this session) · **FAIL** (security-correctness
failure — none found) · **BLOCKED** (named environment/construction boundary) ·
**INTENTIONALLY UNSUPPORTED** (explicit scope decision, not a gap) ·
**HISTORICAL/STALE** (a pre-6a2f274 finding, now closed).

| # | Area | Status | Evidence |
|---|------|--------|----------|
| 1 | Production WASM build | PASS | Built fresh in this worktree (`npm run build:wasm` + `build:wasm:manifest`); 8 previously-skipped real-crypto vertical slices now run and pass. |
| 2 | SecretHandleStore / no plaintext leak | PASS | `test/secure_runtime_alpha_7881_7960_writetime_reproduction_benchmark.test.ts` test 4 and repo-wide secret-scan structural guard (test 11) both re-confirm. |
| 3 | Profile unlock (create/lock/relaunch) | PASS | `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`, `secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts` (re-run, passing); this Arc's own canonical slice adds a real relaunch too. |
| 4 | Device Trust / Device Sync (generic) | PASS (existing) / BLOCKED (generalization) | Device Trust/Registry fully reachable (existing). The underlying generic Device Sync relay transport (beyond Suppression) remains `deviceSyncAttemptFn`-only — a pre-existing, disclosed boundary this Arc does not close for OTHER Device Sync consumers (Ratchet/Peer Capability/Identity Transition/Deletion); closed specifically and only for Suppression by this Arc. |
| 5 | Direct Ratchet / NIP-17 reachability | PASS | `secure_runtime_alpha_6841_6920_real_production_vertical_slice.test.ts` re-run, passing, real WASM. |
| 6 | Same-peer Direct Conversation isolation | PASS | `secure_runtime_alpha_7401_7480_real_vertical_slice.test.ts` + `secure_runtime_alpha_7241_7320_multi_conversation_isolation.test.ts` re-run, passing. |
| 7 | Invitation flow | PASS | `secure_runtime_alpha_7081_7160_real_vertical_slice.test.ts` re-run, passing; this Arc's own canonical slice sends two invitations end to end. |
| 8 | Packaged messaging (send/receive, real relay) | PASS | `secure_runtime_alpha_7161_7240_real_production_vertical_slice.test.ts`, `secure_runtime_alpha_7241_7320_long_running_durability_and_reconnect.test.ts` (240 real messages, 2 restarts, 1 reconnect) re-run, passing. |
| 9 | Search | PASS | `secure_runtime_alpha_7401_7480_real_vertical_slice.test.ts`'s own Search-isolation assertions, re-run, passing. |
| 10 | Direct Archive export/restore | PASS | `secure_runtime_alpha_7801_7880_real_vertical_slice.test.ts` re-run, passing (real WASM, no Board-record fabrication); this Arc's own canonical slice additionally exports/restores. |
| 11 | Archive retention parity | PASS | `secure_runtime_alpha_7481_7560_real_vertical_slice.test.ts`, `secure_runtime_alpha_7241_7320_archive_search_retention_interaction.test.ts`, `secure_runtime_alpha_7241_7320_retention_durability_active_conversation.test.ts` re-run, passing. |
| 12 | Multi-Device Suppression (production construction) | PASS | **CLOSED BY THIS ARC.** `secure_runtime_alpha_7881_7960_suppression_production_wiring_real_vertical_slice.test.ts` — real `startFedosDesktopRuntime()` × 2, real relay, real restart. |
| 13 | Multi-Device Suppression (packaged UI reachability) | BLOCKED | No Settings screen exists in the packaged Electron app to toggle `archiveSuppressionSyncEnabled` — the SAME pre-existing, already-disclosed boundary Ratchet/Peer Capability/Identity Transition/Deletion Request already have (Electron E2E review). Production construction itself is real, not blocked. |
| 14 | Observation read/write scalability | PASS | **CLOSED BY THIS ARC.** `secure_runtime_alpha_7881_7960_write_index_performance_acceptance.test.ts` — warm-instance writes O(1) average, not O(T); `d5979ae`'s own subject-read performance unaffected (7641-7720 tests re-run, passing). |
| 15 | Outbox restart hydration | PASS | `secure_runtime_alpha_7561_7640_real_vertical_slice.test.ts` re-run, passing. |
| 16 | Identity Transition reachability | PASS | `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`, `secure_runtime_alpha_7241_7320_identity_transition_active_conversation.test.ts` re-run, passing. |
| 17 | Signed Deletion reachability | PASS | `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts` re-run, passing. |
| 18 | Peer Capability reachability | PASS | `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts` re-run, passing; this Arc's own canonical slice re-confirms alongside Suppression in the SAME Runtime. |
| 19 | Safety Center | PASS | `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`'s own Safety Center assertions, re-run, passing. |
| 20 | Electron security posture | INTENTIONALLY UNTOUCHED | Zero diff under `packages/fedos-desktop-electron-spike/src/main` and `.../src/preload` (structural guard test 12). |
| 21 | Installer / ZIP / checksums | NOT RE-VERIFIED THIS ARC | Out of this Arc's own named scope (no packaging-pipeline change made); last verified by `secure_runtime_alpha_5241_5320_packaging.test.ts` (not re-run this session — no code in that path changed). |
| 22 | Upgrade / migration compatibility | PASS | **NEW THIS ARC.** `secure_runtime_alpha_7881_7960_upgrade_compatibility.test.ts` — 6 scenarios, all old-shape logs/bundles load correctly, no destructive migration. |
| 23 | Shutdown / recovery + secret/path/log scan | PASS | Structural guard test 11 (this Arc); `stop()` ordering verified (Inbound Subscription stopped before shared relay connections). |

## Historical findings, now stale (superseded by `6a2f274` and this Arc)

- "Archive and Scalability lineages are unreconciled siblings" (`4dd227dd`) — **HISTORICAL/STALE**, closed by `6a2f274`.
- "Direct Conversation Archive unavailable" (`4dd227dd`, and Alpha 7321-7400's own original finding) — **HISTORICAL/STALE**, closed by `6a2f274`.
- "Delivery Observation write-time O(T)" (`3a4dd0bf`) — **HISTORICAL/STALE**, closed by this Arc.
- "Suppression authority never constructed in the Desktop Runtime" (`6a2f274`'s own completion declaration) — **HISTORICAL/STALE**, closed by this Arc.
- "redeemInvitation unavailable" / "AUTOTEST-only IPC" / "same-peer misrouting" / "Archive metadata resurrection" — already HISTORICAL/STALE as of prior Arcs (Alpha 7401-7480, 7481-7560, 7801-7880); unchanged by this Arc.

## Pre-existing structural-guard test debt (confirmed NOT caused by this Arc)

Three older Arcs' own structural-guard tests assert a blanket zero-diff on a
file a STILL LATER, legitimate Arc has since extended, and were never
reconciled by that later Arc:

- `test/secure_runtime_alpha_1471_1540_structural_guards.test.ts` (package.json — later Electron-script additions).
- `test/secure_runtime_alpha_7001_7080_structural_guards.test.ts` test 10 (`src/desktop/production_activation` — later production-activation files).
- `test/secure_runtime_alpha_7161_7240_structural_guards.test.ts` test 2 / `test/secure_runtime_alpha_7081_7160_structural_guards.test.ts` test 8 (`fedos_direct_ratchet_outbound_integration.ts` / `fedos_conversation_runtime_assembly.ts` — later, disclosed extensions).
- `test/secure_runtime_alpha_7641_7720_structural_guards.test.ts` test 9 (`fedos_conversation_archive_direct_subject.ts` — a later Arc's own allowlist gap).

Confirmed via `git stash` A/B (these fail identically with this Arc's own
changes stashed out) — **not a regression this Arc introduces**, and out of
this Arc's own named scope to backfill every historical guard's own
allowlist. Recorded here honestly rather than silently ignored.

## Zero security-correctness FAIL

No security-relevant regression found. Full Completion is warranted.

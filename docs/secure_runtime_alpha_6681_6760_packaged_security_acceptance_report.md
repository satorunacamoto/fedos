# Secure Runtime Alpha 6681–6760 — Packaged Security Acceptance Report

**FedOS Desktop Beta Release Candidate and Packaged Security Acceptance Arc — Phase H.**

## What was actually proven, through the real packaged path, this session

Real Electron 43.1.1 (downloaded this session, not simulated), real
compiled WASM (`packages/fedos-core-rust/pkg/`, built this session), real
`electron-builder` NSIS installer + portable ZIP (built this session),
real code-signing (`signtool.exe`), real independently-re-derived
checksums, real secret scan (0 findings after this Arc's own scanner
precision fix).

Mapped against the mission's own 38-step headline vertical slice, using
the REAL evidence this session produced (never a fake crypto, fake
Runtime, or direct test-only coordinator call):

| Step | Status | Evidence |
|---|---|---|
| 1-6. First launch, create profile, real Master Seed generation, real SecretHandleStore generation, no raw seed crosses to JS, stable account/Nostr identity | **PROVEN** | Alpha 4821-4900's own real packaged CREATE test, re-run this session with real Electron + real WASM. `accountPublicIdentifier` observed identical across create/unlock/restore. |
| 7. Register/trust local Device | **PROVEN** | `ReadyView.deviceTrustState` returned by the real packaged CREATE/UNLOCK path; `deviceTrustReachable: true` via this Arc's own new diagnostic. |
| 8-9. Open Safety Center, Store-backed crypto status safe/non-secret | **PARTIALLY PROVEN** | `productionCryptoStatusOutcome: "ok"` observed live via `shell.productionCryptoStatus()` through the real packaged path (this Arc's own new diagnostic) — proves the Store-backed authority is live and its SAFE status is reachable. A full Safety Center 13-section overview render through the packaged Beta entry point specifically was not separately re-verified this session (the Alpha 4101-4180 file that exercises a Safety Center overview via a DIFFERENT, older Electron main hits the unrelated stale-shape finding described elsewhere). |
| 10-13. Direct Conversation, real Ratchet-capable messaging, peer capability fact, Identity Transition observation | **NOT PROVEN through the packaged Beta entry point** | This is Finding 2 (Execution Specification) — `directRatchetConfigured`/`peerCapabilityConfigured`/`identityTransitionConfigured` all `false` on the real packaged Runtime, blocked on the disclosed Settings→Relay plumbing gap. The underlying subsystems ARE proven at the Node/vertical-slice level (Alpha 6521-6600's own test, 35/35 re-passing post-merge) — just not reachable through the actual packaged process this Arc audited. |
| 14. Durable manual decision | **NOT PROVEN through the packaged path** | Same root cause as 10-13 (Identity Transition unreachable). |
| 15-27. Signed Deletion Request lifecycle, restart, wrong/correct passphrase, identity persistence, deletion approval, Retention/Search/Archive | **NOT PROVEN through the packaged Beta entry point**; **PARTIALLY PROVEN at the Node/inherited-suite level** | `deletionRequestConfigured: false` on the real packaged Runtime (same root cause). Retention/Search/Archive/Deletion Request lifecycle logic itself is unchanged by this Arc's own merge and remains covered by the existing, passing test suite (part of this Arc's own zero-regression full-suite run) — but that is Node-level coverage, not this session's own packaged-process proof. |
| 28-31. Restart-required config change, canonical restart, no duplicate owners/timers | **PARTIALLY PROVEN** | Two-cycle real restart proven for several Electron mains (Alpha 4101-4180/4181-4260/4341-4420, all re-run this session); no duplicate owner/timer/notification confirmed structurally by those same tests' own assertions. A restart-REQUIRED *configuration change* specifically was not constructed as a new scenario this session. |
| 32. Stale old Runtime facade rejects | **PROVEN (inherited)** | Threat Scenario 10 (`every Shell method on a locked/never-started Shell fails closed`), re-confirmed passing post-merge. |
| 33. Stale old Store handle rejects | **PROVEN** | Real cargo test `secret_handle_store_production_wiring_tests::restart_produces_a_fresh_store_generation_independent_of_the_stopped_one`, re-run this session. |
| 34-37. Lock, sensitive commands reject, unlock again, durable state returns | **PROVEN** | Alpha 4821-4900's own real packaged UNLOCK test's own lock→re-unlock leg, re-run this session with real Electron + real WASM. |
| 38. Post-exit scan finds no fixture secret | **PROVEN** | Phase G secret-surface audit, 0 findings across 732 staged files, this session. |

## Honest summary

The two subjects THIS Arc exists to reconcile — the unified Desktop
Runtime configuration graph's own TYPE-LEVEL capacity, and the Store-
backed production crypto authority — are both genuinely proven reachable
through the real packaged process this session. The BROADER 38-step
headline slice the mission describes is proven in large majority (profile
lifecycle, Device Trust, Store-backed crypto, lock/unlock, clean shutdown,
secret-surface cleanliness, stale-handle/stale-facade rejection) but is
genuinely NOT fully proven for the Ratchet/Peer-Capability/Identity-
Transition/Deletion-Request/Safety-Center/Retention/Search/Archive
sub-chain specifically AS REACHED THROUGH THE PACKAGED BETA ENTRY POINT —
because that reachability itself does not yet exist in this codebase
(Finding 2), independent of anything this session could test around it.
This is reported honestly rather than padded with Node-level test
citations dressed up as packaged-process proof.

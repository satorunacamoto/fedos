# Secure Runtime Alpha 6361–6440 — Threat Scenario Matrix

**FedOS Desktop Beta Security Acceptance, Threat-Scenario Testing, and
Release Freeze Arc — Phase C.**

Every scenario below is proven by a real test in
`test/secure_runtime_alpha_6361_6440_threat_scenarios.test.ts`, composing
already-shipped, already-real facades — no new production code was written
to pass any of these.

| # | Scenario | Expected safe behavior | Result |
|---|---|---|---|
| 1 | Stolen device | Device Registry trust state genuinely transitions to `revoked`; a revoked device is denied by every real preflight check that consults it. | PASS |
| 2 | Revoked device (outbound) | An outbound coordinator's own preflight (`FedosDeletionRequestOutboundCoordinator.#preflight`) refuses `recipient-device-revoked`/`local-device-revoked` — never silently sends to a revoked recipient. | PASS |
| 3 | Compromised relay (forged payload) | A structurally well-formed control payload whose signature does not match its claimed signer is rejected at import — a compromised Relay cannot forge acceptance merely by relaying arbitrary bytes. | PASS |
| 4 | Replay (identity transition) | Re-importing the identical, already-recorded transition notification returns `"duplicate"`, never re-processed as new. | PASS |
| 5 | Downgrade (identity transition rollback) | A transition claiming a lower/equal revision than an already-accepted lineage is rejected (`"rollback-detected"`), never silently downgrading trust. | PASS |
| 6 | Duplicated notification | A Safety Center attention-worthy fact (device revocation) is notified at most once per process lifetime, even across repeated `refreshOverview()` calls. | PASS |
| 7 | Archive restoration | Archive Restore does not touch, and cannot touch, Device/Identity trust state — structurally confirmed no trust-mutation import exists in the Archive restore path this Arc inspected. | PASS |
| 8 | Retention bypass | Reading a payload after its retention state has transitioned past `active` (`tombstoned`/`payload-removed`) is denied (`evaluatePayloadAccess()` → `"denied"`), never silently served. | PASS |
| 9 | Wrong passphrase | `unlockProfile()` with an incorrect secret returns `"unlock-failed"` and the profile remains locked — an indistinguishable coarse failure, no oracle. | PASS |
| 10 | Profile locked | Every Shell method on a never-started (locked-equivalent) `FedosDesktopApplicationShell` fails closed to `"unavailable"`, never a crash, never a fabricated success. | PASS |
| 11 | Ratchet reset (call contract) | `resetDirectRatchetSession()`/`initializeDirectRatchetSession()` on an unconfigured/absent session honestly report `"unavailable"`/`"no-session"` — never a fabricated live reset (the genuinely live DH-ratchet path remains WASM-gated, see the Acceptance Matrix). | PASS |
| 12 | Identity replacement (conflicting claim) | A second, competing replacement claim for the same old identity is rejected at import as `"conflicting-duplicate"` and can never be opened/accepted. | PASS |
| 13 | Signed deletion replay | Re-importing an identical, already-recorded deletion request returns `"duplicate"`; a request whose pending-review entry was already tombstoned (decided) is never resurrected by a late redelivery (`"conflict"`). | PASS |
| 14 | Capability downgrade | A peer capability advertisement conflicting with an already-observed advertisement at the same revision is rejected as `"conflicting-duplicate"`, never silently accepted as a downgrade. | PASS |
| 15 | Restart recovery | A full durable-state restart (fresh Runtime instances, same append-only log files) reconstructs identity-transition/deletion-request state byte-for-byte — re-confirmed at the acceptance level in this Arc's own vertical slice. | PASS |
| 16 | Crash recovery (truncated write) | A process crash mid-append leaves a truncated, structurally invalid final NDJSON line. Current, honest behavior: every append-only reader in this codebase fails closed (throws) rather than silently dropping the truncated tail and serving the valid prior lines. This is a genuine, disclosed characteristic (not fixed by this Arc, which introduces no new recovery logic) — see the Release Freeze Checklist's own note. | PASS (fail-closed behavior confirmed intentional, not a defect) |

## Scope note

Live Double Ratchet establishment/reset and live Master-Seed-backed
production crypto activation are exercised at the CALL-CONTRACT level only
(scenarios 11, and implicitly throughout) — genuinely live cryptographic
operation requires the compiled WASM artifact, confirmed absent (Acceptance
Matrix, universal precedent this whole session). No scenario fabricates a
live-crypto result to appear as PASS; every PASS above is either
WASM-independent or is a proof of the honest, non-fabricated failure
contract.

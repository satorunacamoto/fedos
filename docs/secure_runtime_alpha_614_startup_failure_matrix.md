# Secure Runtime Alpha 614 — Startup Failure Matrix

Stage 14 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## The matrix, confirmed by real execution — including a deliberate, discovered asymmetry

| Case | Outcome | Why |
|---|---|---|
| Invalid board log | Hard fail — `startFedosDesktopRuntime()` rejects | `hydrateFedosBoardService()` (Alpha 318) throws unconditionally on a malformed line; `Host.start()` catches, sets `"failed"`, rethrows. |
| Invalid outbox log, `deliveryEnabled: false` | Clean success | Nothing reads the Outbox log at all when delivery never starts. |
| Invalid outbox log, `deliveryEnabled: true` | Hard fail | `outboxPersistence.listIntents()` (Alpha 418) throws unconditionally; hydration/Scheduler both call it directly, no `try`/`catch` anywhere on this path. |
| Invalid observation log | **Does NOT hard-fail**, even with `deliveryEnabled: true` and a real pending intent | Found by real execution, not assumed (Stage's own first draft test wrongly expected a throw). `hydrateFedosDeliveryRecoveryState()`'s own `historyForSafe()` (Alpha 585, inherited unchanged from the Alpha 581–600 Arc) catches a read failure PER INTENT and treats it as "no history" — the intent is simply retried, never blocking startup. |
| `deliveryEnabled: true`, no `observationLogPath` | Synchronous configuration error, before any Persistence backend is constructed | Alpha 609/610's own explicit validation. |
| `deliveryEnabled: true`, no `publisher` | Synchronous configuration error, before any Persistence backend is constructed | Alpha 610's own explicit validation. |
| `deliveryEnabled: false` | Clean success, no dependency on `observationLogPath`/`publisher` at all | Alpha 611. |
| `deliveryEnabled: true`, every dependency present | Clean success, delivery running | — |

## The Observation-log asymmetry, explained — not an inconsistency

This is a DELIBERATE design choice inherited from the prior Arc, not a
gap this Arc introduces or should "fix" for consistency's own sake:
Board log corruption threatens cross-record THREAD integrity (one
corrupt post can break reply-chains for others — Board hydration
correctly voids the whole result). Outbox log corruption threatens the
Scheduler's own ability to enumerate what to attempt at all — an
all-or-nothing read. Observation log corruption affects, at most, ONE
intent's own recovery-state derivation — Alpha 584's own "Fail Closed,
per intent" rule (re-confirmed correct here) isolates it: an unreadable
history is the SAME conservative default a never-attempted intent
already gets, so the SAFE outcome (retry) is preferred over a hard
stop that would block every OTHER, unrelated intent's own honest
recovery.

## No partial ready state, in every case

Confirmed: a rejected `startFedosDesktopRuntime()` call never returns
a `FedosRunningDesktopRuntime` handle — there is no observable
"half-started" runtime state a caller could accidentally interact with.

## See also

- `docs/secure_runtime_alpha_584_recovery_lifecycle_design.md`
- `docs/secure_runtime_alpha_607_board_persistence_wiring.md`
- `docs/secure_runtime_alpha_608_outbox_persistence_wiring.md`

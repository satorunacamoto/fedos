# Secure Runtime Alpha 501 — Existing Host and Delivery Boundary Inventory

Stage 1 of the Alpha 501–520 Durable Delivery Observation Wiring & Host
Delivery Lifecycle Arc. Review only.

## 1. `FedosDesktopHost` — current shape (Alpha 331–420, unchanged by this Arc)

- Constructor: `FedosDesktopHostDependencies { desktopApplication,
  boardPersistence, outboxPersistence? }` — `outboxPersistence` already
  OPTIONAL, defaulted in the constructor body to a fresh
  `InMemoryFedosBoardOutboxPersistence()` (Alpha 419) when omitted —
  the precedent this Arc's own additions mirror exactly.
- Lifecycle: `#state: FedosDesktopHostState` (Alpha 333) — a CLOSED
  six-token union (`constructed`/`starting`/`ready`/`stopping`/
  `stopped`/`failed`), whose own doc states "`FedosDesktopHost`... is
  the ONLY place in this repository permitted to assign a value of
  this type" and enumerates its required/forbidden transitions
  exhaustively. This Arc does NOT add a seventh token or route delivery
  state through it — delivery status is tracked separately (Alpha 504).
- `start()`/`stop()`: each callable exactly once, from `"constructed"`/
  `"ready"` respectively; `stop()`'s own entire body — state transition
  plus clearing `#boardService`/`#boardQuery`/`#boardReader` — is
  confirmed UNCHANGED by this Arc (Alpha 511 re-verifies this
  mechanically).
- No Scheduler, Publisher, or Observation field of any kind exists on
  `FedosDesktopHost` today — confirmed by direct inspection, zero
  matches for `Scheduler|Publisher|Observation` anywhere in
  `fedos_desktop_host.ts`/`create_fedos_desktop_host.ts`.

## 2. The three pipeline pieces this Arc wires together (all Alpha 451–500, unchanged)

- `FedosPublishScheduler` (`src/board/outbox/fedos_publish_scheduler.ts`,
  Alpha 476) — `tick()` is PUBLIC specifically so a caller can drive one
  pass without a real timer (its own header, quoted). `start()`/`stop()`
  run their OWN internal `setInterval`, calling `void this.tick()`
  fire-and-forget — UNOBSERVABLE from outside: no caller can await a
  specific in-flight tick this way. This Arc therefore drives `tick()`
  directly (Alpha 504 §2), never calling `FedosPublishScheduler.start()`/
  `stop()` at all — leaving both completely unused-but-untouched by
  this Arc's own new code.
- `FedosNostrBoardPublisherAdapter implements FedosBoardOutboxPublisher`
  (Alpha 496) — a real, already-built Publisher this Arc's own default
  does NOT construct (no signing authority, no Relay URL exists at Host
  level — Alpha 502 decides the actual default).
- `FedosValidatingDeliveryObservationRepository` (Alpha 495) — the
  write boundary that already enforces the transition graph (Alpha
  494); this Arc constructs one internally from the RAW
  `FedosDeliveryObservationRepository` Host owns (Alpha 507), never
  bypassing it with a direct `FedosDeliveryObservationRepository.record()`
  call.

## 3. Ripple surface

`grep -c "new FedosDesktopHost("` across `test/` — every call site
supplies `FedosDesktopHostDependencies` as an object literal; none
constructs it via a helper that enumerates required keys exhaustively,
and no test asserts an exact `Object.keys(...)` count on either
`FedosDesktopHostDependencies` or `FedosDesktopHost`'s own prototype
(re-confirmed by direct search — zero matches). Adding OPTIONAL fields
and NEW methods is therefore backward compatible by construction, the
same conclusion Alpha 419 §"ripple" already reached for
`outboxPersistence`.

## 4. See also

- `docs/secure_runtime_alpha_419_host_submit_outbox_coordination.md`
- `docs/secure_runtime_alpha_497_scheduler_contract_rewiring.md`
- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`

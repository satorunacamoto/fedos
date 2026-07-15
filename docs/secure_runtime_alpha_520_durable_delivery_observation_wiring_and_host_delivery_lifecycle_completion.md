# Secure Runtime Alpha 520 — Durable Delivery Observation Wiring & Host Delivery Lifecycle Completion Declaration

Stage 20 (final) of the Alpha 501–520 Durable Delivery Observation
Wiring & Host Delivery Lifecycle Arc.

## 1. Completion declaration

Declared complete:

- **Host Construction** — `FedosDesktopHostDependencies` gains
  `publisher?`/`observationRepository?`/`deliveryIntervalMs?`, each
  defaulted inside the constructor exactly like `outboxPersistence`
  (Alpha 419); `createFedosDesktopHost()` passes all three through
  unmodified (Alpha 502/503/507).
- **Host Startup / Shutdown** — `startDelivery()`/`stopDelivery()`
  (Alpha 508/509), guaranteeing the required Scheduler停止 → tick終了
  待ち → Host停止 ordering via a new `FedosHostDeliveryController`
  (Alpha 504–506) that drives `FedosPublishScheduler.tick()` directly,
  never calling its `start()`/`stop()`.
- **Observation Repository Ownership** — `FedosDesktopHost` owns a
  `FedosDeliveryObservationRepository`; `observationQuery()` (Alpha
  510) is the canonical read boundary over it.
- **Scheduler Wiring** — `FedosPublishScheduler` receives the
  Host-owned `outboxPersistence`/`publisher`/`deliveryIntervalMs` at
  `startDelivery()` time; the Scheduler class itself is touched by
  ZERO bytes (Alpha 508, Alpha 519 confirms mechanically).
- **Delivery Lifecycle** — a real, end-to-end verified chain: `Host →
  Scheduler → FedosNostrBoardPublisherAdapter →
  FedosRelayNostrBoardPublisher → NullRelay → (bridged) →
  FedosValidatingDeliveryObservationRepository → Host.observationQuery()`
  (Alpha 513), both the accepted path and the failed path (Alpha 514),
  multi-intent isolation (Alpha 515), and independent-Host-instance
  isolation (Alpha 516) — all real classes, none mocked at the
  boundary this Arc's own instruction named.

## 2. Zero edits to any Publisher, Scheduler, Outbox, or canonical Contract file

Mechanically re-confirmed at Alpha 512 and Alpha 519: `git diff --stat`
is EMPTY for every file under `src/board/outbox/`,
`src/board/publish/`, and `src/board/observation/fedos_delivery_observation*.ts`
this Arc's own instruction protects. The only pre-existing files this
Arc modifies are `README.md` (52 insertions, 0 deletions),
`fedos_desktop_host.ts` (126 insertions, 0 deletions),
`create_fedos_desktop_host.ts` (19 insertions, 1 deletion — one
unavoidable reformat, behaviorally inert for every existing caller),
and two ripple-fixed pre-existing tests
(`secure_runtime_alpha_386`/`488`) whose own predicted fulfillment this
Arc IS.

## 3. Honest limitation discovered, not hidden

A retried delivery attempt for the SAME Outbox intent keeps genuinely
retrying transport (the injected `eventSource`/Publisher is called
again for real), but its SECOND `publishing`/terminal Observation pair
is rejected by the write validator as `"invalid-transition"` — Alpha
494's own single-attempt-per-subject model, adopted deliberately in
that earlier Stage, was never extended with an explicit attempt
identity. Recorded Observation history for one intent therefore does
not grow across delivery-loop retries today (Alpha 514 §"Discovered
consequence"). Named explicitly as real, undone work — not silently
worked around, not hidden from this declaration.

## 4. Verification

See `docs/secure_runtime_alpha_518_final_verification.md` for the full
record: `npm run typecheck` GREEN (one pre-existing, unrelated error
outside this Arc's own diff); this Arc's own 20 test files plus 2
ripple-fixed pre-existing files GREEN; full-repository `npm test` —
210 failed files / 320 failed tests out of 749/10,959, zero overlap
with this Arc's own files, re-confirmed after both ripple fixes; no
Rust file touched, `cargo check` not run; no generated artifact
present. Built entirely inside the dedicated, isolated git worktree and
branch (`worktree-alpha-491-500`) established for the Alpha 491–500
Arc and reused here.

## 5. Still out of scope (this Arc's own absolute prohibitions, honored throughout)

Retry algorithm changes, Publisher/Scheduler/Outbox/Contract
modification, a new outbound protocol, Ontology, `p2p/`, GUI, Web
Worker, Cloudflare (Workers/D1/KV/R2), and multi-attempt/retry-identity
Observation design (§3's own named gap, deliberately deferred again).

## 6. Next Arc recommendation

**Attempt-Identity Observation Design Arc** — resolves §3's own
discovered gap: extend the Delivery Observation model (or a
sibling/adapter over it) with an explicit attempt identity, so a
retried delivery attempt's own `publishing`/terminal pair can be
recorded without the current single-attempt-per-subject model
rejecting it — the one piece this Arc's own real, retrying Scheduler
integration surfaced as genuinely missing, not merely theoretical.

## 7. See also

- `docs/secure_runtime_alpha_501_existing_host_and_delivery_boundary_inventory.md`
  through `docs/secure_runtime_alpha_519_git_diff_confirmation.md`
- `docs/secure_runtime_alpha_500_publish_contract_reconciliation_completion.md`

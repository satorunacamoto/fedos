# Secure Runtime Alpha 503 — Default Publisher and Observation Repository Decision

Stage 3 of the Alpha 501–520 Durable Delivery Observation Wiring & Host
Delivery Lifecycle Arc.

## 1. Default `publisher`: `MockFedosBoardOutboxPublisher`

Options considered:

- **A real `FedosNostrBoardPublisherAdapter`, auto-constructed.**
  REJECTED: requires a live `FedosRelay` connection and a signed-event
  source (signing authority), NEITHER of which `FedosDesktopHost` owns
  or this Arc is authorized to add (Protocol追加禁止, no new
  dependency). Auto-connecting to a network relay inside a constructor
  default would also violate this repository's own "no I/O in
  construction" discipline every other Host default already honors.
- **No default — `publisher` becomes effectively required for
  `startDelivery()`.** REJECTED for the OPTIONAL field itself (Alpha
  502 already requires it stay optional for ripple safety), but this
  IS what happens in practice for real delivery — see §3.
- **`MockFedosBoardOutboxPublisher` (Alpha 473, already built).**
  ADOPTED. It already exists, is explicitly documented as safe for
  "tests and local prototypes," performs zero network/signing I/O, and
  mirrors `outboxPersistence`'s own `InMemoryFedosBoardOutboxPersistence()`
  default precedent exactly: every Host default in this file is
  in-memory/no-op unless a caller overrides it (Alpha 334 §3, Alpha 419
  both already established this pattern; this Arc continues it, not
  invents it).

## 2. Default `observationRepository`: a fresh, in-memory-backed `FedosDeliveryObservationRepository`

`new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence())`
— the SAME "default to the existing in-memory backend" pattern, reusing
Alpha 465's own already-built class unchanged. No durable backend
selection happens here — matches Alpha 334 §3's own explicit "no
durable backend selected" precedent for `boardPersistence`.

## 3. Consequence: the CONSTRUCTOR default never makes real delivery happen by accident

A `FedosDesktopHost` constructed with zero delivery-related overrides
and `startDelivery()` called on it will run a real Scheduler loop
against a real (in-memory) Observation Repository, but every `publish()`
attempt resolves via `MockFedosBoardOutboxPublisher`'s own scripted/
default `{ outcome: "delivered", retryPolicy: "never" }` — no network
call, no real transport, ever, unless a caller explicitly injects a
real `publisher`. This is a deliberate safety property: "no automatic
[real] delivery" by construction, not by a separate guard this Arc
would otherwise need to add.

## 4. See also

- `docs/secure_runtime_alpha_502_host_dependency_extension_decision.md`
- `docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md`

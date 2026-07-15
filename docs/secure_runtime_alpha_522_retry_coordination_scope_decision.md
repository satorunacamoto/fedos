# Secure Runtime Alpha 522 — Retry Coordination Scope Decision

Stage 2 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

## 1. Layering decision: everything lives in `src/board/observation/`, plus one internal rewiring of `FedosHostDeliveryController`

Four new files, all under `src/board/observation/` (Alpha 525–528),
plus a REWIRING of `FedosHostDeliveryController`'s own PRIVATE
persistence helper only (Alpha 529) — its public API
(`start()`/`stop()`/`tick()`/`isRunning()`) and its own
`FedosHostDeliveryControllerDependencies` interface are BOTH
byte-for-byte unchanged.

## 2. Why `FedosDesktopHost` needs no PUBLIC API change (satisfying "Host API変更禁止" at the API surface, not the file)

`FedosDeliveryRetryQuery` (Alpha 528) requires nothing but a
`FedosDeliveryObservationQuery` — the EXACT object
`Host.observationQuery()` (Alpha 510, unchanged) ALREADY returns. A
caller constructs `new FedosDeliveryRetryQuery(host.observationQuery()!)`
directly, with zero read-side Host involvement.

Originally this section claimed `FedosDeliveryRetryRegistry` (Alpha
527, the write-time attempt-number allocator) would be constructed and
owned PRIVATELY inside `FedosHostDeliveryController`, needing no Host
involvement at all, and that `git diff --stat --
src/desktop/host/fedos_desktop_host.ts` would stay EMPTY for this
entire Arc. Alpha 531's own ripple/verification work found this
INCOMPLETE: see the correction below.

### Correction (found during Alpha 531 ripple/verification, not hidden)

A per-controller-instance `FedosDeliveryRetryRegistry` is wrong: `Host.startDelivery()`
constructs a FRESH `FedosHostDeliveryController` on every call, so a
`stopDelivery()` → `startDelivery()` cycle for a still-pending intent
reset attempt numbering to 1, colliding with the already-terminal
attempt-scoped subject from before the restart, and every retry write
after that was silently rejected by the (correct, unchanged) Alpha 495
validator as `invalid-transition` — a real, previously-latent bug,
found by ripple-testing the pre-existing Alpha 505/510/513/514/515/516
tests against this Arc's new code, not by design.

Fix: `FedosDesktopHost` gained ONE new private field,
`#deliveryRetryRegistry: FedosDeliveryRetryRegistry`, constructed once
per Host instance and threaded into every `FedosHostDeliveryController`
`startDelivery()` constructs (via the controller's new optional
`retryRegistry?` dependency, defaulted if omitted — Alpha 529).
`git diff --stat -- src/desktop/host/fedos_desktop_host.ts` is
therefore NOT empty for this Arc. It is still true, and still the
point of this section, that "Host API変更禁止" is satisfied: no public
method signature, return type, or externally-observable behavior of
`FedosDesktopHost` changed — `start()`, `stop()`, `startDelivery()`,
`stopDelivery()`, `deliveryStatus()`, and `observationQuery()` are all
byte-for-byte unchanged in shape. Only a private field needed to persist
across restart cycles, which is state, not API.

## 3. Why `FedosPublishScheduler` needs ZERO changes ("Scheduler変更最小" satisfied at its own minimum)

Every fact this Arc's retry coordination needs — attempt boundaries,
terminal outcome, finality — is ALREADY present, unchanged, in
`entry.observations`' own exact shape (Alpha 521 §3). Zero satisfies
"最小" (minimal) at its own floor; no Scheduler edit is even attempted.

## 4. Why the fix lives at the SUBJECT-IDENTITY layer, not the transition-graph layer

Considered and REJECTED: loosening `isAllowedFedosDeliveryObservationTransition`
(Alpha 494) to permit `terminal → publishing` for a NEW attempt.
Rejected because it would require a new field on
`FedosDeliveryObservation` itself (an attempt marker) to distinguish
"this publishing observation starts a legitimate NEW attempt" from
"this publishing observation is illegally re-entering a closed
subject" — Alpha 494/495 stay byte-for-byte unchanged instead;
`FedosDeliveryObservationSubjectId` itself is redefined, PER CALLER
CONVENTION ONLY (never inside `fedos_delivery_observation.ts`), to mean
"one delivery ATTEMPT" rather than "one delivery intent" — Alpha 525's
own `makeFedosDeliveryAttemptSubjectId` is the ONE place this
convention is established.

## 5. See also

- `docs/secure_runtime_alpha_521_retry_coordination_inventory.md`
- `docs/secure_runtime_alpha_510_host_delivery_status_and_observation_query.md`

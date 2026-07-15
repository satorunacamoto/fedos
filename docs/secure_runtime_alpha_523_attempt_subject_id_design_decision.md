# Secure Runtime Alpha 523 — Attempt Subject ID Design Decision

Stage 3 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

## 1. Shape adopted

`${originalSubjectId}::attempt::${attemptNumber}` — reuses the `::`
separator convention `makeFedosBoardOutboxId` (Alpha 413) and
`makeFedosDeliveryObservationId` (Alpha 462) already established.
`attemptNumber` is a positive integer (`>= 1`), never `0`, matching
this Arc's own natural "first attempt is attempt 1" vocabulary.

## 2. Determinism and parseability

`makeFedosDeliveryAttemptSubjectId(original, attempt)` is a pure
function — the SAME pair always yields the SAME attempt subject id.
`parseFedosDeliveryAttemptSubjectId()` is its exact inverse, anchored
to the STRING'S OWN END (`/^(.+)::attempt::(\d+)$/`) so an
`originalSubjectId` that itself happens to already contain `::` (e.g.
an Outbox intent id, `postId::protocol::destination`, Alpha 413) is
still parsed correctly — the regex is greedy on the prefix, matching
only the FINAL `::attempt::N` suffix.

## 3. Options rejected

- **A numeric field added to `FedosDeliveryObservation` itself.**
  Rejected — Alpha 462 stays unchanged (Alpha 522 §4).
- **A separate `Map<subjectId, attemptNumber[]>` index, stored
  durably.** Rejected — would need its own persistence port, its own
  backend, and its own restart-recovery story; the STRING-identity
  approach needs none of that, since the attempt-scoped subject id
  itself already IS the durable key the existing, unchanged
  `FedosDeliveryObservationRepository` stores under.
- **A GUID/random attempt token.** Rejected — this repository's own
  "no randomness in id derivation" discipline
  (`makeFedosBoardOutboxId`'s own Alpha 413 rationale, quoted
  verbatim: "no randomness, no clock read") applies here identically;
  a random token would also make `historyFor()`'s own sequential
  1,2,3,… walk (Alpha 528) impossible without an external index.

## 4. See also

- `docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md`
- `docs/secure_runtime_alpha_413_outbox_identifier_target_model.md`

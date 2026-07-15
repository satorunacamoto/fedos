# Secure Runtime Alpha 484 — Publisher/Outbox Mutation Boundary Review

Stage 4 of the Alpha 481–490 Publish Pipeline Integration Review Arc.
Review only.

## 1. Question

Does any Publisher — or the Scheduler that drives one — rewrite the
Outbox itself (`putIntent`, or any other mutation of a persisted
`FedosPersistedBoardOutboxRecordV1`)?

## 2. Finding: no. Confirmed by both import analysis and call-site inspection

- `fedos_board_outbox_publisher.ts` (generic Publisher + Mock) imports
  only the CODEC type (`FedosPersistedBoardOutboxRecordV1`), never
  `FedosBoardOutboxPersistence` itself — it has no handle to call
  `putIntent` on even if it wanted to.
- `src/board/publish/nostr/*` (Nostr-specific Publisher) imports only
  Outbox TYPES (`FedosBoardOutboxIntent`), never the codec or
  persistence port.
- `fedos_publish_scheduler.ts` DOES import `FedosBoardOutboxPersistence`
  — but calls exactly one of its three methods, `listIntents()` (a
  read). It never calls `putIntent`. "Delivered"/"abandoned" state is
  tracked entirely in the Scheduler's OWN private `#delivered`/
  `#abandoned` `Set`s, never written back to Outbox storage — the
  persisted Outbox record for a delivered post remains, byte-for-byte,
  exactly as `DesktopHost.submitPostWithOutbox()` first wrote it,
  forever.

`test/secure_runtime_alpha_484_...test.ts` confirms all of the above
mechanically against real source text.

## 3. Consequence worth naming (not a violation, a design implication)

Because the Outbox record is never updated with a delivery outcome,
"is this post delivered yet" is answerable ONLY by consulting the
Scheduler's own in-memory `observationLog()` (lost on process restart —
Alpha 481 §4 already names this as an Observation-storage responsibility
the Scheduler currently holds itself) or a durable Observation store
(only `FedosDeliveryObservation`'s Repository is durable today, and it
is not wired to the Scheduler at all — Alpha 481/485). There is
currently no way, after a restart, to ask "what happened to Outbox
intent X" and get a real answer from any committed code path.

## 4. See also

- `docs/secure_runtime_alpha_481_publish_pipeline_separation_of_concerns_review.md`
- `docs/secure_runtime_alpha_412_outbox_responsibility_decision.md`
- `docs/secure_runtime_alpha_417_outbox_persistence_port_memory_backend.md`

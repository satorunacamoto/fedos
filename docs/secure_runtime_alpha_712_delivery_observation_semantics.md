# Secure Runtime Alpha 712 — Delivery Observation Semantics

Stage 12 of Phase B, the internal gate right after Alpha 710/711.

## Aligned facts

- `"queued"`/`"publishing"` — unchanged, genuinely supported (Alpha
  461–480, untouched).
- `"sent"/"accepted"` — when wired with `FedosRelayOkCorrelatedNostrBoardPublisher`,
  `"delivered"` in `FedosBoardOutboxPublishResult` (the existing outcome
  name, unchanged — Alpha 497's own `"accepted" -> "delivered"` rename is
  reused verbatim) now genuinely means "the Relay sent back a matching OK
  with `accepted: true`," not merely "the local socket call returned."
  When wired with the older `FedosRelayNostrBoardPublisher` instead, the
  SAME outcome name continues to mean only "local send succeeded" — the
  meaning is a property of which Publisher class a Local Runtime chose,
  documented in each class's own header (Alpha 710).
- `"rejected"` — NOT produced by any code path this Arc ships (see Alpha
  711's disclosed limitation) — a Relay `accepted: false` still surfaces
  as `"failed"`, exactly as it did before this Arc.
- `"failed"` — unchanged: local signing failure, transport throw, or a
  timed-out OK correlation.

## No canonical vocabulary change

`FedosBoardOutboxPublishResult`'s own `outcome`/`retryPolicy` fields
(Alpha 473) are byte-for-byte unchanged. The transition validator
(wherever Observation enforces state-machine legality) was not touched
and needed no change — every outcome this Arc's code can ever produce was
already a legal one before this Arc.

No arbitrary Relay text is ever stored — `message` from an inbound OK/
NOTICE is read only to decide `accepted`/ignore, never persisted into
Observation.

Per this Alpha's own instruction ("if canonical vocabulary must change,
stop and perform a formal ripple review"): no change was needed, so no
ripple review was opened.

# Secure Runtime Alpha 485 — Observation/Publisher Awareness Review

Stage 5 of the Alpha 481–490 Publish Pipeline Integration Review Arc.
Review only.

## 1. Question

Does either Observation vocabulary know about, import, or reference a
Publisher?

## 2. Finding: no, for both

- `src/board/outbox/fedos_board_outbox_observation.ts` imports only
  `FedosBoardOutboxId` (a type, from `./fedos_board_outbox_types.js`).
  Zero reference to `FedosBoardOutboxPublisher`,
  `FedosNostrBoardPublisher`, or any Publisher-shaped identifier.
- `src/board/observation/fedos_delivery_observation.ts` has ZERO
  imports of any kind (already re-confirmed by this Arc's own prior
  Alpha 468 guard — re-checked here directly against current source,
  not merely cited).

`test/secure_runtime_alpha_485_...test.ts` confirms both mechanically.
This holds for the entire `src/board/observation/` directory, not just
the one foundational file — none of its six files reference
"Publisher" in any form (§1 of the test asserts this across all six).

## 3. Where "Publisher-awareness" actually lives instead

`FedosPublishScheduler` is the one place that knows about BOTH a
Publisher (`FedosBoardOutboxPublisher`, injected) and an Observation
constructor (`createFedosBoardOutboxObservation`) — it is the
INTEGRATION point, and correctly so: something has to witness a
Publisher's result and turn it into an Observation, and that is a
Scheduler-shaped responsibility, not an Observation-shaped one. The
dependency direction is Scheduler → { Publisher, Observation }, never
Observation → Publisher — the correct direction for keeping Observation
a passive, injectable-anywhere fact type.

## 4. See also

- `docs/secure_runtime_alpha_481_publish_pipeline_separation_of_concerns_review.md`
- `docs/secure_runtime_alpha_468_security_regression_guards.md`

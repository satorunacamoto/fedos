# Secure Runtime Alpha 609 — Delivery Observation Persistence Decision

Stage 9 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## Confirmed: exactly one implementation exists

Repository-wide search confirms `InMemoryFedosDeliveryObservationPersistence`
(Alpha 465) is the ONLY class implementing `FedosDeliveryObservationPersistence`
(Alpha 464) anywhere in `src/`.

## Options compared

- **B. In-memory only, production caller anyway.** Rejected — this
  would silently defeat the ENTIRE point of the Alpha 581–600 Durable
  Retry Registry & Delivery Recovery Arc: `hydrateFedosDeliveryRecoveryState()`
  reads exactly this backend; an in-memory one loses everything on
  every real process exit, making "recovery" a lie the moment this
  Arc's own runtime is the thing that restarts. Exactly the "嘘の耐久性
  を宣言しない" this Stage's own instruction forbids.
- **C. Delivery permanently disabled.** Rejected — too broad a
  concession; delivery CAN be made honest with a small, in-scope,
  precedented addition (below), so disabling it entirely is not
  necessary.
- **D. Defer to a separate Arc.** Rejected — this Arc's own Objective
  explicitly includes "Retry / Abandonment" and "Recovery Hydration"
  among the foundations it is meant to give a real local caller; giving
  it one while KNOWINGLY wiring a fake-durable Observation backend
  underneath is the specific dishonesty this Stage's own instruction
  names.
- **A. Add a minimal append-only durable backend, this Arc, mirroring
  the ALREADY-established pattern.** Chosen.

## Decision: A, implemented as `AppendOnlyFedosDeliveryObservationPersistence`

`src/board/observation/append_only_fedos_delivery_observation_persistence.ts`
— field-for-field identical strategy to `AppendOnlyFedosBoardOutboxPersistence`
(Alpha 418, UNCHANGED, used as the direct template): one JSON-Lines
record per line, `node:fs` only (no new dependency), replay-on-every-call
reading, fail-closed on a corrupt/conflicting line (throws,
unconditionally — no auto-repair), no default path. Implements
`FedosDeliveryObservationPersistence` (Alpha 464, UNCHANGED) verbatim —
no new method, no port change. This is a NEW backend behind an
UNCHANGED interface — it does not touch Retry semantics, Scheduler
semantics, or the canonical Observation state model (all explicitly
prohibited from modification by this Arc), exactly as the Board/Outbox
append-only backends already coexist with their own unchanged ports.

## Runtime policy adopted (Alpha 611 wiring point)

`deliveryEnabled: false` → the runtime starts with NO Observation
backend requirement at all (`observationLogPath` stays optional, Alpha
603). `deliveryEnabled: true` → `observationLogPath` becomes REQUIRED;
its absence is a startup-time configuration error (fail closed, Alpha
614), never a silent fallback to the in-memory implementation.

## See also

- `docs/secure_runtime_alpha_418_append_only_durable_outbox.md`
- `docs/secure_runtime_alpha_603_local_runtime_configuration_model.md`
- `docs/secure_runtime_alpha_611_delivery_activation_policy.md`

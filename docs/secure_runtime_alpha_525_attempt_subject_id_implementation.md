# Secure Runtime Alpha 525 — Attempt Subject ID Implementation

Stage 5 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

**Status: this Stage IMPLEMENTS.** One new file:
`src/board/observation/fedos_delivery_attempt_subject_id.ts`.

## What was implemented

```ts
export function makeFedosDeliveryAttemptSubjectId(
  originalSubjectId: FedosDeliveryObservationSubjectId,
  attemptNumber: number,
): FedosDeliveryObservationSubjectId | null

export function parseFedosDeliveryAttemptSubjectId(
  attemptSubjectId: FedosDeliveryObservationSubjectId,
): { readonly originalSubjectId: FedosDeliveryObservationSubjectId; readonly attemptNumber: number } | null
```

Exactly as decided at Alpha 523 — pure, deterministic, fails closed to
`null` for a non-positive-integer `attemptNumber`, never throws. See
the file's own header for the full design record.

## What this Stage does NOT do

Does not modify `fedos_delivery_observation.ts` — `FedosDeliveryObservationSubjectId`
is imported as a type only, its own branding untouched.

## See also

- `docs/secure_runtime_alpha_523_attempt_subject_id_design_decision.md`

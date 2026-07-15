# Secure Runtime Alpha 474 — Retry Policy Model

Stage 4 of the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.

## 1. Candidates compared

- **Option A — exponential backoff (delay doubling per attempt, with a
  cap).** REJECTED outright — this Arc's own instruction explicitly
  prohibits it ("指数バックオフ禁止"), independent of any technical
  merit it might otherwise have.
- **Option B — a fixed numeric retry-delay field (e.g. `retryAfterMs`).**
  REJECTED: a numeric delay is still a scheduling policy the Scheduler
  would have to interpret and honor with its own clock/queue logic —
  exactly the complexity this Arc's own three-value constraint exists to
  avoid. It also lets a misbehaving `Publisher` stall the Scheduler
  arbitrarily by returning an enormous delay.
- **Option C — a closed three-value enum, `"immediate" | "later" |
  "never"`, with NO numeric component anywhere.** ADOPTED — matches this
  Arc's own required constraint exactly.

## 2. Semantics (binding on `FedosPublishScheduler`)

- **`"immediate"`** — worth exactly ONE additional same-`tick()`
  re-attempt of the identical intent. If that second attempt ALSO
  returns `"immediate"` on a non-`"delivered"` outcome, the Scheduler
  downgrades it to `"later"` before acting — a hard guardrail, not a
  Publisher-controlled choice, guaranteeing every `tick()` call performs
  at most two `publish()` calls per pending intent and always
  terminates. This is the ONE place this Arc imposes its own policy on
  top of the Publisher's own directive, and it is documented here
  precisely because it is the one deviation.
- **`"later"`** — the intent remains pending; the Scheduler takes no
  further action on it this `tick()`. The NEXT `tick()` call (driven by
  `intervalMs`, the Scheduler's own single cadence knob) will attempt it
  again. No delay, backoff, or scheduled-retry timestamp is computed,
  stored, or read anywhere.
- **`"never"`** — the intent is added to an in-memory abandoned set for
  the lifetime of the `FedosPublishScheduler` instance; every future
  `tick()` call filters it out of `listIntents()`'s own result before
  attempting anything. Nothing un-abandons it — there is no
  un-abandon/retry-override method in this Arc.

## 3. Why the Publisher decides, not the Scheduler

Only the `Publisher` (protocol-specific, e.g. a future
`FedosNostrBoardPublisher` adapter) can know whether a given failure is
transient (worth retrying) or permanent (e.g. the counterpart Relay
explicitly rejected the event) — the generic Scheduler has no protocol
knowledge to make that call itself. `FedosBoardOutboxPublishResult.retryPolicy`
is therefore always Publisher-supplied; the Scheduler's only judgment
call is the `"immediate"`-downgrade termination guardrail in §2.

## 4. Why `"never"` is not the same as `"delivered"`

An `outcome: "rejected"|"failed"` with `retryPolicy: "never"` is
recorded as an `"abandoned"` Observation (Alpha 475), distinct from
`"delivered"` — a future durable-Observation consumer must be able to
tell "this Board post was never actually delivered to this target" from
"this Board post reached this target," which a single combined
"stopped-processing" bucket would erase.

## 5. See also

- `docs/secure_runtime_alpha_472_scheduler_responsibility_decision.md`
- `docs/secure_runtime_alpha_473_publisher_interface_model.md`
- `docs/secure_runtime_alpha_475_outbox_observation_realization.md`

# Secure Runtime Alpha 566 — Abandonment Policy Decision

Stage 6 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## Options compared

- **Option A** (max attempt count): simple, deterministic, protocol-
  neutral. Requires a NUMBER.
- **Option B** (max elapsed time): also protocol-neutral, but requires
  a wall-clock read the Scheduler does not otherwise need per-intent,
  and interacts awkwardly with `intervalMs` (a slow interval makes
  "elapsed time" and "attempt count" diverge in a way this Arc has no
  evidence to calibrate).
- **Option C** (per-protocol limits): rejected outright — requires the
  Scheduler to branch on `intent.target.protocol`, violating its own
  HARD GUARDRAIL (no protocol-specific logic, Alpha 472/486) that this
  Arc's own instruction reaffirms ("Schedulerの実装にNostr分岐を入れない").
- **Option D** (Publisher returns abandon): rejected — conflates two
  separate concerns this Arc's own Alpha 569 explicitly requires kept
  separate: what ONE attempt's outcome was (Publisher's job) vs.
  whether to keep trying (a policy decision over the intent's WHOLE
  history, which no single `publish()` call can see).
- **Option E** (explicit policy injection, no shipped default) —
  chosen.

## Decision: Option E, with Option A's own shape as the ONE example implementation

`FedosDeliveryAbandonmentPolicy` (new file,
`src/board/outbox/fedos_board_outbox_abandonment_policy.ts`) is a pure,
OPTIONAL, injected `FedosPublishSchedulerDependencies.abandonmentPolicy`
field:

```ts
export interface FedosDeliveryAbandonmentPolicy {
  evaluate(input: {
    readonly outboxId: FedosBoardOutboxId;
    readonly completedAttempts: number;
    readonly latestOutcome: FedosBoardOutboxPublishOutcome;
  }): "retry" | "abandon";
}
```

`createFedosMaxAttemptsAbandonmentPolicy(maxAttempts: number)` is
provided as ONE concrete, Option-A-shaped implementation callers may
opt into — `maxAttempts` has NO default value in its own signature; a
caller cannot inherit an unjustified number by omission.

## Why no default number is shipped

This Arc's own instruction is explicit: "具体的なdefault回数は、既存決定
と実運用根拠を調査して選ぶ。根拠なしに3回や5回を決めない。" A real search
of this repository's own prior decisions
(`docs/secure_runtime_alpha_559_publish_runtime_recommendations.md`,
the Arc that FIRST named this work) found the number deliberately left
open — that Stage's own text: "decides and implements a bound on 'how
many times a crashing/malformed-response Publisher gets retried'" —
naming the QUESTION, not an answer. No other prior Stage anywhere in
this repository's own history commits to a specific retry-count bound
for ANYTHING resembling this decision (confirmed by a targeted search
across `docs/`, this Stage's own real research, not an assumption).
Inventing a number now, with no such precedent and no real production
traffic data (this whole pipeline has no wired production caller yet —
`docs/secure_runtime_alpha_543_publish_runtime_ownership_audit.md`),
would be exactly the unjustified magic-number decision this Arc's own
instruction forbids. A production default belongs to whichever future
Arc actually wires a real caller and can ground the number in real
observed failure/retry rates.

## Consequence

`FedosPublishScheduler` behaves BYTE-FOR-BYTE identically to before
this Arc when `abandonmentPolicy` is omitted (the default) — every
prior Arc's own tests that construct a Scheduler without this field
(the overwhelming majority) are unaffected. See
`test/secure_runtime_alpha_568_abandonment_enforcement.test.ts` §1.

## See also

- `docs/secure_runtime_alpha_565_retry_abandonment_inventory.md`
- `docs/secure_runtime_alpha_567_abandoned_state_decision.md`
- `docs/secure_runtime_alpha_568_abandonment_enforcement.md`

# Secure Runtime Alpha 572 — Multiple Intent Concurrency Review

Stage 12 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc. Review only — no code changed this Stage.

## Confirmed: single-flight serializes the WHOLE Scheduler, not per-intent

`#runTick()`'s own loop (Alpha 476, unchanged by this Arc):

```ts
for (const intent of pending) {
  entries.push(await this.#attemptIntent(intent));
}
```

processes every pending intent SEQUENTIALLY within one tick — Alpha
563's own single-flight guard adds a second layer of the SAME
property (no two ticks run concurrently), so, together, this repository
now guarantees at most ONE `Publisher.publish()` call in flight at any
moment, across the ENTIRE Scheduler, for the ENTIRE pending set.

## Options compared, for whether V1 (current, fully sequential) is acceptable

- **Intra-tick sequential** (current) — one intent at a time, one full
  tick before the next.
- **Intra-tick parallel** — `Promise.all()` over `pending`, bounded
  only by however many intents are pending.
- **Protocol-partitioned parallel** — one concurrent lane per
  `intent.target.protocol`.

## Decision: keep V1 unchanged this Arc

This Arc's own instruction is explicit: "このArcでは既存挙動を維持する。
新しい並列Publisherは実装しない." Confirmed by Alpha 577's own
performance review: a full tick over 1,000 pending intents (each
resolving near-instantly) still completes and delivers every one
exactly once, with no correctness concern found that would demand
concurrency to fix — the ONLY defect this whole Arc set out to close
was the ACCIDENTAL double-execution race (Alpha 561), not throughput.
Introducing intentional parallelism now would be a scope expansion this
Arc's own instruction explicitly forbids ("Board Runtime API、Private
Board、DM、Ontologyなどへは進まない" — the same "stay in scope" discipline
applies here).

## Documented for a future Arc, not built

A future "bounded concurrency" Arc could inject a
`maxConcurrentPublishes` (or similar) knob into `FedosPublishScheduler`,
processing `pending` in bounded batches via `Promise.all()` per batch —
protocol-partitioning specifically should stay OUT of the Scheduler
itself (per its own unchanged protocol-neutrality guardrail, Alpha
472/486) and, if ever wanted, belongs one layer up, at a caller that
constructs one Scheduler per protocol lane.

## See also

- `docs/secure_runtime_alpha_562_single_flight_semantics_decision.md`
- `docs/secure_runtime_alpha_577_performance_review.md`

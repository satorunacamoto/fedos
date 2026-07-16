# Secure Runtime Alpha 580 — Publish Scheduler Concurrency Safety & Abandonment Policy Arc Completion

Stage 20 (completion) of the Alpha 561–580 Arc.

## Objective, restated, and closed

Two Publish Runtime defects Alpha 541–560's own Operational Review Arc
demonstrated by real execution:

1. `FedosPublishScheduler.tick()` overlapping-call double-publish race —
   **CLOSED** (Alpha 563, single-flight; re-proven at both the raw
   Scheduler layer, Alpha 570/`test/secure_runtime_alpha_549_...test.ts`
   §1 updated, and the full real Host pipeline layer,
   `test/secure_runtime_alpha_570_...test.ts`).
2. A permanently-failing Publisher retried forever, with no explicit
   termination condition — **CLOSED, structurally, with no default
   number invented** (Alpha 566/568: an optional, injected
   `FedosDeliveryAbandonmentPolicy`; a caller who does not inject one
   gets the EXACT prior, unbounded-retry behavior, unchanged).

Board Runtime API, Private Board, DM, Ontology, GUI, Worker, Cloudflare
— none touched, confirmed by this Arc's own structural guards (Alpha
576) and compatibility review (Alpha 578).

## What is DONE

- Scheduler single-flight (`tick()`), guard released in `finally`,
  verified against real overlapping interval firings AND manual calls.
- Scheduler stop/shutdown barrier composed correctly with the
  pre-existing Controller-level barrier (Alpha 505/506), now
  exception-tolerant (`stop()` awaits SETTLEMENT, not success).
- Explicit, optional, protocol-neutral abandonment policy boundary,
  wired end-to-end through 100% pre-existing Observation/Retry
  machinery (Alpha 567's own "reuse, do not extend the canonical
  vocabulary" decision) — zero new Observation states, zero new
  Repository/Registry wiring.
- Nostr Publisher Adapter compatibility re-confirmed against the real
  Adapter/Relay stack, not merely mocked.
- Host lifecycle (`start`/`startDelivery`/`stopDelivery`/`stop`)
  re-confirmed compatible; `FedosDesktopHost` itself untouched.
- Five prior-Arc regression-guard tests, genuinely invalidated by this
  Arc's OWN intentional, in-scope changes, updated with explicit,
  scoped, commented exceptions rather than weakened silently (Alpha
  578's own full account).
- `npm run typecheck`: zero new errors (the one pre-existing error,
  documented since Alpha 560, unchanged).
- Scoped `npm test` sweep (`test/secure_runtime_alpha_4*`,
  `test/secure_runtime_alpha_5*`, plus this Arc's own new files): 165
  files / 896 tests, 152 files / 883 tests passing, the SAME 13
  pre-existing (environment-level, this worktree's own CRLF checkout
  artifact — Alpha 578) failures both before and after this Arc's own
  edits, zero new failures, zero new regressions.

## What is honestly NOT done (per this Arc's own instruction not to declare false completion)

- **Durable Retry Registry / delivered-state persistence:**
  `#delivered`/`#abandoned`/`#completedAttempts` and
  `FedosDeliveryRetryRegistry` itself all remain in-memory,
  per-Scheduler-instance. Alpha 573 confirms, by real execution, this
  is BROADER than originally scoped — even a same-process
  `startDelivery()`/`stopDelivery()` cycle re-attempts already-delivered
  intents, not merely a full process restart. A durable fix is
  explicitly out of this Arc's own scope (`FedosPublishScheduler`/
  `FedosHostDeliveryController` production-file boundary only).
- **Manual resume for an abandoned intent:** not built, per Alpha 568's
  own instruction ("手動再開APIはこのArcでは追加しない").
- **Bounded intra-tick concurrency:** deliberately not built (Alpha
  572) — V1 sequential processing is unchanged and was found adequate
  at the 1,000-intent scale this Arc tested (Alpha 577).
- **A production default `abandonmentPolicy`:** deliberately not
  shipped (Alpha 566) — no grounded number exists in this repository's
  own history to justify one.
- **Multi-process/distributed Scheduler ownership, Relay ACK-based
  abandonment:** never in scope for this Arc.

## Next Arc recommendation — ONE, per this Arc's own instruction

**A. Durable Retry Registry Persistence Arc.** Chosen over Candidate B
(Publish Pipeline Production Caller Wiring) and Candidate C (Board
Runtime Application API Foundation) because this Arc's own Alpha 573
finding sharpens `docs/secure_runtime_alpha_580...`'s own prior
condition precisely: wiring a real production caller (B) or building
the Application API (C) BEFORE `"delivered"`/`"abandoned"`/attempt-count
state survives a restart would mean the FIRST real production traffic
this whole pipeline ever serves inherits a re-delivery bug already
fully characterized and reproduced by this Arc's own test
(`test/secure_runtime_alpha_574_...test.ts` §2) — fixing it first is
strictly cheaper than after, the same standing principle Alpha 558/559
already established for this Arc's own two defects.

## Commit

One commit, per this Arc's own instruction:
`Add Secure Runtime Alpha 561-580: Publish Scheduler Concurrency and Abandonment Arc`.

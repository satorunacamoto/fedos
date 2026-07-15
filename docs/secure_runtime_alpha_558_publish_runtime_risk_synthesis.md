# Secure Runtime Alpha 558 — Cross-Cutting Risk Synthesis

Stage 18 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only. Ranks every finding from Stages 541–557 by severity,
using one consistent scale: **Active** (observably wrong today, in a
path something calls), **Latent** (real, reproducible, but only
reachable once a currently-unwired component is wired), **Structural**
(a design/architecture observation, not a bug).

## Active

None found. Directly follows from Alpha 541: nothing in the reviewed
stack runs in production today, so nothing can be actively wrong in
production today. This is itself worth stating plainly rather than
implying by omission.

## Latent — ranked by how little additional wiring is needed to make them Active

1. **Double-publish race (Alpha 549/550).** Requires only: a Publisher
   whose call duration exceeds `intervalMs`, and a Scheduler `start()`
   call. No Host wiring needed — reproducible with the Scheduler ALONE,
   today, exactly as its own test proves. **Highest priority** — the
   smallest wiring distance from "latent" to "active" of any finding in
   this Arc.
2. **Unbounded retry on a crashing Publisher (Alpha 551).** Same
   minimal-wiring bar as #1 — reproducible with the Scheduler alone.
3. **No restart recovery for delivery bookkeeping (Alpha 545/547).**
   Requires a durable Outbox backend PLUS a process restart — one step
   further than #1/#2 (needs a real backend choice, not just a
   Scheduler call).
4. **WebSocketRelay/timer resource leak on shutdown (Alpha 546/548).**
   Requires a full Host+Publisher+Scheduler wiring — the FURTHEST from
   active of the concrete latent findings, since it needs the most
   components connected before it can occur at all.
5. **PersistedFedosBoardRepository's weaker guarantees (Alpha
   553/555/557).** Requires a future Arc to deliberately choose it as
   `FedosBoardService`'s own injected repository AND a caller to use it
   directly, bypassing `FedosBoardService` — the least likely wiring
   path of any finding here, since Alpha 557 confirms the more obvious
   wiring (injection into `FedosBoardService`) does NOT reproduce it.

## Structural (no severity ranking — design observations, not defects)

- Two Publisher families, two Observation vocabularies, unreconciled
  (Alpha 553, restated from the prior review).
- `desktop()`'s un-narrowed API surface (Alpha 556) — an asymmetry, not
  a proven risk.
- No seventh `FedosDesktopHostState` token exists for "ready +
  delivering," and none should be added (Alpha 544/557) — a
  confirmation of correct current design, listed here for completeness.

## The one connecting thread across every Latent finding

Every Latent finding (1–5) becomes reachable through the SAME single
event: a future Arc wires `FedosPublishScheduler` (and, downstream, a
real Publisher) under `FedosDesktopHost`. **This makes that wiring Arc
the single highest-leverage point to close this Arc's own findings —
fixing #1/#2 (the Scheduler's own reentrancy gap and unbounded-retry
gap) BEFORE that wiring Arc ships is strictly cheaper than fixing them
after**, since after-the-fact fixes would need to account for whatever
Host-side assumptions get built on top of the current, unfixed
behavior in the meantime.

## See also

- `docs/secure_runtime_alpha_541_publish_runtime_operational_review_inventory.md`
  through `docs/secure_runtime_alpha_557_publish_runtime_state_machine_contradiction_review.md`
- `docs/secure_runtime_alpha_559_publish_runtime_recommendations.md`

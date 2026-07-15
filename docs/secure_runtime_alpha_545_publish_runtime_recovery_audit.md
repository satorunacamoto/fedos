# Secure Runtime Alpha 545 — Recovery Audit

Stage 5 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only. What survives a real process restart, per component.

## Board

**Recovers fully**, and correctly, via `hydrateFedosBoardService`
(Alpha 318): deterministic, order-independent (sorted by id before
replay), bounded topological pass, fails closed (whole hydration
voided on any corrupt record or unresolvable thread integrity — never
a partial service). This is the ONE component in the entire reviewed
stack with a real, tested, restart-safe recovery path exercised by
`FedosDesktopHost.start()` itself.

## Outbox

**Partially recovers.** `AppendOnlyFedosBoardOutboxPersistence`
durably preserves every intent (replay-on-every-call, Alpha 542) — the
INTENTS themselves survive a restart intact. But nothing about "which
intents are already delivered" survives: that bookkeeping lives
entirely in `FedosPublishScheduler`'s own private, in-memory
`#delivered`/`#abandoned` `Set`s (Alpha 547), which start EMPTY on
every fresh Scheduler construction. **A real restart, with the
Scheduler wired to a durable Outbox backend, re-attempts publishing
every ALREADY-delivered intent from the beginning** — this is not
merely undocumented, it is the direct, mechanical consequence of the
Scheduler never reading Observation history at construction time
(re-confirmed live, `test/secure_runtime_alpha_545_...test.ts` §1,
constructing a fresh Scheduler over a persistence pre-loaded with an
intent and confirming `tick()` attempts it exactly as if never seen).

## Observation

**The durable vocabulary (`FedosDeliveryObservation`) recovers fully**
— its own Repository/Persistence are durable-backend-capable and
unconnected to anything that would lose data on restart. **The
in-memory vocabulary (`FedosBoardOutboxObservation`) recovers nothing**
— it exists ONLY inside the Scheduler's own `#observationLog`, which is
lost with the process. Since the durable vocabulary is never actually
fed by the Scheduler (prior review's own Alpha 481 §4 finding,
unchanged), the PRACTICAL recovery story for "what happened to this
delivery" is: **nothing recovers**, today, end to end.

## Publisher

Stateless by design (both families) — nothing to recover. Not a gap.

## Host / DesktopApplication

`FedosDesktopHost` itself has no persisted state of its own beyond what
Board/Outbox Persistence already provide — a fresh `FedosDesktopHost`
instance, `start()`ed again with the SAME injected Persistence
backends, recovers Board state correctly (§ above) and recovers Outbox
INTENTS correctly, but (per the Scheduler finding above) recovers no
delivery-outcome state. `DesktopApplication.bootstrap()`/
`refreshPublicIdentity()` re-run their own underlying Identity/Runtime
recovery paths on every `start()` call — out of this Arc's own scope
(Runtime/Identity, Alpha 050–065, untouched).

## Summary table

| Component | Survives restart? |
|---|---|
| Board posts + thread/source indices | Yes, fully |
| Outbox intents (durable backend) | Yes, fully |
| Outbox delivery/retry bookkeeping | **No** — Scheduler-private, in-memory only |
| Durable Observation records | Yes, fully (but nothing writes them yet) |
| In-memory Observation log | No — by design, Alpha 475's own stated scope |
| Publisher state | N/A — stateless |

## See also

- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
- `docs/secure_runtime_alpha_547_publish_runtime_memory_audit.md`

Note: a separate, unmerged design review on branch
`worktree-publish-pipeline-host-ownership-review` (its own doc `06`)
already proposed a durable-Observation-wiring design addressing part of
this Stage's own finding — cited in prose above as prior art, not
linked here since that branch is not part of this Arc's own committed
tree.

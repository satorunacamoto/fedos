# Secure Runtime Alpha 7561-7640 — Scheduler Lifecycle Document

FedOS Conversation Outbox Restart Hydration and Scheduler Scalability Arc — Phase H,
plus a concise restatement of the full construction/start/stop lifecycle for reference.

## Lifecycle, as it exists after this Arc's change

1. A profile is unlocked -> `FedosProfileInitializationCoordinator` builds
   `FedosDesktopRuntimeConfig` -> `startFedosDesktopRuntime()` constructs, when
   `config.privateTransportEnabled` is true, exactly one `FedosPrivateTransport`
   (`fedos_desktop_runtime.ts:1372`, the ONE production construction site, structurally
   enforced by `test/secure_runtime_alpha_1471_1540_structural_guards.test.ts`).
2. `FedosPrivateTransport`'s constructor (this Arc's own edit) builds one
   `FedosDeliveryObservationQuery`, one `FedosValidatingDeliveryObservationRepository`, one
   `FedosDeliveryRetryQuery` (new this Arc), calls
   `hydrateFedosConversationTransportDeliveryRecoveryState()` exactly once, then constructs
   exactly one `FedosConversationTransportScheduler` with `initialDelivered`/
   `initialAbandoned` seeded from that hydration result.
3. `FedosPrivateTransport.start()` connects every relay, then calls
   `this.#scheduler.start()`, which starts exactly one `setInterval` timer
   (`FedosConversationTransportScheduler.start()`, throws if called twice from the running
   state — unchanged, pre-existing guard, re-verified still present).
4. Every tick, `#runTick()` calls `listIntents()` (O(T), cheap — Phase G Part 3) and
   filters by the (now correctly hydrated, then live-updated as attempts complete)
   `#delivered`/`#abandoned` in-memory Sets, attempting only what remains.
5. `FedosPrivateTransport.stop()` stops the Inbound Subscription (if any), stops the
   Scheduler's timer, disconnects every relay. No state is written on stop — the durable
   Observation history already written during `start()`'s own tick cycles is the only thing
   the NEXT construction's hydration will read.
6. A disabled transport (`config.privateTransportEnabled` false/unset) never constructs a
   `FedosPrivateTransport` at all — confirmed unchanged, `fedos_desktop_runtime.ts:1302`'s
   own `if` gate — so "disabled transport remains explicit" (Phase D requirement) continues
   to hold with no code change needed.

No second Scheduler and no second timer are ever constructed anywhere in `src/` — verified
by the same structural-guard discipline already covering `FedosPrivateTransport`'s own
single construction site, and by direct repo-wide grep for
`new FedosConversationTransportScheduler` (exactly one match, inside `FedosPrivateTransport`
itself, unchanged by this Arc).

## Phase H — bounded index/cache decision

**Decision: no new in-memory pending index is added in this Arc.**

Phase H's own template anticipated the risk that `#runTick()`'s `listIntents()` call would
remain an O(T) bottleneck on every tick even after hydration, and offered a narrow
in-memory pending index (rebuilt from durable facts on every start, never persisted, never
the source of truth) as the remedy if so.

**This was checked directly and empirically (Phase G, Part 3) and found NOT to be the
bottleneck**: `FedosConversationTransportOutboxPersistence.listIntents()` measures
sub-millisecond even at T=100,000 (0.708 ms) — the Outbox layer itself is cheap and linear,
not the O(T)-per-tick risk Phase H's template was written to guard against.

**The real, measured bottleneck this Arc's own benchmarking discovered (Phase G, Parts 1-2)
is a different, deeper, and larger one**: `FedosDeliveryObservationQuery`/
`FedosDeliveryRetryQuery` (Board's own Alpha 467/528 machinery, reused unchanged) scan the
**entire Observation repository** on every per-subject history read, making both this Arc's
own hydration function AND the pre-existing `FedosValidatingDeliveryObservationRepository`'s
ordinary per-write staleness check cost O(historyBearingIntentCount²) — not O(T), and not
fixable by an Outbox-side pending index of any kind, since neither cost center (hydration
reads, per-write validation) touches the Outbox's `listIntents()` at all.

**Why a new index is not implemented here, precisely**:
1. It would not address the actual bottleneck found (an Outbox pending-index cannot make
   `FedosDeliveryObservationQuery.historyFor()` cheaper — that cost lives entirely inside
   the Observation layer, a different subsystem).
2. Phase H's own instruction is explicit: "Do not persist a new index in this Arc unless
   unavoidable." Given (1), building one here would be schedule/scope spent on a change that
   does not close the real gap this Arc's own measurement surfaced — the definition of
   avoidable.
3. The correct fix for the REAL bottleneck (indexing `FedosDeliveryObservationRepository`
   internally by `subjectId`, e.g. a `Map<subjectId, Observation[]>` maintained
   incrementally on every `record()` call) is a different, Board-and-Conversation-SHARED
   change, well outside "the narrowest high-precedence remediation" this Arc was scoped to
   implement, and risks exactly the kind of broad, under-time-pressure blast radius "One
   Arc, one primary implementation commit" is designed to prevent.

This decision, and the precise scope of the fix it defers, is carried forward as this Arc's
single recommended next Arc (see the completion declaration).

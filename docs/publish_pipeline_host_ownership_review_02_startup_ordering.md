# 02 — Startup Ordering

## Candidate under review

```
Host hydration -> DesktopApplication start -> Outbox/Observation hydration
  -> Scheduler construction -> Host ready -> explicit Scheduler start
```

## Finding: the candidate's own "Outbox/Observation hydration" step does not exist as a real operation today

`FedosBoardService` hydration (`hydrateFedosBoardService`, Alpha 318) is
a real, one-time, upfront rebuild: it replays a persistence log into an
in-memory Repository/index structure ONCE, at `start()` time — that is
why `FedosDesktopHost.start()` calls it explicitly as its own Step 2.

Neither Outbox nor Observation persistence works this way:

- `InMemoryFedosBoardOutboxPersistence`/`InMemoryFedosDeliveryObservationPersistence`
  are `Map`-backed directly — there is nothing to replay; `listIntents()`/
  `listObservations()` read the live `Map` on every call.
- `AppendOnlyFedosBoardOutboxPersistence` (Alpha 418) — the one durable
  Outbox backend that exists — does not hydrate once at construction
  either: its own `listIntents()` calls a private `replayLog()` helper
  that re-reads the append-only file **on every call** (confirmed by
  direct inspection of `append_only_fedos_board_outbox_persistence.ts`,
  whose own header states "same replay-on-every-call reading
  strategy"). There is no separate upfront hydration step to perform —
  the backend is self-hydrating per read.
- `FedosDeliveryObservationRepository.list()` (Alpha 466) reads
  `FedosDeliveryObservationPersistence.listObservations()` directly,
  with no secondary index of its own to rebuild.

**Revised ordering, reflecting this finding:**

```
1. state -> "starting"
2. Hydrate Board (existing, unmodified hydrateFedosBoardService call)
3. Construct FedosBoardQuery (existing, unmodified)
4. await DesktopApplication.start() (existing, unmodified)
5. Construct the Scheduler: new FedosPublishScheduler({
     outboxPersistence: this.#outboxPersistence,   // already owned
     publisher: <composite over the injected registry>,
     intervalMs, now, setIntervalFn, clearIntervalFn  // pass-through
   })
   -- no "Outbox/Observation hydration" step is inserted, because none
   is needed with any backend that exists today (§ above). If a FUTURE
   Outbox backend ever needs real upfront hydration, its own owner
   would add a step here explicitly, symmetrically with Step 2 -- this
   review does not invent one prematurely.
6. Assign #scheduler, #observationRepository, #publisherRegistry;
   state -> "ready"
7. (separate, explicit call) host.startDelivery() / equivalent ->
   this.#scheduler.start()
```

## Auto-start vs. explicit start — recommendation: explicit, matching every existing precedent

Every lifecycle-owning object in this codebase already follows
"construct now, start explicitly later, never both at once":
`DesktopApplication` (constructor "performs NO async work... `start()`
(below) is the sole place"), `FedosDesktopHost` itself (identical
language, `fedos_desktop_host.ts:85-92`), and `FedosPublishScheduler`
itself (`fedos_publish_scheduler.ts`'s own guardrail: "The constructor
never starts a timer, never calls `Publisher`, never reads the
Outbox"). Auto-starting the Scheduler as part of `Host.start()` would
be the FIRST place in this codebase's own history that a `start()` call
transitively starts a SECOND independent timer-driven loop the caller
did not explicitly ask for — a meaningfully different risk profile than
hydrating a Board or awaiting one `DesktopApplication.start()` call,
since a running Scheduler immediately begins calling an
externally-visible Publisher on a recurring cadence.

**Recommendation: `Host.start()` reaching `"ready"` does NOT
auto-start the Scheduler.** `state() === "ready"` means "the Host and
its owned dependencies are constructed and reachable," matching the
EXISTING meaning of `"ready"` exactly (Board/Query/DesktopApplication
are all live by then, but nothing about `"ready"` today implies
"actively doing background work" — `submitPost()` is caller-driven, not
automatic). A separate, explicit method (see Alpha 05 for its exact
shape) starts delivery. This also keeps `Host.start()` deterministic
and side-effect-scoped to what Alpha 382/383/384 already established:
one `try` block, one clear failure boundary — adding an unconditional
Scheduler `start()` inside it would put a RECURRING background timer
behind the SAME single failure boundary as one-time hydration, which
Alpha 04 (this review) argues against directly.

## See also

- `docs/publish_pipeline_host_ownership_review_01_ownership_matrix.md`
- `docs/publish_pipeline_host_ownership_review_04_failure_isolation.md`
- `docs/secure_runtime_alpha_418_append_only_durable_outbox.md`

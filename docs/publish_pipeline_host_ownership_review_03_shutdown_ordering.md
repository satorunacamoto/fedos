# 03 — Shutdown Ordering

## Candidate under review

```
new work停止 -> scheduler停止 -> in-flight publish -> observation flush
  -> Host stopped
```

## Does `flush`/`await` exist in the current implementation? — No, confirmed by direct inspection

`FedosDesktopHost.stop()` (`fedos_desktop_host.ts:349-358`) is declared
`async stop(): Promise<void>` but contains **zero internal `await`** —
it only checks `#state === "ready"`, transitions
`"stopping" -> "stopped"`, and nulls three fields. Its own header states
this explicitly: "`stop()` performs ONLY lifecycle-state closure...
never a fabricated close call on an object that has none," because
"NEITHER `DesktopApplication` nor `FedosBoardService` nor
`FedosBoardQuery`... exposes a dispose/close method of any kind today."
There is no flush, no drain, no wait-for-in-flight-work anywhere in the
current shutdown path — there is currently nothing WITH in-flight work
for it to wait for (Board/Query are pure in-memory reads by the time
`stop()` runs).

This changes materially once a Scheduler is owned: a `tick()` call has
a real `Promise` in flight (it awaits `Publisher.publish()`, per
protocol/network I/O, possibly for a nontrivial duration). Stopping the
Host while a `tick()` is mid-flight, unhandled, risks: (a) a Publisher
call whose result never gets a chance to become an Observation, (b) an
Outbox intent whose Scheduler-side `#delivered`/`#abandoned` bookkeeping
never gets updated for this attempt, silently re-attempting it on a
future Scheduler start.

## Recommended shutdown sequence

```
1. state -> "stopping" (existing token, unchanged meaning)
2. New work stops FIRST: this.#scheduler?.stop() -- FedosPublishScheduler.stop()
   is ALREADY idempotent and synchronous (clears its own setInterval
   handle; see fedos_publish_scheduler.ts:144-150) -- this immediately
   prevents any NEW tick() from being scheduled. It does NOT cancel a
   tick() already in flight -- FedosPublishScheduler exposes no such
   cancellation, by design (Alpha 476's own scope).
3. In-flight publish: AWAIT any tick() Promise the Host itself is
   currently holding a reference to (see note below -- this requires
   Host to track its own "am I mid-tick" state, which the Scheduler
   itself does not expose today).
4. Observation flush: NOT a separate operation once Alpha 06's wiring
   (durable Repository, not the Scheduler's own private in-memory log)
   is in place -- FedosDeliveryObservationRepository.record() is
   already synchronous and durable-on-write (Alpha 466), so there is
   nothing buffered to flush AFTER Step 3 completes: every Observation
   from every awaited attempt is already durably recorded by the time
   Step 3's own await resolves. "Observation flush" as a DISTINCT
   Step 4 is only meaningful if the Repository/Persistence backend
   itself buffers writes (e.g. a future batched/async backend) -- this
   review does not assume one exists, so it folds Step 4 into Step 3's
   own await rather than inventing a separate flush call against a
   synchronous API that has none.
5. state -> "stopped" (existing token, unchanged; existing #boardService/
   #boardQuery/#boardReader nulling unchanged; #scheduler/
   #observationRepository/#publisherRegistry references also nulled here)
```

## The real gap this ordering surfaces

`FedosPublishScheduler.tick()` (`fedos_publish_scheduler.ts:160-170`)
is `public` specifically so a caller can drive it directly, but
`start()` (the auto-timer path) only ever calls it as
`void this.tick()` — a FIRE-AND-FORGET call, with no `Promise` retained
anywhere the Scheduler itself exposes. **The Scheduler, as it exists
today, has no way for ANY caller — Host included — to await "the
currently in-flight tick, if any."** This is a genuine, concrete
missing piece Step 3 above depends on, not merely a Host-side design
choice: either (a) the Scheduler needs a NEW accessor exposing its own
current in-flight `tick()` `Promise` (a production change, out of this
review's own no-src-change scope, and therefore explicitly named as a
dependency for a future implementation Arc rather than resolved here),
or (b) Host tracks its own wrapper `Promise` by never calling
`scheduler.start()`'s own internal timer directly and instead driving
its OWN `setInterval`-equivalent that calls `scheduler.tick()` itself
and retains the `Promise` — trading the Scheduler's own `start()`/
`stop()` convenience for shutdown-await capability. Recommendation:
**(a)** — the Scheduler is the natural owner of its own in-flight state
and should expose it (e.g. `currentTick(): Promise<...> | null`) rather
than pushing that responsibility onto every caller that wants a clean
shutdown. Named as a real dependency for the "Publish Pipeline Host
Ownership" implementation Arc candidate (this review's own §11).

## See also

- `docs/publish_pipeline_host_ownership_review_02_startup_ordering.md`
- `docs/publish_pipeline_host_ownership_review_04_failure_isolation.md`
- `docs/publish_pipeline_host_ownership_review_11_deliverables_and_dependency_order.md`

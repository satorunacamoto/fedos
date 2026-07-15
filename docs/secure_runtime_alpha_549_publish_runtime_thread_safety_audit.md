# Secure Runtime Alpha 549 — Thread Safety Audit

Stage 9 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only. This repository runs on a single-threaded JavaScript/
TypeScript runtime (Node/Workers) — there is no OS-level thread
concurrency to review. "Thread Safety" is therefore reframed, honestly,
as **async-interleaving safety**: can two logically-concurrent
operations (overlapping `await` chains on the SAME event loop)
interleave in a way that corrupts state or double-executes an effect?

## Host: safe by construction

`FedosDesktopHost.submitPost()` performs its ENTIRE read-check-write
sequence (`previewRegistration` → `putPost` → `registerPost`) with
**zero `await`** — it is fully synchronous internally, so no other
code can run between its steps on a single-threaded event loop (the
method's own header already states this explicitly: "this repository's
execution model is single-threaded/synchronous with no `await` between
steps 1 and 3... structurally unreachable"). Re-confirmed this Arc.
`start()`/`stop()` each check `#state` synchronously before their first
`await` (`start()`) or perform no `await` at all (`stop()`), so two
concurrent `start()` calls cannot both pass the guard — the SECOND
call's own state check reads the state the FIRST call already wrote
before yielding to any `await`. **Safe.**

## Scheduler: a real, concrete interleaving risk found

`FedosPublishScheduler.start()` registers `() => { void this.tick(); }`
on a `setInterval`. `tick()` is `async`, awaits
`this.#publisher.publish(...)` per pending intent, and has **no
reentrancy guard of any kind** — no `#ticking` boolean, no check
against a `tick()` already in flight. Confirmed by direct inspection:
`tick()`'s own body never reads a field it does not also fully own for
the duration of one call, and nothing in `start()`/the timer callback
checks whether a PRIOR `tick()`'s own `Promise` has settled before
firing a new one.

**Concrete failure scenario, proven by real execution
(`test/secure_runtime_alpha_549_...test.ts` §1):** if a single
`Publisher.publish()` call takes LONGER than `intervalMs`, the timer
fires a SECOND `tick()` while the first is still awaiting the same
pending intent's own `#attemptIntent()` call. Because `#delivered`/
`#abandoned` are only updated AFTER an attempt's own `await` resolves
(`fedos_publish_scheduler.ts:188-193`), the SAME Outbox intent is
listed as "pending" by BOTH overlapping `tick()` calls' own
`listIntents().filter(...)` read, and `Publisher.publish()` is called
TWICE, concurrently, for the identical intent — a genuine double-publish,
not merely a double-observation. This is real and reproducible with the
CURRENT, unmodified code; it does not require any hypothetical future
change to trigger.

## Publisher: safe (both families), by having no shared mutable state

Neither `FedosBoardOutboxPublisher`-family implementations nor
`FedosNostrBoardPublisher`-family implementations hold any mutable
field that a concurrent call would race on (`FedosRelayNostrBoardPublisher`
holds only a `readonly #relay` reference; `MockFedosBoardOutboxPublisher`
is test-only and explicitly documents its own `#calls` array is for
test assertions, not runtime state a concurrent caller depends on).
Concurrent `publish()` calls to the SAME Publisher instance are
independent — the RISK is entirely upstream, at the Scheduler's own
call-fan-out (§ above), not inside any Publisher implementation.

## Observation: safe (both vocabularies) for the reason above, unsafe by omission for the same reason

`createFedosBoardOutboxObservation`/`createFedosDeliveryObservation`
are pure functions — no shared state, no race possible in isolation.
But `FedosDeliveryObservationRepository.record()`
(`src/board/observation/fedos_delivery_observation_repository.ts`) has
the SAME read-then-write shape Alpha 483 (prior review) already flagged
for a DIFFERENT reason (no transition-graph check) — it is ALSO, by the
same construction, safe against interleaving only because
`InMemoryFedosDeliveryObservationPersistence.putObservation()` itself
is synchronous; a future ASYNC durable backend (e.g. a real database
client) would need its own explicit ordering guarantee this review does
not assume exists.

## See also

- `docs/secure_runtime_alpha_551_publish_runtime_retry_semantics_audit.md`
- `docs/secure_runtime_alpha_395_host_write_api_implementation.md`

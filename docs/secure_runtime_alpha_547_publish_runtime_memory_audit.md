# Secure Runtime Alpha 547 — Memory Audit

Stage 7 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only. Catalogs every in-memory-only structure across the
reviewed stack — what is lost if the process dies with no durable
backend behind it, and, separately, what is lost EVEN WITH a durable
backend because the structure itself is never persisted at all.

## Catalog

| Structure | Owner | Durable alternative exists? | Notes |
|---|---|---|---|
| `InMemoryFedosBoardRepository` | `FedosBoardService` (default) | Yes — `FedosBoardPersistence` + hydration rebuilds it | Expected, correct: this is a CACHE rebuilt from durable Persistence at every `Host.start()`, not a primary store. |
| `InMemoryFedosBoardPersistence` | Whatever constructs it (Host default) | Yes — `AppendOnlyFedosBoardPersistence` | Caller's choice; in-memory is the DEFAULT when no durable backend is injected (Alpha 334's own documented default). |
| `InMemoryFedosBoardOutboxPersistence` | Host default (`#outboxPersistence`) | Yes — `AppendOnlyFedosBoardOutboxPersistence` | Same pattern. |
| `InMemoryFedosDeliveryObservationPersistence` | Whatever constructs a `FedosDeliveryObservationRepository` | Yes — the port (Alpha 464) accepts any backend; only the in-memory one is built so far | Same pattern, one layer newer. |
| `FedosPublishScheduler.#delivered` (`Set<string>`) | Scheduler instance | **No durable alternative exists or is wired** | Structural — Alpha 545's own recovery-gap finding. |
| `FedosPublishScheduler.#abandoned` (`Set<string>`) | Scheduler instance | **No durable alternative exists or is wired** | Same. |
| `FedosPublishScheduler.#observationLog` (`FedosBoardOutboxObservation[]`) | Scheduler instance | **No durable alternative wired** (a durable one — `FedosDeliveryObservation`'s Repository — exists but is unconnected, Alpha 545/550) | Alpha 475's own explicitly stated scope: "Deliberately NOT persisted this Arc." |
| `DesktopApplication.#currentPublicIdentity` | `DesktopApplication` instance | Out of this Arc's own scope (Identity/Runtime, Alpha 050–065) | Not reviewed further here. |

## The one real distinction this Stage draws

Every row in the FIRST group (Repository/Persistence caches) is
in-memory-only **by explicit caller choice** — a durable backend is one
constructor argument away, already built, already tested. Every row in
the SECOND group (`#delivered`/`#abandoned`/`#observationLog`) is
in-memory-only **by construction** — there is no constructor argument,
no injection point, no durable variant to opt into even if a caller
wanted one. This is the precise, mechanical distinction between "a
cache with a real backing store" and "the only copy of this data that
will ever exist." Alpha 545's recovery gap and this Stage's memory gap
are the SAME underlying fact, viewed from two different angles (what
survives a restart vs. what exists at all outside one process's own
heap).

## Not a leak by itself

None of these structures grows unboundedly UNLESS the number of
distinct Outbox intents ever registered grows unboundedly across a
single process's lifetime without ever being cleared — which, per
Alpha 07 of the (unmerged) Host Ownership Review's own finding
(intents are permanent, never deleted), is exactly what WILL happen
over a long-lived process's life: `#delivered`/`#abandoned` are
`Set`s that only ever grow, never shrink, for the lifetime of one
Scheduler instance. See Alpha 548 for whether this crosses from
"expected memory use" into "leak."

## See also

- `docs/secure_runtime_alpha_545_publish_runtime_recovery_audit.md`
- `docs/secure_runtime_alpha_548_publish_runtime_resource_leak_audit.md`

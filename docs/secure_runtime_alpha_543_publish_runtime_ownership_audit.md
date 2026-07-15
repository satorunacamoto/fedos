# Secure Runtime Alpha 543 — Whole-Stack Ownership Audit

Stage 3 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only.

## Ownership table

| Component | Owner today | Notes |
|---|---|---|
| Board core model | N/A (a value type, not owned) | `FedosBoardPost` etc. are plain data. |
| `FedosBoardRepository` (in-memory) | `FedosBoardService` (private field, default-constructed) | Never caller-visible directly. |
| `FedosBoardRepository` (persisted) | **NOBODY** — constructed only inside its own test suite | Confirmed, Alpha 542/555. |
| `FedosBoardService` | `FedosDesktopHost` (`#boardService`, assigned in `start()` from hydration) | Sole owner. |
| `FedosBoardPersistence` | `FedosDesktopHost` (`#boardPersistence`, constructor-injected) | Sole owner. |
| `FedosBoardQuery` | `FedosDesktopHost` (`#boardQuery`, constructed in `start()`) | Sole owner. |
| `FedosBoardOutboxPersistence` | `FedosDesktopHost` (`#outboxPersistence`, constructor-injected, defaulted) | Sole owner. |
| Publisher (either family) | **NOBODY** in production | Confirmed, prior review's own Alpha 488, re-confirmed unchanged this Arc. |
| `FedosPublishScheduler` | **NOBODY** in production | Same. |
| Observation (either vocabulary) | **NOBODY** in production for the durable one; the in-memory `FedosBoardOutboxObservation` log is owned by the (itself ownerless) Scheduler | Same. |
| `FedosDesktopHost` itself | **NOBODY** — confirmed by Alpha 541, zero production caller | New finding this Arc: ownership gap extends one level higher than the prior review scoped. |

## The ownership chain, as designed vs. as reachable

**As DESIGNED** (by the types/constructors themselves): Host → Board
Service/Query/Persistence/Outbox Persistence is a clean, single-owner
chain — no component here has an ambiguous or dual owner.
**As REACHABLE** (by what actually runs): the chain has no root. A
single-owner chain with no root is, in practice, an unexercised chain —
every guarantee downstream of Host (hydration ran, Query reflects
hydrated state, Outbox writes are coordinated with Board writes) is
proven only by test, never by a real process.

## Comparison with the (separately reviewed, unmerged) Host Ownership Review

The `worktree-publish-pipeline-host-ownership-review` branch's own
design review (not yet merged, reviewed here only as PRIOR ART, not
re-litigated) already proposed a resolution for the Publisher/Scheduler/
Observation half of this gap (Host owning a Publisher registry,
constructing the Scheduler, injecting an Observation Repository). It
did NOT address the finding this Stage adds: Host ITSELF has no
production caller, which no amount of internal Host redesign closes —
that requires a caller (Worker route or Desktop shell) this Arc does
not design (out of scope — this is a Review Arc).

## See also

- `docs/secure_runtime_alpha_541_publish_runtime_operational_review_inventory.md`
- `docs/secure_runtime_alpha_488_desktop_host_ownership_review.md`
- `docs/secure_runtime_alpha_555_publish_runtime_unnecessary_repository_review.md`
